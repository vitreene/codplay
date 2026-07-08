# Notes — délibération spec capsule (fusion et arbitrages)

Trace de travail de la fusion de `2026-07-08-capsule-spec.md` à partir des documents sources existants (capsule-distribution-spec, dedit-spec §8, sequence-editor-grid-spec, capsule-automation README, plan zones) et des arbitrages qui ont suivi. Le contenu normatif final vit dans la spec elle-même — ce document garde uniquement le POURQUOI et l'historique des décisions, pour référence.

## Incohérences relevées à la fusion (2026-07-08) et leur résolution

1. **Nommage `carrousel`/`carrousel`** — capsule-automation (code + README) utilisait l'orthographe française, sequence-editor-grid-spec l'anglaise. Tranché : l'anglais fait foi partout, « il y aura des erreurs partout » sinon (justification utilisateur).

2. **`GRID_MODE` vs `GRID_POLICY`** — deux enums capsule-automation non reliés : `GRID_MODE` (`AutoCapsuleGridInput.mode`, ce qui pilote réellement la forme de la grille) et `GRID_POLICY` (métadonnée par `CAPSULE_TYPE`, mais seul `.stack` était effectivement lu en code — les cinq autres valeurs assignées mais jamais comparées). Aucune dérivation automatique entre les deux n'existait. Tranché : `GRID_POLICY` retiré entièrement, `GRID_MODE` seul fait foi. Mapping détaillé `CapsuleKind`→`GRID_MODE` reste à finaliser (pistes discutées : `carousel`→`forced`, `liste`→`list`, le reste→`manual`).

3. **`CapsulePatch.defaultTransition` (un champ) vs `defaults.introTransitionRef`/`outroTransitionRef` (deux champs, capsule-automation)** — dedit n'exposait qu'un réglage unique là où le modèle en distingue deux. Tranché : `CapsulePatch` scindé en `defaultTransitionIn`/`defaultTransitionOut`.

4. **`CapsulePatch.grid: {preset: string}`** — aucun catalogue de presets de grille n'était spécifié nulle part. Origine retrouvée : dans Eddy, un « preset » de grille référençait une classe CSS toute faite. Jugé pas assez utile pour être reconstruit tel quel. Tranché : retiré, remplacé par trois propriétés explicites `rows`/`cols`/`gap`.

5. **Apparente collision de nom « card »** — dedit-spec §7/§8 réserve explicitement « card »/« cards » aux presets de zones ; `CapsuleKind`/`CAPSULE_TYPE` a une valeur `'card'` qui semblait être un type de capsule sans rapport. Résolu par clarification utilisateur : ce n'est pas une collision — une capsule de type `card` est précisément une capsule dont l'agencement provient d'une card (table de zones) appliquée. Le jeu de zones d'une capsule quelconque peut être enregistré comme card et réutilisé ailleurs : même donnée, deux angles de vue. Cohérent avec `placementPolicy:'mixed'` du type `card`.

6. **« areas »** — `GRID_MODE.areas`/`AutoCapsuleGridInput.areas` (capsule-automation, `grid-template-areas` CSS littéral, non chevauchant) vs le modèle de zones (row/col/span, chevauchement permis, décision explicite du plan zones « jamais grid-template-areas »). Jugé ambigu et dominé par les zones (justification utilisateur : « pourrait servir, mais pose des contraintes auteur que zones résout »). Tranché : `GRID_MODE.areas` et `AutoCapsuleGridInput.areas` retirés. `GRID_MODE` passe de 5 à 4 valeurs.

7. **`eventTimes` (capsule-automation) vs cues/markers (sequence-editor)** — capsule-automation exclut explicitement `cue` de son contrat public et a son propre registre `eventTimes` ; sequence-editor a `TextCue`/`AuthorMarker`. Semblaient être deux mécanismes redondants. Résolu par clarification utilisateur : distincts par nature (eventime = donnée temporelle liée à un event émis ; cue = label lié à un instant), pas une redondance. Un eventime peut se servir d'un label de cue, mais cette résolution a lieu à l'intérieur du composant timeline (sequence-editor) — capsule-automation ne voit jamais qu'un `ms` déjà résolu.

## Autres points arbitrés dans la foulée

- **Easing des transitions nommées** : capsule-automation ne fournit pas d'`ease` dans son catalogue de transitions. Question initiale : le Builder doit-il poser une valeur par défaut ? Tranché : non — `ease` est facultatif, reste absent si non fourni. Rattaché au principe général (« pas de valeur par défaut codée en dur dans le Builder », cf `feedback-no-hardcoded-defaults-in-builder` en mémoire) : un besoin réel se résoudrait en config (catalogue capsule-automation) ou en réglage éditeur, jamais silencieusement dans le code.

