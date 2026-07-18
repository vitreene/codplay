# Chantier 2 — dedit playhead-driven (décor résolu au node, pas au kf sélectionné)

Suite de `packages/editor/plan/2026-07-17-play-mode-decor-editor-deactivation-plan.md` (chantier 1).
**Statut : implémenté et validé** (2026-07-18).

## Objectif

Dedit ne doit jamais afficher/éditer un décor qui ne correspond pas à ce qui est réellement visible
à l'instant courant. Deux manifestations du même trou conceptuel, trouvées à des moments différents :

- **À la pause pendant la lecture** (chantier 1) — dedit affiche le dernier kf sélectionné, jamais
  l'état interpolé réel à la tête de lecture si elle n'est pas exactement sur un kf.
- **Sélection normale, hors lecture** (2026-07-18) — sélectionner un item SANS cibler un kf précis
  (ex. pour le déplacer) faisait retomber `resolveTarget` sur `item.initialDecorId` par défaut,
  indépendamment de ce qui est réellement affiché.

Dans les deux cas, la cause était la même : aucune notion de « décor temporaire, non enregistré, qui
reflète l'état live de l'item » — seulement des décors RÉELS (`initialDecorId` ou un
`Keyframe.decorId`). Modèle retenu (After Effects) : la sélection d'un kf sert aux opérations
structurelles (supprimer/renommer), jamais de source à ce qui s'affiche/s'édite — la source, c'est
toujours l'état live.

## Mécanisme implémenté

