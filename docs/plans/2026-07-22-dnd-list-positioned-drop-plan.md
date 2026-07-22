# Plan — drag-and-drop positionné pour le composant `list`

## Contexte

`s6-dnd-list-scene.ts` ne fait aujourd'hui qu'un drag-and-drop entre deux
listes fixes (table `DROP_ZONES` codée en dur, résolue une seule fois au
`pointerup`). Déposer un item entre deux autres, ou sur un item existant,
ne produit aucun réarrangement visuel — seul un drop sur une zone de liste
vide aboutit à un déplacement, toujours en fin de liste cible (`move`
statique sans `mode`, retombe sur `'append'`). Aucun "ghost" pendant le
drag.

Le composant `list` (`ListComponent.attachChild`/`detachChild`/
`repositionChild`) et le moteur FLIP (`list-flip/`) supportent déjà
l'insertion à un index précis et son animation — rien à corriger côté
runtime existant. Le travail consiste à faire produire ce `mode` numérique
par un vrai calcul géométrique (hit-testing continu pendant le drag), sans
jamais exposer cette complexité à l'auteur de scène.

Ce chantier a traversé une longue phase de conception erratique (plusieurs
mécanismes de contournement proposés puis rejetés : préfixe d'`actionName`
intercepté, event réservé routé artificiellement, accès aux nodes via un
Strap + `context.api`/`RuntimeRegistrySnapshot`). Ce plan repart des faits
vérifiés dans le code, pas de ces conclusions.

## Principes non négociables (déjà tranchés par l'auteur du projet)

1. **Le perso ne porte jamais l'information dnd** comme champ de
   `PersoDoc`/`ListConfig`. Ce qui est nécessaire (guard/`dropIn`,
   `ghost`) vit entièrement dans la déclaration de `capture` — une
   capture ordinaire, pas un champ de perso.
2. **L'accès bas niveau aux nodes/registries pour un mécanisme de scène
   passe exclusivement par le système `RuntimeModule`** (`host.registries`,
   `host.helpers`) — jamais par une façade publique
   (`RuntimeRegistrySnapshot`/`player.getRuntimeRegistry()`/`context.api`),
   réservées à l'éditeur.
3. **Jamais par un Strap** pour l'application géométrique elle-même
   (attachement/repositionnement réel dans la liste) — exclu
   définitivement, ne pas reproposer.
4. **Pendant la phase active d'une capture (tracking), aucun event codplay
   n'est émis** — seuls l'entrée et la sortie de la capture en émettent.
   `CaptureAction` n'en est déjà pas un (`v1-capture-spec.md` : "une
   `CaptureAction` n'est jamais un `event`"). Ça ne bloque en rien le
   reste de la scène (voir "Faits vérifiés").
5. **Favoriser les applications directes et rapides sur les nodes**
   pendant le tracking (pas de détour, pas de latence).
