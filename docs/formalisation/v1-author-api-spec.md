# AuthorApi — spec v1

## Statut

Spec normative v1. Définit la surface d'interface entre les modules authoring et le player codplay.

## Objet

`AuthorApi` est le contrat par lequel les modules authoring (`packages/authoring/`) interagissent avec le player codplay en mode édition. Elle encapsule la surface minimale du player nécessaire aux outils d'édition sans exposer les internals du cycle de rendu runtime.

`createAuthorApi(player)` vit dans `packages/authoring/`. codplay n'a pas connaissance de `AuthorApi` — la direction de dépendance reste `authoring → codplay`.

## Périmètre

**Inclus :**
- Observation du cycle de vie des nœuds DOM par persoId (`subscribeToNode`)
- Lecture de la pose résolue d'un nœud (`getNodePose`)
- Observation de l'état de lecture du player (`subscribeToPlayerState`, `getPlayerState`)
- Convention d'instanciation des modules authoring

**Exclus :**
- Participation au cycle de rendu player — c'est le rôle de `RuntimeModule` (`init / start / update / render`)
- Émission d'événements dans la scène — réservée aux straps et au player
- Manipulation directe des composants runtime codplay

## Relation avec les systèmes existants

### `RuntimeModule`

Le système `RuntimeModule` (`packages/codplay/src/runtime/module-system/`) est instancié par le player pour chaque item qui en a besoin. Il participe activement au cycle `init / start / update / render / onTechnicalEvent / destroy` et peut émettre des événements dans la scène via `emit`.

Un module authoring est différent par nature : il est instancié par l'éditeur, pas par le player. Il observe le player de l'extérieur sans participer à son cycle de rendu. `AuthorApi` et `RuntimeModule` sont deux contrats complémentaires et non substituables.

### `PlayerApi`

`AuthorApi` wrape `PlayerApi`. `subscribeToNode` et `getNodePose` sont ajoutés à `PlayerApi` (voir section ci-dessous) ; les autres méthodes d'`AuthorApi` sont implémentées dans `createAuthorApi` à partir des informations disponibles via `PlayerApi`.

### anime.js comme unique source de vérité de la pose

codplay résout `x`/`y`/`rotate`/`scaleX`/`scaleY`/`width`/`height` via anime.js (`utils.set`, `packages/codplay/src/runtime/components/lib/dom.ts`), qui choisit librement sa représentation DOM (propriétés CSS discrètes ou `transform` composé) — ce choix n'est pas un contrat stable. Un module authoring qui reconstruit cette pose lui-même depuis `getComputedStyle` peut diverger silencieusement de ce qu'anime a réellement écrit, en particulier après un remplacement de nœud (rebuild) où le nouveau nœud ne porte que ce qu'anime y a mis. `getNodePose` élimine cette reconstruction : seul le module qui écrit la pose (anime.js, via codplay) est habilité à la relire (`utils.get`, symétrique de `utils.set`). Aucun module authoring ne doit dépendre d'anime.js directement ni re-décoder le style d'un nœud pour en déduire sa pose.

## Interface

```ts
type PlayerAuthorState = {
  isPlaying: boolean
}

type NodePose = {
  x: number
  y: number
  rotate: number
  scaleX: number
  scaleY: number
  width: number
  height: number
}

type AuthorApi = {
  subscribeToNode(
    persoId: string,
    cb: (node: Element | null) => void
  ): () => void

  getNodePose(persoId: string): NodePose | null

  subscribeToPlayerState(
    cb: (state: PlayerAuthorState) => void
  ): () => void

  getPlayerState(): PlayerAuthorState
}

function createAuthorApi(player: PlayerApi): AuthorApi
```

## Contrats par méthode

### `subscribeToNode`

Souscrit au cycle de vie DOM du nœud correspondant à `persoId`.

