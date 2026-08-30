# Plan d'implémentation — reprise de l'éditeur avec CodPlay V2

**Statut : En cours — tranche 3 (capacités V2 `cqw` et `snapshot`) implémentée ; le contrat de géométrie V2 est obligatoire et doit être arrêté avant le bridge éditeur.**
**Cible : ed2 avec CodPlay V2 foundation.**
**Date : 2026-08-30.**

## Objet et frontière

Cette reprise remplace la verticale V1 de l'éditeur par une verticale V2 complète : préparation de `SceneDoc`, compilation, preload, instance, accès authoring et preview `Decor`. Elle n'emporte aucun patch legacy ni couche de compatibilité V1/V2 : V1 ne reste qu'une référence de comportement et de preuves. La verticale V2 nativement construite ne crée ni player parallèle, ni reconstruction de décor depuis le DOM.

Elle se raccorde aux acteurs et machines xState déjà propriétaires de l'état et des commandes de l'éditeur. Le bridge V2 ne duplique ni le contrôleur, ni la machine Decor, ni la machine de séquence, et ne les contourne pas par un état authoring concurrent.

Les zones restent hors de cette première intégration. Leur modèle existe dans `packages/authoring/capsule-automation`, leur preview reste autonome dans l'éditeur, et leur raccordement est une tranche postérieure. Le contexte et les choix expliqués sont dans la [note de contexte](./notes/2026-08-30-editor-codplay-v2-context.md). La prochaine session doit suivre la [note de reprise opérationnelle](./notes/2026-08-30-editor-codplay-v2-reprise-prochaine-session.md) avant toute modification de code.

## Décisions déjà retenues

- Le builder ed2 prépare le `SceneDoc` V2 ; CodPlay ne connaît pas `EditorScene`.
- `snapshot` est une capacité directe de l'instance V2, au même niveau que `telco`. Elle est créée dans CodPlay et exposée par sa façade ; aucun package `authoring` ne la crée ni ne l'enveloppe. Elle ne connaît ni `EditorScene`, ni `Decor`, ni les classes runtime internes.
- État résolu et contribution temporaire sont logiques. La projection HTML peut mesurer ses nœuds pour produire la géométrie nécessaire au hit-test et aux pointeurs, mais aucun node n'est remis à l'éditeur pour lire ou écrire `Decor`.
- La géométrie de présentation nécessaire à l'authoring est une capacité constitutive de V2, non une option du raccordement Selection Frame. Elle découle de la frontière `Projection.set / measure / mount` : la projection HTML mesure les nœuds persistants et expose un frame numérique immuable ; elle n'expose pas les nœuds comme API de pose et l'éditeur ne relit pas le DOM.
- Entre deux `Decor` d'un même item, le builder calcule l'écart et l'interpole par défaut. Les couleurs portées par une propriété explicitement nommée couleur sont normalisées pour ACE ; les chaînes CSS composées, classes et propriétés intrinsèquement discrètes, telles que `object-fit`, sont exclues de ce calcul.
- La convention de longueur ed2 est `cqw`, déjà utilisée par V1 pour `x`, `y`, `width` et `height`. Seules les données structurées explicitement longues produisent une longueur `cqw` dans la `SceneDoc` V2 ; les chaînes CSS libres et propriétés custom restent opaques, à l'exception de la normalisation des couleurs autonomes sur les propriétés nommées couleur. Aucune whitelist de propriétés de dimension ni inférence depuis la grammaire CSS n'est introduite.
- V2 reçoit cette longueur explicite ; le materializer ne qualifie pas le CSS. Il ne fait que projeter une longueur déjà connue avec la largeur de référence de la scène.
- Cascade, copy-on-write et l'unique écriture persistante `Decor` demeurent des responsabilités ed2.

## Écarts V2 à qualifier avant code

| Écart constaté | État actuel | Décision à produire |
| --- | --- | --- |
| Lecture snapshot | Contrat et port runtime V2 implémentés ; lecture logique exposée par la façade, sans accès au DOM. | Compléter la preuve navigateur avec le cycle d’instance du bridge. |
| Preview temporaire | Contribution runtime V2 implémentée après résolution et avant solve/materialize ; journal et `CompiledScene` inchangés. | Compléter la preuve navigateur et raccorder la session Decor. |
| Longueur logique | Builder, interpolation logique et projection HTML `cqw` implémentés. | Compléter la preuve façade/navigateur Play, Seek et resize. |
| Géométrie du Selection Frame | Le runner possède déjà une mesure HTML interne (`captureHtmlPose` et snapshots de layout), mais la façade ne l'expose pas encore comme frame authoring. | Achever la frontière V2 `Projection.measure` par un frame géométrique numérique, cohérent avec la présentation courante, puis raccorder le cadre à ce frame. Aucun node observable ni API de pose ne remplace cette sortie. |

Chaque ligne devient une tranche V2 séparée : cause démontrée, classification bug/feature, contrat, fichiers V2, tests d'intégration et autorisation explicite avant code. Aucune ne peut être masquée par un bridge temporaire.

### Qualification technique préalable à la tranche d'intégration

Les écarts `snapshot` et `cqw` sont des **features V2**, pas des correctifs de bug :

- `snapshot` : le runtime possède déjà un `SolvedScene` présenté, mais aucune
  surface publique d'instance ni point d'application d'une contribution
  temporaire. Il faut donc ajouter le port `get/set/clear` prévu par le contrat,
  ses diagnostics et son raccordement au cycle `resolve → solve → materialize`,
  sans modifier `CompiledScene` ni le journal ;
- `cqw` : la tranche autorisée a retiré le blocage
  `EDITOR_V2_OFFSET_REQUIRES_CQW` et porte maintenant une longueur logique
  explicite jusqu'à l'interpolation et la projection HTML. Les preuves de
  façade/navigateur restent à compléter, sans inférence CSS dans le materializer
  ni conversion de `line-height`, `object-fit` ou CSS libre.

Le bridge éditeur est ensuite une tranche d'adaptation, non une capacité core :
il remplacera le pont V1 par `CodPlay.build()`, `preload.load()`,
`preload.css.set()`, `instances.create()` et le `telco` d'instance, puis
émettra les résultats vers les événements xState existants. Tant que les deux
features core ne sont pas intégrées et validées sur le chemin façade, écrire ce bridge imposerait
un fallback V1 ou une lecture de pose par le DOM, tous deux exclus par ce plan.

L'ordre retenu est donc : `cqw` (les scènes réelles portent des offsets),
`snapshot`, exposition obligatoire de la géométrie V2, bridge éditeur, puis
bascule des régions et suppression des imports V1 après preuve navigateur.
L'autorisation explicite de modifier le core V2 pour les deux premières features
a été donnée le 2026-08-30 ; elle ne couvre pas l'évolution de frontière requise
pour la géométrie.

## Tranche 0 — fermer les trois contrats d'entrée

### 0.1 Contrat snapshot V2 — validé le 2026-08-30

Le contrat validé de la capacité `snapshot`, attachée à une instance V2, précise :

- lecture synchrone de l'état résolu, par `persoId`, au temps effectivement présenté ;
- observation du cycle de lecture nécessaire aux outils, sans piloter ce cycle ;
- remise, remplacement et effacement d'un patch partiel `{ target: { storyId, persoId }, timeMs, state }` ;
- comportement de la preview et du brouillon aux seek, rebuild, destruction et remplacement d'instance, à établir après observation des manipulations réelles ;
- diagnostics pour cible absente, instance détruite, temps non présenté et patch rejeté ;
- aucune observation de node ni référence DOM ; la géométrie authoring relève du contrat V2 dédié décrit ci-dessous.

La surface et ses noms d'opérations sont validés. Le contrat ne réintroduit pas `getNodePose`, `setNodePose` ou `getComputedStyle` comme mécanisme de décor.

### 0.1.1 Surface minimale proposée

V2 expose un port public étroit sur l'instance. Il ne connaît aucun package authoring ni type `EditorScene` :

```ts
type SnapshotTarget = Readonly<{
  storyId: string
  persoId: string
}>

type SnapshotState = Readonly<{
  target: SnapshotTarget
  state: Readonly<Record<string, unknown>>
}>

type CodPlaySnapshot = Readonly<{
  /** Temps logique effectivement présenté par l'instance. */
  timeMs: number
  /** État résolu avant toute contribution de preview. */
  states: readonly SnapshotState[]
}>

type SnapshotPatch = Readonly<{
  target: SnapshotTarget
  /** Doit être égal au `snapshot.timeMs` courant. */
  timeMs: number
  /** Patch logique partiel ; l'incrément ed2 ne produit que `style`. */
  state: Readonly<Record<string, unknown>>
}>

type SnapshotSetResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false
      code: 'INSTANCE_DESTROYED' | 'TIME_NOT_PRESENTED' | 'TARGET_NOT_PRESENT' | 'INVALID_PATCH'
    }>

type CodPlaySnapshotApi = Readonly<{
  /** Lit une frame logique présentée, jamais le DOM ni la preview courante. */
  get(): CodPlaySnapshot | null
  /** Remplace atomiquement l'ensemble de la preview courante. */
  set(patches: readonly SnapshotPatch[]): SnapshotSetResult
  /** Efface la preview courante ; opération idempotente. */
  clear(): void
}>
```

