# Plan d'implémentation — reprise de l'éditeur avec CodPlay V2

**Statut : En cours — tranche 3 (capacités V2 `cqw` et `snapshot`) implémentée ; bridge éditeur à ouvrir après décision Selection Frame.**
**Cible : ed2 avec CodPlay V2 foundation.**
**Date : 2026-08-30.**

## Objet et frontière

Cette reprise remplace la verticale V1 de l'éditeur par une verticale V2 complète : préparation de `SceneDoc`, compilation, preload, instance, accès authoring et preview `Decor`. Elle n'emporte aucun patch legacy ni couche de compatibilité V1/V2 : V1 ne reste qu'une référence de comportement et de preuves. La verticale V2 nativement construite ne crée ni player parallèle, ni reconstruction de décor depuis le DOM.

Elle se raccorde aux acteurs et machines xState déjà propriétaires de l'état et des commandes de l'éditeur. Le bridge V2 ne duplique ni le contrôleur, ni la machine Decor, ni la machine de séquence, et ne les contourne pas par un état authoring concurrent.

Les zones restent hors de cette première intégration. Leur modèle existe dans `packages/authoring/capsule-automation`, leur preview reste autonome dans l'éditeur, et leur raccordement est une tranche postérieure. Le contexte et les choix expliqués sont dans la [note de contexte](./notes/2026-08-30-editor-codplay-v2-context.md).

## Décisions déjà retenues

- Le builder ed2 prépare le `SceneDoc` V2 ; CodPlay ne connaît pas `EditorScene`.
- `snapshot` est une capacité directe de l'instance V2, au même niveau que `telco`. Elle est créée dans CodPlay et exposée par sa façade ; aucun package `authoring` ne la crée ni ne l'enveloppe. Elle ne connaît ni `EditorScene`, ni `Decor`, ni les classes runtime internes.
- État résolu et contribution temporaire sont logiques. Un node HTML peut servir à la géométrie, au hit-test ou aux pointeurs, jamais à lire ou écrire `Decor`.
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
| Géométrie du Selection Frame | La façade n'expose pas encore la géométrie ou le node matérialisé. | Reprendre nativement en V2 le comportement déjà défini du cadre (sélection, hit-test, pointeurs et gestes) ; ne décider que de sa source V2 — géométrie exposée ou node observable — sans lecture ni écriture de `Decor` par le DOM. |

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
`snapshot`, bridge éditeur, puis bascule des régions et suppression des imports
V1 après preuve navigateur. L'autorisation explicite de modifier le core V2 pour
ces deux features a été donnée le 2026-08-30 ; elle ne couvre pas d'autre
évolution du core.

## Tranche 0 — fermer les deux contrats d'entrée

### 0.1 Contrat snapshot V2 — validé le 2026-08-30

Le contrat validé de la capacité `snapshot`, attachée à une instance V2, précise :

- lecture synchrone de l'état résolu, par `persoId`, au temps effectivement présenté ;
- observation du cycle de lecture nécessaire aux outils, sans piloter ce cycle ;
- remise, remplacement et effacement d'un patch partiel `{ target: { storyId, persoId }, timeMs, state }` ;
- comportement de la preview et du brouillon aux seek, rebuild, destruction et remplacement d'instance, à établir après observation des manipulations réelles ;
- diagnostics pour cible absente, instance détruite, temps non présenté et patch rejeté ;
- éventuelle observation de node, avec référence remplaçable et sans API de pose.

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
- Les nodes HTML, `subscribeToNode()`, lecture de pose et écriture de pose ne font pas partie de cette surface. Le comportement du Selection Frame est celui déjà fixé en V1 ; seule sa source technique V2 (géométrie exposée ou node observable) reste à choisir, sans lecture ni écriture de décor par le DOM.

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

### Décision d'implémentation provisoire — conservation de la preview

Pour ne pas imposer une annulation automatique avant l'observation de l'interface,
le port V2 conserve la contribution jusqu'à `snapshot.clear()`. Elle n'est
présentée que lorsque le temps courant correspond au `timeMs` de la contribution ;
un seek vers un autre temps retrouve donc l'état résolu. Cette règle concrétise
provisoirement le contrat et sera réévaluée sur les gestes réels de l'éditeur.

## Tranche 1 — planifier et autoriser les capacités V2 éventuelles

Cette tranche ne modifie pas l'éditeur. Elle ouvre seulement les sous-plans V2 révélés par la tranche 0.

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
   de façon synchrone la feuille CSS de l'éditeur, sans l'ajouter à `engine.resources` ;
5. créer une unique instance avec la racine HTML de l'éditeur ;
6. seek au temps éditeur mémorisé ;
7. transmettre `instance.snapshot` aux consommateurs une fois l'instance prête ;
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

Cette tranche commence seulement quand `instance.snapshot` et le cycle d'instance sont validés.

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
| Palette et CSS libre | `DecorPatch` vers session unique | lecture live depuis snapshot/node. |
| `LibreAdapter` et offset bridge | patch logique move/resize/rotate/scale vers session | appels ed2 à `setNodePose` et `getNodePose`, offset bridge et double protocole offset. Ces méthodes ne sont pas recréées dans V2. |
| Selection Frame | raccord V2 du comportement existant ; géométrie V2 ou node observable pour le cadre, contribution logique pour la pose | node comme état de décor. |
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
dans l’état ci-dessus. Cette autorisation ne couvre ni une autre évolution du
cœur, ni le bridge éditeur, ni les zones. Le cycle d’instance, le circuit
`Decor`, la source V2 du Selection Frame et la suppression des imports V1
restent des tranches distinctes à traiter selon leur contrat et leurs preuves.
