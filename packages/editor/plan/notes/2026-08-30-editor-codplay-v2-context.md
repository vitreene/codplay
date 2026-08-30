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

La convention V1 effective est `cqw` pour les longueurs d'offset, y compris `x`, `y`, `width` et `height`. Le builder ed2 ne devine pas l'intention d'une déclaration CSS : les seuls champs structurés de longueur (`OffsetData.x/y/width/height` et `translate.x/y`) deviennent une longueur `cqw` explicite dans la `SceneDoc` V2. Les chaînes CSS libres et propriétés custom restent opaques, sauf une couleur autonome portée par une propriété nommée couleur, normalisée en `ColorValue` pour ACE ; ainsi `line-height: '1.2'`, `calc()` ou une variable CSS ne sont pas réinterprétés. Cette décision ne repose sur aucune whitelist de propriétés de dimension et ne lit pas le DOM.

V2 doit conserver et interpoler cette valeur de longueur explicite. Le materializer HTML ne vérifie ni la grammaire CSS ni l'unité : il reçoit une longueur déjà qualifiée, la projette avec la largeur de référence explicite et écrit le résultat en `px`. `100cqw` est la largeur de la racine de scène, y compris pour `y` et `height`. Une longueur `cqw` et une valeur CSS incompatible ne sont jamais interpolées implicitement : V2 produit un diagnostic. La tranche autorisée porte maintenant cette forme explicite et sa projection générique ; les preuves façade/navigateur restent à compléter. La décision ne doit pas être contournée en remettant des chaînes `cqw` dans le builder ed2.

L'interpolation `Decor` est définie par la mesure de l'écart entre deux `Decor` du même item. Les propriétés interpolables doivent être projetées dans la représentation V2 avec leur unité et leur forme correctes. Les classes et les propriétés CSS intrinsèquement discrètes, telles que `object-fit`, ne sont pas interpolables : elles sont ignorées par ce calcul.

## « vDom »

Il n'existe pas de contrat public V2 nommé `vDom`, ni d'arbre virtuel mutable par l'éditeur. L'expression utile est la projection logique retenue/réconciliée :

```text
materialize -> resolve -> solve -> component.update -> runner HTML
```

Les outils éditeur lisent `instance.snapshot.get()` et remettent une preview logique temporaire par `instance.snapshot.set()`. Le node HTML demeure utile à la géométrie du cadre de sélection, au hit-test et aux pointeurs, jamais à la lecture ou l'écriture de décor.

## Conséquence pour `setNodePose()`

La cible V2, déjà bornée par le plan de façade, est un patch de preview temporaire :

```ts
{ target: { storyId, persoId }, timeMs, state: Partial<Record<string, unknown>> }
```

Elle remplace partiellement l'état résolu avant sa matérialisation, sans modifier `CompiledScene`, le journal ou le document éditeur. Palette, Selection Frame et multi-sélection doivent produire cette même forme ; la persistance convertit ensuite ce patch en `DecorPatch` par l'unique transaction éditeur et le copy-on-write existant.

`setNodePose()` n'est donc pas le mécanisme cible des gestes connus. Une éventuelle capacité HTML `subscribeToNode()` peut rester utile à l'ancrage du cadre de sélection. Toute conservation de lecture/écriture de pose par node exigerait de démontrer une interaction impossible à exprimer en état logique.

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
CodPlay et la longueur logique `cqw` dans le builder, la résolution et la
projection HTML. Elle ne couvre pas encore le bridge éditeur, le Selection Frame
ni les zones ; ces écarts restent suivis par le plan principal.
