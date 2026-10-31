# Interpolation des styles de décor

## Rôle

Le builder Editor traduit les changements de styles CSS d'un item en actions de
style ACE, sur le même player natif que ses autres keyframes. Il ne crée pas de
timeline ou d'horloge par propriété.

## Contrat

- Les styles de `Decor.style` et `Decor.custom` restent des maps ouvertes. Une
  propriété n'a pas besoin d'être ajoutée à une liste d'interpolation pour
  utiliser le chemin commun.
- Pour chaque segment de keyframes, l'endpoint source vient d'abord de la
  cascade auteur résolue jusqu'au keyframe source. Si cette propriété manque,
  le builder peut employer la valeur CSS calculée de l'élément natif à sa pose
  initiale. La cascade auteur garde toujours la priorité sur cette mesure.
- Le bridge demande au builder les propriétés sources manquantes, stage une
  occurrence native sans démarrer Play, puis la seek une fois à la pose initiale
  de chaque item concerné. Il lit ces propriétés sur la présentation native
  réelle et les transmet uniquement à la compilation finale. Aucune mesure n'est
  conservée entre les compilations ni écrite dans `EditorScene`.
- Si l'endpoint auteur utilise `cqw`, les longueurs physiques calculées sont
  converties au même repère `cqw` pour préparer ACE. Les champs auteur, la
  palette et la persistance gardent leurs valeurs `cqw`.
- Les valeurs interpolables par ACE sont groupées dans l'action de style du
  segment sous la forme `{ from, to, duration, ease }`. Une valeur calculée
  d'endpoint n'entre pas dans le décor source ou dans l'état auteur. Les valeurs
  incompatibles avec le parseur ACE gardent la résolution discrète du builder.
- Après un `Seek`, la palette lit l'état logique présenté par le snapshot après
  `seekApplied`. La mesure CSS initiale n'est jamais utilisée pour reconstituer
  l'état courant de la palette.

## Invariants

- CodPlay et ACE restent l'unique circuit temporel de présentation.
- Il n'existe ni canal, ni lecteur, ni cache temporel par propriété CSS.
- L'endpoint mesuré est transitoire et spécifique à une compilation.
- Le défaut CSS doit être mesurable et convertible dans l'unité attendue. Si
  cette valeur manque, le builder conserve l'action discrète et signale les
  endpoints qui n'ont pas pu être initialisés.

## Preuves

- [`player-interpolation.spec.ts`](../tests/builder-v2/player-interpolation.spec.ts)
  vérifie `border-radius` absent à la source, la demande de mesure, l'action ACE
  unique `{ from: '0cqw', to: '8cqw' }`, le snapshot à `4cqw` et l'absence
  d'écriture du défaut dans le décor auteur.
- [`scene-player-bridge-v2.spec.ts`](../tests/scene-player-bridge-v2.spec.ts)
  vérifie qu'une valeur initiale fournie par une classe CSS d'application est
  capturée pendant le staging avant la compilation publiée.
- Safari Technology Preview, fixture réelle des bridges Editor : saisie palette
  `32` au KF de `2 500 ms` → décor cible `8cqw`, décor source absent, snapshot et
  style natif à `4cqw` au seek de `1 250 ms`.
- Suite Editor : 48 fichiers, 521 tests ; typecheck et build Vite réussis.

## Lecture du circuit

Commencer par `buildSceneDocV2` et `buildInterpolationActions` dans
`src/builder-v2/build-scene.ts`, puis suivre `measureInitialStyleDefaults` dans
`src/app/bridges/scene-player-bridge.ts`. `EditorCoordinationBridge` ne conserve
les captures que pour projeter les insets d'endpoint du cadre dans le même état
de scène ; les commandes de palette restent snapshot-first.