Cette capacité est portée directement par l'instance :

```ts
type CodPlayInstance = Readonly<{
  // ... telco, events, diagnostic
  snapshot: CodPlaySnapshotApi
}>
```

Le bridge ed2 consomme `instance.snapshot` directement. V2 reste propriétaire de la frame logique et de la preview ; aucun adaptateur externe ne maintient de copie de scène ou de cache de pose.

### 0.1.2 Sémantique de contribution

- `set()` remplace l'ensemble précédent, pas seulement les persos cités. Cette opération rend un patch multi-sélection atomique et évite des previews résiduelles.
- Tous les patches d'un appel visent le même temps présenté. Chaque `target` contient `storyId` et `persoId`, ce qui permet de prévisualiser plusieurs stories dans une même instance. ed2 fournit simplement la story unique qu'il prépare aujourd'hui. Sinon l'appel échoue avec `TIME_NOT_PRESENTED` et ne modifie pas la preview.
- `get()` retourne l'état résolu sans preview. L'éditeur compose chaque nouveau patch à partir de cette base et de sa propre session ; il ne relit jamais une valeur de preview pour l'accumuler.
- Au premier incrément ed2, seule la clé `style` est admise dans `state`. Les propriétés de `style` fusionnent clé par clé avec le style résolu, comme une action V2 ; une autre clé est rejetée avec `INVALID_PATCH`. Toute extension de ce vocabulaire exige une décision V2 distincte.
- Une contribution est appliquée après `resolve` et avant `solve` et `component.update`. Elle n'est jamais enregistrée dans le journal ni dans `CompiledScene`.
- `clear()` est l'opération explicite et idempotente qui abandonne la preview. La conservation, le masquage, la reprojection ou l'effacement d'une preview lors d'un seek, d'un changement de sélection, d'un rebuild ou d'un remplacement d'instance ne sont pas décidés à ce stade : ils devront être qualifiés à partir des manipulations réelles de l'interface.
- Les nodes HTML, `subscribeToNode()`, lecture de pose et écriture de pose ne font pas partie de cette surface. Le comportement du Selection Frame est celui déjà fixé en V1 ; sa source technique V2 est la géométrie numérique exposée par la projection HTML, sans lecture ni écriture de décor par le DOM.

### 0.1.3 Preuves propres à l'API

1. lecture par `get()` d'un état interpolé à un temps seeké ;
2. contribution partielle `style` sans perte des propriétés absentes ;
3. remplacement atomique d'une preview mono puis multi-perso ;
4. rejet sans effet d'un temps différent, cible absente et clé non admise ;
5. effacement explicite par `clear()` ;
6. observation documentée des gestes interrompus par seek, changement de sélection, rebuild, remplacement et destroy, sans postuler une annulation automatique ;
7. identité Play/Seek de l'état logique et de sa projection HTML, avant et pendant une preview.

**Fichiers de plan concernés :** `packages/codplay/plan/facade-engine-instance-plan.md` §8, façade/types d'instance V2, puis ce plan ed2.

**Acceptation :** contrat accepté. Le sous-plan V2 est autorisé le 2026-08-30 ;
la validation de l'implémentation reste suivie par les preuves de la tranche dédiée.

### 0.2 Contrat de longueur `cqw` — validé le 2026-08-30

Le contrat fixe la valeur V2 et son origine :

- `OffsetData.x/y/width/height` et `OffsetData.translate.x/y` sont toujours des longueurs `cqw` ;
- le builder porte ces valeurs dans `SceneDoc` sous la forme `{ kind: 'length', unit: 'cqw', value }` ;
- les chaînes CSS libres, les propriétés custom et les valeurs composées (`calc()`, `var()`, gradients, filtres) restent opaques ; une couleur autonome sur une propriété nommée couleur est normalisée en `ColorValue` pour l'interpolation ACE ;
- `100cqw` correspond à la largeur de la racine de scène, y compris pour `y` et `height`, conformément à V1 ;
- V2 interpole deux longueurs `cqw` puis les projette en `px` avec cette largeur de référence, sans qualification CSS dans le materializer ;
- une interpolation entre une longueur `cqw` et une valeur CSS incompatible produit un diagnostic explicite.

Les valeurs unitless CSS, telles que `line-height: '1.2'`, ne sont pas converties : elles restent dans `Decor.style`. Tout futur module ed2 qui produit une longueur doit la déclarer explicitement, plutôt que demander au builder de deviner son intention.

**Fichiers de plan concernés :** spécification V2 de style/ACE, plan de façade, nouveau plan ed2 de builder V2.

**Acceptation :** contrat accepté. Le sous-plan V2 doit prouver : `offset.width: 12.5` devient une longueur logique, les couleurs `color`/`background-color` sont normalisées, `line-height: '1.2'` reste opaque, `object-fit: 'cover'` reste discret, et CSS libre/`calc()` restent opaques, en Play, Seek et resize.

### 0.3 Sous-plan V2 autorisé — longueur `cqw`

Cette intervention est une **feature V2** : aucun comportement V2 existant ne
est corrigé opportunément. Elle se limite aux quatre frontières suivantes :

1. **Builder ed2** (`packages/editor/src/builder-v2`) : remplacer le blocage
   `EDITOR_V2_OFFSET_REQUIRES_CQW` par la projection des champs structurés
   `OffsetData` en valeurs `{ kind: 'length', unit: 'cqw', value }`. Les
   champs `rotate`/`scale` restent numériques ; `anchor`/`ratio` restent
   signalés comme écart séparé. En dehors de la normalisation des couleurs
   autonomes sur les propriétés nommées couleur, `Decor.style`, `custom` et les
   classes ne sont pas réinterprétés.
2. **Résolution V2** (`packages/codplay/src/runtime/player/pipeline`) :
   accepter deux longueurs explicites de même unité dans le tween générique,
   interpoler leur nombre, et conserver la valeur structurée dans l'état
   logique. Une borne `cqw` et une valeur CSS incompatible produisent l'erreur
   dédiée ; aucune propriété CSS n'est consultée.
3. **Projection HTML** (`packages/codplay/src/services/style` et
   `packages/codplay/src/runtime/runner-html`) : convertir uniquement la valeur
   logique `cqw` déjà déclarée en pixels avec `largeur-racine / 100`. La largeur
   est fournie par le host lors de l'initialisation et des resizes ; le
   materializer ne déduit ni unité ni grammaire CSS.
4. **Preuves** : tests du builder, du tween V2, de l'adaptateur style et du
   resize du host. Les cas `line-height`, `object-fit`, CSS libre et `calc()`
   doivent rester inchangés ; les couleurs `color` et `background-color` sont
   normalisées avant compilation.

Les modifications sont autorisées uniquement dans ces frontières. Toute
extension vers la façade snapshot, le bridge éditeur ou les zones reste dans sa
tranche dédiée.

### 0.4 Géométrie de présentation V2 — obligation architecturale, contrat à ouvrir

Cette capacité n'est pas une feature ajoutée pour compenser l'éditeur : elle
achève la frontière V2 `Projection.set / measure / mount`, qui est la raison de
la refonte. Le moteur logique reste portable et ne lit pas le DOM ; la
projection HTML est responsable de mesurer la géométrie réellement produite
après `component.update` et de la rendre interrogeable par l'authoring. Le
runner possède déjà les briques internes de cette mesure (`captureHtmlPose`,
`captureHtmlLayoutSnapshot`, registre des nœuds persistants et
`presentSceneForGeometryCapture`). Elles ne constituent toutefois pas encore
un contrat public de l'instance.

La classification est donc la suivante :

- ce n'est pas un correctif de bug : aucune divergence avec un contrat public
  V2 existant n'est corrigée ; la sortie authoring de `measure` n'a pas encore
  été exposée ;
- ce n'est pas une adaptation V1 : `getNodePose`, `setNodePose`,
  `subscribeToNode` et tout handle DOM sont abandonnés ;
- c'est l'achèvement d'une frontière V2 déjà décidée, qui exige une évolution
  du core et une autorisation séparée de celle de `cqw` et `snapshot`.

