# Capsule Automation

## Rôle

`@codplay/capsule-automation` est un moteur pur et portable : sans DOM, sans
horloge, sans état partagé. Pour une capsule et ses enfants, il produit :

- le contexte de grille (lignes, colonnes, mode) et ses règles CSS ;
- le placement de chaque enfant, explicite ou automatique ;
- les événements d’intro et d’outro de chaque enfant ;
- les classes de chaque élément et la feuille de style qui les définit.

Le moteur `AutoCapsule` ne calcule pas le temps. Chaque enfant arrive avec son
`timeRange` absolu, résolu en amont par `CapsuleBounds.resolve`, que le paquet
fournit aussi : pour un arbre de capsules, elle résout une seule fois les bornes
de chaque enfant (fenêtre, distribution par `CapsuleDistribution`, verrous,
transition effective avec fusion aux bords), pour tous les appelants
(`src/timing/`, avec `TransitionTiming` et `CapsulePreset` ;
[spécification de distribution](./capsule-distribution-spec.md)). Le moteur
transmet le `timeRange` tel quel aux événements.

L’appelant décide ce qu’est un enfant. Editor, par exemple, déclare aussi chaque
zone comme un enfant à placement explicite pour obtenir son emprise de grille
(voir l’[intégration V2 d’Editor](../../../editor/specs/editor-v2-integration-spec.md)).

## Interface

- `new AutoCapsule({ capsule, children, eventTimes?, eventDefinitions?, config? }, options?)`
  - `resolve()` renvoie `{ state, grid, capsule, children, styleSheet, diagnostics }`.
  - `buildGrid()` ne calcule que la grille ; `renderStyleSheet()` renvoie la
    feuille du dernier résultat, ou en calcule un.
  - `options.autoResolveOnWrite` (défaut `true`) résout dès la construction ;
    `options.includeDiagnostics` (défaut `true`).
- `resolveAutoCapsuleDefaults(type, overrides?)` : transitions par défaut d’une
  capsule ; `CapsuleBounds` l’utilise pour appliquer les mêmes défauts que le moteur.
- `CapsuleBounds.resolve({ durationMs, order?, root })` : bornes résolues de tous
  les enfants d’un arbre de capsules, entrées primitives ; `CapsuleDistribution`,
  `CapsulePreset` et `TransitionTiming` en sont les briques. Contrat :
  [spécification de distribution](./capsule-distribution-spec.md) §5 à §8.
- `DEFAULT_AUTO_CAPSULE_CONFIG`, `DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS` et les
  constantes `CAPSULE_TYPE`, `GRID_MODE`, `PLACEMENT_POLICY`, `AREA_KIND`,
  `EVENT_ACTION`, `ORIENTATION`, `DIAGNOSTIC_LEVEL`.

## Types de capsule

Chaque type fixe son mode de grille : ce n’est jamais un réglage de l’appelant.

| Type | Mode de grille | Grille résolue | Politique de placement | Intro / outro par défaut | Outro généré |
| --- | --- | --- | --- | --- | --- |
| `carousel` | `forced` | 1 × 1 | `auto` | `fade` / `fade` | oui |
| `rangee` | `derived` | 1 ligne × n colonnes ; n lignes × 1 colonne si `orientation: vertical` | `mixed` | `fade` / aucun | non |
| `liste` | `list` | n lignes × 1 colonne | `mixed` | `fade` / aucun | non |
| `grille` | `manual` | `rows` × `cols` fournis, sinon 9 × 16 | `mixed` | `fade` / `fade` | oui |
| `card` | `manual` | `rows` × `cols` fournis, sinon 9 × 16 | `explicit-only` | `fade` / `fade` | oui |

`n` est le nombre d’enfants visibles. Les gouttières `gap`, `rowGap` et
`columnGap` sont appliquées indépendamment au style de la grille.

## Placement

Un enfant a un placement explicite quand son `placement` porte une `area`, ou à
la fois une `row` et une `col` numériques (avec `rowSpan` et `colSpan`, 1 par
défaut). Le placement explicite l’emporte sur la politique du type.

