import type { Actor } from 'xstate'
import { CodPlay } from 'codplay'
import type { CodPlayInstance } from 'codplay'
import { buildSceneDocV2 } from '../../builder-v2'
import type { StyleDefaultCapture, StyleDefaultRequest } from '../../builder-v2/types'
import { EDITOR_ENGINE_OPTIONS } from '../../item-presentation/engine-options'
import type { EditorScene } from '../commands/types'
import type { controllerMachine } from '../controller/controller-machine'
import type { BridgeHandle } from './types'
import type { EditorCoordinationBridge } from './editor-coordination-bridge'

/** Seeks the staged native instance to each requested item pose and captures its CSS defaults. */
async function measureInitialStyleDefaults(
  instance: CodPlayInstance,
  root: HTMLElement,
  requests: readonly StyleDefaultRequest[],
  preRollMs: number,
  isCurrentRevision: () => boolean,
): Promise<Map<string, StyleDefaultCapture> | null> {
  const requestsByTime = new Map<number, StyleDefaultRequest[]>()
  for (const request of requests) {
    const atTime = requestsByTime.get(request.initialTimeMs) ?? []
    atTime.push(request)
    requestsByTime.set(request.initialTimeMs, atTime)
  }

  const defaultsByItem = new Map<string, StyleDefaultCapture>()
  for (const [timeMs, itemsAtTime] of requestsByTime) {
    await instance.telco.seek(timeMs + preRollMs)
    if (!isCurrentRevision()) return null

    for (const request of itemsAtTime) {
      const node = [...root.querySelectorAll<HTMLElement>('[data-editor-visual-for]')]
        .find((candidate) => candidate.dataset.editorVisualFor === request.itemId)
      if (node === undefined) continue
      const cqwWidthPx = measureCqwWidthPx(node)
      const computed = node.ownerDocument.defaultView!.getComputedStyle(node)
      const values = Object.fromEntries(request.properties.flatMap((property) => {
        const value = computed.getPropertyValue(property).trim()
        return value === '' ? [] : [[property, value]]
      }))
      if (Object.keys(values).length > 0) defaultsByItem.set(request.itemId, { values, cqwWidthPx })
    }
  }
  return defaultsByItem
}

/** Measures one cqw in the item's computed container without changing the item cascade. */
function measureCqwWidthPx(item: HTMLElement): number | null {
  const parent = item.parentElement
  if (parent === null) return null
  const reference = item.ownerDocument.createElement('span')
  reference.style.cssText = 'all:initial;display:block;position:absolute;visibility:hidden;pointer-events:none;width:1cqw;height:0'
  parent.append(reference)
  const width = reference.getBoundingClientRect().width
  reference.remove()
  return Number.isFinite(width) && width > 0 ? width : null
}

