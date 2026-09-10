import type { PersoDoc, StoryDoc } from 'codplay'
import type {
  AuthorCaptureInitFunction,
  AuthorCaptureTrackFunction,
} from 'codplay/scene/capture/authoring-types'
import type { PlannedStrapHelpers, PlannedStrapOccurrence, StrapFunction } from 'codplay/runtime/player'
import {
  POSITION_LIVE_A_COMMIT_STRAP,
  POSITION_LIVE_A_DRAG_EVENT,
  POSITION_LIVE_A_RELEASED_EVENT,
  POSITION_LIVE_A_SETTLED_EVENT,
  POSITION_LIVE_B_COMMIT_STRAP,
  POSITION_LIVE_B_DRAG_EVENT,
  POSITION_LIVE_B_RELEASED_EVENT,
  POSITION_LIVE_B_SETTLED_EVENT,
  POSITION_LIVE_BOUNCE_START_STRAP,
  POSITION_LIVE_INITIALIZE_EVENT,
  POSITION_LIVE_ITEM_MOVE_EVENT,
  POSITION_LIVE_ITEM_MOVE_STATE_STRAP,
  POSITION_MOVE_DURATION_MS,
  POSITION_NAMESPACE,
  POSITION_STORY_END_EVENT,
  POSITION_STORY_FOUR_ID,
} from './constants'
import { CAROUSEL_EVENTS_BY_STORY_ID, createViewRoot } from './carousel'
import {
  clamp,
  createPixelPositionStyle,
  createPositionMoveData,
  prepareQuadraticPositionPath,
  readFinite,
  readRecord,
} from './shared'
import type { AnchorId, PositionPoint } from './types'

const STAGE_TARGET = 'position:view-four:stage'
const A_CONTAINER = 'position:view-four:a'
const B_CONTAINER = 'position:view-four:b'
const INITIAL_TARGET_ID: AnchorId = 'b'

const LIVE_BOUNCE_START_OFFSET_MS = 650
const LIVE_BOUNCE_TARGETS: readonly AnchorId[] = ['b', 'a']
const LIVE_BOUNCE_REPEAT_COUNT = 20
const LIVE_BOUNCE_EASE = 'linear'
const LIVE_BOUNCE_END_OFFSET_MS = LIVE_BOUNCE_START_OFFSET_MS + POSITION_MOVE_DURATION_MS * LIVE_BOUNCE_REPEAT_COUNT

/** Creates story 4 with two physical anchors and live-calculated item moves. */
export function createStoryFour(): StoryDoc {
  const storyEvents = CAROUSEL_EVENTS_BY_STORY_ID[POSITION_STORY_FOUR_ID]
  const view = createViewRoot(POSITION_STORY_FOUR_ID, `
    <section class="position-view__frame position-view__frame--lesson">
      <div class="position-moving-stage position-two-node-stage" data-part="${STAGE_TARGET}">
        <div class="position-route position-route--stage" aria-hidden="true"><span class="position-route__line"></span></div>
        <div class="position-stage-axis" aria-hidden="true"><span></span><span></span></div>
      </div>
      <div class="position-story-caption">
        <span class="position-story-caption__number">04</span>
        <p>Faites glisser A ou B pendant la série de rebonds. La cible courante recalcule la trajectoire ; la source conserve le trajet en cours.</p>
      </div>
    </section>
  `)
  return {
    id: POSITION_STORY_FOUR_ID,
    state: {
      liveAX: 0,
      liveAY: 0,
      liveBX: 0,
      liveBY: 0,
      liveCurrentTargetId: INITIAL_TARGET_ID,
    },
    straps: {
      [POSITION_LIVE_BOUNCE_START_STRAP]: createLiveBounceStartStrap(),
      [POSITION_LIVE_A_COMMIT_STRAP]: createAnchorCommitStrap('a'),
      [POSITION_LIVE_B_COMMIT_STRAP]: createAnchorCommitStrap('b'),
      [POSITION_LIVE_ITEM_MOVE_STATE_STRAP]: createLiveItemMoveStateStrap(),
    },
    listen: [
      { on: storyEvents.enter, active: true, reset: true },
      { on: storyEvents.leave, active: false },
      { on: storyEvents.reset, reset: true },
      {
        on: POSITION_LIVE_INITIALIZE_EVENT,
        straps: [POSITION_LIVE_BOUNCE_START_STRAP],
      },
      {
        on: POSITION_LIVE_A_RELEASED_EVENT,
        straps: [POSITION_LIVE_A_COMMIT_STRAP],
      },
      {
        on: POSITION_LIVE_B_RELEASED_EVENT,
        straps: [POSITION_LIVE_B_COMMIT_STRAP],
      },
      {
        on: POSITION_LIVE_ITEM_MOVE_EVENT,
        straps: [POSITION_LIVE_ITEM_MOVE_STATE_STRAP],
      },
    ],
    persos: [
      view,
      createStoryFourAnchor('a'),
      createStoryFourAnchor('b'),
      {
        id: 'position-view-four-item',
        type: 'tag',
        initial: {
          tag: 'span',
          content: 'item',
          className: 'position-item position-item--lime',
          move: { target: A_CONTAINER },
        },
        // Every live transfer is a move supplied by the story event circuit.
        actions: { [POSITION_LIVE_ITEM_MOVE_EVENT]: true },
      },
    ],
  }
}