- **Coordonnées** : `gridRow = "<row> / span <rowSpan>"` et
  `gridColumn = "<col> / span <colSpan>"`, avec une règle CSS dédiée.
- **`area`** : le jeton fourni devient `areaClassName` ; aucune règle CSS n’est
  émise, le jeton est supposé défini par l’hôte.
- **Sans placement explicite** :
  - `explicit-only` (`card`) : l’enfant occupe la **zone fantôme**, c’est-à-dire
    toute la surface de la grille (`1 / span rows`, `1 / span cols`), et un
    diagnostic `info` `placement-ghost-zone-applied` est émis ;
  - `liste` : une ligne par enfant, selon son rang (`ac-list-r<n>`), sans règle
    CSS ;
  - sinon : placement automatique, case par case, ligne après ligne, selon le
    rang de l’enfant.
- `meta.usedAutoPlacement` vaut `false` pour un placement explicite, `true`
  pour un placement automatique ou la zone fantôme.

## Événements

Chaque enfant reçoit un événement `intro` et, selon le type, un événement `outro`.

- Un événement fourni par l’appelant est conservé. S’il porte un `name` qui
  désigne un `eventTime` enregistré, son déclenchement est le début de cet
  `eventTime` ; sinon l’intro se déclenche au début de l’enfant et l’outro à sa fin.
- Un événement manquant est synthétisé aux bornes du `timeRange` de l’enfant,
  avec la transition par défaut. Le nom synthétique vient de
  `naming.buildSyntheticEventName` ; `isSynthetic` signale que le nom a dû être
  généré.
- La durée vient de l’événement, sinon de sa définition nommée (`ref`), sinon 0.
- Transition par défaut d’une capsule : le réglage de la capsule
  (`defaults.introTransitionRef`, `outroTransitionRef`, `generateDefaultOutro`),
  sinon le défaut du type, sinon le défaut global. Un réglage de capsule l’emporte
  toujours sur le type.

Catalogue des définitions nommées (`DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS`) :
`cut` (0 ms, sans style), `fade`, `swipe-left`, `swipe-right`, `swipe-top`,
`swipe-down` et `zoom` (300 ms chacune). L’appelant peut en ajouter ou en
remplacer par `eventDefinitions`.

## Classes et feuille de style

Chaque élément reçoit des jetons de classe dédupliqués : ceux de l’appelant, puis
ceux que le moteur génère. Les noms par défaut :

| Élément | Classe |
| --- | --- |
| Grille | `ac-grid-<type>-<rows>x<cols>-<mode>` |
| Cellule | `ac-cell-r<row>-c<col>`, avec `-rs<n>-cs<n>` dès qu’une étendue dépasse 1 |
| Ligne de liste | `ac-list-r<n>` |
| Racine de scène | `ac-scene-root` |

Ces noms et les noms d’événements synthétiques sont produits par `config.naming`,
que l’appelant peut remplacer. `styleSheet` regroupe les règles de la capsule puis
celles des enfants, dédupliquées, une règle par ligne.

## Racine de scène

Avec `capsule.sceneRoot: true`, la capsule ajoute la classe fixe `ac-scene-root`
à celle de la grille et émet la règle
`.ac-scene-root{width:100%;height:100%;grid-area:1/-1;min-width:0;min-height:0;overflow:hidden;container-type:size;}`.

- Les dimensions sont une règle distincte de la grille : le nom de la classe de
  grille est identique avec ou sans `sceneRoot`, et le style en ligne de la grille
  ne porte ni largeur ni hauteur.
- `grid-area:1/-1` remplit tout l’hôte même quand il est lui-même une grille ;
  `min-width:0` et `min-height:0` empêchent les enfants volumineux d’agrandir la
  piste de l’hôte ; `container-type:size` établit le conteneur de référence des
  unités `cqw` et `cqh` des descendants.

## Invariants

- Le moteur ne lit ni n’écrit le DOM, et ne calcule aucun temps.
- La grille et le placement d’un type ne dépendent pas de l’appelant : le mode
  est fixé par le type.