Avant toute écriture, le sous-plan devra fixer le contrat public (nom de la
surface et opérations exactes). Ses invariants sont déjà déterminés :

1. fournir la frame de géométrie de la présentation effectivement affichée,
   avec un temps et une révision ;
2. adresser chaque item par son identité de scène/story/perso et indiquer son
   état monté ou absent ;
3. fournir, au minimum, le rectangle viewport, les dimensions locales, la
   matrice affine, l'origine et la relation au parent/racine nécessaires aux
   poignées, au hit-test, au déplacement et au redimensionnement ;
4. inclure les cibles/conteneurs dont l'authoring a besoin pour convertir les
   coordonnées (notamment les pistes de grille résolues), et pas seulement
   l'item sélectionné ;
5. retourner des données immuables, sans référence de node, sans matrice d'un
   overlay FLIP et sans géométrie historique ;
6. publier une frame cohérente après initialisation, `seek`, `resize`,
   `snapshot.set/clear`, rebuild, montage/démontage ou remplacement d'un node,
   afin que l'éditeur ne conserve jamais une pose obsolète ;
7. mesurer les nœuds auteur persistants après leur projection naturelle. Les
   overlays FLIP/DnD restent techniques et ne deviennent jamais la géométrie
   d'édition.

La géométrie ne doit pas être ajoutée à `snapshot` ni à `SolvedScene` :
`snapshot` reste l'état logique indépendant du substrat et `SolvedScene` reste
calculé sans DOM. Le frame géométrique est une sortie de la projection HTML,
consommée par le bridge puis par les machines xState du Selection Frame. Cette
séparation réalise le vDom utile à l'éditeur : état logique V2 d'un côté,
mesure de projection de l'autre, sans aller-retour node → décor.

**Acceptation du sous-plan avant code :** une surface publique et son DTO sont
relus, les transitions de validité et les diagnostics d'absence sont fixés,
les conversions de coordonnées et de grille sont couvertes, et un scénario
navigateur prouve qu'une preview `snapshot` met à jour la géométrie fournie.
Sans cette acceptation et l'autorisation de modifier le core, le bridge ne
peut pas être ouvert.

### 0.4.1 Chemin d'implémentation à préparer

L'inventaire du code montre quatre frontières, qui ne doivent pas être
confondues :

1. **Runner/projection HTML.** À partir de la mesure déjà centralisée dans
   `runtime/motion/html-pose.ts` et `runner-html/layout-snapshot.ts`, produire
   un DTO public plus étroit que `LayoutSnapshot`. Le runner capture la frame
   courante après la projection naturelle et la conserve jusqu'à la prochaine
   invalidation. `getPersoNode()` et `getTargetNode()` restent internes ; ils
   ne sont pas promus comme solution.
2. **Façade d'instance.** Exposer ce DTO par un port authoring V2 distinct de
   `snapshot` et de `telco`. Le port doit notifier la frame après init, seek,
   resize, `snapshot.set/clear`, rebuild et changements de montage. Il ne doit
   pas déplacer la mesure dans `RuntimePlayer`, ni mêler géométrie physique et
   état logique.
3. **Modules Selection Frame.** Remplacer la dépendance `AuthorApi`/node par
   une source de frame numérique : `selection-frame.ts`,
   `multi-selection-frame.ts`, `flex-anchor-tool.ts` et les adaptateurs de
   grille consomment les poses et conteneurs fournis. `overlay-pose.ts` reste
   l'algèbre de l'overlay éditeur, mais ne mesure plus un node du player.
   Les pistes de grille résolues doivent venir de la même transaction de
   projection ; les gestes gardent leur machine xState existante.
4. **Bridge et contrôleur ed2.** Le bridge V2 transmet l'instance et le port
   de géométrie aux acteurs xState. `LibreAdapter` et l'offset bridge ne
   mutent plus le node : ils composent un patch `snapshot` depuis l'état de
   base et remettent les deltas à la session `Decor`. Les événements de
   remplacement, absence et frame obsolète sont traités par les machines
   existantes, sans tracker de node parallèle.

La suppression effective des imports `AuthorApi`, `getNodePose`,
`setNodePose`, `subscribeToNode`, des lectures de pose dans
`decor-editor` et du double protocole offset intervient seulement après la
preuve de ce chemin complet. Les zones restent une tranche ultérieure : leur
preview demeure dans l'éditeur et leur CSS est produit par
`capsule-automation`, indépendamment de ce port de géométrie.

## Plan détaillé d'ouverture du chantier — qualification et portes d'arrêt

Cette section rend le plan exécutable et sépare explicitement les travaux qui
peuvent relever de l'éditeur de ceux qui demanderaient une évolution de
CodPlay. Le « gap » observé aujourd'hui ne signifie pas que le pipeline V2 est
à corriger : le builder V2, le pipeline logique `materialize → resolve → solve`,
`snapshot`, `cqw` et les briques de mesure HTML existent déjà. Le bridge de
l'éditeur et le Selection Frame utilisent encore la verticale V1, tandis que
la sortie publique de géométrie n'a pas encore été fermée. C'est un état de
migration inachevée ; il ne constitue pas, à lui seul, la preuve d'un bug V2.

### Règle impérative de qualification d'un écart

Pour chaque anomalie rencontrée pendant la reprise, l'analyse suit ces six
étapes, dans cet ordre :

1. reproduire le comportement par le chemin navigateur complet de l'éditeur,
   et non par une démo ou un test isolé ;
2. relever la valeur aux frontières `EditorScene`, `SceneDoc`, `CompiledScene`,
   état résolu `snapshot`, frame de géométrie et projection HTML ;
3. comparer la valeur et l'ordre des opérations au contrat déjà fixé ;
4. classer l'écart : **bug V2** seulement si un contrat V2 existant est violé ;
   **feature V2** si la capacité demandée n'existe pas dans ce contrat ;
   **correction éditeur** si l'éditeur conserve une hypothèse V1 ou une voie
   d'état concurrente ; **écart de spécification** si le comportement n'est
   pas décidé ;
5. ouvrir un sous-plan et une autorisation séparés pour tout bug V2 ou toute
   feature V2 ; une correction ne peut pas servir à introduire une feature ;
6. seulement après cette qualification, modifier le périmètre autorisé et
   ajouter la preuve qui aurait échoué avant le changement.

Une différence de forme entre l'ancien `AuthorApi` et la façade V2 n'est donc
pas un motif pour ajouter un adaptateur de compatibilité : le portage abandonne
V1. De même, une mesure manquante dans la façade ne sera pas « réparée » par
une lecture de node dans l'éditeur ; elle est traitée comme l'achèvement de la
frontière V2 `Projection.measure` décrit en §0.4.

### Matrice initiale des écarts et de leur traitement

| Référence | Emplacement constaté | Classe au démarrage | Travail autorisé | Porte d'acceptation |
| --- | --- | --- | --- | --- |
| Builder natif | `packages/editor/src/builder-v2/` | Déjà construit ; preuve pure encore à compléter dans le navigateur | Auditer le mapping et raccorder sa sortie, sans recopier le builder V1 | `SceneDoc` compilable, une story, capsules imbriquées, CSS de `capsule-automation`, ressources média et diagnostics vérifiés sur le chemin façade. |
| Pipeline logique | `packages/codplay/src/runtime/player/pipeline/` | Contrat V2 existant ; aucun correctif déduit de l'ancien bridge | Ne pas le modifier pendant l'inventaire. Toute divergence observée est d'abord reproduite et classée | Même état logique aux temps identiques en Play, Seek et replay ; aucune lecture DOM. |
| Preview logique | `instance.snapshot` | Feature déjà implémentée et validée comme surface | Finir la preuve navigateur et la consommation par l'éditeur | `get/set/clear`, patch atomique multi-item, diagnostics et géométrie rafraîchie après application. |
| Longueurs `cqw` | builder/résolution/projection | Feature V2 déjà portée ; pas de conversion CSS à ajouter | Compléter Play/Seek/resize et vérifier l'éditeur | Offset structuré `cqw` interpolé ; `line-height`, `object-fit`, `calc()` et CSS libre inchangés. |
| Géométrie authoring | `runner-html` mesure en interne, façade sans sortie publique | Feature/frontière V2 obligatoire, non un bug établi | Arrêter le contrat, puis exposer un DTO numérique depuis la projection HTML | Frame cohérente après init, seek, resize, preview, rebuild et montage ; aucune référence DOM. |
| Bridge de scène | `packages/editor/src/app/bridges/scene-player-bridge.ts` | Résidu V1 | Créer et valider un bridge V2 séparé, puis basculer | `build → preload → resources → CSS slot → instance → seek`, une instance active, erreurs transactionnelles. |
| Décor live | `packages/editor/src/decor-editor/mount.ts`, `decor-editor-bridge.ts` | Hypothèse V1 : écriture et lecture du node | Réécrire la preview en contribution `snapshot`, conserver la palette et xState | Aucun `style.*` de l'éditeur écrit sur le node du player ; commit par commande xState. |
| Pose et offset | `offset-editor-bridge.ts`, `@codplay/selection-frame` | `getNodePose`/`setNodePose` et double protocole | Remplacer par delta géométrique → patch logique ; ne pas recréer ces méthodes | Move/resize/rotate/scale, multi-sélection et commit sans pose DOM. |
| Contrôleur | `controller/types.ts`, `controller-machine.ts` | Contexte `authorApi`, `referenceWidthPx`, `offsetBridge` | Faire transiter instance/telco/snapshot/géométrie, sans dupliquer `scene` ou `selection` | Les commandes et la sélection restent dans la machine existante ; aucun état parallèle. |
| CSS/médias | `codplay.preload.css`, `preload.load`, `resources.register` | APIs V2 disponibles, bridge absent | Utiliser le canal CSS direct et le cache média existant, séparément | CSS immédiat et remplaçable ; média déjà préparé réutilisé ; nettoyage au remplacement/destruction. |
| Zones | `scene.zones`, `Decor.zoneId`, `packages/authoring/capsule-automation` | Modèle existant, raccordement possiblement interrompu | Auditer après V2 ; preview uniquement dans l'éditeur | Aucune classe de zone ajoutée à l'interpolation générique ni au player avant la tranche dédiée. |