Le callback reçoit :
- `Element` — quand le nœud est (re)monté dans le DOM (init player, seek qui remonte l'item)
- `null` — quand le nœud est retiré (seek qui retire l'item, re-init, `player.destroy()`)

**Appel immédiat** : si le nœud est déjà présent au moment de la souscription, le callback est appelé synchronement avec ce nœud avant le retour de `subscribeToNode`.

Plusieurs subscribers peuvent coexister pour le même `persoId`.

Retourne une fonction de désinscription. La désinscription est idempotente. Appeler la désinscription depuis le corps d'un callback en cours est sans effet immédiat sur l'itération courante.

**Pré-condition** : `player.init()` doit avoir été appelé.

### `getNodePose`

Retourne, de façon synchrone, la pose actuellement résolue par anime.js pour le nœud correspondant à `persoId` : `{ x, y, rotate, scaleX, scaleY, width, height }`, toutes valeurs numériques déjà résolues en px/deg/facteur (aucune unité à interpréter côté appelant).

Retourne `null` quand le perso n'a aucun nœud monté (jamais chargé, ou détruit).

Ne lit jamais `getComputedStyle` ni ne décode `style.transform` — délègue entièrement à `utils.get` (anime.js), la même bibliothèque qui a résolu ces valeurs via `utils.set`. Reste correct après un rebuild complet (nouveau nœud, même `persoId`) puisque la lecture porte sur le nœud courant, jamais sur un état mis en cache côté authoring.

**Pré-condition** : `player.init()` doit avoir été appelé.

### `subscribeToPlayerState`

Souscrit aux changements de `PlayerAuthorState`. Le callback est appelé à chaque transition du player qui modifie cet état.

**Appel immédiat** : le callback est appelé synchronement avec l'état courant lors de la souscription.

Retourne une fonction de désinscription.

### `getPlayerState`

Retourne `PlayerAuthorState` de façon synchrone. Peut être appelé à tout moment après `player.init()`.

## Additions requises sur `PlayerApi` (codplay)

`subscribeToNode` doit être ajouté à `PlayerApi` :

```ts
// packages/codplay/src/player/player.ts
subscribeToNode(persoId: string, cb: (node: Element | null) => void): () => void
```

**Implémentation dans `RuntimeComponentOrchestrator`** :

Ajouter un `Map<string, Set<(node: Element | null) => void>>` de subscribers. Chaque appel à `nodeByPersoId.set(persoId, node)` notifie les abonnés avec le nœud. `clear()` notifie tous les abonnés avec `null`. Le player délègue `subscribeToNode` à l'orchestrateur.

Aucun attribut DOM n'est ajouté — la résolution reste dans le runtime.

`getNodePose` doit être ajouté à `PlayerApi` :

```ts
// packages/codplay/src/player/player.ts
getNodePose(persoId: string): NodePose | null
```

**Implémentation** : `Player.getNodePose` résout le nœud via `getRuntimeRegistry().getNodeById(persoId)` (déjà exposé) puis délègue à `readNodePose` (`packages/codplay/src/runtime/components/lib/dom.ts`), qui appelle `utils.get(node, prop, false)` pour chacune des sept propriétés — symétrique de `applyStyleProps`/`utils.set` qui les écrit. Retourne `null` si le nœud résolu n'est pas un `Element`.

`subscribeToPlayerState` et `getPlayerState` sont implémentés dans `createAuthorApi` à partir de l'état interne du player, sans addition nécessaire à `PlayerApi`.

## Cycle de vie de `AuthorApi`

`createAuthorApi(player)` peut être appelé avant `player.init()`. Les souscriptions posées avant `init` sont valides — les callbacks sont déclenchés dès que le player est prêt.

À `player.destroy()` :
- Tous les abonnés `subscribeToNode` reçoivent `null` pour chaque perso connu.
- Tous les abonnés `subscribeToPlayerState` reçoivent `{ isPlaying: false }`.
- Les fonctions de désinscription deviennent no-op.

`AuthorApi` ne doit pas être utilisé après `player.destroy()`.

## Convention d'instanciation des modules authoring

Un module authoring reçoit `AuthorApi` à sa création, pas `PlayerApi`. Signature de fabrique canonique :

```ts
function createXxxModule(opts: {
  authorApi: AuthorApi
  // options propres au module
}): XxxModuleHandle

type XxxModuleHandle = {
  destroy(): void
  // méthodes propres au module
}
```

Un module authoring ne doit pas accéder directement à `PlayerApi`. Si un besoin n'est pas couvert par `AuthorApi`, l'interface doit être enrichie ici plutôt que contournée.

Toute extension doit être ajoutée à cette spec avant implémentation.

## Notes de contexte (non normatives)

Les éléments ci-dessous ne font pas partie de la spec v1. Ils consignent des besoins potentiels identifiés pendant la conception, sans engagement d'implémentation. C'est au projet de décider si et quand ils entrent dans le périmètre.

- **`getCompiledScene()`** — lors de la conception de `SelectionFrame`, un besoin d'introspection de la structure de scène (liste des persos, leurs types) a été anticipé pour des outils de sélection ou d'inspection. Ce besoin n'a pas encore été formulé explicitement.

- **`subscribeToPlayerEvent(eventName, cb)`** — des modules authoring réactifs à la timeline (play, pause, seek) auraient besoin d'un canal d'écoute des événements player. Non discuté à ce stade.

- **`getPersoIds()`** — accès synchrone à la liste des persoIds connus du player, utile pour des outils de sélection multiple ou d'inventaire. Extrapolé depuis le besoin multi-sélection de `SelectionFrame`, non validé.
