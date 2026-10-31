import { createActor } from 'xstate'
import { controllerMachine } from '../../src/app/controller/controller-machine'
import { EditorCoordinationBridge } from '../../src/app/bridges/editor-coordination-bridge'
import { createScenePlayerBridge } from '../../src/app/bridges/scene-player-bridge'
import { createDecorEditorBridge } from '../../src/app/bridges/decor-editor-bridge'
import { createSequenceEditorBridge } from '../../src/app/bridges/sequence-editor-bridge'
import { EditorPlayerCommandFacade } from '../../src/app/commands/editor-player-command-facade'
import { EditorActionsFacade } from '../../src/app/facades/editor-actions-facade'
import { createEmptyEditorScene } from '../../src/app/scenes/editor-scene'
import { rootPlacementModeForScene } from '../../src/app/commands/root-placement-commands'
import type { RootPlacementMode } from '../../src/app/commands/types'
import '../../src/decor-editor/decor-editor.css'
import '../../src/sequence-editor/sequence-editor.css'

const actor = createActor(controllerMachine)
const playerFacade = new EditorPlayerCommandFacade()
const coordination = new EditorCoordinationBridge(actor, playerFacade)
const actions = new EditorActionsFacade(actor)
const sceneRoot = document.getElementById('block-test-scene')!
const paletteRoot = document.getElementById('block-test-palette')!
const timelineRoot = document.getElementById('block-test-timeline')!
const statusOutput = document.getElementById('block-test-status')!
let seekAcknowledgements = 0
let sceneBridge: ReturnType<typeof createScenePlayerBridge> | null = null
let sequenceBridge: ReturnType<typeof createSequenceEditorBridge> | null = null
let decorBridge: ReturnType<typeof createDecorEditorBridge> | null = null
let actorSubscription: ReturnType<typeof actor.subscribe> | null = null
let seekSubscription: ReturnType<typeof actor.on> | null = null

/** Updates the visible acceptance state from the production document actor. */
function renderStatus(): void {
  const { context, value } = actor.getSnapshot()
  const scene = context.scene
  const block = scene?.items.find((item) => item.type === 'bloc')
  const decor = block === undefined ? null : scene?.decors[block.initialDecorId] ?? null
  statusOutput.textContent = JSON.stringify({
    state: value,
    mode: scene === null ? null : rootPlacementModeForScene(scene),
    blocks: scene?.items.filter((item) => item.type === 'bloc').length ?? 0,
    zones: Object.keys(scene?.zones ?? {}).length,
    selection: context.selection.itemIds,
    geometry: decor?.offset === undefined
      ? decor?.zoneId === undefined ? null : { unit: 'grid', zoneId: decor.zoneId }
      : { unit: 'cqw', offset: decor.offset },
  })
}

/** Waits for the runtime bridge to acknowledge its initial author-time seek. */
async function waitForRuntime(): Promise<void> {
  const deadline = performance.now() + 6000
  while (seekAcknowledgements === 0) {
    if (performance.now() > deadline) throw new Error('Editor runtime acknowledgement timed out')
    await new Promise((resolve) => setTimeout(resolve, 16))
  }
}

/** Starts the real Editor actor and mounts its player, timeline, and decor bridges. */
export async function mountFixture(): Promise<void> {
  seekSubscription = actor.on('seekApplied', () => { seekAcknowledgements += 1 })
  actorSubscription = actor.subscribe(renderStatus)
  actor.start()
  actions.loadScene({ ...createEmptyEditorScene('Bloc de validation'), id: 'block-creation-browser-test' })
  sceneBridge = createScenePlayerBridge(sceneRoot, actor, coordination)
  sequenceBridge = createSequenceEditorBridge(timelineRoot, actor, coordination)
  decorBridge = createDecorEditorBridge(paletteRoot, actor, coordination)

  document.getElementById('block-test-mode-transform')!.addEventListener('click', () => setPlacementMode('transform'))
  document.getElementById('block-test-mode-grid')!.addEventListener('click', () => setPlacementMode('fine-grid'))
  document.getElementById('block-test-start')!.addEventListener('click', beginCreation)
  document.getElementById('block-test-cancel')!.addEventListener('click', () => actions.cancelCreation())
  document.getElementById('block-test-undo')!.addEventListener('click', () => actions.undo())
  document.getElementById('block-test-redo')!.addEventListener('click', () => actions.redo())

  window.addEventListener('pagehide', destroyFixture, { once: true })
  await waitForRuntime()
  renderStatus()
}

/** Stores a root placement choice through the existing document command path. */
function setPlacementMode(mode: RootPlacementMode): void {
  actions.runCommand({ name: 'setRootPlacementMode', args: { mode } })
}

/** Enters the production creation state using the mode stored in EditorScene. */
function beginCreation(): void {
  const scene = actor.getSnapshot().context.scene
  if (scene === null) return
  const mode = rootPlacementModeForScene(scene)
  if (mode === null) return
  actions.beginBlockCreation(mode)
}

/** Returns the block document state needed by the isolated browser acceptance check. */
export function inspectDocument(): Readonly<Record<string, unknown>> {
  const { context } = actor.getSnapshot()
  const scene = context.scene
  const block = scene?.items.find((item) => item.type === 'bloc')
  const decor = block === undefined ? null : scene?.decors[block.initialDecorId] ?? null
  return {
    mode: scene === null ? null : rootPlacementModeForScene(scene),
    blockCount: scene?.items.filter((item) => item.type === 'bloc').length ?? 0,
    zoneCount: Object.keys(scene?.zones ?? {}).length,
    geometry: decor?.offset === undefined
      ? decor?.zoneId === undefined ? null : { unit: 'grid', zoneId: decor.zoneId }
      : { unit: 'cqw', offset: decor.offset },
    selection: context.selection.itemIds,
  }
}

/** Releases the in-memory Editor bridges and actor when the fixture page closes. */
export function destroyFixture(): void {
  decorBridge?.destroy()
  sequenceBridge?.destroy()
  sceneBridge?.destroy()
  coordination.destroy()
  actions.destroy()
  playerFacade.destroy()
  actorSubscription?.unsubscribe()
  seekSubscription?.unsubscribe()
  actor.stop()
}
