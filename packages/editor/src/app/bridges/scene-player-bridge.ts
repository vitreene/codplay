import type { Actor } from 'xstate'
import { CodPlay } from 'codplay'
import type { CodPlayInstance } from 'codplay'
import { buildSceneDocV2, EDITOR_V2_STORY_ID } from '../../builder-v2'
import type { EditorScene } from '../commands/types'
import type { controllerMachine } from '../controller/controller-machine'
import type { BridgeHandle } from './types'
import type { EditorCoordinationBridge } from './editor-coordination-bridge'

/** Mounts the editor scene through one V2 CodPlay owner and one active instance. */
export function createScenePlayerBridge(
  mountTarget: HTMLElement,
  machine: Actor<typeof controllerMachine>,
  coordination: EditorCoordinationBridge,
): BridgeHandle {
  const codplay = new CodPlay({ pauseOnDocumentHidden: false })
  let activeInstance: CodPlayInstance | null = null
  let activeRoot: HTMLElement | null = null
  let activeResourceUrls: string[] = []
  let activeStyleSheet = ''
  let activeScene: EditorScene | null = null
  let authorTimeMs = 0
  let rebuildRevision = 0

  /** Replaces the generated scene stylesheet in the stable V2 preload slot. */
  function setStyleSheet(cssText: string): void {
    codplay.preload.css.set({
      slot: 'editor-scene',
      cssText,
      container: mountTarget,
    })
  }

  /** Removes one staged instance and its host after a superseded or failed rebuild. */
  function discardStagedInstance(instance: CodPlayInstance | null, root: HTMLElement): void {
    if (instance !== null) codplay.instances.destroy(instance.instanceId)
    root.remove()
  }

  /** Builds, preloads, stages, and atomically publishes one V2 editor instance. */
  async function rebuild(scene: EditorScene): Promise<void> {
    const revision = ++rebuildRevision
    const result = buildSceneDocV2(scene)
    if (!result.ok) {
      console.error('[scenePlayer bridge] V2 scene build failed', result.diagnostics)
      return
    }

    const { sceneDoc, styleSheet, rootGrid, preRollMs } = result
    const compiled = codplay.build({ scene: sceneDoc })
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

    const previousStyleSheet = activeStyleSheet
    try {
      setStyleSheet(styleSheet)
    } catch (error) {
      console.error('[scenePlayer bridge] V2 stylesheet installation failed', error)
      if (previousStyleSheet !== '') setStyleSheet(previousStyleSheet)
      return
    }

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
        durationMs: scene.meta.durationMs,
        mountTargets: [{ id: 'root-host', kind: 'root', storyId: EDITOR_V2_STORY_ID }],
      })
    } catch (error) {
      discardStagedInstance(null, stagedRoot)
      if (previousStyleSheet !== '') setStyleSheet(previousStyleSheet)
      console.error('[scenePlayer bridge] V2 instance creation failed', error)
      return
    }

    if (revision !== rebuildRevision) {
      discardStagedInstance(nextInstance, stagedRoot)
      return
    }

    const previousInstance = activeInstance
    const previousRoot = activeRoot
    const previousResourceUrls = activeResourceUrls
    activeInstance = nextInstance
    activeRoot = stagedRoot
    activeResourceUrls = [...compiled.compiledScene.resources.entries].map((entry) => entry.url)
    activeStyleSheet = styleSheet
    activeScene = scene
    mountTarget.style.aspectRatio = `${rootGrid.cols} / ${rootGrid.rows}`
    coordination.bindPlayer(nextInstance, preRollMs)

    if (previousInstance !== null) codplay.instances.destroy(previousInstance.instanceId)
    previousRoot?.remove()
    if (previousResourceUrls.length > 0) codplay.preload.release(previousResourceUrls)

    const seekResult = await coordination.execute({ type: 'seek', timelineMs: authorTimeMs })
    if (revision !== rebuildRevision) return
    if (seekResult.ok) machine.send({ type: 'SEEK_APPLIED' })
  }

  /** Executes the single player-side seek path for an author timeline request. */
  const unsubscribeSeek = machine.on('seek', ({ timelineMs }) => {
    authorTimeMs = timelineMs
    if (activeInstance === null) return
    void coordination.execute({ type: 'seek', timelineMs }).then((result) => {
      if (result.ok && result.progress.timelineMs === authorTimeMs) machine.send({ type: 'SEEK_APPLIED' })
    })
  })

  /** Rebuilds the V2 instance after a committed document change. */
  const unsubscribeCommitted = machine.on('sceneCommitted', ({ scene }) => {
    if (scene === activeScene) return
    void rebuild(scene)
  })
  const unsubscribeLoaded = machine.on('sceneLoaded', ({ scene }) => {
    authorTimeMs = 0
    void rebuild(scene)
  })
  const unsubscribeReverted = machine.on('sceneReverted', ({ scene }) => {
    void rebuild(scene)
  })
  const unsubscribePlayback = machine.on('playbackActiveChanged', ({ active }) => {
    if (!active || activeScene === null) return
    void rebuild(activeScene).then(() => {
      if (machine.getSnapshot().value === 'playing') coordination.transport.play()
    })
  })

  const initialScene = machine.getSnapshot().context.scene
  if (initialScene !== null) void rebuild(initialScene)

  return {
    /** Destroys the active V2 instance, preload slots, and bridge subscriptions. */
    destroy(): void {
      rebuildRevision += 1
      unsubscribeSeek.unsubscribe()
      unsubscribeCommitted.unsubscribe()
      unsubscribeLoaded.unsubscribe()
      unsubscribeReverted.unsubscribe()
      unsubscribePlayback.unsubscribe()
      coordination.unbindPlayer()
      if (activeInstance !== null) codplay.instances.destroy(activeInstance.instanceId)
      activeRoot?.remove()
      if (activeResourceUrls.length > 0) codplay.preload.release(activeResourceUrls)
      codplay.preload.css.clear('editor-scene')
      codplay.destroy()
      activeInstance = null
      activeRoot = null
      activeScene = null
    },
  }
}