/** Mounts the editor scene through one V2 CodPlay owner and one active instance. */
export function createScenePlayerBridge(
  mountTarget: HTMLElement,
  machine: Actor<typeof controllerMachine>,
  coordination: EditorCoordinationBridge,
): BridgeHandle {
  const codplay = new CodPlay({ engine: EDITOR_ENGINE_OPTIONS, pauseOnDocumentHidden: false })
  let activeInstance: CodPlayInstance | null = null
  let activeRoot: HTMLElement | null = null
  let activeResourceUrls: string[] = []
  let activeStyleSheet = ''
  let activeScene: EditorScene | null = null
  let activePreRollMs = 0
  let authorTimeMs = 0
  let rebuildRevision = 0
  let seekRevision = 0
  let rebuildInFlight: { scene: EditorScene; promise: Promise<void> } | null = null
  let pendingPlayRequest: { scene: EditorScene; revision: number } | null = null
  let playbackRequestRevision = 0
  let seekInFlight: { instance: CodPlayInstance; promise: Promise<void> } | null = null

  coordination.bindSceneHost(mountTarget)
  mountTarget.style.position = 'relative'

  /** Replaces the generated scene stylesheet in the stable V2 preload slot. */
  function setStyleSheet(cssText: string): void {
    codplay.preload.css.set({
      slot: 'editor-scene',
      cssText,
      container: mountTarget,
    })
  }

  /** Restores the stylesheet state that was active before a staged rebuild. */
  function restoreStyleSheet(cssText: string): void {
    if (cssText === '') {
      codplay.preload.css.clear('editor-scene')
      return
    }
    setStyleSheet(cssText)
  }

  /** Releases resources registered for a discarded staged scene. */
  function releaseResourceUrls(urls: readonly string[]): void {
    if (urls.length > 0) codplay.preload.release(urls)
  }

  /** Removes one staged instance and its host after a superseded or failed rebuild. */
  function discardStagedInstance(instance: CodPlayInstance | null, root: HTMLElement): void {
    if (instance !== null) codplay.instances.destroy(instance.instanceId)
    root.remove()
  }

  /** Builds, preloads, stages, and atomically publishes one V2 editor instance. */
  async function rebuild(scene: EditorScene): Promise<void> {
    const revision = ++rebuildRevision
    const initialResult = buildSceneDocV2(scene)
    if (!initialResult.ok) {
      console.error('[scenePlayer bridge] V2 scene build failed', initialResult.diagnostics)
      return
    }

    let result = initialResult
    let compiled = codplay.build({ scene: result.sceneDoc })
    if (!compiled.ok) {
      console.error('[scenePlayer bridge] V2 compilation failed', compiled.diagnostics)
      return
    }

    const preloadResult = await codplay.preload.load({
      manifest: compiled.compiledScene.resources,
      options: { mode: 'author', container: mountTarget },
    })
    if (revision !== rebuildRevision) return
    if (!preloadResult.ok) {
      console.error('[scenePlayer bridge] V2 preload failed', preloadResult.error)
      return
    }
    codplay.resources.register(preloadResult.data)
    const stagedResourceUrls = [...compiled.compiledScene.resources.entries].map((entry) => entry.url)
    if (revision !== rebuildRevision) {
      releaseResourceUrls(stagedResourceUrls)
      return
    }

    const previousStyleSheet = activeStyleSheet
    try {
      setStyleSheet(result.styleSheet)
    } catch (error) {
      console.error('[scenePlayer bridge] V2 stylesheet installation failed', error)
      restoreStyleSheet(previousStyleSheet)
      releaseResourceUrls(stagedResourceUrls)
      return
    }

    let styleDefaultsByItem: ReadonlyMap<string, StyleDefaultCapture> = new Map()
    if (result.styleDefaultRequests.length > 0) {
      const probeRoot = document.createElement('div')
      probeRoot.className = 'editor-v2-instance-root'
      probeRoot.style.width = '100%'
      probeRoot.style.height = '100%'
      probeRoot.style.position = 'absolute'
      probeRoot.style.inset = '0'
      probeRoot.style.opacity = '0'
      probeRoot.style.pointerEvents = 'none'
      probeRoot.setAttribute('aria-hidden', 'true')
      mountTarget.append(probeRoot)

      let probeInstance: CodPlayInstance | null = null
      try {
        probeInstance = codplay.instances.create({
          instanceId: `${scene.id}-${revision}-style-default-probe`,
          compiledScene: compiled.compiledScene,
          functions: compiled.functions,
          root: probeRoot,
        })
      } catch (error) {
        discardStagedInstance(null, probeRoot)
        if (revision === rebuildRevision) restoreStyleSheet(previousStyleSheet)
        releaseResourceUrls(stagedResourceUrls)
        console.error('[scenePlayer bridge] V2 style-default probe creation failed', error)
        return
      }

      let measuredDefaults: Map<string, StyleDefaultCapture> | null
      try {
        measuredDefaults = await measureInitialStyleDefaults(
          probeInstance,
          probeRoot,
          result.styleDefaultRequests,
          result.preRollMs,
          () => revision === rebuildRevision,
        )
      } catch (error) {
        discardStagedInstance(probeInstance, probeRoot)
        if (revision === rebuildRevision) restoreStyleSheet(previousStyleSheet)
        releaseResourceUrls(stagedResourceUrls)
        console.error('[scenePlayer bridge] V2 style-default probe failed', error)
        return
      }
      discardStagedInstance(probeInstance, probeRoot)
      if (measuredDefaults === null) {
        releaseResourceUrls(stagedResourceUrls)
        return
      }

      const measuredResult = buildSceneDocV2(scene, measuredDefaults)
      if (!measuredResult.ok) {
        if (revision === rebuildRevision) restoreStyleSheet(previousStyleSheet)
        releaseResourceUrls(stagedResourceUrls)
        console.error('[scenePlayer bridge] V2 scene build with measured defaults failed', measuredResult.diagnostics)
        return
      }
      const measuredCompiled = codplay.build({ scene: measuredResult.sceneDoc })
      if (!measuredCompiled.ok) {
        if (revision === rebuildRevision) restoreStyleSheet(previousStyleSheet)
        releaseResourceUrls(stagedResourceUrls)
        console.error('[scenePlayer bridge] V2 compilation with measured defaults failed', measuredCompiled.diagnostics)
        return
      }
      result = measuredResult
      compiled = measuredCompiled
      styleDefaultsByItem = measuredDefaults
      if (result.styleDefaultRequests.length > 0) {
        console.warn('[scenePlayer bridge] CSS defaults could not be measured for every tween endpoint', result.styleDefaultRequests)
      }
    }

    if (revision !== rebuildRevision) {
      releaseResourceUrls(stagedResourceUrls)
      return
    }

    const { styleSheet, rootGrid, preRollMs, durationMs } = result

    const stagedRoot = document.createElement('div')
    stagedRoot.className = 'editor-v2-instance-root'
    stagedRoot.style.width = '100%'
    stagedRoot.style.height = '100%'
    mountTarget.append(stagedRoot)

    let nextInstance: CodPlayInstance
    try {
      nextInstance = codplay.instances.create({
        instanceId: `${scene.id}-${revision}`,
        compiledScene: compiled.compiledScene,
        functions: compiled.functions,
        root: stagedRoot,
      })
    } catch (error) {
      discardStagedInstance(null, stagedRoot)
      restoreStyleSheet(previousStyleSheet)
      releaseResourceUrls(stagedResourceUrls)
      console.error('[scenePlayer bridge] V2 instance creation failed', error)
      return
    }

    if (revision !== rebuildRevision) {
      discardStagedInstance(nextInstance, stagedRoot)
      releaseResourceUrls(stagedResourceUrls)
      return
    }

    const previousInstance = activeInstance
    const previousRoot = activeRoot
    const previousResourceUrls = activeResourceUrls
    activeInstance = nextInstance
    activeRoot = stagedRoot
    activeResourceUrls = stagedResourceUrls
    activeStyleSheet = styleSheet
    activeScene = scene
    activePreRollMs = preRollMs
    mountTarget.style.aspectRatio = `${rootGrid.cols} / ${rootGrid.rows}`
    coordination.bindStyleDefaults(scene, styleDefaultsByItem)
    coordination.bindPlayer(nextInstance, preRollMs, durationMs)
    // A seek still attached to the discarded instance cannot hand off the new binding; the
    // rebuild's final seek below is authoritative for this instance.
    seekInFlight = null

    if (previousInstance !== null) codplay.instances.destroy(previousInstance.instanceId)
    previousRoot?.remove()
    releaseResourceUrls(previousResourceUrls)

    const seekRevisionAtStart = seekRevision
    const seekTimeAtStart = authorTimeMs
    const seekResult = await coordination.execute({ type: 'seek', timelineMs: seekTimeAtStart })
    if (revision !== rebuildRevision) return
    if (
      seekRevision === seekRevisionAtStart &&
      seekResult.ok &&
      Math.abs(seekResult.progress.timelineMs - authorTimeMs) <= 1
    ) {
      machine.send({ type: 'SEEK_APPLIED' })
    }
  }

  /** Coalesces one scene rebuild and invalidates work superseded by a later document state. */
  function scheduleRebuild(scene: EditorScene): Promise<void> {
    if (rebuildInFlight?.scene === scene) return rebuildInFlight.promise
    if (activeScene === scene && activeInstance !== null) {
      // A revert can make the already published scene current while an older rebuild is still
      // staging. Invalidate that older target instead of allowing it to publish over the revert.
      if (rebuildInFlight !== null) {
        rebuildRevision += 1
        rebuildInFlight = null
        // Any play queued behind the superseded build belongs to that obsolete scene. Invalidate
        // it together with the build so its completion callback cannot start playback after the
        // revert has restored the already-published instance.
        pendingPlayRequest = null
        playbackRequestRevision += 1
      }
      return Promise.resolve()
    }

    const promise = rebuild(scene)
    rebuildInFlight = { scene, promise }
    void promise.then(
      () => {
        if (rebuildInFlight?.promise === promise) rebuildInFlight = null
      },
      () => {
        if (rebuildInFlight?.promise === promise) rebuildInFlight = null
      },
    )
    return promise
  }

  /** Waits for the latest author seek on one instance before starting playback. */
  async function waitForPendingSeek(instance: CodPlayInstance): Promise<void> {
    while (seekInFlight?.instance === instance) {
      const pending = seekInFlight
      await pending.promise
      if (seekInFlight === pending) return
    }
  }

  /** Starts one stable instance from the pose already maintained by the canonical player. */
  async function startPlayback(scene: EditorScene, requestRevision: number): Promise<void> {
    if (
      requestRevision !== playbackRequestRevision
      || machine.getSnapshot().value !== 'playing'
      || machine.getSnapshot().context.scene !== scene
      || activeScene !== scene
      || activeInstance === null
    ) return

    // A prior author seek (including Stop) has already presented this instance at the canonical
    // playhead. Wait for that handoff, then only repair a genuinely different pose. Re-seeking on
    // every Play races the handoff and can leave the controller in `playing` while the runtime
    // remains `ready`.
    await waitForPendingSeek(activeInstance)
    if (
      requestRevision !== playbackRequestRevision
      || machine.getSnapshot().value !== 'playing'
      || machine.getSnapshot().context.scene !== scene
      || activeScene !== scene
      || activeInstance === null
    ) return
    const currentProgress = coordination.transport.getProgress()
    // The editor exposes author time, while the runtime seek/play contract includes the hidden
    // transition pre-roll. A raw rewind reaches player time 0 (not `preRollMs`), so comparing only
    // adapted author time would falsely consider the instance aligned and start playback from the
    // pre-roll gap. Compare the runtime coordinate before deciding that no repair seek is needed.
    const expectedPlayerTimeMs = authorTimeMs + activePreRollMs
    if (currentProgress === null || Math.abs(currentProgress.playerTimeMs - expectedPlayerTimeMs) > 1) {
      const seekResult = await coordination.execute({ type: 'seek', timelineMs: authorTimeMs })
      if (
        requestRevision !== playbackRequestRevision
        || machine.getSnapshot().value !== 'playing'
        || machine.getSnapshot().context.scene !== scene
        || activeScene !== scene
        || activeInstance === null
        || !seekResult.ok
      ) return
    }
    const playResult = await coordination.execute({ type: 'play' })
    if (
      requestRevision !== playbackRequestRevision
      || machine.getSnapshot().value !== 'playing'
      || machine.getSnapshot().context.scene !== scene
      || activeScene !== scene
      || activeInstance === null
      || !playResult.ok
    ) return
  }

  /** Queues playback behind a document rebuild without rebuilding for a simple play gesture. */
  function queuePlaybackAfterRebuild(
    scene: EditorScene,
    rebuildPromise: Promise<void> = scheduleRebuild(scene),
  ): void {
    const requestRevision = ++playbackRequestRevision
    const request = { scene, revision: requestRevision }
    pendingPlayRequest = request
    void rebuildPromise.then(() => {
      if (pendingPlayRequest !== request) return
      pendingPlayRequest = null
      void startPlayback(scene, requestRevision)
    }, () => {
      if (pendingPlayRequest === request) pendingPlayRequest = null
    })
  }

  /** Executes the single player-side seek path for an author timeline request. */
  const unsubscribeSeek = machine.on('seek', ({ timelineMs }) => {
    authorTimeMs = timelineMs
    const requestRevision = ++seekRevision
    const instanceAtRequest = activeInstance
    if (instanceAtRequest === null) return
    const seekPromise = coordination.execute({ type: 'seek', timelineMs }).then((result) => {
      if (
        requestRevision === seekRevision &&
        activeInstance === instanceAtRequest &&
        result.ok &&
        Math.abs(result.progress.timelineMs - authorTimeMs) <= 1
      ) {
        machine.send({ type: 'SEEK_APPLIED' })
      }
    }).finally(() => {
      if (seekInFlight?.instance === instanceAtRequest && seekInFlight.promise === seekPromise) {
        seekInFlight = null
      }
    })
    seekInFlight = { instance: instanceAtRequest, promise: seekPromise }
  })

  /** Rebuilds the V2 instance after a committed document change. */
  const unsubscribeCommitted = machine.on('sceneCommitted', ({ scene }) => {
    if (scene === activeScene) return
    const rebuildPromise = scheduleRebuild(scene)
    if (machine.getSnapshot().value === 'playing') queuePlaybackAfterRebuild(scene, rebuildPromise)
  })
  const unsubscribeLoaded = machine.on('sceneLoaded', ({ scene }) => {
    authorTimeMs = 0
    void scheduleRebuild(scene)
  })
  const unsubscribeReverted = machine.on('sceneReverted', ({ scene }) => {
    void scheduleRebuild(scene)
  })
  const unsubscribePlayback = machine.on('playbackActiveChanged', ({ active }) => {
    const scene = machine.getSnapshot().context.scene
    if (!active) {
      playbackRequestRevision += 1
      pendingPlayRequest = null
      return
    }
    if (scene === null) return
    if (activeScene === scene && activeInstance !== null && rebuildInFlight === null) {
      const requestRevision = ++playbackRequestRevision
      void startPlayback(scene, requestRevision)
      return
    }
    queuePlaybackAfterRebuild(scene)
  })

  const unsubscribePlaybackReconciled = coordination.onPlaybackReconciled((timelineMs) => {
    authorTimeMs = timelineMs
  })

  const initialScene = machine.getSnapshot().context.scene
  if (initialScene !== null) void scheduleRebuild(initialScene)

  return {
    /** Destroys the active V2 instance, preload slots, and bridge subscriptions. */
    destroy(): void {
      rebuildRevision += 1
      seekRevision += 1
      unsubscribeSeek.unsubscribe()
      unsubscribeCommitted.unsubscribe()
      unsubscribeLoaded.unsubscribe()
      unsubscribeReverted.unsubscribe()
      unsubscribePlayback.unsubscribe()
      unsubscribePlaybackReconciled()
      pendingPlayRequest = null
      rebuildInFlight = null
      coordination.unbindSceneHost(mountTarget)
      coordination.unbindPlayer()
      if (activeInstance !== null) codplay.instances.destroy(activeInstance.instanceId)
      activeRoot?.remove()
      releaseResourceUrls(activeResourceUrls)
      codplay.preload.css.clear('editor-scene')
      codplay.destroy()
      activeInstance = null
      activeRoot = null
      activeScene = null
    },
  }
}
