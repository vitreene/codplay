import type { PersoDoc, StoryDoc } from 'codplay'
import type {
  AuthorCaptureInitFunction,
  AuthorCaptureTrackFunction,
} from 'codplay/scene/capture/authoring-types'
import type { StrapFunction } from 'codplay/runtime/player'
import {
  POSITION_LIVE_ITEM_MOVE_EVENT,
  POSITION_LIVE_SOURCE_DRAG_EVENT,
  POSITION_LIVE_SOURCE_RELEASED_EVENT,
  POSITION_LIVE_SOURCE_SETTLED_EVENT,
  POSITION_LIVE_TARGET_DRAG_EVENT,
  POSITION_LIVE_TARGET_RELEASED_EVENT,
  POSITION_LIVE_TARGET_SETTLED_EVENT,
  POSITION_LIVE_BOUNCE_STRAP,
  POSITION_LIVE_SOURCE_COMMIT_STRAP,
  POSITION_LIVE_TARGET_COMMIT_STRAP,
  POSITION_STORY_FOUR_ID,
  POSITION_NAMESPACE,
} from './constants'
import { createViewRoot } from './carousel'
import {
  clamp,
  createCircularArcPath,
  createPixelPositionStyle,
  createPositionMoveData,
  readFinite,
  readRecord,
} from './shared'
import type { AnchorRole, PositionPoint, StoryAnimationOccurrence } from './types'

const STAGE_TARGET = 'position:view-four:stage'
const SOURCE_CONTAINER = 'position:view-four:source'
const TARGET_CONTAINER = 'position:view-four:target'

const LIVE_BOUNCES: readonly Readonly<{ offsetMs: number; target: AnchorRole }>[] = [
  { offsetMs: 650, target: 'target' },
  { offsetMs: 1_800, target: 'source' },
  { offsetMs: 2_950, target: 'target' },
  { offsetMs: 4_100, target: 'source' },
]

/** Creates story 4 with draggable anchors and live-calculated moves. */
export function createStoryFour(): StoryDoc {
  const view = createViewRoot(3, `
    <section class="position-view__frame position-view__frame--lesson">
      <div class="position-live-stage" data-part="${STAGE_TARGET}">
        <div class="position-route position-route--stage" aria-hidden="true"><span class="position-route__line"></span></div>
        <div class="position-live-stage__beam" aria-hidden="true"><span></span><span></span><span></span></div>
      </div>
      <div class="position-story-caption">
        <span class="position-story-caption__number">04</span>
        <p>Faites glisser source ou cible pendant la boucle. Les rebonds reprennent les ancres courantes ; un relâchement émet aussitôt un move recalculé.</p>
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
      [POSITION_LIVE_BOUNCE_STRAP]: createLiveBounceStrap(),
    },
    listen: [
      { on: POSITION_LIVE_SOURCE_RELEASED_EVENT, straps: [POSITION_LIVE_SOURCE_COMMIT_STRAP] },
      { on: POSITION_LIVE_TARGET_RELEASED_EVENT, straps: [POSITION_LIVE_TARGET_COMMIT_STRAP] },
      { on: POSITION_LIVE_SOURCE_SETTLED_EVENT, straps: [POSITION_LIVE_BOUNCE_STRAP] },
      { on: POSITION_LIVE_TARGET_SETTLED_EVENT, straps: [POSITION_LIVE_BOUNCE_STRAP] },
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
      className: `position-live-anchor position-live-anchor--${role}`,
      style: { x: '0px', y: '0px' },
      markup: `
        <article class="position-node position-node--${role}">
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
  return createPositionMoveData(target, createCircularArcPath(0.5, controlY))
}

/** Schedules four two-second reparenting moves for the live lesson. */
export function createStoryFourAnimationPlan(
  state: Readonly<Record<string, unknown>> = {},
): readonly StoryAnimationOccurrence[] {
  const sourcePoint = {
    x: readFinite(state.liveSourceX, 0),
    y: readFinite(state.liveSourceY, 0),
  }
  const targetPoint = {
    x: readFinite(state.liveTargetX, 0),
    y: readFinite(state.liveTargetY, 0),
  }
  return LIVE_BOUNCES.map((bounce) => ({
    name: POSITION_LIVE_ITEM_MOVE_EVENT,
    offsetMs: bounce.offsetMs,
    data: createLiveBounceMoveData(bounce.target, sourcePoint, targetPoint),
  }))
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

/** Calculates one immediate two-second rebound after a live anchor release. */
export function createLiveBounceStrap(): StrapFunction {
  return ({ event, state }) => {
    const data = readRecord(event.data)
    const targetRole: AnchorRole = data?.anchorRole === 'source'
      ? 'target'
      : data?.anchorRole === 'target'
        ? 'source'
        : data?.target === 'source'
          ? 'source'
          : 'target'
    const sourcePoint = {
      x: readFinite(state.liveSourceX, 0),
      y: readFinite(state.liveSourceY, 0),
    }
    const targetPoint = {
      x: readFinite(state.liveTargetX, 0),
      y: readFinite(state.liveTargetY, 0),
    }
    return {
      events: [{
        name: POSITION_LIVE_ITEM_MOVE_EVENT,
        data: createLiveBounceMoveData(targetRole, sourcePoint, targetPoint),
      }],
    }
  }
}
