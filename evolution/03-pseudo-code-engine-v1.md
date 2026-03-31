# Pseudo-code - Engine V1

## 1) Noms simples (concepts)

- `clock`: temps logique
- `ticker`: cadence raf
- `bus`: diffusion events
- `machineStore`: etats runtime (`player`, `story`, `playable`)
- `traceStore`: journal de transitions machine

## 2) Demarrage et preload

```ts
function initPlayer(sceneDoc, options):
  // Init detruit l'instance precedente avant de recreer l'etat.
  destroyPlayerIfReady()
  state.scene = sceneDoc
  state.mode = options.mode
  state.runtimePolicy = options.runtimePolicy
  state.createElement = options.createElement
  mountSceneElements(sceneDoc)
  transitionPlayer('INIT')
```

```ts
function mountSceneElements(sceneDoc):
  for each runtimeItem in expandRuntimeItems(sceneDoc):
    element = createElement(runtimeItem)
    elementStore.set(runtimeItem.runtimeId, element)

function createElement(runtimeItem):
  // Factory unique de creation de node + plugins locaux.
  element = state.createElement(runtimeItem)
  pluginStore.register(runtimeItem.runtimeId, element.plugins ?? [])
  return element
```

```ts
async function startPlayer():
  transitionPlayer('PRELOAD_START')

  preloadResult = await preloadScene(state.scene)

  if preloadResult.ok:
    transitionPlayer('PRELOAD_OK')
    transitionPlayer('PLAY')
    ticker.start()
    return

  // En editor on autorise un mode degrade; en player on bloque.
  if state.mode == 'editor':
    transitionPlayer('PRELOAD_DEGRADED')
    ticker.start()
  else:
    transitionPlayer('PRELOAD_ERROR')
```

## 3) Tick runtime

```ts
function handleTick(realMs):
  // Resolution 10 ms.
  nowMs = normalizeTime(realMs, 10)
  batch = collectEvents(state.prevMs, nowMs, margin=16)

  for each event in batch:
    processEvent(event)

  syncMasterMedia(nowMs, thresholdMs=80)
  state.prevMs = nowMs
```

## 4) Extraction ordonnee des events

```ts
function collectEvents(fromMs, toMs, margin):
  batch = []

  for each track in getActiveTracks():
    batch += pickTrackEvents(track, fromMs, toMs + margin)

  sort batch by:
    1. event.ms asc
    2. track.order asc
    3. event.index asc
    4. source user after source story/system

  return batch
```

## 5) Traitement d'un event

```ts
function processEvent(event):
  bus.publish(event.name, event.payload)

  // Etape 1: transitions de machine (trace obligatoire).
  applyMachineTransitions(event)

  // Etape 2: resolution des cibles d'action.
  targets = resolveTargets(event)

  // Ordre stable: ordre de declaration des cibles.
  for each target in targets:
    action = target.actions[event.name]
    if action exists:
      transition = readTransition(action)
      transition = deriveTransition(target, action, transition)
      transition = pluginStore.applyTransition(target, transition)
      runAnimation(target, action, transition)

  commitState()
```

## 6) Event utilisateur

```ts
function emitUserEvent(name, payload, options):
  event = buildUserEvent(name, payload, state.prevMs)

  // Record explicite: false par defaut.
  if options.recordable == true:
    if options.recordMode == 'finalOnly' or options.recordMode is undefined:
      addToUserTrack(event)

  processEvent(event)
```

## 7) Seek / rewind avec mode rebuild

```ts
function seekTo(targetMs, options):
  rebuildMode = options.rebuild ?? 'state'

  if !state.runtimePolicy.allowedRebuildModes.includes(rebuildMode):
    traceRejected('player', 'SEEK_START', 'MODE_NOT_ALLOWED_BY_POLICY')
    return

  transitionPlayer('SEEK_START', { targetMs, rebuildMode })

  if rebuildMode == 'full':
    // Mode surtout utile en contexte editeur.
    destroyRuntimeElements()
    resetSceneState({ keepMediaHandles: false })
    preloadScene(state.scene)
    mountSceneElements(state.scene)
  else:
    // Mode player: on conserve les medias deja charges.
    resetSceneState({ keepMediaHandles: true })

  replayUntil(targetMs)
  applyPlayableSeek(targetMs)

  transitionPlayer('SEEK_DONE', { targetMs })
```

