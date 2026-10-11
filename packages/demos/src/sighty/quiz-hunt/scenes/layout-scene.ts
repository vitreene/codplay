import type { SceneDoc } from 'codplay/scene/types'
import type { AuthorCaptureTrackFunction } from 'codplay/scene/capture'
import { QUIZ_HUNT_EXTRA_HIDE_DURATION_MS } from '../game-rules'
import { QUIZ_HUNT_EVENTS } from '../messages'

const EXTRA_OFFER_OUTLET = 'quiz-hunt:layout:extra-offer'
const EXTRA_INVENTORY_OUTLET = 'quiz-hunt:layout:extra-inventory'

type LayoutScenePerso = SceneDoc<string>['stories'][string]['persos'][number]

/** Composes the content, basket, and full-scene result overlay outlets. */
export const layoutScene: SceneDoc<string> = {
  id: 'quiz-hunt-layout',
  stories: {
    main: {
      id: 'main',
      initial: { move: '@root' },
      straps: {
        'quiz-hunt-layout-commit-capture-end': ({ event }) => {
          const captureState = readRecord(event.data?.captureState)
          const style = readRecord(captureState.style)
          if (typeof style.x !== 'string' || typeof style.y !== 'string') return undefined
          return {
            events: [{
              name: QUIZ_HUNT_EVENTS.extraDragCommit,
              data: {
                style: {
                  x: style.x,
                  y: style.y,
                  zIndex: readFinite(style.zIndex, 30),
                },
              },
            }],
          }
        },
      },
      listen: [{
        on: QUIZ_HUNT_EVENTS.extraDragEnd,
        straps: ['quiz-hunt-layout-commit-capture-end'],
      }],
      persos: [
        {
          id: 'quiz-hunt-layout-frame',
          type: 'layout',
          initial: {
            move: '@root',
            className: 'quiz-hunt-layout',
            markup: `<div id="quiz-hunt-layout-root" class="quiz-hunt-layout">
              <div id="quiz-hunt-layout-main-zone" class="quiz-hunt-main-zone" data-part="quiz-hunt:layout:content"></div>
              <div id="quiz-hunt-layout-basket-host" data-part="quiz-hunt:layout:basket"></div>
              <div id="quiz-hunt-layout-extra-overlay" class="quiz-hunt-extra-overlay">
                <div id="quiz-hunt-layout-extra-offer" class="quiz-hunt-extra-outlet" data-part="${EXTRA_OFFER_OUTLET}"></div>
                <div id="quiz-hunt-layout-extra-inventory" class="quiz-hunt-extra-outlet" data-part="${EXTRA_INVENTORY_OUTLET}"></div>
              </div>
              <div id="quiz-hunt-layout-result-host" data-part="quiz-hunt:layout:result"></div>
            </div>`,
          },
          actions: {},
        },
        createExtraToken(),
        createLayoutSlot('slot-content', 'quiz-hunt:layout:content'),
        createLayoutSlot('slot-basket', 'quiz-hunt:layout:basket'),
        createLayoutSlot('slot-result', 'quiz-hunt:layout:result'),
      ],
    },
  },
}

