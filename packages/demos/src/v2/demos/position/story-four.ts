import type { PersoDoc, StoryDoc } from 'codplay'
import type {
  AuthorCaptureInitFunction,
  AuthorCaptureTrackFunction,
} from 'codplay/scene/capture/authoring-types'
import type { PlannedStrapHelpers, PlannedStrapOccurrence, StrapFunction } from 'codplay/runtime/player'
import {
  POSITION_LIVE_ITEM_MOVE_EVENT,
  POSITION_LIVE_SOURCE_DRAG_EVENT,
  POSITION_LIVE_SOURCE_RELEASED_EVENT,
  POSITION_LIVE_SOURCE_SETTLED_EVENT,
  POSITION_LIVE_TARGET_DRAG_EVENT,
  POSITION_LIVE_TARGET_RELEASED_EVENT,
  POSITION_LIVE_TARGET_SETTLED_EVENT,
  POSITION_LIVE_SOURCE_COMMIT_STRAP,
  POSITION_LIVE_TARGET_COMMIT_STRAP,
  POSITION_MOVE_DURATION_MS,
  POSITION_STORY_END_EVENT,
  POSITION_STORY_FOUR_ID,
  POSITION_NAMESPACE,
} from './constants'
import { CAROUSEL_EVENTS, createViewRoot } from './carousel'
import {
  clamp,
  createCircularArcPath,
  createPixelPositionStyle,
  createPositionMoveData,
  readFinite,
  readRecord,
} from './shared'
import type { AnchorRole, PositionPoint } from './types'

const STAGE_TARGET = 'position:view-four:stage'
const SOURCE_CONTAINER = 'position:view-four:source'
const TARGET_CONTAINER = 'position:view-four:target'

const LIVE_BOUNCE_START_OFFSET_MS = 650
const LIVE_BOUNCE_TARGETS: readonly AnchorRole[] = ['target', 'source']
const LIVE_BOUNCE_REPEAT_COUNT = 20
const LIVE_BOUNCE_EASE = 'linear'
const LIVE_BOUNCE_END_OFFSET_MS = LIVE_BOUNCE_START_OFFSET_MS + POSITION_MOVE_DURATION_MS * LIVE_BOUNCE_REPEAT_COUNT

/** Creates story 4 with draggable anchors and live-calculated moves. */
export function createStoryFour(): StoryDoc {
  const view = createViewRoot(3, `
    <section class="position-view__frame position-view__frame--lesson">
      <div class="position-moving-stage position-two-node-stage" data-part="${STAGE_TARGET}">
        <div class="position-route position-route--stage" aria-hidden="true"><span class="position-route__line"></span></div>
        <div class="position-stage-axis" aria-hidden="true"><span></span><span></span></div>
      </div>
      <div class="position-story-caption">
        <span class="position-story-caption__number">04</span>
        <p>Faites glisser source ou cible pendant la série de rebonds. Au relâchement, la trajectoire courante est recalculée.</p>
      </div>
    </section>
  `)
  return {
    id: POSITION_STORY_FOUR_ID,
    state: {
      liveSourceX: 0,
      liveSourceY: 0,
      liveTargetX: 0,
      liveTargetY: 0,
    },
    straps: {
      [POSITION_LIVE_SOURCE_COMMIT_STRAP]: createAnchorCommitStrap('source'),
      [POSITION_LIVE_TARGET_COMMIT_STRAP]: createAnchorCommitStrap('target'),
    },
    listen: [
      { on: CAROUSEL_EVENTS[3].enter, active: true, reset: true },
      { on: CAROUSEL_EVENTS[3].leave, active: false },
      { on: CAROUSEL_EVENTS[3].reset, reset: true },
      { on: POSITION_LIVE_SOURCE_RELEASED_EVENT, straps: [POSITION_LIVE_SOURCE_COMMIT_STRAP] },
      { on: POSITION_LIVE_TARGET_RELEASED_EVENT, straps: [POSITION_LIVE_TARGET_COMMIT_STRAP] },
    ],
    persos: [
      view,
      createStoryFourAnchor('source'),
      createStoryFourAnchor('target'),
      {
        id: 'position-view-four-item',
        type: 'tag',
        initial: {
          tag: 'span',
          content: 'item',
          className: 'position-item position-item--lime',
          move: { target: SOURCE_CONTAINER },
        },
        // Every live transfer is a move supplied by the story event circuit.
        actions: { [POSITION_LIVE_ITEM_MOVE_EVENT]: true },
      },
    ],
  }
}

/** Creates one draggable source or target anchor for the live lesson. */
function createStoryFourAnchor(role: AnchorRole): PersoDoc {
  const isSource = role === 'source'
  const capture = createAnchorCapture(role)
  const outlet = isSource ? SOURCE_CONTAINER : TARGET_CONTAINER
  const releasedEvent = isSource ? POSITION_LIVE_SOURCE_RELEASED_EVENT : POSITION_LIVE_TARGET_RELEASED_EVENT
  const dragEvent = isSource ? POSITION_LIVE_SOURCE_DRAG_EVENT : POSITION_LIVE_TARGET_DRAG_EVENT
  const settledEvent = isSource ? POSITION_LIVE_SOURCE_SETTLED_EVENT : POSITION_LIVE_TARGET_SETTLED_EVENT
  return {
    id: `position-view-four-${role}`,
    type: 'layout',
    initial: {
      move: { target: STAGE_TARGET },
      className: `position-anchor position-anchor--${role} position-node position-node--${role} position-live-anchor`,
      style: { x: '0px', y: '0px' },
      markup: `
        <article>
          <strong>${role}</strong>
          <div class="position-node__outlet" data-part="${outlet}"></div>
        </article>
      `,
    },
    emit: {
      pointerdown: {
        preventDefault: true,
        event: { name: `${POSITION_NAMESPACE}:live:${role}:grabbed` },
        capture: {
          trackOn: ['pointermove'],
          endOn: ['pointerup', 'pointercancel'],
          stateScope: 'story',
          initCaptureState: capture.initCaptureState,
          trackCommand: capture.trackCommand,
          endEmit: { name: releasedEvent },
        },
      },
    },
    actions: {
      [dragEvent]: true,
      [settledEvent]: true,
    },
  }
}