### Corrections probablement situées dans l'éditeur

Cette liste n'est pas une autorisation de modifier le code ; elle indique où
le diagnostic devra d'abord chercher lorsqu'un écart est observé :

1. `scene-player-bridge.ts` continue à appeler `codplay-v1/creator`,
   `studio.load()` et une URL Blob CSS : c'est la verticale d'intégration à
   remplacer, pas un défaut prouvé de `RuntimePlayer` V2.
2. `decor-editor/mount.ts` applique actuellement le décor résolu sur les
   nodes du player et les suit avec `subscribeToNode` : c'est une écriture DOM
   V1 à retirer au profit de `snapshot.set()` ; la palette et la machine du
   panneau restent en place.
3. `offset-editor-bridge.ts` et `adapters/libre-adapter.ts` lisent et écrivent
   `NodePose`. Le remplacement attendu est le calcul d'un delta depuis la
   frame numérique puis un `SnapshotPatch`, sans nouvelle méthode de pose.
4. `decor-editor-bridge.ts` et `sequence-editor-bridge.ts` lisent encore
   `AuthorApi.getPersoStates()` pour les valeurs temporaires ou l'insertion de
   keyframe. Après le portage, la base doit être `instance.snapshot.get()` ;
   une valeur manquante dans cette lecture est un diagnostic V2 à qualifier,
   pas une raison de relire le DOM.
5. `selection-frame.ts`, `multi-selection-frame.ts`, `flex-anchor-tool.ts` et
   les adaptateurs de grille conservent des trackers de nodes. Ils doivent
   garder leurs machines xState et leur overlay d'éditeur, mais recevoir les
   coordonnées et pistes de grille du port V2 de géométrie.
6. `controller/types.ts` et `controller-machine.ts` stockent encore
   `authorApi`, `offsetBridge` et `referenceWidthPx` comme rendez-vous V1. La
   correction attendue est un changement de payload et de sources, sans
   déplacer le propriétaire `scene`/`selection` hors de xState.

Si l'un de ces points ne peut pas être remplacé avec les contrats A1/C1, le
travail s'arrête et le manque est reclassé comme feature ou écart de
spécification V2. Aucun fallback DOM n'est admis pour fermer artificiellement
le portage.

### Séquence verrouillée et livrables

Les identifiants ci-dessous sont les unités de travail. Une porte « arrêt » est
un blocage volontaire : tant qu'elle n'est pas franchie, le code de la phase
suivante ne doit pas être écrit.

#### A0 — Baseline et inventaire sans modification

**Entrées :** la verticale V1 actuelle, le builder V2 existant, les contrats
CodPlay V2 et les machines xState de l'éditeur.

**Actions :**

- tracer les appels V1 réels de `scene-player-bridge.ts` : construction,
  `load`, `seek`, `PLAYER_READY`, rebuild, destruction et re-sélection ;
- tracer chaque lecture/écriture d'`AuthorApi` dans
  `decor-editor-bridge.ts`, `mount.ts`, `offset-editor-bridge.ts`,
  `sequence-editor-bridge.ts` et `packages/authoring/selection-frame/src/` ;
- relever la chaîne xState actuelle : `scene`, `selection`, `RUN_COMMAND`,
  `RUN_TRANSACTION`, `SEEK`, `SEEK_APPLIED`, `PHASE_ABORT` et les événements
  de cycle de lecture ;
- associer à chaque appel un invariant V1 à préserver et une frontière V2
  cible, sans écrire de traduction de code ;
- exécuter les tests existants de builder, snapshot, preload CSS, média,
  Selection Frame et bridges éditeur afin d'obtenir une photographie avant
  portage. Un échec est enregistré comme constat, pas corrigé dans cette
  phase.

**Livrable :** la matrice ci-dessus complétée par les cas réellement atteints
par l'application et une liste de tests de référence. **Arrêt :** toute ligne
dont la sémantique V1 ou le contrat V2 n'est pas identifiable est remontée
comme écart de spécification ; aucune supposition n'est codée.

#### A1 — Arrêt du contrat de géométrie V2 (validation et autorisation séparées)

Le nom exact du port et du DTO n'est pas inventé ici. Avant de toucher au core,
la revue doit fixer chacun des points suivants :

- surface de l'instance et opérations de lecture/observation (pull synchrone,
  notification, ou les deux) ;
- identité `storyId/persoId`, révision, temps présenté, état `mounted/absent`
  et comportement lorsque la frame est indisponible ;
- systèmes de coordonnées : viewport, racine de scène, parent et local ;
  rectangle, dimensions locales, origine et matrice affine nécessaires aux
  poignées ;
- conteneurs et cibles à retourner, notamment les pistes de grille résolues,
  pour que les conversions de `SelectionFrame` et de multi-sélection soient
  faites dans la même frame ;
- moment de mesure : après `component.update` et projection naturelle, sans
  utiliser les calques FLIP/DnD comme pose auteur ;
- invalidation après init, seek, resize, `snapshot.set`, `snapshot.clear`,
  rebuild, montage, démontage et remplacement ;
- diagnostics de frame obsolète, cible absente, scène remplacée et instance
  détruite ;
- immutabilité du DTO et interdiction de retourner un node, un handle DOM ou
  une opération `get/setNodePose`.

**Livrable :** contrat public relu et marqué `Fixe`, avec critères d'acceptation
et autorisation explicite d'intervention dans CodPlay. **Arrêt :** sans cette
validation, il est interdit de créer `instance.geometry` (ou un autre nom), de
modifier la façade, ou d'ouvrir le bridge éditeur.

#### C1 — Achèvement de la frontière V2 `Projection.measure`

Cette phase est une **feature/frontière V2**, pas un correctif présumé. Elle
ne commence qu'après A1 et son autorisation.

1. Dans `packages/codplay/src/runtime/runner-html/`, réutiliser
   `captureHtmlPose`, `captureHtmlLayoutSnapshot`, le registre des nœuds
   persistants et `presentSceneForGeometryCapture`. Transformer leur sortie en
   un DTO public plus étroit que `LayoutSnapshot` ; les champs FLIP (`targetOrder`,
   frontières et attachments) restent internes.
2. Conserver le cache de frame au niveau de la projection/runner, avec une
   révision changée à chaque invalidation. La capture a lieu après la
   projection de l'état courant, jamais dans `SolvedScene` ni dans le player
   logique.
3. Relayer la frame par `InstanceFacadeImpl`, sans exposer `RuntimePlayer`,
   `HtmlPlayerRunner`, `getPersoNode()` ou `getTargetNode()`.
4. Déclencher une nouvelle frame dans l'ordre défini par A1 et publier les
   diagnostics plutôt que de servir silencieusement une frame obsolète.
5. Ajouter les tests runner/facade et un test navigateur qui compare la frame
   initiale, la frame après Seek, la frame après `snapshot.set`, la frame après
   `snapshot.clear` et la frame après resize. Ajouter parent/enfant,
   reparentage, grid tracks et item absent/monté.

