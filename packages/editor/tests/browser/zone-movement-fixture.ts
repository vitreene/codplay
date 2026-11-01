import { createActor } from 'xstate'
import { controllerMachine } from '../../src/app/controller/controller-machine'
import { EditorCoordinationBridge } from '../../src/app/bridges/editor-coordination-bridge'
import { createScenePlayerBridge } from '../../src/app/bridges/scene-player-bridge'
import { createDecorEditorBridge } from '../../src/app/bridges/decor-editor-bridge'
import { createSequenceEditorBridge } from '../../src/app/bridges/sequence-editor-bridge'
import { EditorPlayerCommandFacade } from '../../src/app/commands/editor-player-command-facade'
import { EditorActionsFacade } from '../../src/app/facades/editor-actions-facade'
import { createEmptyEditorScene } from '../../src/app/scenes/editor-scene'
import type { EditorScene, ZoneRect } from '../../src/app/commands/types'
import { iconSvg } from '../../src/decor-editor/icons'
import '../../src/app/layout/app-layout.css'
import '../../src/decor-editor/decor-editor.css'
import '../../src/sequence-editor/sequence-editor.css'

const DEMO_DURATION_MS = 5_000
const START_AREA: ZoneRect = { row: 35, col: 14, rowSpan: 18, colSpan: 28 }
const END_AREA: ZoneRect = { row: 25, col: 92, rowSpan: 38, colSpan: 56 }
const actor = createActor(controllerMachine)
const playerFacade = new EditorPlayerCommandFacade()
const coordination = new EditorCoordinationBridge(actor, playerFacade)
const actions = new EditorActionsFacade(actor)
const sceneHost = document.getElementById('zone-movement-scene')!
const paletteHost = document.getElementById('zone-movement-palette')!
const timelineHost = document.getElementById('zone-movement-timeline')!
const undoButton = document.getElementById('zone-movement-undo') as HTMLButtonElement
const redoButton = document.getElementById('zone-movement-redo') as HTMLButtonElement
let seekAcknowledgements = 0
let sceneBridge: ReturnType<typeof createScenePlayerBridge> | null = null
let sequenceBridge: ReturnType<typeof createSequenceEditorBridge> | null = null
let decorBridge: ReturnType<typeof createDecorEditorBridge> | null = null
let seekSubscription: ReturnType<typeof actor.on> | null = null
let historySubscription: (() => void) | null = null

undoButton.innerHTML = iconSvg('undo')
redoButton.innerHTML = iconSvg('redo')
undoButton.addEventListener('click', () => actions.undo())
redoButton.addEventListener('click', () => actions.redo())

/** Creates the authored scene with two responsive root-grid targets and one zone-moving block. */
function createZoneMovementScene(): EditorScene {
  const scene = createEmptyEditorScene('Déplacement entre zones')
  const startDecorId = 'zone-movement-start-decor'
  const endDecorId = 'zone-movement-end-decor'
  const zoneStyle = {
    width: '100%',
    height: '100%',
    'background-color': 'oklch(0.68 0.18 38)',
    'border-radius': '1.2cqw',
  }

  return {
    ...scene,
    id: 'zone-movement-browser-demo',
    meta: { ...scene.meta, title: 'Déplacement entre zones', durationMs: DEMO_DURATION_MS },
    items: [{
      id: 'zone-movement-block',
      type: 'bloc',
      parentId: null,
      order: 'a',
      visible: true,
      contentId: null,
      initialDecorId: startDecorId,
      keyframes: [
        { id: 'zone-movement-start', timeMs: 0, decorId: startDecorId, channel: 'pose', name: 'Départ · z1' },
        { id: 'zone-movement-end', timeMs: DEMO_DURATION_MS, decorId: endDecorId, channel: 'pose', name: 'Arrivée · z2' },
      ],
    }],
    contents: {},
    decors: {
      [startDecorId]: { id: startDecorId, zoneId: 'zone-movement-zone-one', style: zoneStyle },
      [endDecorId]: { id: endDecorId, zoneId: 'zone-movement-zone-two', style: zoneStyle },
    },
    zones: {
      'zone-movement-zone-one': {
        id: 'zone-movement-zone-one',
        capsuleId: null,
        name: 'z1',
        surfaces: { portrait: START_AREA, landscape: START_AREA },
      },
      'zone-movement-zone-two': {
        id: 'zone-movement-zone-two',
        capsuleId: null,
        name: 'z2',
        surfaces: { portrait: END_AREA, landscape: END_AREA },
      },
    },
  }
}

/** Waits for Editor's real seek acknowledgement with a bounded failure. */
async function until(predicate: () => boolean): Promise<void> {
  const deadline = performance.now() + 6_000
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error('Editor runtime acknowledgement timed out')
    await new Promise((resolve) => setTimeout(resolve, 16))
  }
}

/** Mounts the production Editor bridges over the in-memory zone-to-zone authoring scene. */
export async function mountFixture(): Promise<void> {
  seekSubscription = actor.on('seekApplied', () => { seekAcknowledgements += 1 })
  historySubscription = actions.subscribeHistory((history) => {
    undoButton.disabled = !history.canUndo
    redoButton.disabled = !history.canRedo
  })
  actor.start()
  actions.loadScene(createZoneMovementScene())
  actor.send({ type: 'TOGGLE_ZONES_VISIBLE' })
  sceneBridge = createScenePlayerBridge(sceneHost, actor, coordination)
  sequenceBridge = createSequenceEditorBridge(timelineHost, actor, coordination)
  decorBridge = createDecorEditorBridge(paletteHost, actor, coordination)
  window.addEventListener('pagehide', destroyFixture, { once: true })
  await until(() => seekAcknowledgements > 0)
}

/** Seeks through the same author-time coordination path used by the Editor timeline. */
export async function seekTo(timeMs: number): Promise<ReturnType<typeof inspectDemo>> {
  const currentProgress = coordination.transport.getProgress()
  if (currentProgress !== null && Math.abs(currentProgress.timelineMs - timeMs) <= 1) return inspectDemo()
  const previousAcknowledgements = seekAcknowledgements
  coordination.requestAuthorSeek(timeMs)
  await until(() => seekAcknowledgements > previousAcknowledgements
    && Math.abs((coordination.transport.getProgress()?.timelineMs ?? Number.NEGATIVE_INFINITY) - timeMs) <= 1)
  return inspectDemo()
}

/** Exposes authored zone assignments and current runtime state to browser inspection tools. */
export function inspectDemo() {
  const scene = actor.getSnapshot().context.scene
  const item = scene?.items.find((candidate) => candidate.id === 'zone-movement-block')
  return {
    rootGrid: scene?.rootCapsule?.grid,
    zones: Object.values(scene?.zones ?? {}).map((zone) => ({ id: zone.id, name: zone.name, area: zone.surfaces.landscape })),
    block: item === undefined || scene === null ? null : {
      type: item.type,
      offset: scene.decors[item.initialDecorId]?.offset ?? null,
      keyframes: item.keyframes.map((keyframe) => ({
        timeMs: keyframe.timeMs,
        channel: keyframe.channel,
        zoneId: scene.decors[keyframe.decorId]?.zoneId ?? null,
      })),
    },
    progress: coordination.transport.getProgress(),
    runtime: coordination.snapshot.get()?.states.find((state) => state.target.persoId === 'zone-movement-block')?.state ?? null,
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
  seekSubscription?.unsubscribe()
  historySubscription?.()
  actor.stop()
}
