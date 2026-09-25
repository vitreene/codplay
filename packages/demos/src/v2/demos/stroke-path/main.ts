import type { CodPlayEngineOptions, CompiledRecord } from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'
import type {
  AuthorCaptureInitFunction,
  AuthorCaptureTrackFunction,
} from 'codplay/scene/capture/authoring-types'
import type { StrapEvent, StrapFunction } from 'codplay/runtime/player'
import type { V2DemoEventInjection } from '../../layout/types'
import { STROKE_PATH_COMPONENT_DEFINITION } from './stroke-path-layer'
import {
  getStrokePathAreaOrigin,
  isStoredStroke,
  readStoredStrokes,
  resetStrokePathAreaOrigin,
  type StoredStroke,
  writeStoredStrokes,
  clearStoredStrokes,
} from './stroke-path-state'

const SCENE_ID = 'stroke-path-scene-v2'
const STORY_ID = 'stroke-path-story'
const LAYER_PERSO_ID = 'stroke-path-layer'
const MIN_POINT_DISTANCE = 1
const RDP_EPSILON = 0.5

type LocalPoint = Readonly<{ x: number; y: number }>

type StrokeCaptureState = Record<string, unknown> & {
  points: LocalPoint[]
  color: string
  originX: number
  originY: number
}

type StrokeStoryState = Readonly<{
  strokes?: readonly StoredStroke[]
  nextStrokeId?: number
}>

type ScenePerso = SceneDoc<string>['stories']['main']['persos'][number]

/** Engine registration for the non-normative, scene-local SVG stress layer. */
export const engineCapabilities: Pick<CodPlayEngineOptions, 'components'> = {
  components: { register: [STROKE_PATH_COMPONENT_DEFINITION] },
}

/** Creates the V2 scene with ordinary events, capture actions and replayable straps. */
export function createScene(): SceneDoc<string> {
  resetStrokePathAreaOrigin()
  return {
    id: SCENE_ID,
    straps: {
      'stroke-path-save': saveStrokeStrap,
      'stroke-path-clear-storage': clearStrokeStorageStrap,
    },
    listen: [
      { on: 'sketch:stroke:committed', straps: ['stroke-path-save'] },
      { on: 'sketch:cleared', straps: ['stroke-path-clear-storage'] },
    ],
    stories: {
      [STORY_ID]: {
        id: STORY_ID,
        state: { strokes: [], nextStrokeId: 0 },
        initial: { move: '@root' },
        straps: {
          'stroke-path-build': buildStrokeStrap,
          'stroke-path-restore': restoreStrokesStrap,
          'stroke-path-clear': clearStrokesStrap,
        },
        listen: [
          { on: 'stroke:captured', straps: ['stroke-path-build'] },
          { on: 'stroke:restore', straps: ['stroke-path-restore'] },
          { on: 'sketch:clear', straps: ['stroke-path-clear'] },
        ],
        persos: [
          createSceneLayout(),
          createStrokeLayer(),
          createClearButton(),
        ],
      },
    },
  }
}

/** Restores compatible V1 strokes through the public V2 event facade on mount. */
export function createInitialEvents(): readonly V2DemoEventInjection[] {
  return [{
    eventime: {
      name: 'stroke:restore',
      visibility: 'story',
      data: { strokes: [...readStoredStrokes()] },
    },
    target: { scope: 'story', storyId: STORY_ID },
  }]
}

/** Creates the shared page content and its named scene-local mounting parts. */
function createSceneLayout(): ScenePerso {
  return {
    id: 'stroke-path-layout',
    type: 'layout',
    initial: {
      move: '@root',
      className: 'stroke-path-scene',
      markup: `
        <main id="stroke-path-scene-markup" class="stroke-path-scene__surface">
          <div id="stroke-path-drawing-area" class="stroke-path-scene__area" data-part="stroke-path-layout:area"></div>
          <div id="stroke-path-controls" class="stroke-path-scene__controls" data-part="stroke-path-layout:controls"></div>
        </main>
      `,
    },
    actions: {},
  }
}

/** Declares the SVG layer as the real V2 pointer-capture owner. */
function createStrokeLayer(): ScenePerso {
  return {
    id: LAYER_PERSO_ID,
    type: 'stroke-path-layer',
    initial: { move: { target: 'stroke-path-layout:area' } },
    emit: {
      pointerdown: {
        preventDefault: true,
        event: { name: 'stroke:start' },
        capture: {
          trackOn: ['pointermove'],
          endOn: ['pointerup', 'pointercancel'],
          stateScope: 'story',
          initCaptureState: initStrokeCaptureState,
          trackCommand: trackStroke,
          endEmit: { name: 'stroke:captured' },
        },
      },
    },
    actions: {
      'stroke:start': {},
      stroke_tracking: {},
      'stroke:live:reset': {},
      'sketch:set-strokes': {},
      'stroke:save:done': {},
    },
  }
}

