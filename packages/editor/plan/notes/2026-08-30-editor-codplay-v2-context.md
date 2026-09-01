# Contexte — reprise ed2 avec CodPlay V2

**Statut : note de contexte.**
**Liée au plan :** `../2026-08-30-editor-codplay-v2-reprise-report.md`.
**Date : 2026-08-30.**

Cette note conserve les constats techniques et les décisions qui expliquent le plan de reprise. Elle n'autorise aucun code et ne remplace pas les contrats V2 ou le plan accepté.

## Situation de départ V1

Le bridge `packages/editor/src/app/bridges/scene-player-bridge.ts` dépend de `codplay-v1/creator`, `studio.load()`, `studio.player`, de sa telco et de `AuthorApi`. Le builder `packages/editor/src/builder/build-scene.ts` produit un `SceneDef` V1, des eventimes V1 et une feuille CSS fournie comme `extraResources`.

Le décor temporaire a déjà déplacé sa lecture vers `getPersoStates()`, mais le Selection Frame écrit encore la pose du node avec `setNodePose()`, puis reconstruit un `DecorPatch`. V1 séparait ainsi le document, l'état animé et l'état DOM. La position, la taille, la rotation, l'échelle et les couleurs n'étaient pas garanties comme un unique état à un même temps logique. `getNodePose()` et `setNodePose()` sont des méthodes V1 : elles sont retirées du circuit ed2 lors de la bascule et ne reçoivent pas d'équivalent V2.

## Ce que V2 apporte

V2 évalue une scène par une seule projection temporelle :

```text
faits compilés et journalisés à t
  -> materialize : occurrences actives et elapsedMs
  -> resolve : état initial + actions actives
  -> solve : placement et graphe de présentation
  -> component.update({ state, timeMs: t })
  -> services -> runner HTML/DOM
```

`resolveScene()` produit un état logique unique par perso. Les canaux transform scalaires et les valeurs CSS scalaires ou couleurs normalisées sont évalués avec le même `elapsedMs`, puis placés dans le même `state.style`. Play et Seek suivent la même évaluation. Le DOM est seulement la projection de cet état ; il ne doit pas servir à le reconstituer.

Les présentations FLIP et leurs matrices sont transitoires et distinctes de la pose auteur. Elles ne sont jamais une donnée à capturer ou à persister.

## Unités de dimension ed2

La migration distingue la sémantique retenue de la technique V1. Les nombres
des champs structurés de longueur (`OffsetData.x/y/width/height` et
`translate.x/y`) sont des valeurs `unitless` de transport : ils représentent
une longueur logique, mais ne sont pas encore une unité CSS. Le `unitless` CSS
de `line-height`, `opacity` ou d'une propriété intrinsèquement dimensionless
reste une autre sémantique.

Le builder ed2 transmet ces nombres dans le contrat V2. CodPlay les qualifie à
sa frontière de compilation, avec la constante de configuration de longueur
logique ; pour le contexte actuel, cette constante vaut `cqw`. La même règle
s'applique aux patches de géométrie envoyés à `snapshot`. Le choix `cqw` est
donc une configuration courante, pas une norme que l'éditeur devrait fabriquer
ou que tous les contextes futurs devraient imposer.

V2 conserve et interpole ensuite la valeur logique qualifiée. Le materializer
HTML ne vérifie ni la grammaire CSS ni l'unité : il projette la valeur avec la
largeur de la racine de scène et écrit le résultat en `px`. `100cqw` est la
largeur de cette racine, y compris pour `y` et `height`. Une longueur logique
et une valeur CSS incompatible ne sont jamais interpolées implicitement : V2
produit un diagnostic. Les chaînes CSS libres, propriétés custom, `calc()` et
variables restent opaques ; une couleur autonome sur une propriété nommée
couleur est normalisée pour ACE. La qualification et la projection sont des
étapes V2, sans méthode, bridge ou conversion V1.

L'interpolation `Decor` est définie par la mesure de l'écart entre deux `Decor` du même item. Les propriétés interpolables doivent être projetées dans la représentation V2 avec leur unité et leur forme correctes. Les classes et les propriétés CSS intrinsèquement discrètes, telles que `object-fit`, ne sont pas interpolables : elles sont ignorées par ce calcul.

## « vDom »

Il n'existe pas de contrat public V2 nommé `vDom`, ni d'arbre virtuel mutable par l'éditeur. L'expression utile est la projection logique retenue/réconciliée :

```text
materialize -> resolve -> solve -> component.update -> runner HTML
```

Les outils éditeur lisent `instance.snapshot.get()` et remettent une preview logique temporaire par `instance.snapshot.set()`. La géométrie utile au cadre de sélection ne vient pas d'un node remis à l'éditeur : elle est mesurée par la projection HTML et fournie sous forme de données numériques cohérentes. L'overlay du cadre, son hit-test et ses pointeurs restent des DOM appartenant à l'éditeur ; ils ne deviennent pas la projection du player.

## Géométrie V2 exposée — obligation de la refonte

La possibilité de fournir cette géométrie est constitutive de V2. Elle réalise la
frontière `Projection.set / measure / mount` déjà posée dans le cahier des
charges : le player résout un état logique, la projection le présente, puis la
projection peut mesurer le résultat réel lorsqu'une interaction doit connaître
la position, la taille ou les matrices du rendu. Dire que la géométrie serait
« une option » confondait donc l'absence actuelle de façade avec l'absence de
la capacité architecturale.

La mesure existe déjà à l'intérieur du runner HTML : `captureHtmlPose` lit une
frame de pose dans une transaction de mesure ; `captureHtmlLayoutSnapshot`
compose les poses root/parent/enfant ; `presentSceneForGeometryCapture` présente
un état sur les nœuds auteur persistants avant cette lecture. Ces fonctions sont
des briques internes et les snapshots de mouvement ne sont pas directement le
contrat de l'éditeur : ils portent des notions FLIP (`targetOrder`, frontières,
attachments) qui ne doivent pas fuir dans la façade.