/** Creates the V1-styled extra token and keeps its capture inside the game layout scene. */
function createExtraToken(): LayoutScenePerso {
  return {
    id: 'quiz-hunt-extra-token',
    type: 'tag',
    initial: {
      tag: 'button',
      content: 'E',
      className: 'quiz-hunt-extra-token is-hidden',
      style: { x: 0, y: 0, zIndex: 20 },
      attr: {
        type: 'button',
        'aria-label': 'Jeton de rattrapage',
        title: 'Jeton de rattrapage',
      },
      move: { target: EXTRA_OFFER_OUTLET },
    },
    emit: {
      click: { event: { name: QUIZ_HUNT_EVENTS.extraCollect, visibility: 'public' } },
      pointerdown: {
        event: { name: QUIZ_HUNT_EVENTS.extraDragStart },
        capture: {
          trackOn: ['pointermove'],
          endOn: ['pointerup', 'pointercancel'],
          stateScope: 'story',
          initCaptureState: initExtraTokenCaptureState,
          trackCommand: trackExtraToken,
          // The end event materializes the last drag offset after live capture actions are cleared.
          endEmit: { name: QUIZ_HUNT_EVENTS.extraDragEnd },
        },
      },
    },
    actions: {
      [QUIZ_HUNT_EVENTS.extraShow]: {
        className: { add: 'is-visible', remove: 'is-hidden' },
        style: { opacity: 1 },
      },
      [QUIZ_HUNT_EVENTS.extraHide]: {
        className: { add: 'is-hidden', remove: 'is-visible' },
      },
      [QUIZ_HUNT_EVENTS.extraRetryHide]: {
        className: { add: 'is-hiding', remove: 'is-dragging' },
        style: {
          opacity: { from: 1, to: 0, duration: QUIZ_HUNT_EXTRA_HIDE_DURATION_MS },
          y: { to: '-=150px', duration: QUIZ_HUNT_EXTRA_HIDE_DURATION_MS },
        },
      },
      [QUIZ_HUNT_EVENTS.extraRetryHideDone]: {
        className: { add: 'is-hidden', remove: 'is-visible is-hiding' },
        style: { x: 0, y: 0, zIndex: 20 },
      },
      [QUIZ_HUNT_EVENTS.extraCollected]: {
        move: {
          target: EXTRA_INVENTORY_OUTLET,
          transition: {
            duration: 360,
            ease: 'outCubic',
            path: 'M 0 0 A 1.25 1.25 0 0 1 1 0',
          },
        },
        className: {
          add: 'quiz-hunt-extra-token-inventory is-visible',
          remove: 'is-hidden',
        },
        style: { x: 0, y: 0, zIndex: 20 },
      },
      [QUIZ_HUNT_EVENTS.extraDragStart]: {
        className: { add: 'is-dragging' },
      },
      [QUIZ_HUNT_EVENTS.extraDragTrack]: {},
      [QUIZ_HUNT_EVENTS.extraDragEnd]: {
        className: { remove: 'is-dragging' },
      },
      [QUIZ_HUNT_EVENTS.extraDragCommit]: true,
      [QUIZ_HUNT_EVENTS.extraDragReturn]: {
        style: {
          x: { to: '0px', duration: 180, ease: 'outQuad' },
          y: { to: '0px', duration: 180, ease: 'outQuad' },
          zIndex: 20,
        },
      },
    },
  }
}

/** Starts each token drag from its stable inventory position. */
function initExtraTokenCaptureState(): Record<string, unknown> {
  return { style: { x: '0px', y: '0px', zIndex: 30 } }
}

/** Moves the visible token by the live pointer delta during V2 capture. */
function trackExtraToken({ sample, captureState }: Parameters<AuthorCaptureTrackFunction>[0]) {
  const previousStyle = readRecord(captureState.style)
  const style = {
    x: `${readPixelValue(previousStyle.x) + readFinite(sample.movementX, 0)}px`,
    y: `${readPixelValue(previousStyle.y) + readFinite(sample.movementY, 0)}px`,
    zIndex: 30,
  }
  return {
    actions: [{
      name: QUIZ_HUNT_EVENTS.extraDragTrack,
      data: { style },
    }],
    captureState: { style },
  }
}

/** Uses a finite authored capture value or a stable fallback. */
function readFinite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Reads one CSS-pixel offset retained in the private capture state. */
function readPixelValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return 0
  const match = /^(-?(?:\d+\.?\d*|\.\d+))px$/.exec(value.trim())
  if (match === null) return 0
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : 0
}

/** Narrows one capture value to a record before reading its authored style fields. */
function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

/** Creates one named Sighty slot in the matching game layout outlet. */
function createLayoutSlot(name: string, target: string) {
  return {
    id: `quiz-hunt-${name}`,
    name,
    type: 'slot' as const,
    initial: { move: { target } },
    actions: {},
  }
}