1. `resolveKeyframeAlignment(item, timelineMs)` (`decor-editor-bridge.ts`) classe la position du
   playhead : `no-keyframes` / `before-first` / `exact` / `after-last` / `between`. Seul `between`
   déclenche une lecture live — `exact`/`after-last` résolvent via la cascade document normale (même
   traitement qu'un kf explicitement sélectionné), `before-first`/`no-keyframes` retombent sur
   `item.initialDecorId` (comportement historique, kf1 ≈ `initialDecorId`, cf plus bas).
2. `AuthorApi.getNodeSnapshot(persoId, props)` — généralisation de `getNodePose`
   (`runtime/components/lib/dom.ts::readNodeSnapshot`) : lit via `utils.get(nodeRef, prop)` (forme
   à 2 arguments — la forme à 3 arguments `utils.get(node, prop, false)` ne fonctionne QUE pour le
   vocabulaire de pose fixe d'anime.js ; testé empiriquement). Retourne les valeurs telles quelles
   (chaînes unitées pour les longueurs, chaînes brutes pour les couleurs), jamais `getComputedStyle`.
   Passage obligé par `AuthorApi` (jamais anime.js directement depuis dedit) pour survivre au
   remplacement d'anime.js (chantiers 3/6 de `2026-07-16-anime-js-native-substitution-chantiers.md`).
3. **Demandé, pas collecté en bloc** — `styleFieldsForItemType` (`decor-editor-bridge.ts`) dérive la
   liste des propriétés à lire directement de `PaletteConfig.panels[].fields[].path`
   (`decor-editor/default-palette.ts`), filtrée aux panneaux pertinents pour le type d'item — jamais
   une liste devinée ou dupliquée.
4. `resolveTemporaryPatch` convertit chaque valeur lue dans l'unité propre au `Decor`
   (`formatLiveValueForCssProperty`, `css-value-format.ts` — cqw pour les champs numériques, chaîne
   brute sinon) avant de les redistribuer en `DecorPatch` (`style`/`offset`), même forme qu'un décor
   réel — dedit ne connaît aucun type parallèle.
5. `syncSelection` fusionne `base` (cascade au dernier kf réel avant le playhead) avec `live`
   (`mergePatch(base, live)`, `live` gagne) — le décor temporaire ne consigne que ce qui diffère,
   jamais un instantané complet. Jamais écrit dans `scene.decors` ; `onDecorChange` refuse
   silencieusement (avec avertissement) toute édition tant que `target.isTemporary` est vrai — pas de
   commit possible sans poser un keyframe au préalable.

## `initialDecorId` ≈ kf1 — pas deux cibles concurrentes

`initialDecorId` est lié à kf1, c'est le même concept — pas un troisième concept concurrent.
Cohérent avec le builder : `buildItemPerso` fusionne
`initialStyleFromIntro ⊕ introDecor(initialDecorId) ⊕ firstKfDecor` en un seul état initial, kf1
n'a jamais sa propre action séparée. Éditer « à kf1 » (playhead aligné dessus) revient donc à éditer
ce couple confondu. Le décor temporaire n'intervient QUE quand le playhead n'est aligné sur AUCUN kf
(`between`).

## Signal UI + raccourci

- `.dedit-palette--temporary` (fond plus clair) — piloté par `controller.isTemporary()`, une donnée
  pure ; le CSS reste le seul endroit qui décide de la présentation.
- Bouton « Aller à kf1 » (`.dedit-snap-to-kf1`, visible seulement en décor temporaire) — envoie
  `SEEK` vers le premier keyframe de l'item (`controller.requestSnapToFirstKeyframe()` →
  `onSnapToFirstKeyframeRequest` côté bridge). dedit ne résout pas lui-même « où est kf1 » — relaie
  la demande à l'hôte.

## Bug corrigé en cours de route — champ couleur figé après un patch externe

`renderColorField` (`decor-editor/render.ts`) évite de réécrire `input.value` tant que le champ a le
focus (pour ne pas fermer le picker natif en plein geste) — guard nécessaire, mais rien ne
redéclenchait la mise à jour différée une fois le focus perdu : un patch externe reçu pendant que le
champ était focus (ex. clic sur « Aller à kf1 » alors que le picker de couleur était encore actif)
laissait la valeur affichée périmée indéfiniment, jusqu'au prochain événement machine quelconque.
Corrigé par un listener `blur` qui réapplique la valeur résolue courante. Testé dans
`tests/decor-editor-render.spec.ts` (régression confirmée sans le fix, verte avec).

Trouvé en testant le raccourci en direct : un faux positif initial (couleur apparemment inchangée
après clic) était en réalité `oklch(0.6 0.24 25)` → `#ee0b2a` dans les deux cas (kf1 seul, pas
d'interpolation en jeu à ce point du test) — la vraie régression n'est apparue qu'avec deux couleurs
suffisamment différentes pour distinguer un hex périmé d'un hex correct.

## Audit préalable — chemins parallèles/oubliés de lecture-écriture du node (2026-07-18)

Fait avant implémentation. Balayage de tous les accès pose/style live (`getComputedStyle`, écritures
directes `node.style.*`, appels `utils.get`/`utils.set`) dans `packages/authoring/`,
`packages/editor/src/`, `packages/codplay/src/runtime/`.

**Sûr / déjà balisé** — tout le reste : les `getComputedStyle` restants lisent des dimensions de
boîte/grille, jamais une pose (mesure de texte, gabarit de zone, `overlay-pose.ts` pour le
positionnement du CADRE CS lui-même, jamais réinjecté dans `AuthorApi`) ; aucun appel `utils.get`/
`utils.set` hors du runtime codplay ou de `libre-adapter.ts`/`overlay-pose.ts` ; la frontière
rebuild → `reattachSelection` → `seedResolvedPose` est garantie sans race (montage du node
strictement synchrone avant la notification `subscribeToNode`, confirmé en lisant
`runtime-component-orchestrator.ts`).

**Deux points de vigilance réels, documentés, pas encore de garde-fou actif dans le code :**

1. **Geste CS actif** — `LibreAdapter` (`libre-adapter.ts`, `applyMove`/`applyResize`/`applyRotate`/
   `applyScale`) écrit `translate`/`rotate`/`scale`/`width`/`height` DIRECTEMENT sur le node pendant
   un geste, en contournant `utils.set` — le cache d'anime.js diverge du node réel et n'est
   réconcilié qu'au rebuild suivant. `getNodeSnapshot` appelé PENDANT un geste actif renverrait donc
   une pose périmée. `resolveTemporaryPatch` est gaté sur `!gestureActive` côté
   `decor-editor-bridge.ts::syncSelection` — même garde-fou que `offset-editor-bridge.ts::
   readLiveGestureNodePose`.
2. **Animation FLIP en vol** (`runtime/modules/list-flip/`) — un réordonnancement de liste anime la
   position via FLIP ; `getNodeSnapshot` appelé PENDANT cette animation lira la pose transitoire, pas
   la pose de repos. Pas un bug en soi (c'est littéralement l'état live), mais un cas à garder en tête
   si un rapport de bug futur mentionne une position transitoire capturée dans un décor temporaire.

## Hors périmètre — trouvé pendant les tests, pas traité ici

- **CS strippe le transform à l'attache** (`LibreAdapter::seedResolvedPose`) — écrit
  inconditionnellement `node.style.transform = 'none'` puis reseed les propriétés discrètes ;
  confirmé en direct (transform:none visible dès la sélection, persiste même après désélection).
  Package/concern différent de ce chantier (`packages/authoring/selection-frame`) — pas corrigé ici.

## Hors périmètre — rattaché à un autre chantier

Une lecture VRAIMENT indépendante du node (un état de perso possédé nativement, pas seulement
adressé par `persoId` via le cache d'anime) n'existe pas pour les propriétés animées : aucun
composant runtime ne garde de style séparé du node, et pendant un tween en cours c'est anime.js seul
qui écrit le node à chaque frame. Cette capacité appartient au projet
`packages/codplay/plan/notes/2026-07-16-anime-js-native-substitution-chantiers.md` (chantiers 3/6,
qui anticipe déjà ce besoin côté éditeur en §8) — pas à ce chantier.