**Invariants non négociables :** `RuntimePlayer` et `SolvedScene` restent
portables et sans DOM ; aucune nouvelle lecture DOM côté éditeur ; aucune pose
FLIP n'est publiée ; la frame correspond à ce qui est effectivement affiché.
**Arrêt :** un test isolé de `captureHtmlPose` ne suffit pas ; le chemin façade
et navigateur doit être prouvé avant E2.

#### E1 — Audit et preuve navigateur du builder V2

Cette phase est côté éditeur et peut s'effectuer après A0, mais elle ne crée
aucun bridge.

- comparer l'entrée `EditorScene` au mapping de
  `packages/editor/src/builder-v2/build-scene.ts`, sans copier
  `packages/editor/src/builder/build-scene.ts` ;
- vérifier la story unique actuelle (`story-main`), les identités stables,
  parentages `move.target`, capsules imbriquées, feuilles text/image/media,
  contenu absent, durée et pré-roll ;
- vérifier que `capsule-automation` est le seul producteur des classes et de
  la feuille CSS de chaque niveau ; le builder ne fabrique ni classe de zone,
  ni URL de preload, ni placement déduit du DOM ;
- vérifier le calcul d'écart entre deux décors du même item : toutes les
  propriétés structurées interpolables voyagent ensemble au même temps,
  classes et propriétés discrètes sont ignorées, les couleurs autonomes sont
  normalisées, les valeurs unitless/CSS composées restent opaques ;
- ajouter une fixture où `x`, `y`, `width`, `height`, rotation, échelle et une
  couleur changent simultanément entre deux décors. À un temps intermédiaire,
  une seule lecture de `snapshot` doit contenir toutes les valeurs au même
  progrès ; une propriété absente doit rester issue de la cascade précédente.
- vérifier que les longueurs structurées sont des valeurs logiques `cqw` et
  non des chaînes CSS ; le materializer ne reçoit aucune décision à prendre ;
- vérifier que `CodPlay.build()` produit le manifeste média et les diagnostics
  attendus sans importer V1.

Une affectation `Decor.zoneId` ou `scene.zones` rencontrée dans cette preuve
reste un avertissement `ZONE_DEFERRED` documenté : elle ne doit ni produire une
classe interpolée, ni être déclarée « corrigée » par ce builder. La preuve
initiale peut utiliser une scène sans zones ; la parité complète avec les
scènes zonées appartient à Z1.

**Classement :** une erreur de mapping `EditorScene → SceneDoc` est une
correction éditeur si le contrat V2 et le modèle ed2 la prescrivent ; une forme
de scène non décidée devient un écart de spécification ; elle ne justifie pas
un changement du core. **Arrêt :** la preuve doit inclure un test navigateur
initial/milieu/fin et Play/Seek, pas seulement les tests purs actuels.

#### E2 — Bridge V2 de scène et transaction de remplacement

Créer un nouveau bridge V2 dans `packages/editor/src/app/bridges/` ; ne pas
modifier le comportement du bridge V1 pour le faire « fonctionner aussi ».
La bascule vers ce fichier est une étape ultérieure et irréversible après
preuve.

**Cycle nominal, dans cet ordre :**

1. recevoir la scène et un numéro de génération monotone du contrôleur ;
2. appeler `buildSceneDocV2()` et arrêter la génération si le résultat comporte
   une erreur ;
3. appeler `codplay.build({ scene: sceneDoc })` et arrêter sur diagnostics
   bloquants ;
4. extraire le manifest de ressources URL du `CompiledScene` ; appeler
   `codplay.preload.load()` avec le mode éditeur ; le cache doit réutiliser un
   média déjà préparé ;
5. appeler `codplay.resources.register()` avec le résultat preload avant la
   création de l'instance ; aucune ressource média n'est clonée dans le DOM ;
6. appliquer `styleSheet` par `codplay.preload.css.set()` sur le slot CSS
   réservé à l'éditeur, immédiatement et séparément du preload média ; ne pas
   créer d'URL Blob ni ajouter la feuille CSS au manifest de ressources ;
7. créer une seule instance V2 sur la racine de scène et ses mount targets ;
8. appeler `instance.telco.seek()` au temps éditeur mémorisé, avec le pré-roll
   du builder, puis attendre la fin effective du seek ;
9. publier dans le contrôleur l'instance V2, sa telco, `snapshot` et la frame
   géométrique validée en A1 ; les bridges consommateurs se branchent sur ces
   ports, jamais sur le runner ;
10. seulement après publication réussie, détruire l'ancienne instance et
    libérer les ressources qu'elle ne partage plus.

**Échec et concurrence :** chaque étape vérifie la génération courante ; une
réponse périmée est ignorée et ses handles sont libérés. L'ancienne instance
et sa feuille restent actives tant que la nouvelle n'est pas prête. Comme
`preload.css.set()` remplace un slot sans transaction, le bridge conserve la
feuille précédente et la restaure sur le même slot si une étape postérieure
échoue ; s'il n'existait pas de feuille, il appelle `clear(slot)`. Cette
restauration est un nettoyage du bridge, pas un nouveau contrat CodPlay.

**Destruction :** un rebuild réussi détruit exactement une fois l'instance et
ses abonnements ; un abandon de génération détruit uniquement les ressources
préparées pour cette génération ; un démontage de l'éditeur détruit l'instance,
libère ses ressources et efface le slot CSS. La règle de démontage d'une scène
Sighty reste une note future, hors périmètre de l'éditeur actuel.

**Arrêt :** aucun `PLAYER_READY` incomplet, aucune instance parallèle, aucun
`studio.load`, `studio.player`, `AuthorApi` ou appel direct au runner ne doit
être présent dans ce nouveau bridge.

#### E3 — Raccordement au contrôleur xState existant

Le contrôleur reste l'unique propriétaire de `EditorScene`, `selection` et des
commandes. Il n'est pas remplacé par le bridge et aucun store authoring
parallèle n'est créé.

- remplacer dans `ControllerContext` les champs V1 (`authorApi`, pose/offset
  bridge et largeur utilisée uniquement pour relire le node) par les ports V2
  arrêtés en A1, tout en conservant `telco` comme façade de transport ;
- conserver `PLAYER_READY` comme rendez-vous de disponibilité, mais remplacer
  son payload V1 par les handles V2 validés. L'événement émis sera renommé
  `instanceReady` dans le contrôleur (nom interne à l'éditeur, sans effet sur
  la façade CodPlay) afin qu'aucun vocabulaire `AuthorApi` ne survive ; il
  n'existera qu'un seul rendez-vous de disponibilité ;
- conserver `sceneCommitted`, `sceneLoaded`, `seek`, `seekApplied`,
  `flushPending`, `sceneReverted` et `playbackActiveChanged` tant que leur
  sémantique reste identique ; changer seulement la donnée transportée et la
  source de resynchronisation ;
- faire passer toutes les écritures par `RUN_COMMAND`/`RUN_TRANSACTION` ; le
  bridge ne persiste ni `Decor`, ni `Content`, ni une sélection ;
- traiter les générations, absences et frames obsolètes comme des événements
  de disponibilité du bridge, sans `assign` qui recrée l'état de scène.

**Arrêt :** la machine doit pouvoir être testée avec un faux port V2 numérique
et une fausse instance sans importer `codplay-v1` ni `@codplay/selection-frame`
pour créer une `AuthorApi`.

#### D1 — Session `Decor` unique, logique et xState

Cette phase remplace le circuit de preview DOM, pas le modèle de commandes de
l'éditeur.

1. Conserver `DecorEditorController`, sa machine xState locale, sa palette et
   sa résolution de cascade ; remplacer `mountDecorEditor` par un montage qui
   rend la palette mais n'écrit plus `applyResolvedDecor` sur un node du
   player.
2. Pour les propriétés qui appartiennent à `state.style` (styles déclarés,
   longueurs d'offset déjà qualifiées `cqw` et déclarations `custom` résolues
   par le builder), construire un patch logique depuis le décor de base et le
   temps courant, puis appeler atomiquement `instance.snapshot.set()` pour
   tous les items concernés. `snapshot.get()` est la base résolue ; la preview
   précédente n'est jamais relue pour l'accumuler.
3. `snapshot` n'admet actuellement que `state.style`. Les classes, les zones,
   le contenu textuel et toute autre clé ne sont donc pas envoyés dans ce port
   par une extension implicite : soit leur preview est déjà couverte par un
   circuit éditeur distinct documenté, soit l'absence de preview immédiate est
   constatée et un contrat V2 séparé est ouvert. La tranche zones ne débute pas
   ici.
4. Utiliser la frame géométrique uniquement pour l'overlay et les gestes. Les
   valeurs de pose sont remises dans leur forme logique `cqw`; aucune conversion
   px→cqw ne se fait à partir d'un node ou d'un cache V1.