- Les trois sorties (grille, placement, événements) viennent d’un même état
  normalisé, copié à l’entrée : modifier l’entrée après coup ne change pas un
  moteur existant.

## Limites

Comportements implémentés, exécutés sur l’API publique mais sans test dédié :

- Les enfants sont ordonnés par `order` puis par `id` ; `visible: false` exclut
  l’enfant de toute sortie, y compris du compte de la grille.
- Le placement automatique dépend uniquement du rang de l’enfant. Il ne tient
  pas compte des cases occupées par un placement explicite : plusieurs enfants
  peuvent occuper la même case, ce qui est un usage normal d’une grille CSS.
  Au-delà du nombre de cases, il reprend au début de la grille.
- Un `placement` incomplet (`row` sans `col`) est traité comme absent : l’enfant
  retombe sur la politique du type.
- Dans un `carousel` (grille 1 × 1), tous les enfants occupent la même case ;
  seul leur `timeRange` les distingue.
- `auto` et `mixed` se résolvent de la même façon ; seule `explicit-only` change
  le comportement.
- Les `constraints` d’un enfant (`lockPlacement`, `lockClassGeneration`) sont
  conservées dans l’état mais ne sont lues par aucun calcul.
- Un événement autre qu’intro ou outro, sans nom, se déclenche au début de
  l’enfant et émet un diagnostic `info` `event-fallback-trigger`.
- `includeDiagnostics: false` vide `diagnostics` et supprime les diagnostics
  d’événements.
- L’état est copié par JSON : une valeur non sérialisable est perdue.
  `getSerializableState()` exclut la configuration, donc les fonctions de nommage.
- Les méthodes d’écriture (`setCapsule`, `upsertChild`, `setChildPlacement`, …)
  résolvent aussitôt ; aucune n’est couverte par les tests.
- `timeRange` : `durationMs = max(0, endMs − startMs)` et `locked: true`.
- Les noms de classe par défaut du tableau ci-dessus ne sont assertés par les
  tests que pour `ac-list-r<n>` et `ac-scene-root`.

Limites de conception :

- Le moteur ne contrôle pas les débordements de grille et n’empêche aucun
  recouvrement.
- Il ne connaît pas l’orientation de l’hôte : une surface portrait ou paysage est
  choisie par l’appelant avant de lui fournir les coordonnées.

## Preuves

Les tests du paquet passent (`npm run test` depuis le dossier du paquet).

- [`build-grid.spec.ts`](../tests/build-grid.spec.ts) : les cinq modes de grille,
  les défauts 9 × 16, l’orientation de `rangee`, les gouttières, la racine de
  scène (classe, règle, indépendance du nom de grille).
- [`resolve-placement.spec.ts`](../tests/resolve-placement.spec.ts) : coordonnées
  explicites, `area` sans règle CSS, placement automatique sur une grille
  manuelle, `liste` et zone fantôme de `card` avec son diagnostic.
- [`resolve-events.spec.ts`](../tests/resolve-events.spec.ts) : défauts du type et
  surcharge de la capsule, synthèse aux bornes du `timeRange`, `outro` absent pour
  `rangee`, résolution d’une `ref`, nom synthétique, `eventTime` nommé.
- [`auto-capsule.spec.ts`](../tests/auto-capsule.spec.ts) : résolution de bout en
  bout, déduplication de la feuille de style, `renderStyleSheet()` sans résolution
  préalable.
- [`capsule-bounds.spec.ts`](../tests/capsule-bounds.spec.ts),
  [`capsule-distribution.spec.ts`](../tests/capsule-distribution.spec.ts),
  [`capsule-preset.spec.ts`](../tests/capsule-preset.spec.ts),
  [`transition-timing.spec.ts`](../tests/transition-timing.spec.ts) : résolution
  des bornes (racine, capsule imbriquée, fusion, transitions explicites et par
  défaut, ordre, durée minimale, diagnostic), distribution et préréglages.