6. **Les guards de disponibilité dynamique d'une cible** (ex. liste
   pleine) sont une décision d'auteur ordinaire, lue dans `state` — jamais
   encodée en dur dans le module géométrique, jamais de logique
   applicative portée par un perso. Résolue une fois, à l'ouverture du
   drag — jamais pendant, jamais après coup sur un commit déjà appliqué.
   Ce qui fait qu'un item est ou non draggable, ou qu'une liste est ou non
   éligible, est **entièrement à la charge de l'auteur** — codplay ne
   connaît que ce que la fonction de guard lui restitue (voir "Guard et
   state").

## Faits vérifiés qui fondent l'architecture

- Le système `RuntimeModule` (`runtime/components/types.ts:212-350`) :
  `RuntimeModule = { install(host: RuntimeModuleHost): RuntimeModuleBinding }`.
  **`host` — nom utilisé partout dans ce plan, toujours le même objet** :
  celui que le module reçoit en paramètre de sa propre fonction
  `install`, donnant accès à `host.registries` (node/component/container/
  mounted), `host.helpers`, `host.emit(...)` et `host.timeline.currentMs`
  — jamais autre chose, jamais une façade différente selon l'endroit du
  plan. **Code de module uniquement** (`runtime/modules/*/`) : l'auteur
  de scène ne le voit ni ne l'écrit jamais — aucun `host` dans un
  `SceneDoc`, un `capture.*`, un Strap, ou une démo. Deux canaux
  d'invocation indépendants pour un module installé :
  - `hooks` (`beforeUpdate`/`afterUpdate`/etc., `RuntimeModuleBinding.
    runtime.hooks`), filtré par `match.actionKeys`/`componentCapabilities`
    (`RuntimeModuleMatch`, `types.ts:249-252`), déclenché quand une
    **action perso résolue** matche — le pipeline `move`/action normal,
    déjà seek-safe (une action perso est une conséquence d'un vrai
    `StoryEvent` matérialisé, rejouable).
  - `events` (`RuntimeModuleBinding.events`, `types.ts:267`), déclenché par
    `dispatchModuleEvent(name, payload)`
    (`runtime-component-orchestrator.ts:291-297`), appelable soit
    synchrone via `host.emit(...)` (qui matérialise *aussi* un event —
    voir plus bas, à éviter pour le preview), soit directement via
    `renderer.dispatchModuleEvent(name, payload, ms)`
    (`renderer/create-renderer.ts:551-558`, `insertMode: 'persist-only'`,
    **jamais matérialisé sur un track**) — c'est ce second chemin,
    direct, que `applyCaptureTickActions` doit utiliser pour le preview.

- Le composant `list` (spec `v1-list-spec.md`) doit exposer "attacher un
  enfant / détacher un enfant / repositionner un enfant / lire l'ordre
  courant" — déjà le contrat exact de `RuntimeListComponent.attachChild/
  detachChild/repositionChild/getChildrenSnapshot`
  (`runtime/components/types.ts:85-108`, implémenté dans
  `runtime/components/list-component.ts`). Ces méthodes **ne mettent
  jamais à jour elles-mêmes** `host.registries.container`/`mounted` (le
  même `host` que ci-dessus) — cette mise à jour est systématiquement à
  la charge de l'appelant (`runtime/modules/move/index.ts`, ex. lignes
  215-216, 236-238, 276-277, 298-299, 317-318, toujours un
  `setParentId`/`mounted.set` juste après).

- `applyCaptureTickActions` (`create-player.ts:822-864`) est le seul point
  qui reçoit déjà, au même endroit, le flux `CaptureAction` à haute
  fréquence **et** un accès aux nodes. Il ne traite aujourd'hui que
  `action.data.style`, en résolvant les persos cibles par
  `resolvePersoIdsForActionName(action.actionName)`
  (`create-player.ts:789-807` — tous les persos montés dont `actions`
  porte cette clé, pas de `persoId` explicite dans le flux). Le
  dédoublonnage (ligne 833-837, JSON du `action.data` complet comparé à la
  dernière valeur envoyée pour cet `actionName`) profite gratuitement à
  toute extension de `action.data` : un pointeur immobile ne refait rien.

- **Contrainte de seek, déterminante pour la suite** (`v1-capture-spec.md`,
  règle 4, Matérialisation) : *"le tracking n'est jamais materialise en
  track... au seek, seuls les events materialises (`endEmit`, `events` de
  `endCapture`) sont rejoues ; le tracking intermediaire... n'est jamais
  reconstitue tel quel"*. Le commit final doit obligatoirement emprunter
  le canal `endEmit`/action perso normale pour rester seek-safe.

- **La fusion `event.data` → action perso est un merge plat, pas imbriqué**
  (`core/events/dispatch.ts:7-19`, `mergeActionWithEventPayload` :
  `{ ...action, ...payload }`) : les clés de `event.data` (ici, le
  `captureState` accumulé, transporté par `endEmit`) atterrissent au
  **même niveau** que les clés de l'action statique déclarée par
  l'auteur, pas nichées sous une clé d'action. Une action statique
  `actions['item:dropped'] = { listDnd: true }` fusionnée avec
  `captureState = { dropIn: [...], clientX, clientY }` donne
  `{ listDnd: true, dropIn: [...], clientX, clientY }` — le module lit ces
  clés au même niveau que `listDnd` (celle qui sert de `match.actionKeys`).

- **Le drag ne bloque jamais le reste de la scène** — vérifié dans
  `create-player.ts:1558-1591` (`runPlaybackTick`) : `applyCaptureTickActions()`
  (ligne 1583) et `runDueTimelineEventsSync(syncTimelineMs)` (ligne 1588,
  le pipeline normal d'events/straps/listen) tournent l'un après l'autre
  dans le **même tick**, sans verrou ni condition entre les deux. La
  règle "aucun event pendant le tracking" (principe 4) ne porte que sur ce
  que la capture émet elle-même — un timer, une autre story, un `listen`
  déclenché par un event sans rapport continuent de fonctionner
  normalement pendant qu'un drag est actif.

- **Un même event déclenche à la fois un Strap et une action perso** —
  vérifié dans `player.ts` : `routeSceneEvent` (ligne 1302) route les
  `listen` matchés vers `routeMatchingRules` (straps/transform/emit), qui
  appelle ensuite `emitRuntimeEvent` pour le **même** event (ligne 1403) ;
  quand aucun `listen` ne matche, `emitRuntimeEvent` est appelé directement
  (ligne 1354). Dans les deux cas, `emitRuntimeEvent` → `player.emit` →
  `runTimelineEvent` (`create-player.ts:1663`) résout ensuite
  `this.director.runTimelineEvent(event)` (ligne 1680) — la résolution
  d'action perso — **inconditionnellement**, qu'un Strap ait tourné ou
  non. `endEmit` peut donc déclencher à la fois un Strap (via `listen`) et
  l'action perso du perso dragué (via le module) — pas une alternative
  exclusive. **Mais l'ordre compte** : dans `routeMatchingRules`
  (`player.ts:1370-1401`), les straps d'un event tournent **avant** que ce
  même event n'atteigne `emitRuntimeEvent`/le director (ligne 1403) — un
  Strap sur `item:dropped` lui-même tournerait donc *avant* que le module
  ait résolu `commit()`, sans encore connaître `listId`/`index` (voir
  "Guard et state").

- **Un event `source: 'module'` passe par `listen`/les straps, mais jamais
  par le director** — `create-player.ts:1674-1678` (`runTimelineEvent`) :
  `if (event.source === RUNTIME_EVENT_SOURCE.module) { ...
  dispatchModuleEvent(...); return }`, un retour précoce qui saute
  `this.director.runTimelineEvent(event)`. Ce retour précoce n'intervient
  que dans `runTimelineEvent`, en aval de `routeMatchingRules` — les
  straps, résolus plus haut dans `player.ts`, tournent normalement pour un
  event `source: 'module'`. C'est le mécanisme qui permet à un event émis
  par le module lui-même (`host.emit`, `source: 'module'` posé par
  `runtime-component-orchestrator.ts:351`) de déclencher un Strap sans
  jamais risquer de redéclencher une action perso.

- `capture.stateScope` (`capture-types.ts:99-108`, `'story' | 'scene'`,
  défaut `'story'`) existe déjà et est déjà résolu par
  `resolveCaptureState()` (`capture-runtime.ts:179-183`) avant chaque
  appel à `initCaptureState`/`endCapture`. Rien à ajouter ici : le guard
  lit `state.dnd`, quel que soit le scope choisi par l'auteur sur sa
  capture.

- `list-flip/engine/dom-matrix.ts` fournit déjà
  `captureCombinedMatrixForNode`/`worldDeltaToLocalDelta` (transposition
  écran→local rotation-aware, réutilisées telles quelles pour le
  hit-testing — pas de fonction point-absolu existante, seulement des
  deltas, adaptée dans `list-dnd`).

- `dom-component-adapter.ts:162-198` (`resolveRootEmitRule`) résout
  `emit.pointerdown` (`EmitRuleAction`, `runtime/types.ts:60-70`) et passe
  déjà `capture: action.capture` tel quel à `startCapture({ capture,
  persoId: item.id, storyId: item.storyId, ... })` — `ghost` tient comme
  champ simple sur cet objet `capture`, aucune couche intermédiaire à
  ajouter.

## Architecture retenue

Deux canaux séparés, pour deux rôles séparés — ne jamais les confondre :

### 1. Preview (ghost pendant le drag) — transitoire, jamais matérialisé

- L'auteur déclare `ghost?: { className?: string; style?: Record<string,
  string | number> }` directement sur `capture` — statique, optionnel,
  aucune fonction (voir "Ghost"). Le reste (`trackOn`/`endOn`/
  `initCaptureState`/`endEmit`) reste une capture normale, exactement
  comme aujourd'hui dans `s6-dnd-list-scene.ts`.
- `trackCommand` est optionnel et n'a, pour le cas courant, qu'un rôle :
  contrôler la position de l'item pendant le drag — jamais une notion
  d'`actionName`/`CaptureAction` à construire soi-même (voir plus bas,
  `CaptureTickResult`). Exemple d'usage — une ligne :
  ```ts
  trackCommand: ({ sample }) => ({ position: { x: sample.clientX, y: sample.clientY } })
  ```

  Par défaut, quand l'auteur n'écrit aucun `trackCommand`, le
  comportement est exactement celui de cet exemple (suivi 1:1 du
  pointeur) — pas une absence de suivi.
- L'auteur n'écrit jamais le signal de preview lui-même : rien à décider
  dedans — `clientX`/`clientY`/`candidateListIds` sont tous dérivables de
  données que la capture possède déjà (`clientX`/`clientY` dans `sample`,
  `candidateListIds` = `captureState.dropIn`). `draggedPersoId` n'a même
  pas besoin d'être produit ici — voir plus bas.
- **`CaptureAction` (`actionName`+`data`) reste intact, pas touché.** Ce
  type est un catalogue par nom — résoudre, via `actionName`, lequel des
  persos ayant déclaré `actions[actionName]` est concerné
  (`resolvePersoIdsForActionName`). C'est le mécanisme exact que
  `space-bubbles-scene.ts` (le turret) et `quiz-hunt/extra-story.ts` (le
  token) utilisent déjà, et il reste disponible tel quel pour qui veut
  continuer à l'écrire à la main. Mais ici il n'y a jamais de catalogue :
  une capture a un seul target, connu d'avance (`persoId`, dans la
  fermeture de `startCapture` depuis le début, jamais besoin d'être
  redécouvert). Fabriquer un `actionName` (même égal à `persoId`) pour
  faire passer `position`/`dnd` par ce canal serait tordre l'objet pour
  le faire ressembler à une action qu'il n'est pas. `position`/`dnd`
  empruntent donc un canal **séparé**, honnête, qui ne prétend jamais
  être une action :

  ```ts
  export type CaptureTickResult = {
    action?: CaptureAction                       // catalogue par nom — inchangé, existant
    position?: Record<string, number | string>   // valeur directe, persoId connu par l'abonnement
    dnd?: Record<string, unknown>                 // idem
    captureState?: CaptureState                   // inchangé, comme aujourd'hui
    updateState?: Record<string, unknown>          // inchangé, comme aujourd'hui
  }
  ```

- `persoId` voyage par **l'abonnement lui-même**, jamais par la donnée du
  tick : `subscribeCaptureTick(persoId: string, fn: () => CaptureTickResult
  | void): () => void` — `startCapture` le connaît déjà (`persoId` est un
  de ses propres paramètres) au moment où il s'abonne :

  ```ts
  // capture-runtime.ts
  unsubscribeCaptureTick = subscribeCaptureTick(persoId, () => {
    const result = pendingResult
    pendingResult = undefined
    return result
  })
  ```

  ```ts
  // create-player.ts — captureTickSubscribers devient Set<{ persoId, fn }>
  subscribeCaptureTick(persoId: string, fn: () => CaptureTickResult | void): () => void {
    const entry = { persoId, fn }
    this.captureTickSubscribers.add(entry)
    return () => { this.captureTickSubscribers.delete(entry) }
  }
  ```

- `capture-runtime.ts`'s `runTrackCommand` (lignes 202-223) : chemin
  catalogue inchangé si l'auteur construit `output.action` lui-même ;
  sinon, résout `position` (déclarée ou par défaut) et le signal dnd
  (quand `captureState.dropIn` est un tableau — le marqueur "capture
  dnd", pas un nouveau champ), sans jamais construire de `CaptureAction` :

  ```ts
  function runTrackCommand(sample: CaptureSample): void {
    samples.push(sample)
    const output = capture.trackCommand?.({ sample, samples, captureState })
    if (output?.captureState !== undefined) captureState = output.captureState
    if (output?.updateState !== undefined) applyStateUpdate?.(capture.stateScope ?? 'story', storyId, output.updateState)

    if (output?.action !== undefined) {
      pendingResult = { action: output.action } // chemin catalogue, inchangé
      return
    }

    const isPointerSample = 'clientX' in sample
    const dropIn = (captureState as { dropIn?: unknown }).dropIn
    const isDndCapture = Array.isArray(dropIn) && isPointerSample

    const position = output?.position ?? (
      capture.trackCommand === undefined && isPointerSample
        ? { x: (sample as PointerCaptureSample).clientX, y: (sample as PointerCaptureSample).clientY }
        : undefined
    )

    if (position === undefined && !isDndCapture) return

    pendingResult = {
      position,
      dnd: isDndCapture
        ? { clientX: (sample as PointerCaptureSample).clientX, clientY: (sample as PointerCaptureSample).clientY, candidateListIds: dropIn, ghost: capture.ghost }
        : undefined
    }
  }
  ```

  Le fallback par défaut ne s'applique que quand `capture.trackCommand`
  est absent — un auteur qui écrit son propre `trackCommand` mais omet
  `position` sur un tick précis a fait ce choix délibérément, le défaut
  ne l'écrase pas.
- `applyCaptureTickActions` (`create-player.ts`) traite les trois cas
  indépendamment, `persoId` venant de l'abonnement, jamais de la donnée :

  ```ts
  for (const { persoId, fn } of this.captureTickSubscribers) {
    const result = fn()
    if (!result) continue

    if (result.action !== undefined) {
      // chemin catalogue, byte-for-byte inchangé : resolvePersoIdsForActionName(result.action.actionName)
    }
    if (result.position !== undefined) {
      // chemin direct : target = renderer.getRuntimeRegistry().getNodeById(persoId)
    }
    if (result.dnd !== undefined) {
      this.renderer.dispatchModuleEvent('list-dnd:preview', { ...result.dnd, draggedPersoId: persoId }, event.ms)
    }
  }
  ```

  Jamais `host.emit`/`listen`/`director`/track pour le cas `dnd`
  (`host.emit` matérialiserait un event, voir "Faits vérifiés").
- Le module `list-dnd`, via son handler `events['list-dnd:preview']`,
  résout la position (hit-testing rotation-aware) et repositionne
  uniquement les **voisins** via `repositionChild` — jamais l'item dragué
  lui-même (voir "Détachement" plus bas). Idempotent : rappeler avec la
  même position ne produit aucun mouvement supplémentaire.

**Note pour un futur chantier, hors scope ici** : `CaptureAction` lui-même
mélange plusieurs préoccupations (catalogue par nom, dédoublonnage,
payload libre) et mériterait d'être revu — pas touché dans ce plan, le
canal `CaptureTickResult` ci-dessus l'évite plutôt que de le corriger.

### 2. Commit (au relâchement) — action perso normale, seek-safe

- La fin de capture (`endEmit`, **inchangé**, `source: 'system'` comme
  aujourd'hui) déclenche une action perso normale. L'auteur déclare
  `actions['item:dropped'] = { listDnd: true }` — un simple marqueur pour
  `match: { actionKeys: ['listDnd'] }`. `endEmit.data` est omis, donc
  retombe sur `captureState` (`capture-runtime.ts:321`,
  `data: capture.endEmit.data ?? captureState`), qui porte `dropIn`/
  `clientX`/`clientY` accumulés pendant le drag — fusionnés à plat dans
  l'action au moment de la résolution (voir "Faits vérifiés").
- Le module `list-dnd` (`RuntimeModule` enregistré via `registerModule`,
  comme `moveModule`/`listModule`/`replaceModule` dans
  `runtime-component-orchestrator.ts:130-132`), avec `match: {
  actionKeys: ['listDnd'] }` et des hooks `beforeUpdate`/`afterUpdate`
  (motif identique à `replaceModule`), résout la géométrie finale (accès
  natif `host.registries`) et applique le move réel (`attachChild`/
  `detachChild`/`repositionChild` + mise à jour des registries, comme
  `moveModule` le fait déjà pour un `move` standard). Le `draggedPersoId`
  n'a pas besoin d'être porté par les données : il se résout depuis
  `payload.resolvedAction.listenerId`/`targetId`, exactement comme
  `replaceModule.resolvePersoId` (`runtime/modules/replace/index.ts:16-23`).
- Ce chemin est nativement seek-safe : c'est une action perso ordinaire,
  déclenchée par un `StoryEvent` matérialisé normalement — rejouée au
  replay exactement comme n'importe quelle action `move` aujourd'hui.

### Détachement de l'item pendant le drag

Pratique de référence du drag-and-drop de liste (Sortable.js, `dnd-kit`,
HTML5 natif) : l'item dragué est détaché du flux logique de sa liste
source dès l'ouverture du drag (il garde son propre node, visible, suivi
libre du pointeur), pour que le calcul des voisins n'ait jamais à
compenser sa présence. Le module fait ce détachement de façon idempotente
au premier `previewAt`.

## Guard et state

Codplay ne connaît et ne doit connaître que deux choses, résolues une
fois à l'ouverture du drag : si l'item est actuellement draggable, et si
oui, la liste des cibles valides (`dropIn`). Tout le reste (comptage,
capacités, règles de jeu) reste entièrement à la charge de l'auteur, dans
son propre `state` — codplay ne lit jamais sa forme, seulement ce que la
fonction de guard restitue.

### Changements de contrat capture (trois, tous dans `capture-runtime.ts`/`capture-types.ts`)

`CaptureInitFn` (`capture-types.ts:48`) passe de `(input) => CaptureState`
à `(input) => CaptureState | false`. `capture-runtime.ts:187-189` doit
vérifier ce retour **avant** de souscrire à `subscribeCaptureTick`/
`endOn`/`trackOn` (lignes 356-370) :

```ts
const initResult = capture.initCaptureState
  ? capture.initCaptureState({ state: resolveCaptureState() })
  : {}
if (initResult === false) {
  return () => {} // aucun listener jamais installé, cycle annulé avant de commencer
}
let captureState: CaptureState = initResult
```

`false` arrête le cycle avant qu'aucun `trackOn`/`endOn` ne soit posé —
pas un rejet après coup sur un commit déjà appliqué (principe 6).

Les deux autres changements — le nouveau type `CaptureTickResult`
(`action?`/`position?`/`dnd?`/`captureState?`/`updateState?`, `action`
restant le seul chemin qui parle d'`actionName`), et `runTrackCommand`/
`subscribeCaptureTick` qui font voyager `persoId` par l'abonnement plutôt
que par la donnée — sont décrits en détail dans "Architecture retenue §
1. Preview", pas répétés ici.

### State : exemples isolés, pas un helper

Codplay n'impose ni classe ni type pour `state.dnd` — seulement le
contrat de retour de la fonction de guard (`false | { dropIn: string[] }`,
lue à `initCaptureState`). Ce qui suit est trois exemples indépendants,
chacun illustrant une seule notion, à réécrire par l'auteur selon ses
propres besoins — pas une API à importer.

**Forme de state (exemple) :**
```ts
type MyDndState = {
  listCapacity: Record<string, { max: number; count: number }>
  draggableItemIds: string[]
}
```

**Guard, dans `initCaptureState` (exemple)** — décide `false` (arrêt) ou
`dropIn` :
```ts
initCaptureState: ({ state }) => {
  const dnd = state.dnd as MyDndState
  if (!dnd.draggableItemIds.includes(itemId)) return false
  const dropIn = Object.entries(dnd.listCapacity)
    .filter(([, capacity]) => capacity.count < capacity.max)
    .map(([listId]) => listId)
  return { dropIn }
}
```
Ce qui déclenche `false` est entièrement à la charge de l'auteur — cet
exemple choisit "non draggable ⇒ arrêt" ; un autre auteur pourrait laisser
le drag s'ouvrir même avec `dropIn: []` (principe 6).

**Mise à jour du state (exemple)**, dans le Strap déclenché par
`list-dnd:dropped` (voir plus bas) :
```ts
updateDndState: ({ state, event }) => {
  const dnd = state.dnd as MyDndState
  const { persoId, listId } = event.data as { persoId: string; listId: string }
  const capacity = dnd.listCapacity[listId]
  return {
    update: {
      dnd: {
        listCapacity: capacity
          ? { ...dnd.listCapacity, [listId]: { ...capacity, count: capacity.count + 1 } }
          : dnd.listCapacity,
        draggableItemIds: dnd.draggableItemIds.filter((id) => id !== persoId)
      }
    }
  }
}
```

Le Strap de comptage **n'écoute pas** `item:dropped` (l'event qui porte
l'action `listDnd`) mais un event distinct, `list-dnd:dropped`, émis par
le module lui-même dans son hook `afterUpdate` une fois `commit()`
résolu — `host` ici est le même objet que partout ailleurs dans ce plan
(voir "Faits vérifiés" : le paramètre reçu par `install(host)`) :

```ts
function install(host: RuntimeModuleHost): RuntimeModuleBinding {
  function afterUpdate(payload: RuntimeModuleHookPayload): void {
    // ... résout `target` via commit(), voir "Architecture retenue § 2. Commit" ...
    host.emit({
      name: 'list-dnd:dropped',
      payload: { persoId, listId: target.listId, index: target.index },
      insertMode: 'persist-only',
      ms: host.timeline.currentMs
    })
  }
  return { runtime: { hooks: { afterUpdate }, match: { actionKeys: ['listDnd'] } } }
}
```

Exactement le pattern déjà en place dans `replaceModule`
(`runtime/modules/replace/index.ts:53-58`, `'replace:initial-size'`) — pas
un mécanisme nouveau. Ce n'était **pas** possible sur `item:dropped`
lui-même : comme noté plus haut ("Faits vérifiés"), les straps d'un event
tournent avant que ce même event n'atteigne le director — au moment où un
Strap sur `item:dropped` tournerait, le module n'a pas encore résolu
`commit()`, donc pas encore de `listId`. Un event séparé, émis *depuis* la
résolution elle-même, est la seule séquence qui fonctionne.

Ce follow-up event (`source: 'module'`) passe bien par
`routeSceneEvent`/`listen` comme un event normal — seul le director est
court-circuité pour lui (voir "Faits vérifiés"), donc aucune action perso
ne peut être redéclenchée par accident derrière. Le Strap de comptage le
reçoit avec `event.data = { persoId, listId, index }`, et met à jour
`state.dnd` comme dans l'exemple ci-dessus — jamais la géométrie
elle-même (principe 3).

## Ghost

Un placeholder DOM, jamais un perso, jamais suivi par `registries`/FLIP —
purement géré par le module `list-dnd` lui-même.

- Config statique, déclarée par l'auteur directement sur `capture.ghost`
  (`className?: string`, `style?: Record<string, string | number>`) — les
  deux optionnels. Pas de champ `dnd` séparé sur `emit.pointerdown` :
  `startCapture` reçoit déjà l'objet `capture` complet, `ghost` y tient
  comme champ simple, sans nouvelle couche.
- Dimensions : toujours calquées sur `draggedNode.getBoundingClientRect()`
  (`width`/`height` inline), imposées par le module, indépendamment de la
  config — l'auteur peut les écraser via `style` s'il le souhaite.
- Classe : celle fournie par l'auteur, sinon une constante conventionnelle
  exportée par le module (`DEFAULT_GHOST_CLASS_NAME`) — toujours présente,
  pour rester ciblable en CSS même sans config. Codplay ne fournit aucune
  règle CSS pour cette classe : par défaut, aucun style visible au-delà
  des dimensions.
- Cycle de vie, à la charge du module (`Map<persoId, HTMLElement>` interne
  à l'instance, même pattern que `nextSyntheticEventSeq`) : création au
  premier `previewAt` pour un `draggedPersoId` donné ; réinsertion brute
  (`insertBefore`/`appendChild`, pas `attachChild`) à l'index résolu à
  chaque `previewAt` suivant ; suppression inconditionnelle dans
  `commit()`, que la cible ait été trouvée ou non — seul point de fin de
  drag garanti d'être appelé une fois.

## Fichiers critiques

- `packages/codplay/src/runtime/modules/list-dnd/create-list-dnd-module.ts` —
  module géométrique pur, déjà en place (hit-testing rotation-aware,
  `previewAt`/`commit`) : aujourd'hui juste une classe instanciée
  directement dans les tests, pas un vrai `RuntimeModule`. À faire
  implémenter `RuntimeModule.install(host)`, retournant `runtime: {
  hooks: { beforeUpdate, afterUpdate }, match: { actionKeys: ['listDnd'] } }`
  (`beforeUpdate`/`afterUpdate` appellent `commit()` puis `host.emit(
  'list-dnd:dropped', ...)`, motif `replaceModule`) et `events: {
  'list-dnd:preview': handler }` (appelle `previewAt()`) — à enregistrer
  réellement via `registerModule`, à étendre avec le cycle de vie du
  ghost.
- `packages/codplay/src/runtime/capture-types.ts:95-113` —
  `CaptureDeclaration` élargi d'un champ `ghost?: { className?, style? }`.
  `CaptureInitFn` (ligne 48) élargi à `CaptureState | false`. Pas de
  changement sur `EmitRuleAction`/`dom-component-adapter.ts` : `ghost`
  tient directement sur `capture`, déjà reçu tel quel par `startCapture`.
- `packages/codplay/src/runtime/capture-runtime.ts:187-189` — vérifie le
  retour `false` avant de souscrire aux listeners.
- `packages/codplay/src/runtime/capture-types.ts` — nouveau type
  `CaptureTickResult = { action?: CaptureAction; position?:
  Record<string, number | string>; dnd?: Record<string, unknown> }`.
  `CaptureAction` lui-même **non modifié**. `CaptureTrackFn` retourne
  `CaptureTickResult | void` au lieu de `CaptureTrackOutput` (le nouveau
  type absorbe `captureState`/`updateState` en plus des trois champs
  ci-dessus).
- `packages/codplay/src/runtime/capture-runtime.ts:202-223` —
  `runTrackCommand` construit `pendingResult: CaptureTickResult`
  (chemin catalogue inchangé si `output.action` est fourni ; sinon
  `position`/`dnd` calculés, voir "Architecture retenue § 1. Preview").
  Souscription à `subscribeCaptureTick(persoId, fn)` — signature élargie
  d'un premier paramètre `persoId`.
- `packages/codplay/src/player/create-player.ts` — `subscribeCaptureTick`
  élargi d'un paramètre `persoId`, `captureTickSubscribers` devient
  `Set<{ persoId: string; fn: () => CaptureTickResult | void }>` (au lieu
  de `Set<() => CaptureAction | void>`). `applyCaptureTickActions`
  (lignes 822-864) traite `action`/`position`/`dnd` indépendamment,
  `position`/`dnd` résolus directement via le `persoId` de l'abonnement,
  jamais par `resolvePersoIdsForActionName`.
- `packages/codplay/src/runtime/components/runtime-component-orchestrator.ts:130-132` —
  enregistrement de `listDndModule` aux côtés de `moveModule`/`listModule`/
  `replaceModule`.
- `packages/demos/src/scenes/s6-dnd-list-scene.ts` — réécrit pour utiliser
  la nouvelle forme (`capture.ghost`, `actions['item:dropped'] = {
  listDnd: true }`), retire `DROP_ZONES`/le hit-testing manuel de
  `drop-resolver`. Le Strap qui reste devient un lecteur/écrivain de
  `state.dnd` (forme libre, voir "Guard et state"), pas un résolveur
  géométrique.

## Vérification

- Tests unitaires : le module géométrique isolé (déjà couvert dans
  `tests/lot20/list-dnd-module.spec.ts`) et le changement de contrat
  `CaptureInitFn` (`false` annule le cycle avant tout listener).
- Test d'intégration : capture réelle simulée (pattern
  `tests/lot20/capture-runtime.spec.ts`, vrais `PointerEvent`), vérifiant
  que le preview repositionne les voisins sans matérialisation, que le
  ghost apparaît/disparaît correctement, et que le commit produit une
  action `move` réelle, rejouable au seek.
- `tests/lot20/list-dnd-preview-commit.spec.ts` — à corriger : utilise
  aujourd'hui `player.getRuntimeRegistry()` (façade éditeur), à migrer
  vers le pattern `RuntimeComponentOrchestrator` réel (`loadPersos`/
  `routeUpdates`), une fois le module enregistré pour de vrai.
- Validation manuelle : démo `s6-dnd-list-scene.ts` en navigateur —
  poussée animée des voisins pendant le drag, ghost visible à l'endroit
  attendu, absence de jank au commit, comportement identique après un
  seek.

## Appendice — exemple d'usage (l'indispensable)

```ts
// state initial de la story (ou de la scene, selon capture.stateScope) — forme libre
type MyDndState = {
  listCapacity: Record<string, { max: number; count: number }>
  draggableItemIds: string[]
}
state: {
  dnd: {
    listCapacity: { 'list-a': { max: 3, count: 0 }, 'list-b': { max: 3, count: 0 } },
    draggableItemIds: ['item-1', 'item-2', 'item-3', 'item-4', 'item-5', 'item-6']
  } satisfies MyDndState
}

// un item dragable
function makeItemPerso(id: string, label: string) {
  return {
    id,
    type: 'text',
    initial: { tag: 'div', content: label, move: { parentId: 'list-source' } },
    emit: {
      pointerdown: {
        capture: {
          stateScope: 'story',
          initCaptureState: ({ state }) => {
            const dnd = state.dnd as MyDndState
            if (!dnd.draggableItemIds.includes(id)) return false
            const dropIn = Object.entries(dnd.listCapacity)
              .filter(([, capacity]) => capacity.count < capacity.max)
              .map(([listId]) => listId)
            return { dropIn }
          },
          // trackCommand est optionnel — omis ici : le suivi 1:1 du pointeur s'applique par défaut,
          // et le signal de preview dnd est produit automatiquement dans les deux cas (voir
          // "Architecture retenue § 1. Preview"). Forme complète si un comportement différent est
          // voulu (axe verrouillé, clamp, snap...) :
          // trackCommand: ({ sample }) => ({ position: { x: sample.clientX, y: sample.clientY } }),
          //
          // ghost est optionnel lui aussi — omis ici, la classe/dimensions par défaut suffisent :
          // ghost: { className: 'my-ghost', style: { opacity: 0.5 } },
          endEmit: { name: 'item:dropped' } // data absent -> fallback captureState (dropIn + clientX/clientY)
        }
      }
    },
    actions: {
      'item:dropped': { listDnd: true } // marqueur -> match.actionKeys: ['listDnd']
    }
  }
}

// story.listen — le comptage réagit au follow-up event du module, pas à endEmit lui-même
listen: [{ on: 'list-dnd:dropped', straps: ['updateDndState'] }]

// strapCollection (passé séparément à player.init, pas un champ de SceneDoc)
const strapCollection = {
  updateDndState: ({ state, event }) => {
    const dnd = state.dnd as MyDndState
    const { persoId, listId } = event.data as { persoId: string; listId: string }
    const capacity = dnd.listCapacity[listId]
    return {
      update: {
        dnd: {
          listCapacity: capacity
            ? { ...dnd.listCapacity, [listId]: { ...capacity, count: capacity.count + 1 } }
            : dnd.listCapacity,
          draggableItemIds: dnd.draggableItemIds.filter((id) => id !== persoId)
        }
      }
    }
  }
}
```