/** Creates the standard V2 button whose DOM event enters Perso.emit. */
function createClearButton(): ScenePerso {
  return {
    id: 'stroke-path-clear-button',
    type: 'tag',
    initial: {
      move: { target: 'stroke-path-layout:controls' },
      tag: 'button',
      content: 'Effacer',
      attr: { type: 'button' },
      className: 'stroke-path-clear-button',
    },
    emit: {
      pointerdown: {
        event: { name: 'sketch:clear', visibility: 'story' },
      },
    },
    actions: {},
  }
}

/** Initializes one drawing gesture from the latest fixture-local SVG origin. */
const initStrokeCaptureState: AuthorCaptureInitFunction = () => {
  const origin = getStrokePathAreaOrigin()
  return {
    points: [],
    color: randomStrokeColor(),
    originX: origin.left,
    originY: origin.top,
  }
}

/** Streams a smoothed live path through the compiled capture action target. */
const trackStroke: AuthorCaptureTrackFunction = ({ sample, captureState }) => {
  const state = readCaptureState(captureState)
  const x = finiteNumber(sample.clientX) - state.originX
  const y = finiteNumber(sample.clientY) - state.originY
  const points = [...state.points, { x, y }]
  const nextCaptureState: StrokeCaptureState = { ...state, points }
  if (points.length < 2) return { captureState: nextCaptureState }

  return {
    captureState: nextCaptureState,
    actions: [{
      name: 'stroke_tracking',
      data: { liveStroke: { d: buildSmoothPath(points), color: state.color } },
    }],
  }
}

/** Commits one lightly simplified capture and replaces the ordered story snapshot. */
const buildStrokeStrap: StrapFunction = ({ event, state }) => {
  const captureState = readCaptureState(event.data?.captureState)
  if (captureState.points.length < 2) return {}

  const filtered = filterByMinDistance([...captureState.points], MIN_POINT_DISTANCE)
  const reduced = reducePoints(filtered, RDP_EPSILON)
  const stroke: StoredStroke = {
    id: String(readNextStrokeId(state as StrokeStoryState)),
    d: buildSmoothPath(reduced),
    color: captureState.color,
  }
  const strokes = [...readStrokeArray((state as StrokeStoryState).strokes), stroke]

  return {
    update: {
      strokes,
      nextStrokeId: readNextStrokeId(state as StrokeStoryState) + 1,
    },
    events: [
      storyEvent('sketch:set-strokes', { strokes }),
      storyEvent('stroke:live:reset', { resetLive: true }),
      sceneEvent('sketch:stroke:committed', { stroke }),
    ],
  }
}

/** Restores an ordered storage snapshot and advances IDs beyond restored strokes. */
const restoreStrokesStrap: StrapFunction = ({ event }) => {
  const strokes = readStrokeArray(event.data?.strokes)
  return {
    update: { strokes, nextStrokeId: nextStrokeIdAfter(strokes) },
    events: [storyEvent('sketch:set-strokes', { strokes })],
  }
}

/** Clears the replayable snapshot and asks the scene strap to clear local storage. */
const clearStrokesStrap: StrapFunction = () => ({
  update: { strokes: [] },
  events: [
    storyEvent('sketch:set-strokes', { strokes: [] }),
    sceneEvent('sketch:cleared'),
  ],
})

/** Persists the committed stroke after the runtime has accepted its scene event. */
const saveStrokeStrap: StrapFunction = ({ event }) => {
  const data = isPlainRecord(event.data) ? event.data : {}
  const stroke = data.stroke
  if (!isStoredStroke(stroke)) return {}
  const strokes = readStoredStrokes().filter((candidate) => candidate.id !== stroke.id)
  writeStoredStrokes([...strokes, stroke])
  return { events: [storyEvent('stroke:save:done')] }
}

/** Clears saved strokes after the ordinary story clear event reaches the scene. */
const clearStrokeStorageStrap: StrapFunction = () => {
  clearStoredStrokes()
  return { events: [storyEvent('stroke:save:done')] }
}

/** Builds a story-targeted event consumed by the layer action index. */
function storyEvent(name: string, data?: CompiledRecord): StrapEvent {
  return { name, ...(data === undefined ? {} : { data }), storyId: STORY_ID, visibility: 'story' }
}

/** Builds a scene-visible event consumed by the scene storage listeners. */
function sceneEvent(name: string, data?: CompiledRecord): StrapEvent {
  return { name, ...(data === undefined ? {} : { data }), visibility: 'scene' }
}