/** Creates one draggable physical anchor for the live lesson. */
function createStoryFourAnchor(anchorId: AnchorId): PersoDoc {
  const capture = createAnchorCapture(anchorId)
  const outlet = containerFor(anchorId)
  const releasedEvent = releasedEventFor(anchorId)
  const dragEvent = dragEventFor(anchorId)
  const settledEvent = settledEventFor(anchorId)
  return {
    id: `position-view-four-${anchorId}`,
    type: 'layout',
    initial: {
      move: { target: STAGE_TARGET },
      className: `position-anchor position-anchor--${anchorId} position-node position-node--${anchorId} position-live-anchor`,
      style: { x: '0px', y: '0px' },
      markup: `
        <article>
          <strong>${anchorId.toUpperCase()}</strong>
          <div class="position-node__outlet" data-part="${outlet}"></div>
        </article>
      `,
    },
    emit: {
      pointerdown: {
        preventDefault: true,
        event: { name: `${POSITION_NAMESPACE}:live:${anchorId}:grabbed` },
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
function createAnchorCapture(anchorId: AnchorId): Readonly<{
  initCaptureState: AuthorCaptureInitFunction
  trackCommand: AuthorCaptureTrackFunction
}> {
  const { xKey, yKey } = anchorStateKeys(anchorId)
  const actionName = dragEventFor(anchorId)
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
        data: {
          style: createPixelPositionStyle(x, y),
        },
      },
      captureState: { x, y },
      updateState: { [xKey]: x, [yKey]: y },
    }
  }
  return { initCaptureState, trackCommand }
}

/** Builds one item move toward the requested physical target. */
function createLiveBounceMoveData(
  targetId: AnchorId,
  points: Readonly<Record<AnchorId, PositionPoint>>,
): ReturnType<typeof createPositionMoveData> & { liveTargetId: AnchorId } {
  const sourceId = oppositeAnchorId(targetId)
  const sourcePoint = points[sourceId]
  const targetPoint = points[targetId]
  const distance = Math.hypot(targetPoint.x - sourcePoint.x, targetPoint.y - sourcePoint.y)
  const bend = clamp(0.18 + distance / 900, 0.16, 0.42)
  const controlY = targetId === 'b' ? -bend : bend
  const move = createPositionMoveData(
    containerFor(targetId),
    prepareQuadraticPositionPath(0.5, controlY),
    LIVE_BOUNCE_EASE,
  )
  return { ...move, liveTargetId: targetId }
}

/** Reads both physical anchor positions from one story state snapshot. */
function readAnchorPoints(state: Readonly<Record<string, unknown>>): Readonly<Record<AnchorId, PositionPoint>> {
  return {
    a: {
      x: readFinite(state.liveAX, 0),
      y: readFinite(state.liveAY, 0),
    },
    b: {
      x: readFinite(state.liveBX, 0),
      y: readFinite(state.liveBY, 0),
    },
  }
}

/** Schedules twenty alternating moves from the current physical anchor poses. */
export function planStoryFourAnimation(
  state: Readonly<Record<string, unknown>> = {},
  planned: Pick<PlannedStrapHelpers, 'repeat' | 'wait'>,
): readonly PlannedStrapOccurrence[] {
  const points = readAnchorPoints(state)
  const moves = planned.repeat(
    { eachMs: POSITION_MOVE_DURATION_MS, times: LIVE_BOUNCE_REPEAT_COUNT },
    ({ index }) => {
      const targetId = LIVE_BOUNCE_TARGETS[index % LIVE_BOUNCE_TARGETS.length]
      if (targetId === undefined) return undefined
      return {
        event: {
          name: POSITION_LIVE_ITEM_MOVE_EVENT,
          visibility: 'story',
          data: createLiveBounceMoveData(targetId, points),
        },
        update: { liveCurrentTargetId: targetId },
      }
    },
  ).map((occurrence) => ({
    ...occurrence,
    offsetMs: LIVE_BOUNCE_START_OFFSET_MS + occurrence.offsetMs,
  }))
  return [
    ...moves,
    ...planned.wait(LIVE_BOUNCE_END_OFFSET_MS, {
      event: { name: POSITION_STORY_END_EVENT, visibility: 'story' },
    }),
  ]
}

/** Starts the first finite bounce plan from the story's current anchor state. */
function createLiveBounceStartStrap(): StrapFunction {
  return ({ state, context }) => planStoryFourAnimation(state, context.planned)
}

/** Records the physical target of an item move for the next target release. */
function createLiveItemMoveStateStrap(): StrapFunction {
  return ({ event }) => {
    const targetId = readAnchorId(readRecord(event.data)?.liveTargetId)
    return targetId === undefined
      ? undefined
      : { update: { liveCurrentTargetId: targetId } }
  }
}

/** Commits one physical anchor and retargets only when that anchor is the current target. */
export function createAnchorCommitStrap(anchorId: AnchorId): StrapFunction {
  const { xKey, yKey } = anchorStateKeys(anchorId)
  const settledEvent = settledEventFor(anchorId)
  return ({ event, state }) => {
    const captureState = readRecord(readRecord(event.data)?.captureState)
    if (captureState === undefined) return undefined
    const x = clamp(readFinite(captureState.x, 0), -170, 170)
    const y = clamp(readFinite(captureState.y, 0), -105, 105)
    const points = {
      ...readAnchorPoints(state),
      [anchorId]: { x, y },
    } as Readonly<Record<AnchorId, PositionPoint>>
    const currentTargetId = readAnchorId(state.liveCurrentTargetId) ?? INITIAL_TARGET_ID
    const settled = {
      name: settledEvent,
      visibility: 'story' as const,
      data: {
        anchorId,
        style: createPixelPositionStyle(x, y),
      },
    }
    const update = {
      [xKey]: x,
      [yKey]: y,
      ...(anchorId === currentTargetId ? { liveCurrentTargetId: currentTargetId } : {}),
    }

    // Moving the current source only commits its own position. The active
    // item move still resolves FIRST -> the same target and is not restarted.
    if (anchorId !== currentTargetId) {
      return { update, events: [settled] }
    }

    const immediateMove = {
      name: POSITION_LIVE_ITEM_MOVE_EVENT,
      visibility: 'story' as const,
      data: createLiveBounceMoveData(currentTargetId, points),
    }
    return {
      update,
      events: [settled, immediateMove],
    }
  }
}

/** Returns the physical container that receives an item move. */
function containerFor(anchorId: AnchorId): string {
  return anchorId === 'a' ? A_CONTAINER : B_CONTAINER
}

/** Returns the state keys storing one physical anchor's position. */
function anchorStateKeys(anchorId: AnchorId): Readonly<{ xKey: string; yKey: string }> {
  return anchorId === 'a'
    ? { xKey: 'liveAX', yKey: 'liveAY' }
    : { xKey: 'liveBX', yKey: 'liveBY' }
}

/** Returns the physical event emitted while one anchor is being dragged. */
function dragEventFor(anchorId: AnchorId): string {
  return anchorId === 'a' ? POSITION_LIVE_A_DRAG_EVENT : POSITION_LIVE_B_DRAG_EVENT
}

/** Returns the physical event emitted when one anchor is released. */
function releasedEventFor(anchorId: AnchorId): string {
  return anchorId === 'a' ? POSITION_LIVE_A_RELEASED_EVENT : POSITION_LIVE_B_RELEASED_EVENT
}

/** Returns the physical event emitted after one anchor position is committed. */
function settledEventFor(anchorId: AnchorId): string {
  return anchorId === 'a' ? POSITION_LIVE_A_SETTLED_EVENT : POSITION_LIVE_B_SETTLED_EVENT
}

/** Returns the other physical anchor for the next item direction. */
function oppositeAnchorId(anchorId: AnchorId): AnchorId {
  return anchorId === 'a' ? 'b' : 'a'
}

/** Accepts only a physical anchor id carried by internal move metadata. */
function readAnchorId(value: unknown): AnchorId | undefined {
  return value === 'a' || value === 'b' ? value : undefined
}