```ts
function rewindToStart(options):
  rebuildMode = options.rebuild ?? 'state'

  if !state.runtimePolicy.allowedRebuildModes.includes(rebuildMode):
    traceRejected('player', 'REWIND_START', 'MODE_NOT_ALLOWED_BY_POLICY')
    return

  transitionPlayer('REWIND_START', { rebuildMode })

  seekTo(0, { rebuild: rebuildMode })
  resetStraps()

  transitionPlayer('REWIND_DONE')
```

## 8) Application du seek sur playable

```ts
function applyPlayableSeek(targetMs):
  for each playable in getPlayables():
    logical = resolvePlayableStateAt(playable.id, targetMs)

    if playable.kind == 'media':
      applyMediaSeek(playable, logical)
    else:
      applyStorySeek(playable, logical)
```

```ts
function applyMediaSeek(mediaPlayable, logical):
  // On ne force jamais play pendant un seek.
  if logical.intent == 'idle':
    return

  if logical.intent == 'ended':
    mediaPlayable.setCurrentTime(mediaPlayable.duration)
    mediaPlayable.pause()
    return

  if logical.intent == 'paused':
    mediaPlayable.setCurrentTime(logical.mediaMs)
    mediaPlayable.pause()
    return

  if logical.intent == 'playing':
    mediaPlayable.setCurrentTime(logical.mediaMs)
    if machineStore.player == 'playing':
      mediaPlayable.play()
    else:
      mediaPlayable.pause()
```

## 9) Machines et trace

```ts
function transitionMachine(machine, id, fromState, eventName, toState, payload):
  machineStore[machine][id] = toState

  // Chaque transition est tracee pour debug et rejeu.
  traceStore.push({
    traceMs: state.prevMs,
    machine,
    id,
    from: fromState,
    event: eventName,
    to: toState,
    payload
  })
```

## 10) Fin story et enfants

```ts
function updateStoryEnded(storyId):
  story = getStory(storyId)

  if story.endPolicy == 'storyDriven':
    return

  blockingChildren = getChildren(storyId).filter((child) => child.blocksStoryEnd == true)

  if blockingChildren.every((child) => getPlayableState(child.id) == 'ended'):
    transitionMachine('story', storyId, 'playing', 'ALL_BLOCKING_CHILDREN_ENDED', 'ended')
```

Note:

- un enfant `loop: infinite` est non bloquant par defaut

## 11) Type `list` et plugin local

```ts
function createElement(runtimeItem):
  if runtimeItem.type != 'list':
    return createRegularElement(runtimeItem)

  nodeRef = createListNode(runtimeItem)
  listPlugin = createListAutoLayoutPlugin({
    runtimeItemId: runtimeItem.runtimeId,
    config: runtimeItem.list,
    nodeRef
  })

  return { runtimeItemId: runtimeItem.runtimeId, nodeRef, plugins: [listPlugin] }
```

## 12) Diff enfants list et animation auto

```ts
function applyListChildrenPatch(listId, nextChildrenIds):
  list = elementStore.get(listId)
  prevChildrenIds = list.childrenIds

  beforeRects = measureChildrenRects(list.nodeRef, prevChildrenIds)

  diff = computeListDiff(prevChildrenIds, nextChildrenIds)
  // diff.added, diff.removed, diff.moved

  // Commit logique de l'ordre cible
  list.childrenIds = nextChildrenIds
  commitListDomOrder(list.nodeRef, nextChildrenIds)

  afterRects = measureChildrenRects(list.nodeRef, nextChildrenIds)

  animateListDiff(list, diff, beforeRects, afterRects)
```

## 13) Traitement des points de vigilance

```ts
function animateListDiff(list, diff, beforeRects, afterRects):
  // 1) remove: sortie animee puis retrait physique
  for each childId in diff.removed:
    markChildAsLeaving(list.id, childId)
    runLeaveAnimation(childId, () => detachChildNode(childId))

  // 2) move: FLIP sur enfants deplaces
  for each childId in diff.moved:
    runFlipMove(childId, beforeRects[childId], afterRects[childId])

  // 3) add: animation d'entree
  for each childId in diff.added:
    runEnterAnimation(childId)

  // 4) media: ne jamais modifier l'intent logique media
  for each childId in diff.moved:
    if isMediaPlayable(childId):
      preserveMediaIntent(childId)
```

## 14) Revision runtime et stabilite des refs

```ts
function rebuild(mode):
  transitionPlayer('REBUILD_START', { mode })

  if mode == 'full':
    destroyRuntimeElements()
    state.runtimeRevision += 1
    mountSceneElements(state.scene)
  else:
    // state rebuild: meme nodes, meme plugins
    resetSceneState({ keepMediaHandles: true })

  transitionPlayer('REBUILD_DONE', { mode, runtimeRevision: state.runtimeRevision })
```
