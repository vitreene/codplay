import type { PersoDoc, SceneDoc } from 'codplay/scene/types'
import type { AuthorCaptureTrackFunction } from 'codplay/scene/capture'
import { QUIZ_HUNT_ORIGINAL_GAME_STYLES } from './quiz-hunt-original-game-styles.ts'

export const QUIZ_HUNT_SLOT = {
  CONTENT: 'slot-content',
  BASKET: 'slot-basket',
} as const

export const QUIZ_HUNT_LAYOUT_EVENT = {
  EXTRA_SHOW: 'quiz-hunt:extra:show',
  EXTRA_HIDE: 'quiz-hunt:extra:hide',
  EXTRA_COLLECT: 'quiz-hunt:extra:collect',
  EXTRA_COLLECTED: 'quiz-hunt:extra:collected',
  EXTRA_DRAG_START: 'quiz-hunt:extra:drag:start',
  EXTRA_DRAG_TRACK: 'quiz-hunt:extra:drag:track',
  EXTRA_DRAG_END: 'quiz-hunt:extra:drag:end',
  EXTRA_DRAG_COMMIT: 'quiz-hunt:extra:drag:commit',
  EXTRA_DRAG_RETURN: 'quiz-hunt:extra:drag:return',
  EXTRA_DROP_TARGET: 'quiz-hunt:extra:drop-target',
  EXTRA_RETRY_HIDE: 'quiz-hunt:extra:retry-hide',
  EXTRA_RETRY_HIDE_DONE: 'quiz-hunt:extra:retry-hide-done',
  RESULT_ROUTE: 'quiz-hunt:result:route',
  RESULT_SUCCESS: 'quiz-hunt:result:success',
  RESULT_FAILURE: 'quiz-hunt:result:failure',
} as const

const EXTRA_OFFER_PART = 'quiz-hunt:layout:extra-offer'
const EXTRA_INVENTORY_PART = 'quiz-hunt:layout:extra-inventory'
export const QUIZ_HUNT_EXTRA_RETRY_HIDE_DURATION_MS = 800

type LayoutPerso = SceneDoc<string>['stories'][string]['persos'][number]