5. À la fin d'une phase, produire les commandes `setDecor`/`assignContent` et
   les envoyer à xState avec le copy-on-write existant. Le commit ne passe
   jamais par `snapshot.set()` comme écriture persistante.
6. À l'abandon explicite, appeler `snapshot.clear()` puis laisser xState
   émettre `sceneReverted` selon la sémantique déjà décidée. Aucune annulation
   automatique supplémentaire n'est introduite avant observation des gestes
   réels.
7. Pour l'insertion d'un keyframe, composer la base cascade et la contribution
   `snapshot` du même temps, puis produire la transaction existante ; ne pas
   photographier le DOM.

**Fichiers à traiter :** `decor-editor-bridge.ts`, `decor-editor/mount.ts`,
`decor-editor/css-value-format.ts`, `decor-editor/decor-live-session.ts`,
`sequence-editor-bridge.ts` et les tests de bridge/machine. Le rôle exact de
`referenceWidthPx` doit être supprimé pour les offsets ; s'il reste requis par
une opération d'auto-size strictement éditeur, cette dépendance doit être
documentée et testée séparément, sans la réintroduire dans la pose V2.

Les champs `classes`, `zoneId` et les données de contenu ne sont pas transformés
en pseudo-`style` pour contourner la limite actuelle de `snapshot` : ce port ne
reçoit que `state.style`. Une demande de preview immédiate pour l'un de ces
champs est donc un écart à qualifier, pas une correction silencieuse du
materializer ou du bridge.

**Arrêt :** palette, CSS libre, couleurs, dimensions, move, resize, rotation,
scale, multi-sélection, insertion de keyframe, commit, abandon, seek et
rebuild doivent passer par le même canal logique ; aucune écriture DOM ne doit
être nécessaire pour rendre la preview.

#### D2 — Selection Frame et adaptateurs : géométrie numérique uniquement

Le package `@codplay/selection-frame` devient un consommateur de la géométrie
V2 ; il ne devient pas propriétaire de `snapshot` et ne crée pas de second
service authoring.

- remplacer dans `selection-frame.ts`, `multi-selection-frame.ts` et
  `flex-anchor-tool.ts` les trackers `subscribeToNode`/`TrackedSession` par
  une source de frame validée en A1 ; garder leurs machines xState de gestes et
  l'overlay DOM appartenant à l'éditeur ;
- remplacer les appels de `captureOverlayPose(node)`, `measureWorldRect(node)`
  et `getComputedStyle` du player par les valeurs viewport/locales/matrices du
  frame. Les fonctions d'algèbre de `overlay-pose.ts` peuvent rester si elles
  prennent des nombres déjà fournis ; elles ne doivent plus mesurer un node du
  player ;
- fournir aux adaptateurs flex/grid les conteneurs et pistes résolues de la
  même frame, avec la même révision que l'item. Une grille absente ou une cible
  démontée désactive le geste et publie un diagnostic ; elle ne déclenche pas
  une recherche DOM de secours ;
- réécrire `adapters/libre-adapter.ts`, `adapters/flex-adapter.ts` et
  `grid-placement-adapter.ts` pour calculer un delta logique depuis la frame
  de départ, puis remettre un `SnapshotPatch`. `setNodePose`, `getNodePose`,
  `subscribeToNode`, `NodePose` et le double protocole offset ne reçoivent
  aucune implémentation V2 ;
- en multi-sélection, calculer la collection de patches dans la même révision
  et appeler un seul `snapshot.set()` atomique ;
- réserver `zone-editor.ts` à la tranche zones : il n'est pas réécrit dans D2
  pour faire croire que les zones sont déjà intégrées.

**Arrêt :** un geste complet conserve ses invariants V1 (ancre, correction de
rotation, redimensionnement, copie de dimensions et sélection), mais toutes
les entrées sont numériques et toutes les sorties sont logiques. Les tests
doivent couvrir item monté/absent, parent/enfant, reparentage, scroll/resize,
seek et remplacement de scène.

#### D3 — Bascule applicative, suppression V1 et preuve complète

Après E2, E3, D1, D2 et leurs tests navigateur :

- brancher l'application sur le bridge V2 et retirer les imports
  `codplay-v1/creator`, les types V1 de `PLAYER_READY`, `createAuthorApi`,
  `getNodePose`, `setNodePose`, `getNodeSnapshot`, `getPersoStates`,
  `subscribeToNode` et `createTrackedSession` de la verticale éditeur ;
- conserver les fichiers V1 uniquement s'ils ont d'autres consommateurs
  explicitement hors ed2 ; ils ne sont pas réexportés comme compatibilité V2 ;
- supprimer le double protocole offset et les chemins de preview DOM ; ne pas
  laisser une branche « temporaire » non nommée qui pourrait devenir le
  comportement normal ;
- mettre à jour les README/statuts et cette matrice pour refléter les preuves,
  puis faire la recherche d'imports V1 dans toute l'application éditeur.

**Acceptation :** navigateur réel sur chargement, sélection, palette, geste,
multi-sélection, commit, abandon, keyframe, Play, Pause, Seek, replay, resize,
rebuild, média déjà préchargé, remplacement CSS, destruction et erreur de
preload. Ajouter typecheck, tests ciblés editor/selection-frame/codplay,
builds concernés et Safari. Un test unitaire vert seul ne clôt pas la
verticale.

### Cartographie des preuves à conserver et à ajouter

| Frontière | Preuves existantes à conserver | Preuves à compléter ou créer après le contrat |
| --- | --- | --- |
| Builder ed2 | `packages/editor/tests/builder-v2/build-scene.spec.ts`, distribution/preset et validation de scène | Fixture navigateur du builder réel : une scène sans zones pour la tranche initiale, puis une scène zonée qui conserve `ZONE_DEFERRED` sans masquer l'écart. |
| Compilation et longueurs | `packages/codplay/tests/scene/compiled/scene-builder.spec.ts`, `packages/codplay/tests/runtime/runner-html/player-runner.spec.ts` | Cas façade du builder ed2 avec `cqw`, couleur, propriété unitless, CSS composé et interpolation simultanée. |
| Snapshot et preload | `packages/codplay/tests/facade/snapshot.spec.ts`, `packages/codplay/tests/runtime/preload/preload-css-slot.spec.ts`, `packages/codplay/tests/facade/media-preload-handoff.spec.ts` | Scénario unique build → preload média/CSS → instance → snapshot → geometry, avec remplacement et rollback. |
| Géométrie V2 | `packages/codplay/tests/runtime/motion/motion-capture.spec.ts`, `motion-graph.spec.ts` pour les briques internes | Contrat public runner/facade à créer après A1 : frame, révision, absence, parent/enfant, grid, seek, resize, snapshot et montage. |
| Contrôleur xState | `packages/editor/tests/controller/controller-machine.spec.ts`, `controller.spec.ts` | Rendez-vous `PLAYER_READY`/`instanceReady`, génération de rebuild, erreur et destruction sans état concurrent. |
| Decor | `packages/editor/tests/decor-editor-bridge.spec.ts`, machine, merge, units et mount | Remplacement des fakes `AuthorApi` par instance/snapshot/frame ; preuve palette, CSS libre, pose, keyframe, commit/abandon sans mutation DOM. |
| Selection Frame | `packages/authoring/selection-frame/tests/selection-frame.spec.ts`, `adapters.spec.ts`, `flex-anchor-tool.spec.ts`, `grid-geometry.spec.ts`, `machine.spec.ts`, `overlay-pose.spec.ts` | Tests sur frame numérique, delta logique, item absent, parent/reparent, grid et multi-patch atomique ; `tracked-session.spec.ts` devient une preuve historique à retirer du chemin V2. |
| Intégration finale | tests de démos/runner et vérifications navigateur existantes | Parcours éditeur réel en Play, Pause, Seek, replay, resize, rebuild, média réutilisé, CSS remplacée, destruction et Safari. |

Les noms de tests nouveaux n'anticipent pas une API non arrêtée : ils sont
créés seulement après A1 et portent le nom de la frontière effectivement
validée. Toute preuve qui échoue avant modification est conservée comme
reproduction de l'écart et rattachée à son classement.

#### Z1 — Zones, uniquement après la preuve V2

Cette tranche est explicitement postérieure à D3. Elle commence par l'audit du
travail interrompu autour de `scene.zones` et des appels de
`packages/authoring/capsule-automation` : le modèle n'est pas recréé, et le
builder ne reçoit pas une seconde implémentation de placement.

- conserver `scene.zones` et `Decor.zoneId` comme concepts ed2 ;
- faire produire à `capsule-automation` les classes CSS de placement et la
  feuille scoped, en séparant définition d'une zone, affectation d'un item et
  preview ;