La cible d'intégration est donc une sortie publique V2 dédiée, distincte de
`snapshot` :

- `snapshot` expose l'état logique résolu et reçoit la preview `style`, sans
  dépendre du substrat ;
- la géométrie expose une frame numérique immuable, associée au temps et à une
  révision, après la présentation naturelle de cet état en HTML ;
- chaque item doit être adressable par son identité story/perso, signaler sa
  présence, et fournir le rectangle viewport, la boîte locale, l'origine, la
  matrice affine et les relations parent/racine nécessaires aux poignées et
  aux conversions de coordonnées ;
- les conteneurs/cibles utiles aux outils (notamment les pistes de grille
  résolues) doivent être mesurables dans la même frontière ; un simple
  rectangle de l'item sélectionné ne suffit pas ;
- aucune référence DOM, lecture `getBoundingClientRect()` ou
  `getComputedStyle()` n'est réalisée par l'éditeur ; aucun overlay FLIP/DnD
  n'est présenté comme la pose auteur.

La frame doit être cohérente avec chaque opération qui peut changer le rendu :
initialisation, seek, resize, preview `snapshot.set/clear`, reconstruction,
montage/démontage et remplacement d'un node. Une révision ou un temps permet
au consommateur de rejeter une frame devenue obsolète. La mesure est déclenchée
à ces frontières explicites ; elle ne devient pas une lecture DOM supplémentaire
à chaque tick de la boucle.

Le nom exact de la surface, ses opérations de lecture/observation et la forme
publique du DTO restent à fixer dans le sous-plan avant toute modification du
core. Ce point est une évolution de frontière V2 à autoriser séparément, pas un
correctif opportuniste et pas une compatibilité V1.

## Conséquence pour `setNodePose()`

La cible V2, déjà bornée par le plan de façade, est un patch de preview temporaire :

```ts
{ target: { storyId, persoId }, timeMs, state: Partial<Record<string, unknown>> }
```

Elle remplace partiellement l'état résolu avant sa matérialisation, sans modifier `CompiledScene`, le journal ou le document éditeur. Palette, Selection Frame et multi-sélection doivent produire cette même forme ; la persistance convertit ensuite ce patch en `DecorPatch` par l'unique transaction éditeur et le copy-on-write existant. Après `snapshot.set()`, la géométrie publique doit être rafraîchie afin que le cadre puisse suivre immédiatement la projection de la preview.

`setNodePose()` n'est donc pas le mécanisme cible des gestes connus. `subscribeToNode()` et les autres références de node V1 ne sont pas la sortie de géométrie V2 : le cadre est notifié par la frame numérique de la projection et produit ensuite un patch logique. Toute interaction qui semblerait exiger un node doit d'abord être examinée comme un manque du contrat de mesure V2, jamais contournée par une écriture DOM.

## Zones

Les zones sont un modèle de l'éditeur. Elles sont résolues vers des classes CSS par `packages/authoring/capsule-automation`, puis consommées comme `className` par le player. Leur preview est un overlay autonome de l'éditeur ; elle n'appartient pas au player, à la telco ou au cycle V2 de materialize/seek.

`capsule-automation` est l'autorité du placement explicite `{ row, col, rowSpan, colSpan }`, des règles CSS et de leurs classes. La verticale builder V1 de l'éditeur l'utilise déjà pour les grilles et les placements automatiques, mais construit les `AutoCapsuleChildInput` sans `placement` et ne transmet pas `scene.zones`/`Decor.zoneId`. La verticale builder V2 utilise maintenant les artefacts de ce même service pour les classes de grille et le CSS de chaque niveau de capsule ; elle ne transmet toujours pas `scene.zones`/`Decor.zoneId` et ne produit donc aucune classe liée aux zones.

Le raccordement zones est différé après l'intégration V2 initiale. Il devra réutiliser le modèle et l'automation existants, garder séparées la modification de la définition de zone et l'affectation d'une zone à un enfant, et ne pas les faire entrer dans le calcul d'interpolation `Decor`.

## Frontière snapshot V2 et gouvernance

`snapshot` est une capacité directe de l'instance V2, au même niveau que `telco`. Elle est créée dans CodPlay et exposée par sa façade ; aucun package `authoring` ne la crée ni ne l'enveloppe. Elle ne donne accès ni à `RuntimePlayer`, ni au catalogue, ni au materializer. Elle reste limitée à `get`, `set` et `clear`, définis dans le plan de reprise ed2.

Toute nouvelle intervention V2 révélée par l'adaptation doit être qualifiée avant code :

- **correctif de bug** : divergence prouvée avec un contrat V2 déjà fixé ;
- **feature** : capacité V2 absente. `snapshot` et `cqw` sont les features déjà
  autorisées dans la tranche en cours.

La cause ou le besoin, les invariants, le périmètre, le plan et les preuves d'acceptation sont documentés et validés avant toute écriture. Chaque intervention V2 requiert ensuite l'autorisation explicite de l'auteur. Un correctif ne sert jamais de prétexte à introduire une feature, et une feature ne se présente jamais comme un correctif.

La tranche autorisée du 2026-08-30 implémente désormais `instance.snapshot` dans
CodPlay et une première version de la longueur logique `cqw` dans le builder,
la résolution et la projection HTML. Cette première version est une étape de
migration : la qualification `unitless → cq*` doit encore être déplacée du
builder vers CodPlay et centralisée dans la configuration. Le bridge éditeur,
le Selection Frame et les zones ne sont pas encore raccordés ; ces frictions
restent suivies par le plan principal.