/** Builds the persistent game frame, content and basket outlets, and extra token. */
export function buildQuizHuntLayoutScene(): Readonly<{ sceneDoc: SceneDoc<string>; styleSheet: string }> {
  return {
    sceneDoc: {
      id: 'quiz-hunt-layout-scene',
      stories: {
        main: {
          id: 'main',
          initial: { move: '@root' },
          straps: {
            'quiz-hunt-layout-capture-end': ({ event }) => {
              const style = readRecord(readRecord(event.data?.captureState).style)
              if (typeof style.x !== 'string' || typeof style.y !== 'string') return undefined
              return {
                events: [{
                  name: QUIZ_HUNT_LAYOUT_EVENT.EXTRA_DRAG_COMMIT,
                  data: { style: { x: style.x, y: style.y, zIndex: readFinite(style.zIndex, 30) } },
                }],
              }
            },
            'quiz-hunt-layout-result-route': ({ event }) => {
              const outcome = event.data?.outcome
              if (outcome !== 'success' && outcome !== 'failure') return undefined
              return { events: [{
                name: outcome === 'success' ? QUIZ_HUNT_LAYOUT_EVENT.RESULT_SUCCESS : QUIZ_HUNT_LAYOUT_EVENT.RESULT_FAILURE,
                visibility: 'public' as const,
                data: event.data,
              }] }
            },
          },
          listen: [
            { on: QUIZ_HUNT_LAYOUT_EVENT.EXTRA_DRAG_END, straps: ['quiz-hunt-layout-capture-end'] },
            { on: QUIZ_HUNT_LAYOUT_EVENT.RESULT_ROUTE, straps: ['quiz-hunt-layout-result-route'] },
          ],
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
                    <div id="quiz-hunt-layout-extra-offer" class="quiz-hunt-extra-outlet" data-part="${EXTRA_OFFER_PART}"></div>
                    <div id="quiz-hunt-layout-extra-inventory" class="quiz-hunt-extra-outlet" data-part="${EXTRA_INVENTORY_PART}"></div>
                  </div>
                </div>`,
              },
              actions: {},
            },
            createExtraToken(),
            createLayoutSlot(QUIZ_HUNT_SLOT.CONTENT, 'quiz-hunt:layout:content'),
            createLayoutSlot(QUIZ_HUNT_SLOT.BASKET, 'quiz-hunt:layout:basket'),
          ],
        },
      },
    },
    styleSheet: QUIZ_HUNT_ORIGINAL_GAME_STYLES,
  }
}

/** Creates the layout-owned extra token and its capture gestures. */
function createExtraToken(): LayoutPerso {
  return {
    id: 'quiz-hunt-extra-token',
    type: 'tag',
    initial: {
      tag: 'button',
      content: 'E',
      className: 'quiz-hunt-extra-token is-hidden',
      style: { x: 0, y: 0, zIndex: 20 },
      attr: { type: 'button', 'aria-label': 'Jeton extra', title: 'Jeton extra' },
      move: { target: EXTRA_OFFER_PART },
    },
    emit: {
      click: { event: { name: QUIZ_HUNT_LAYOUT_EVENT.EXTRA_COLLECT, visibility: 'public' } },
      pointerdown: {
        event: { name: QUIZ_HUNT_LAYOUT_EVENT.EXTRA_DRAG_START },
        capture: {
          trackOn: ['pointermove'],
          endOn: ['pointerup', 'pointercancel'],
          stateScope: 'story',
          initCaptureState: () => ({ style: { x: '0px', y: '0px', zIndex: 30 } }),
          trackCommand: trackExtraToken,
          endEmit: { name: QUIZ_HUNT_LAYOUT_EVENT.EXTRA_DRAG_END },
        },
      },
    },
    actions: {
      [QUIZ_HUNT_LAYOUT_EVENT.EXTRA_SHOW]: { className: { add: 'is-visible', remove: 'is-hidden' }, style: { opacity: 1 } },
      [QUIZ_HUNT_LAYOUT_EVENT.EXTRA_HIDE]: { className: { add: 'is-hidden', remove: 'is-visible' } },
      [QUIZ_HUNT_LAYOUT_EVENT.EXTRA_COLLECTED]: {
        move: { target: EXTRA_INVENTORY_PART, transition: { duration: 360, ease: 'outCubic', path: 'M 0 0 A 1.25 1.25 0 0 1 1 0' } },
        className: { add: 'quiz-hunt-extra-token-inventory is-visible', remove: 'is-hidden' },
        style: { x: 0, y: 0, zIndex: 20 },
      },
      [QUIZ_HUNT_LAYOUT_EVENT.EXTRA_DRAG_START]: { className: { add: 'is-dragging' } },
      [QUIZ_HUNT_LAYOUT_EVENT.EXTRA_DRAG_TRACK]: {},
      [QUIZ_HUNT_LAYOUT_EVENT.EXTRA_DRAG_END]: { className: { remove: 'is-dragging' } },
      [QUIZ_HUNT_LAYOUT_EVENT.EXTRA_DRAG_COMMIT]: true,
      [QUIZ_HUNT_LAYOUT_EVENT.EXTRA_DRAG_RETURN]: {
        style: { x: { to: '0px', duration: 180, ease: 'outQuad' }, y: { to: '0px', duration: 180, ease: 'outQuad' }, zIndex: 20 },
      },
      [QUIZ_HUNT_LAYOUT_EVENT.EXTRA_RETRY_HIDE]: {
        className: { add: 'is-hiding', remove: 'is-dragging' },
        style: { opacity: { from: 1, to: 0, duration: QUIZ_HUNT_EXTRA_RETRY_HIDE_DURATION_MS }, y: { to: '-=150px', duration: QUIZ_HUNT_EXTRA_RETRY_HIDE_DURATION_MS } },
      },
      [QUIZ_HUNT_LAYOUT_EVENT.EXTRA_RETRY_HIDE_DONE]: {
        className: { add: 'is-hidden', remove: 'is-visible is-hiding' },
        style: { x: 0, y: 0, zIndex: 20 },
      },
    },
  }
}

/** Moves the extra token by the pointer delta during its captured drag. */
function trackExtraToken({ sample, captureState }: Parameters<AuthorCaptureTrackFunction>[0]) {
  const previousStyle = readRecord(captureState.style)
  const style = {
    x: `${readPixelValue(previousStyle.x) + readFinite(sample.movementX, 0)}px`,
    y: `${readPixelValue(previousStyle.y) + readFinite(sample.movementY, 0)}px`,
    zIndex: 30,
  }
  return {
    actions: [{ name: QUIZ_HUNT_LAYOUT_EVENT.EXTRA_DRAG_TRACK, data: { style } }],
    captureState: { style },
  }
}

/** Creates one Sighty slot in its named layout outlet. */
function createLayoutSlot(name: string, target: string): PersoDoc<string> {
  return { id: `quiz-hunt-${name}`, name, type: 'slot', initial: { move: { target } }, actions: {} }
}

/** Uses a finite numeric capture value or the supplied default. */
function readFinite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

/** Reads one CSS-pixel offset from private capture state. */
function readPixelValue(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return 0
  const match = /^(-?(?:\d+\.?\d*|\.\d+))px$/.exec(value.trim())
  if (match === null) return 0
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : 0
}

/** Narrows capture input before reading its style fields. */
function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}