/** Creates an anchor capture that preserves exact pointer displacement in pixels. */
function createAnchorCapture(role: AnchorRole): Readonly<{
  initCaptureState: AuthorCaptureInitFunction
  trackCommand: AuthorCaptureTrackFunction
}> {
  const xKey = role === 'source' ? 'liveSourceX' : 'liveTargetX'
  const yKey = role === 'source' ? 'liveSourceY' : 'liveTargetY'
  const actionName = role === 'source' ? POSITION_LIVE_SOURCE_DRAG_EVENT : POSITION_LIVE_TARGET_DRAG_EVENT
  const initCaptureState: AuthorCaptureInitFunction = ({ state }) => ({
    x: readFinite(state[xKey], 0),
    y: readFinite(state[yKey], 0),
  })
  const trackCommand: AuthorCaptureTrackFunction = ({ sample, captureState }) => {
    const x = clamp(readFinite(captureState.x, 0) + readFinite(sample.movementX, 0), -170, 170)
    const y = clamp(readFinite(captureState.y, 0) + readFinite(sample.movementY, 0), -105, 105)
    return {
      action: {
        actionName,
        data: { style: createPixelPositionStyle(x, y) },
      },
      captureState: { x, y },
      updateState: { [xKey]: x, [yKey]: y },
    }
  }
  return { initCaptureState, trackCommand }
}

/** Builds one live bounce move from the current anchor positions. */
function createLiveBounceMoveData(
  targetRole: AnchorRole,
  sourcePoint: PositionPoint,
  targetPoint: PositionPoint,
): ReturnType<typeof createPositionMoveData> {
  const distance = Math.hypot(targetPoint.x - sourcePoint.x, targetPoint.y - sourcePoint.y)
  const bend = clamp(0.34 + distance / 520, 0.32, 0.78)
  const controlY = targetRole === 'target' ? -bend : bend
  const target = targetRole === 'target' ? TARGET_CONTAINER : SOURCE_CONTAINER
  return createPositionMoveData(target, createCircularArcPath(0.5, controlY), 'overlay', LIVE_BOUNCE_EASE)
}

/** Schedules twenty sequential two-second moves with the V2 planned repeat helper. */
export function planStoryFourAnimation(
  state: Readonly<Record<string, unknown>> = {},
  planned: Pick<PlannedStrapHelpers, 'repeat' | 'wait'>,
): readonly PlannedStrapOccurrence[] {
  const sourcePoint = {
    x: readFinite(state.liveSourceX, 0),
    y: readFinite(state.liveSourceY, 0),
  }
  const targetPoint = {
    x: readFinite(state.liveTargetX, 0),
    y: readFinite(state.liveTargetY, 0),
  }
  const moves = planned.repeat(
    { eachMs: POSITION_MOVE_DURATION_MS, times: LIVE_BOUNCE_REPEAT_COUNT },
    ({ index }) => {
      const targetRole = LIVE_BOUNCE_TARGETS[index % LIVE_BOUNCE_TARGETS.length]
      if (targetRole === undefined) return undefined
      return {
        event: {
          name: POSITION_LIVE_ITEM_MOVE_EVENT,
          visibility: 'scene',
          data: createLiveBounceMoveData(targetRole, sourcePoint, targetPoint),
        },
      }
    },
  ).map((occurrence) => ({
    ...occurrence,
    offsetMs: LIVE_BOUNCE_START_OFFSET_MS + occurrence.offsetMs,
  }))
  return [
    ...moves,
    ...planned.wait(LIVE_BOUNCE_END_OFFSET_MS, {
      event: { name: POSITION_STORY_END_EVENT, visibility: 'scene' },
    }),
  ]
}

/** Commits one released anchor and emits its settled position through the event circuit. */
export function createAnchorCommitStrap(role: AnchorRole): StrapFunction {
  const isSource = role === 'source'
  const xKey = isSource ? 'liveSourceX' : 'liveTargetX'
  const yKey = isSource ? 'liveSourceY' : 'liveTargetY'
  const settledEvent = isSource ? POSITION_LIVE_SOURCE_SETTLED_EVENT : POSITION_LIVE_TARGET_SETTLED_EVENT
  return ({ event }) => {
    const captureState = readRecord(readRecord(event.data)?.captureState)
    if (captureState === undefined) return undefined
    const x = clamp(readFinite(captureState.x, 0), -170, 170)
    const y = clamp(readFinite(captureState.y, 0), -105, 105)
    return {
      update: { [xKey]: x, [yKey]: y },
      events: [{ name: settledEvent, data: { anchorRole: role, style: createPixelPositionStyle(x, y) } }],
    }
  }
}
