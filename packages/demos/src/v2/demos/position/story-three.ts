import type { AuthorListenEvent, AuthorListenTransform, PersoDoc } from 'codplay'
import type {
  AuthorCaptureInitFunction,
  AuthorCaptureTrackFunction,
} from 'codplay/scene/capture/authoring-types'
import type { StrapFunction } from 'codplay/runtime/player'
import {
  POSITION_PATH_CAPTURE_EVENT,
  POSITION_PATH_CONTROL_LIVE_EVENT,
  POSITION_PATH_CONTROL_SETTLED_EVENT,
  POSITION_PATH_ITEM_MOVE_EVENT,
} from './constants'
import { createViewRoot } from './carousel'
import {
  clamp,
  createCircularArcPath,
  createPositionMoveData,
  preparePositionPath,
  readFinite,
  readRecord,
} from './shared'
import type { StoryAnimationOccurrence } from './types'

const SOURCE_CONTAINER = 'position:view-three:source'
const TARGET_CONTAINER = 'position:view-three:target'
const CONTROL_TARGET = 'position:view-three:control'

/** Creates the third lesson: the captured control point determines the item path. */
export function createStoryThree(): readonly PersoDoc[] {
  const view = createViewRoot(2, `
    <section class="position-view__frame position-view__frame--lesson">
      <div class="position-path-stage">
        <article class="position-node position-node--source">
          <strong>source</strong>
          <div class="position-node__outlet" data-part="${SOURCE_CONTAINER}"></div>
        </article>
        <div class="position-path-visual">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <path d="M 8 55 A 42 42 0 0 0 92 55" pathLength="1"></path>
            <path class="position-path-visual__ghost" d="M 8 55 L 92 55" pathLength="1"></path>
          </svg>
          <div class="position-path-control-zone" data-part="${CONTROL_TARGET}"></div>
        </div>
        <article class="position-node position-node--target">
          <strong>cible</strong>
          <div class="position-node__outlet" data-part="${TARGET_CONTAINER}"></div>
        </article>
      </div>
      <div class="position-story-caption">
        <span class="position-story-caption__number">03</span>
        <p>Déplacez le point médian. La capture prépare un path, puis le transmet au move de l’item.</p>
      </div>
    </section>
  `)
  const capture = createPathControlCapture()
  return [
    view,
    {
      id: 'position-view-three-path-control',
      type: 'tag',
      initial: {
        tag: 'button',
        content: '·',
        className: 'position-path-control',
        attr: { type: 'button', 'aria-label': 'Déplacer le point médian du path' },
        style: createPathControlStyle(0.5, -0.48),
        move: { target: CONTROL_TARGET },
      },
      emit: {
        pointerdown: {
          preventDefault: true,
          event: { name: `${POSITION_PATH_CAPTURE_EVENT}:grabbed` },
          capture: {
            trackOn: ['pointermove'],
            endOn: ['pointerup', 'pointercancel'],
            stateScope: 'story',
            initCaptureState: capture.initCaptureState,
            trackCommand: capture.trackCommand,
            endEmit: { name: POSITION_PATH_CAPTURE_EVENT },
          },
        },
      },
      actions: {
        [POSITION_PATH_CONTROL_LIVE_EVENT]: true,
        [POSITION_PATH_CONTROL_SETTLED_EVENT]: true,
      },
    },
    {
      id: 'position-view-three-item',
      type: 'tag',
      initial: {
        tag: 'span',
        content: 'item',
        className: 'position-item position-item--cyan',
        move: { target: SOURCE_CONTAINER },
      },
      // The captured path and the move duration arrive in event.data.
      actions: { [POSITION_PATH_ITEM_MOVE_EVENT]: true },
    },
  ]
}

/** Creates a path-control capture that stores normalized scene data in story state. */
function createPathControlCapture(): Readonly<{
  initCaptureState: AuthorCaptureInitFunction
  trackCommand: AuthorCaptureTrackFunction
}> {
  const initCaptureState: AuthorCaptureInitFunction = ({ state }) => ({
    controlX: clamp(readFinite(state.pathControlX, 0.5), 0.12, 0.88),
    controlY: clamp(readFinite(state.pathControlY, -0.48), -0.9, 0.9),
  })
  const trackCommand: AuthorCaptureTrackFunction = ({ sample, captureState }) => {
    const previousX = clamp(readFinite(captureState.controlX, 0.5), 0.12, 0.88)
    const previousY = clamp(readFinite(captureState.controlY, -0.48), -0.9, 0.9)
    const controlX = clamp(previousX + readFinite(sample.movementX, 0) / 260, 0.12, 0.88)
    const controlY = clamp(previousY + readFinite(sample.movementY, 0) / 150, -0.9, 0.9)
    return {
      action: {
        actionName: POSITION_PATH_CONTROL_LIVE_EVENT,
        data: { style: createPathControlStyle(controlX, controlY) },
      },
      captureState: { controlX, controlY },
      updateState: { pathControlX: controlX, pathControlY: controlY },
    }
  }
  return { initCaptureState, trackCommand }
}

/** Converts a normalized control point to the handle's local visual offset. */
function createPathControlStyle(controlX: number, controlY: number): Record<string, number> {
  return {
    x: (controlX - 0.5) * 260,
    y: controlY * 120,
  }
}

/** Schedules the initial curved move for the third lesson. */
export function createStoryThreeAnimationPlan(): readonly StoryAnimationOccurrence[] {
  return [{
    name: POSITION_PATH_ITEM_MOVE_EVENT,
    offsetMs: 1_050,
    data: createPositionMoveData(TARGET_CONTAINER, createCircularArcPath(0.5, -0.48)),
  }]
}

/** Commits the latest captured control point to the story state. */
export function createPathCommitStrap(): StrapFunction {
  return ({ event }) => {
    const captureState = readRecord(readRecord(event.data)?.captureState)
    if (captureState === undefined) return undefined
    return {
      update: {
        pathControlX: clamp(readFinite(captureState.controlX, 0.5), 0.12, 0.88),
        pathControlY: clamp(readFinite(captureState.controlY, -0.48), -0.9, 0.9),
      },
    }
  }
}

/** Converts captured control coordinates into a prepared move carried by event.data. */
export function createPathCaptureTransform(): AuthorListenTransform {
  /** Maps the capture payload to the item move and settled control-point event. */
  const transform = (event: AuthorListenEvent): readonly AuthorListenEvent[] | undefined => {
    const captureState = readRecord(readRecord(event.data)?.captureState)
    if (captureState === undefined) return undefined
    const controlX = clamp(readFinite(captureState.controlX, 0.5), 0.12, 0.88)
    const controlY = clamp(readFinite(captureState.controlY, -0.48), -0.9, 0.9)
    const path = preparePositionPath(controlX, controlY)
    return [
      {
        name: POSITION_PATH_ITEM_MOVE_EVENT,
        data: createPositionMoveData(TARGET_CONTAINER, path),
      },
      {
        name: POSITION_PATH_CONTROL_SETTLED_EVENT,
        data: { style: createPathControlStyle(controlX, controlY) },
      },
    ]
  }
  return transform
}