/** Reads a capture state with safe point and color defaults. */
function readCaptureState(value: unknown): StrokeCaptureState {
  if (!isPlainRecord(value)) return { points: [], color: randomStrokeColor(), originX: 0, originY: 0 }
  const points = Array.isArray(value.points)
    ? value.points.filter(isLocalPoint)
    : []
  return {
    points,
    color: typeof value.color === 'string' ? value.color : randomStrokeColor(),
    originX: finiteNumber(value.originX),
    originY: finiteNumber(value.originY),
  }
}

/** Reads the next numeric stroke id from the resolved story state. */
function readNextStrokeId(state: StrokeStoryState): number {
  return typeof state.nextStrokeId === 'number' && Number.isFinite(state.nextStrokeId)
    ? Math.max(0, Math.floor(state.nextStrokeId))
    : nextStrokeIdAfter(readStrokeArray(state.strokes))
}

/** Finds the first ID unused by the restored ordered collection. */
function nextStrokeIdAfter(strokes: readonly StoredStroke[]): number {
  return strokes.reduce((next, stroke) => {
    const parsed = Number(stroke.id)
    return Number.isInteger(parsed) && parsed >= next ? parsed + 1 : next
  }, 0)
}

/** Keeps only valid persisted strokes in their authored order. */
function readStrokeArray(value: unknown): readonly StoredStroke[] {
  if (!Array.isArray(value)) return []
  const byId = new Map<string, StoredStroke>()
  for (const stroke of value) {
    if (isStoredStroke(stroke)) byId.set(stroke.id, stroke)
  }
  return [...byId.values()]
}

/** Checks one finite local point in a capture payload. */
function isLocalPoint(value: unknown): value is LocalPoint {
  if (!isPlainRecord(value)) return false
  return typeof value.x === 'number' && Number.isFinite(value.x)
    && typeof value.y === 'number' && Number.isFinite(value.y)
}

/** Reads one finite number or returns zero for malformed non-normative payloads. */
function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Returns a random color once for a complete gesture. */
function randomStrokeColor(): string {
  return `hsl(${Math.floor(Math.random() * 360)}, 75%, 45%)`
}

/** Rounds SVG coordinates to three decimal places to preserve persisted detail. */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

/** Calculates the shortest distance from one point to a line segment's infinite line. */
function perpendicularDistance(point: LocalPoint, start: LocalPoint, end: LocalPoint): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (dx === 0 && dy === 0) return Math.hypot(point.x - start.x, point.y - start.y)
  const numerator = Math.abs(dy * point.x - dx * point.y + end.x * start.y - end.y * start.x)
  return numerator / Math.hypot(dx, dy)
}

/** Keeps the smoothed quadratic path geometry from the V1 drawing fixture. */
function buildSmoothPath(points: readonly LocalPoint[]): string {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M${round3(points[0]!.x)} ${round3(points[0]!.y)} L${round3(points[1]!.x)} ${round3(points[1]!.y)}`
  }

  let path = `M${round3(points[0]!.x)} ${round3(points[0]!.y)}`
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index]!
    const next = points[index + 1]!
    path += ` Q${round3(current.x)} ${round3(current.y)} ${round3((current.x + next.x) / 2)} ${round3((current.y + next.y) / 2)}`
  }
  const last = points[points.length - 1]!
  return `${path} L${round3(last.x)} ${round3(last.y)}`
}

/** Filters redundant neighboring pointer samples before final simplification. */
function filterByMinDistance(points: readonly LocalPoint[], minDistance: number): LocalPoint[] {
  if (points.length < 3) return [...points]
  const filtered: LocalPoint[] = [points[0]!]
  for (let index = 1; index < points.length - 1; index += 1) {
    const last = filtered[filtered.length - 1]!
    if (Math.hypot(points[index]!.x - last.x, points[index]!.y - last.y) >= minDistance) {
      filtered.push(points[index]!)
    }
  }
  filtered.push(points[points.length - 1]!)
  return filtered
}

/** Simplifies one final stroke with the Douglas-Peucker algorithm. */
function reducePoints(points: readonly LocalPoint[], epsilon: number): LocalPoint[] {
  if (points.length < 3) return [...points]
  const first = points[0]!
  const last = points[points.length - 1]!
  let maxDistance = 0
  let splitIndex = 0
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = perpendicularDistance(points[index]!, first, last)
    if (distance > maxDistance) {
      maxDistance = distance
      splitIndex = index
    }
  }
  if (maxDistance <= epsilon) return [first, last]
  const left = reducePoints(points.slice(0, splitIndex + 1), epsilon)
  const right = reducePoints(points.slice(splitIndex), epsilon)
  return [...left.slice(0, -1), ...right]
}

/** Checks a plain event or action record at this fixture's dynamic boundary. */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