## Mapping `CapsuleKind` → `GRID_MODE` finalisé, `position` fusionné dans `card`, `legacy` retiré

Point 2 laissait le mapping détaillé `CapsuleKind`→`GRID_MODE` ouvert (« pistes discutées, pas tranchées »). Avant de trancher, contexte factuel rassemblé pour vérifier s'il s'agissait encore de résidu Eddy (suspicion de l'utilisateur) :

- `packages/authoring/capsule-automation/src/config/capsule-types.ts` (`AUTO_CAPSULE_TYPE_BEHAVIORS`) porte déjà un `gridPolicy` par type, quasi bijectif avec `CAPSULE_TYPE` (`carrousel→stack`, `rangee→line`, `liste→list`, `grille→grid`, `position→areas`, `card→areas`, `legacy→legacy`) — ressemble à un mécanisme de première génération, entièrement piloté par le type.
- `GRID_MODE` (`grid.mode`, ce qui pilote réellement la forme dans `build-grid.ts`) n'est dérivé ni de ce tableau ni du type — il est posé librement par l'appelant, par instance.
- Seul `gridPolicy.stack` est encore lu (`build-grid.ts:60`, repli pour `grid.mode==='manual'` sans rows/cols) — ne concerne que `carrousel`. Les cinq autres valeurs ne sont lues nulle part.
- `resolve-placement.ts:97` vérifie directement `capsule.type === CAPSULE_TYPE.liste`, en alternative à `GRID_MODE.list` — un contournement direct par type, indépendant de `gridPolicy` et de `GRID_MODE`.

Sur cette base, l'utilisateur a tranché en une seule fois le mapping complet, en définissant chaque sous-type par son comportement (pas seulement par sa valeur `GRID_MODE`) :
- `carousel` → `forced` : tous les enfants dans la même cellule, empilés, décalés dans le temps.
- `rangee` → `derived` : une seule dimension, orientation horizontale/verticale.
- `grille` → `manual` : grille régulière explicite (X cols × Y rows).
- `card` → `manual` : ensemble de zones arbitraires — absorbe `position`, dont la distinction (zones via `grid-template-areas` littéral) était déjà un concept abandonné (point 6 ci-dessus). Puisque `position` et `card` avaient déjà `gridPolicy:'areas'` identique dans `capsule-types.ts` (ne différaient que par `placementPolicy`), la fusion est cohérente avec le code existant, pas une invention. Nom retenu : `card` (pas `position`) — conséquence mécanique : la capsule racine, qui était de type `position`, devient de type `card` avec zéro zone.
- `liste` → `list` : énumération séquentielle, pas une grille au sens propre — géré nativement par le comportement dynamique (ajout/retrait) du composant Codplay `list`. Cohérent avec le contournement direct déjà observé dans `resolve-placement.ts`.
- `legacy` → retiré entièrement (« sans objet ») : `CAPSULE_TYPE`/`CapsuleKind` ont maintenant exactement les mêmes 5 valeurs.

Point laissé ouvert par cette clarification, résolu ensuite (même jour) : `placementPolicy` du `card` fusionné — `position` avait `explicitOnly`, `card` avait `mixed`, jamais réconcilié explicitement. Question renvoyée par l'utilisateur avant de choisir entre les deux : « pourquoi un enfant se retrouverait-il sans zone ? à quoi sert l'interface sinon ? » — remettant en cause la prémisse même du choix (un avertissement ou un placement auto-calculé supposent tous deux qu'un enfant sans zone est un cas normal à gérer au runtime). Résolu autrement : `explicitOnly` conservé (capsule-automation ne calcule jamais de placement automatique), mais le Builder garantit qu'un placement explicite existe toujours pour chaque enfant — un enfant sans zone assignée par l'auteur reçoit par défaut la zone pleine surface de la grille (`row:1, col:1`, span égal à `rows`/`cols`, équivalent CSS `1/-1`), une valeur déterministe et documentée, pas un repli silencieux. `mixed` (hérité de l'ancien `card`) est abandonné sans être réconcilié — jugé lié à Eddy, cf `2026-07-08-capsule-automation-reconciliation-plan.md` §3.1.

## Note de méthode

Cette fusion a révélé que plusieurs « incohérences » n'en étaient pas vraiment (card, eventTimes/cues) — la clarification utilisateur a suffi à montrer que les concepts étaient distincts par conception, pas en conflit. D'autres étaient de vraies redondances à trancher (GRID_MODE/POLICY, areas). Utile de garder cette distinction à l'esprit avant de proposer un renommage : vérifier d'abord si les deux usages désignent vraiment la même chose.