- afficher la preview des zones par l'overlay de l'éditeur, éventuellement
  alimenté par la frame géométrique V2, sans en faire une capacité du player ;
- ne pas inclure les classes ou changements de zone dans le diff interpolé d'un
  décor ; `object-fit` et autres valeurs discrètes gardent la même règle ;
- pour Sighty, conserver en note la règle de fin de scène : lors du démontage
  complet d'une scène, libérer les ressources et en particulier le slot CSS ;
  elle ne fait pas partie de l'intégration ed2 actuelle.

**Arrêt :** un plan zones séparé, relu et accepté, précède toute modification
de code ; aucun avertissement `ZONE_DEFERRED` du builder V2 n'est masqué pour
faire paraître la tranche initiale terminée.

### Portes de validation et autorisations

L'état de départ est désormais explicite :

- `snapshot` : contrat validé, implémentation CodPlay présente, preuve de
  consommation éditeur à faire ;
- `cqw` : contrat validé, implémentation builder/résolution/projection présente,
  preuve façade/navigateur à faire ;
- géométrie : obligation architecturale de V2, contrat public à arrêter et
  intervention core à autoriser séparément ;
- bridge, xState, Decor et Selection Frame : aucune adaptation V1 n'est
  acceptée ; leurs sous-plans sont ceux de E2 à D3 ;
- zones : volontairement hors tranche initiale.

Le chantier ne peut être déclaré « ouvert en code » qu'après A1 et, si la
géométrie n'est pas déjà couverte par un contrat V2 accepté, après
l'autorisation explicite de C1. Toute anomalie trouvée ensuite reçoit son
classement dans A0 avant de modifier le code. Cette règle protège le point de
départ V2 : si le défaut est dans l'éditeur, il est corrigé dans l'éditeur ; si
la capacité manque réellement dans CodPlay, elle est décrite comme feature
V2, justifiée, planifiée et soumise à autorisation, jamais introduite comme un
patch de compatibilité.

### Décision d'implémentation provisoire — conservation de la preview

Pour ne pas imposer une annulation automatique avant l'observation de l'interface,
le port V2 conserve la contribution jusqu'à `snapshot.clear()`. Elle n'est
présentée que lorsque le temps courant correspond au `timeMs` de la contribution ;
un seek vers un autre temps retrouve donc l'état résolu. Cette règle concrétise
provisoirement le contrat et sera réévaluée sur les gestes réels de l'éditeur.

## Tranche 1 — planifier et autoriser les capacités V2 révélées

Cette tranche ne modifie pas l'éditeur. Elle ouvre les sous-plans V2 révélés par
la tranche 0, dont l'exposition obligatoire de la géométrie de projection.

Pour chaque capacité acceptée, le sous-plan doit nommer : contrat public, frontière interne touchée, invariants de scène compilée et journal, sémantique de cycle de vie de la preview, diagnostics, tests unitaires et test navigateur Play/Seek/resize/rebuild. La contribution authoring ne modifie jamais `CompiledScene`, le journal, les événements ni le document ed2.

**Acceptation :** sous-plan V2 accepté et autorisé séparément. En l'absence de cette acceptation, la reprise reste limitée aux travaux ed2 qui ne dépendent pas de la capacité.

## Tranche 2 — construire le builder V2, sans toucher au bridge V1

Créer une verticale de builder V2 dédiée dans `packages/editor/src/builder-v2/`. Le builder V1 `packages/editor/src/builder/build-scene.ts` reste intact et sert seulement de référence pour les fixtures et assertions de comportement ; aucun de ses types, sorties ou chemins d'exécution ne participe à V2.

### 2.1 Entrée et sortie

Entrée : `EditorScene`. La résolution de placement et la production CSS sont déléguées aux
services existants de `capsule-automation` ; le builder n'en recopie pas les règles.

Sortie :

- un `SceneDoc` V2 à une story principale ;
- la source CSS scoped concaténée (`styleSheet`) et la grille racine résolue (`rootGrid`) ;
- un manifeste de preload réservé au bridge navigateur pour les ressources URL de contenu ; la
  feuille générée passe par `codplay.preload.css` ;
- la durée et le pré-roll nécessaires au seek de l'éditeur ;
- des diagnostics de builder structurés, jamais un `SceneDoc` partiel silencieux.

### 2.2 Mapping structurel à porter

| Source ed2 | Sortie V2 | Invariant |
| --- | --- | --- |
| Capsule racine et capsules imbriquées | persos `list` et `move` V2 | parentage et ordre stables ; aucune relation déduite depuis le DOM. |
| `bloc` et `text` | perso `tag` | contenu texte absent conservé absent. |
| `image` | perso `img` | source issue de `Content`. |
| `media` et `video` | perso `media` | tag, source et master préservés. |
| `CapsuleDef` | résolution `capsule-automation` + classes scoped | une seule production des classes et du CSS. |
| `initialDecorId` et premier keyframe | `initial.style` | une propriété n'est jamais écrite deux fois au même instant. |
| paires de keyframes suivantes | action V2 + eventime V2 | interpolation par l'écart de décors résolus. |

Le slice actuellement porté accepte la capsule racine implicite, une arborescence de capsules
imbriquées et les feuilles (`bloc`, `text`, `image`, `video` ou `media`), avec zéro, une ou plusieurs
keyframes. Une absence de mapping produit un diagnostic explicite : elle n'est pas contournée par
V1.

### 2.3 Émission `Decor`

Avant toute émission, extraire ou désigner une résolution pure unique de la cascade. Elle doit servir aux lectures ed2, à l'insertion de keyframe et au builder ; aucun des circuits de résolution V1 ne subsiste dans cette verticale.

Pour chaque item :

1. résoudre le décor initial puis chaque keyframe dans l'ordre temporel ;
2. fusionner `style`, l'offset structuré et le CSS libre selon les règles ed2 existantes ;
3. convertir les seuls champs structurés de longueur en valeurs `cqw`, puis calculer le diff vers le keyframe suivant ;
4. émettre uniquement les propriétés modifiées ;
5. appliquer la transition implicite sur tout l'intervalle, ou l'override `transitionIn`/`transitionOut` existant ;
6. ne pas émettre classes, `zoneId` ni propriétés intrinsèquement discrètes dans ce circuit.

Le CSS libre reste de responsabilité auteur. Ses valeurs composées ne sont pas artificiellement converties en longueurs ; elles suivent seulement les capacités d'interpolation V2 déjà admises.

### 2.4 Preuves de la tranche builder

- tests purs : mapping racine/texte, id, parentage, pré-roll, cascade, diff, durée et easing ;
- cas de deux keyframes où position, dimensions, rotation, échelle et couleur évoluent au même temps logique ;
- cas de valeur unitless, longueur `cqw`, valeur opaque et propriété discrète ;
- compilation par `codplay.build()` et diagnostic d'un type ou style non supporté ;
- test navigateur réel : initial, milieu et fin de l'intervalle, en Play et Seek.

**Acceptation :** le premier incrément produit une `SceneDoc` compilable, sans player V1, et les assertions portent sur état logique et projection HTML. Aucun travail sur palette ou Selection Frame n'est engagé ici.

### État de l'implémentation — 2026-08-30

La première preuve de cette tranche est en place dans une verticale isolée :

- `packages/editor/src/builder-v2/` expose `buildSceneDocV2()` et sa résolution pure de décor ;
- la story déterministe de l'éditeur reste `story-main`, conformément au modèle ed2 existant, tandis que les persos sont natifs V2 (`list` pour la racine et les capsules, `tag`/`img`/`media` pour les feuilles) et utilisent `move.target` ;
- les fixtures couvrent une racine, deux niveaux de capsules, les placements grille, la feuille CSS produite par `capsule-automation`, les mappings `bloc`/`text`/`image`/`video`/`media`, zéro à plusieurs keyframes, une transition `fade`, un diff de couleur, la ressource vidéo et une compilation par `CodPlay.build()` ;
- les erreurs de forme, de contenu et de transition retournent des diagnostics sans `SceneDoc` partiel ; les couleurs autonomes des propriétés nommées couleur sont normalisées par ACE, tandis que `scene.zones` et les classes discrètes sont signalées sans être interpolées ;
- `styleSheet` restitue la source CSS de tous les niveaux résolus, tandis que `preloadManifest` reste explicitement vide à cette frontière pure : le bridge navigateur la transmettra à `codplay.preload.css.set()` sans URL inventée par le builder ;
- les offsets structurés sont désormais portés par des valeurs logiques `{ kind: 'length', unit: 'cqw', value }` ; aucune chaîne `cqw` n'est fabriquée par le builder ;
- la projection HTML applique `largeur-racine / 100` aux longueurs logiques, et le même facteur est recalculé lors d'un resize ; `line-height`, `object-fit`, `calc()` et les autres chaînes CSS restent opaques, hors couleurs autonomes déjà normalisées au builder.
- `instance.snapshot` fournit maintenant la lecture logique sans preview, le remplacement atomique d'une preview `style` et `clear()` directement depuis la façade CodPlay ; les rejets publient leurs diagnostics sans modifier la scène compilée ni le journal.

L'arborescence imbriquée et la feuille CSS ont été incluses dans cette même tranche parce qu'elles
correspondent déjà à la ligne de mapping `CapsuleDef` de ce plan et qu'elles sont produites par le
service existant `capsule-automation` ; il n'y a ni nouveau contrat, ni chemin de placement parallèle,
ni intervention dans le core V2. Cette extension reste limitée au builder pur et à sa preuve de
compilation.

Les tests ciblés du builder et du core passent. Cette tranche reste `En cours` :
la preuve navigateur du host, le bridge navigateur, le circuit `Decor` et les zones
restent à traiter. Le bridge devra appeler `codplay.preload.css.set()` pour rendre `styleSheet` disponible
immédiatement, tandis que les ressources URL continueront de passer par `preload.load()` ; cette
étape n'est pas encore câblée dans l'application.

## Tranche 3 — installer le cycle d'instance V2 dans l'éditeur

Créer un bridge V2 séparé ; ne modifier `scene-player-bridge.ts` qu'au moment de la bascule. Son cycle est :

1. préparer la scène par le builder V2 ;
2. `codplay.build({ scene })` ;
3. précharger uniquement les ressources URL du `CompiledScene` (médias, images et autres ressources
   déclarées), puis enregistrer le résultat dans `codplay.resources` ;
4. appeler `codplay.preload.css.set({ slot, cssText: styleSheet, container })` pour remplacer
   de façon synchrone la feuille CSS de l'éditeur, sans l'ajouter à `codplay.resources` ;
5. créer une unique instance avec la racine HTML de l'éditeur ;
6. seek au temps éditeur mémorisé ;
7. transmettre `instance.snapshot` et la frame de géométrie V2 aux consommateurs une fois l'instance prête ;
8. à un rebuild validé, détruire l'ancienne instance et ses abonnements exactement une fois.

Le bridge doit définir son point de commit : un échec de build ou preload ne publie ni `PLAYER_READY` incomplet, ni snapshot d'une instance détruite. La politique de conservation ou de destruction de l'ancienne preview en cas d'échec est à décider et tester avant code.

Le bridge est un adaptateur d'infrastructure : il remet les résultats V2 aux acteurs xState existants et reçoit leurs commandes par les bridges existants. Il ne possède aucun état de sélection, de `Decor`, de séquence ou de persistance. Toute transition xState nécessaire mais absente doit faire l'objet d'une décision distincte, avant code ; aucune machine parallèle ou voie impérative de contournement n'est admise.

**Fichiers cibles :** nouveau bridge V2 dans `packages/editor/src/app/bridges/`, types et événements
du contrôleur, bridge sequence/telco, appel à `codplay.preload.css` pour le slot CSS scoped.

**Acceptation :** navigateur réel : build, preload URL, application CSS immédiate, instance, Play,
pause, Seek, resize, changement de scène, destruction, rebuild puis re-sélection. Une ressource
média déjà préchargée est réutilisée, le slot CSS ne s'accumule pas et un échec conserve l'ancienne
instance et sa feuille. Un seul `CodPlay` et une seule instance active ; aucune importation V1 dans
la verticale V2.

## Tranche 4 — refaire le circuit `Decor`

Cette tranche commence seulement quand `instance.snapshot`, la frame de
géométrie et le cycle d'instance sont validés.

### 4.1 Point d'entrée unique

Définir une session d'édition de décor avec les opérations explicites preview, commit et abandon. Palette, Selection Frame et multi-sélection produisent toutes un `DecorPatch` dans ce canal. La session :

- construit la contribution temporaire depuis le décor résolu à `timeMs` ;
- l'envoie à `instance.snapshot.set()` pour la preview ;
- remet au contrôleur le patch à persister par l'unique commande ed2 ;
- appelle `instance.snapshot.clear()` lors de l'abandon explicite.

La granularité de persistance pendant un geste (transaction continue ou regroupée) doit préserver la sémantique V1 validée et être décidée explicitement avant implementation. Le devenir du brouillon et de la preview au commit, au seek, au changement de sélection, au rebuild et au destroy reste volontairement ouvert : il sera décidé à partir des manipulations effectives de l'interface, puis couvert par les preuves du circuit.

### 4.2 Consumers à rebrancher

| Consumer actuel | Remplacement V2 attendu | À retirer après preuve |
| --- | --- | --- |
| Palette et CSS libre | `DecorPatch` vers session unique | lecture live depuis le snapshot logique, jamais depuis un node. |
| `LibreAdapter` et offset bridge | patch logique move/resize/rotate/scale vers session | appels ed2 à `setNodePose` et `getNodePose`, offset bridge et double protocole offset. Ces méthodes ne sont pas recréées dans V2. |
| Selection Frame | raccord V2 du comportement existant sur la frame de géométrie exposée ; contribution logique pour la pose | node comme état de décor, observation directe de node. |
| MultiSelectionFrame | diffusion atomique du même patch logique par item | adaptateurs de pose indépendants. |

Le contrôleur conserve cascade, fork d'un décor partagé et copy-on-write. L'insertion d'un keyframe lit le même état logique résolu que la preview ; elle ne recalcule ni style ni pose depuis une autre voie.

### 4.3 Preuves du circuit

- palette : couleur, valeur CSS libre, abandon et commit ;
- cadre : move, resize, rotate, scale, changement de sélection et interruption, selon le comportement existant ;
- multi-sélection : patch identique, persistance atomique et copy-on-write ;
- insertion de keyframe à mi-interpolation ;
- Play/Seek/replay/resize/rebuild sans divergence entre état résolu, preview et décor persisté ;
- Safari, tests ciblés editor/authoring puis suites affectées complètes.

## Tranche 5 — basculer l'application et retirer V1

Remplacer l'usage de `scene-player-bridge.ts`, les types `AuthorApi` V1 et l'offset bridge seulement une fois les tranches précédentes validées. Les appels ed2 à `getNodePose()` et `setNodePose()` sont alors supprimés et ne reçoivent aucun équivalent V2. Mettre à jour le contrôleur, les bridges palette/sequence et les tests qui publient aujourd'hui `PLAYER_READY` avec des objets V1.

La suppression V1 est une conséquence de la preuve d'intégration, jamais le moyen de rendre la migration irréversible. Les fichiers et appels V1 propres à ed2 sont retirés dans une modification dédiée, avec recherche d'imports et test de l'application éditeur réelle. Les méthodes peuvent demeurer dans `packages/codplay-v1` tant que ce runtime possède d'autres consommateurs ; elles ne font plus partie de la verticale ed2 V2.

**Acceptation finale :** décor, interactions, Play, Seek, resize, persistance, destruction et reconstruction dans le navigateur réel ; typecheck, tests pertinents, build et Safari ; absence de double runtime, de lecture DOM du décor et de bridge temporaire.

## Tranche 6 — reprendre les zones, après V2

Auditer le travail interrompu avant toute modification. Le raccordement devra préparer `scene.zones` et l'affectation `Decor.zoneId` pour `capsule-automation`, qui reste l'unique producteur des classes de placement. La preview de zones reste dans l'éditeur et ne devient pas un service du player.

Cette tranche doit décider séparément le comportement temporel de l'affectation de zone : elle est hors de l'interpolation générique `Decor`, et aucune transition de classe n'est introduite implicitement par la reprise V2.

**Acceptation :** plan zones accepté, puis tests de définition, affectation, classes initiales, preview sans player, Play/Seek/resize et persistance.

## Conditions de validation du présent plan

Les décisions de la tranche 0 sont validées. La modification du cœur V2 pour
les seules features `snapshot` et `cqw` a été explicitement autorisée le
2026-08-30 et son port est couvert par les tests unitaires et de façade indiqués
dans l’état ci-dessus. L’exposition de la géométrie est une obligation
architecturale de V2, mais son contrat public et son autorisation de modification
du core restent à produire séparément ; elle ne peut donc pas encore être codée.
Cette autorisation ne couvre ni le bridge éditeur, ni les zones. Le cycle
d’instance, le circuit `Decor`, la preuve de géométrie du Selection Frame et la
suppression des imports V1 restent des tranches distinctes à traiter selon leur
contrat et leurs preuves.
