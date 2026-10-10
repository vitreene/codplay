import type { CompiledRecord } from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'
import type { StrapFunction, StrapReturnValue } from 'codplay/runtime/player'
import { resolveQuizHuntColorStyle } from '../../../v1/scenes/quiz-hunt/color-palette'
import type { QuizHuntFinal } from '../game-data'
import { QUIZ_HUNT_TIMER_BUDGET_MS } from '../game-rules'
import { basketColorEvent, basketFinalButtonEvent, openFinalEvent, QUIZ_HUNT_EVENTS } from '../messages'

const TIMER_TWEEN_DURATION_MS = QUIZ_HUNT_TIMER_BUDGET_MS
const TIMER_START_EVENT = 'quiz-hunt:basket:timer:countdown'
const TIMER_FREEZE_EVENT = 'quiz-hunt:basket:timer:freeze'
const TIMER_EXPIRE_CHECK_EVENT = 'quiz-hunt:basket:timer:expiry-check'
const TIMER_NEEDLE_SET_EVENT = 'quiz-hunt:basket:timer:needle-set'
const TIMER_ELAPSED_SET_EVENT = 'quiz-hunt:basket:timer:elapsed-set'
const TIMER_ELAPSED_SLOT = 'quiz-hunt:basket:timer:elapsed-slot'
const ELAPSED_RING_RADIUS = 132
const ELAPSED_RING_CIRCUMFERENCE = 2 * Math.PI * ELAPSED_RING_RADIUS

type BasketScenePerso = SceneDoc<string>['stories'][string]['persos'][number]
type TimerStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'expired'

type TimerFrameInput = Readonly<{
  progress: number
  data?: Readonly<Record<string, unknown>>
}>

/** Builds one V1-styled footer scene that keeps its basket, final controls, and timer together. */
export function createBasketScene(colors: readonly string[], finals: readonly QuizHuntFinal[]): SceneDoc<string> {
  const persos: BasketScenePerso[] = [
    createBasketLayout(),
    ...colors.map(createBasketColorValue),
    ...finals.map(createFinalButton),
    createTimerValue(),
    createTimerElapsedRing(),
    createTimerNeedle(),
  ]
  return {
    id: 'quiz-hunt-basket',
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        state: {
          timer: {
            status: 'idle',
            remainingMs: QUIZ_HUNT_TIMER_BUDGET_MS,
            startedAtMs: 0,
            generation: 0,
            feedbackPending: false,
          },
        },
        straps: {
          'quiz-hunt-basket-timer': createTimerStrap(),
          'quiz-hunt-basket-project': ({ event }) => projectBasket(colors, finals, event.data),
        },
        listen: [
          { on: QUIZ_HUNT_EVENTS.timerPlay, straps: ['quiz-hunt-basket-timer'] },
          { on: QUIZ_HUNT_EVENTS.timerPause, straps: ['quiz-hunt-basket-timer'] },
          { on: QUIZ_HUNT_EVENTS.timerStop, straps: ['quiz-hunt-basket-timer'] },
          { on: QUIZ_HUNT_EVENTS.timerFeedbackPending, straps: ['quiz-hunt-basket-timer'] },
          { on: QUIZ_HUNT_EVENTS.timerFeedbackFinished, straps: ['quiz-hunt-basket-timer'] },
          { on: TIMER_EXPIRE_CHECK_EVENT, straps: ['quiz-hunt-basket-timer'] },
          { on: QUIZ_HUNT_EVENTS.basketProject, straps: ['quiz-hunt-basket-project'] },
        ],
        persos,
      },
    },
  }
}

/** Creates the original footer, basket slots, and circular timer regions. */
function createBasketLayout(): BasketScenePerso {
  return {
    id: 'quiz-hunt-basket-layout',
    type: 'layout',
    initial: {
      move: '@root',
      className: 'quiz-hunt-footer',
      markup: `<div id="quiz-hunt-basket-root" class="quiz-hunt-footer">
        <!-- data-part="quiz-hunt:basket:slots" -->
        <div id="quiz-hunt-timer-zone" class="quiz-hunt-timer-zone">
          <div id="quiz-hunt-timer-wrapper" class="quiz-hunt-chrono-wrapper" data-part="quiz-hunt:basket:timer-wrapper">
            ${buildClockFaceMarkup()}
            <div id="quiz-hunt-timer-needle" class="quiz-hunt-chrono-needle"></div>
            <div id="quiz-hunt-timer-dot" class="quiz-hunt-chrono-dot"></div>
            <!-- data-part="quiz-hunt:basket:timer" -->
          </div>
        </div>
        <div id="quiz-hunt-basket-tools" class="quiz-hunt-basket-tools">
          <div id="quiz-hunt-basket-final-slot" class="quiz-hunt-basket-final-slot" data-part="quiz-hunt:basket:final"></div>
        </div>
      </div>`,
    },
    actions: {},
  }
}

/** Builds the original SVG clock face and its named elapsed-ring outlet. */
function buildClockFaceMarkup(): string {
  const cx = 150
  const cy = 150
  const outerRadius = 143
  const majorInnerRadius = 118
  const minorInnerRadius = 132
  const textRadius = 102
  const marks: string[] = []

  for (let index = 0; index < 60; index += 1) {
    const radians = (index * 6 - 90) * (Math.PI / 180)
    const isMajor = index % 5 === 0
    const innerRadius = isMajor ? majorInnerRadius : minorInnerRadius
    const x1 = (cx + innerRadius * Math.cos(radians)).toFixed(2)
    const y1 = (cy + innerRadius * Math.sin(radians)).toFixed(2)
    const x2 = (cx + outerRadius * Math.cos(radians)).toFixed(2)
    const y2 = (cy + outerRadius * Math.sin(radians)).toFixed(2)
    const stroke = isMajor ? '#cbd5e1' : '#475569'
    const strokeWidth = isMajor ? '2.8' : '1.2'
    marks.push(`<line id="quiz-hunt-timer-mark-${index}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`)
  }

  for (let index = 1; index <= 12; index += 1) {
    const seconds = index * 5
    const radians = (seconds * 6 - 90) * (Math.PI / 180)
    const x = (cx + textRadius * Math.cos(radians)).toFixed(2)
    const y = (cy + textRadius * Math.sin(radians)).toFixed(2)
    const label = seconds === 60 ? '60' : String(seconds).padStart(2, '0')
    marks.push(`<text id="quiz-hunt-timer-label-${index}" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" fill="#e2e8f0" font-size="13" font-family="monospace" font-weight="700">${label}</text>`)
  }

  return `<svg id="quiz-hunt-timer-face" class="quiz-hunt-chrono-face" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg">
    <circle id="quiz-hunt-timer-face-background" cx="150" cy="150" r="146" fill="#0f172a"/>
    <circle id="quiz-hunt-timer-ring-background" cx="150" cy="150" r="${ELAPSED_RING_RADIUS}" fill="none" stroke="rgba(148, 163, 184, 0.22)" stroke-width="28"/>
    <g id="quiz-hunt-timer-elapsed-slot" data-part="${TIMER_ELAPSED_SLOT}"></g>
    <g id="quiz-hunt-timer-marks">${marks.join('')}</g>
  </svg>`
}

/** Creates one color-coded basket slot using the source palette. */
function createBasketColorValue(color: string): BasketScenePerso {
  const colorStyle = resolveQuizHuntColorStyle(color)
  return {
    id: `quiz-hunt-basket-slot-${color}`,
    type: 'tag',
    initial: {
      tag: 'div',
      content: '—',
      className: 'quiz-hunt-basket-slot',
      style: {
        '--quiz-hunt-accent': colorStyle.solid,
        '--quiz-hunt-accent-gradient': colorStyle.gradient,
      },
      move: { target: 'quiz-hunt:basket:slots' },
    },
    actions: { [basketColorEvent(color)]: null },
  }
}

/** Creates one V1 final button with a fixed event for its generated question. */
function createFinalButton(final: QuizHuntFinal): BasketScenePerso {
  return {
    id: `quiz-hunt-basket-final-${final.id}`,
    type: 'tag',
    initial: {
      tag: 'button',
      content: 'Épreuve finale',
      attr: {
        id: `quiz-hunt-basket-final-${final.id}-button`,
        type: 'button',
        disabled: true,
        'aria-label': `Épreuve finale : ${final.label}`,
      },
      className: 'quiz-hunt-final-button is-hidden',
      style: { '--quiz-hunt-accent': '#2563eb' },
      move: { target: 'quiz-hunt:basket:final' },
    },
    emit: { click: { event: { name: openFinalEvent(final.id), visibility: 'public' } } },
    actions: {
      [basketFinalButtonEvent(final.id, true)]: {
        className: { remove: 'is-hidden' },
        attr: { disabled: false },
      },
      [basketFinalButtonEvent(final.id, false)]: {
        className: { add: 'is-hidden' },
        attr: { disabled: true },
      },
    },
  }
}

/** Creates the V1 digital countdown readout inside the round timer. */
function createTimerValue(): BasketScenePerso {
  return {
    id: 'quiz-hunt-basket-timer-value',
    type: 'tag',
    initial: {
      tag: 'span',
      content: formatRemaining(QUIZ_HUNT_TIMER_BUDGET_MS),
      className: 'quiz-hunt-chrono-display',
      move: { target: 'quiz-hunt:basket:timer' },
    },
    actions: {
      [TIMER_START_EVENT]: {
        duration: TIMER_TWEEN_DURATION_MS,
        ease: 'linear',
        fn: resolveTimerFrame,
      },
      [TIMER_FREEZE_EVENT]: {},
    },
  }
}

/** Creates the moving clock needle driven by the same timer events. */
function createTimerNeedle(): BasketScenePerso {
  return {
    id: 'quiz-hunt-basket-timer-needle',
    type: 'tag',
    initial: {
      tag: 'span',
      className: 'quiz-hunt-chrono-needle',
      move: { target: 'quiz-hunt:basket:timer-wrapper' },
    },
    actions: {
      [TIMER_START_EVENT]: {
        duration: TIMER_TWEEN_DURATION_MS,
        ease: 'linear',
        fn: resolveNeedleFrame,
      },
      [TIMER_NEEDLE_SET_EVENT]: {},
    },
  }
}

/** Creates the elapsed SVG arc driven by the shared countdown. */
function createTimerElapsedRing(): BasketScenePerso {
  return {
    id: 'quiz-hunt-basket-timer-elapsed-ring',
    type: 'layout',
    initial: {
      format: 'svg',
      markup: buildElapsedArcMarkup(),
      move: { target: TIMER_ELAPSED_SLOT },
    },
    actions: {
      [TIMER_START_EVENT]: {
        duration: TIMER_TWEEN_DURATION_MS,
        ease: 'linear',
        fn: resolveElapsedFrame,
      },
      [TIMER_ELAPSED_SET_EVENT]: {},
    },
  }
}

/** Builds the elapsed-time arc matching the original Quiz Hunt chrono. */
function buildElapsedArcMarkup(): string {
  return `<circle id="quiz-hunt-timer-elapsed-ring-circle" class="quiz-hunt-chrono-elapsed-ring" cx="150" cy="150" r="${ELAPSED_RING_RADIUS}" fill="none" stroke-width="28" stroke-linecap="butt" stroke-dasharray="${ELAPSED_RING_CIRCUMFERENCE}" stroke-dashoffset="${ELAPSED_RING_CIRCUMFERENCE}" transform="rotate(-90 150 150)"/>`
}

/** Starts or freezes the timer without changing the basket scene's transport. */
function createTimerStrap(): StrapFunction {
  return ({ event, state, context }) => {
    const timer = readTimerState(state.timer)

    if (event.name === TIMER_EXPIRE_CHECK_EVENT) {
      const generation = event.data?.generation
      if (timer.status !== 'running' || generation !== timer.generation) return undefined
      const nowMs = event.applyAtMs ?? timer.startedAtMs + timer.remainingMs
      const remainingMs = clampRemaining(timer.remainingMs - Math.max(0, nowMs - timer.startedAtMs))
      if (remainingMs > 0) {
        return context.planned.wait(remainingMs, {
          event: { name: TIMER_EXPIRE_CHECK_EVENT, data: { generation } },
        })
      }
      return expireTimer(timer)
    }

    if (event.name === QUIZ_HUNT_EVENTS.timerFeedbackPending) {
      return { update: { timer: { ...timer, feedbackPending: true } } }
    }

    if (event.name === QUIZ_HUNT_EVENTS.timerFeedbackFinished) {
      return { update: { timer: { ...timer, feedbackPending: false } } }
    }

    if (event.name === QUIZ_HUNT_EVENTS.timerPlay) {
      if (timer.status === 'running' || timer.status === 'expired') return undefined
      const requestedRemaining = event.data?.remainingMs
      const remainingMs = timer.status === 'paused' || timer.status === 'stopped'
        ? timer.remainingMs
        : typeof requestedRemaining === 'number'
          ? clampRemaining(requestedRemaining)
          : timer.remainingMs
      const startedAtMs = event.applyAtMs ?? 0
      const generation = timer.generation + 1
      if (remainingMs <= 0) return expireTimer({ ...timer, generation })
      return [
        {
          update: { timer: { ...timer, status: 'running', remainingMs, startedAtMs, generation } },
          events: [{
            name: TIMER_START_EVENT,
            data: { remainingMs, duration: TIMER_TWEEN_DURATION_MS, totalMs: QUIZ_HUNT_TIMER_BUDGET_MS },
          }],
        },
        context.planned.wait(remainingMs, {
          event: { name: TIMER_EXPIRE_CHECK_EVENT, data: { generation } },
        }),
      ]
    }

    if (event.name === QUIZ_HUNT_EVENTS.timerStop && timer.status !== 'running') {
      if (timer.status === 'expired') return undefined
      return {
        update: { timer: { ...timer, status: 'stopped', generation: timer.generation + 1 } },
      }
    }

    if (
      (event.name !== QUIZ_HUNT_EVENTS.timerPause && event.name !== QUIZ_HUNT_EVENTS.timerStop)
      || timer.status !== 'running'
    ) return undefined

    const nowMs = event.applyAtMs ?? timer.startedAtMs
    const elapsedMs = Math.max(0, nowMs - timer.startedAtMs)
    const remainingMs = clampRemaining(timer.remainingMs - elapsedMs)
    const generation = timer.generation + 1
    if (remainingMs <= 0) return expireTimer({ ...timer, generation })
    const status = event.name === QUIZ_HUNT_EVENTS.timerStop ? 'stopped' : 'paused'
    return {
      update: { timer: { ...timer, status, remainingMs, generation } },
      events: [
        ...freezeTimerEvents(remainingMs),
        { name: QUIZ_HUNT_EVENTS.timerPaused, data: { remainingMs }, visibility: 'public' },
      ],
    }
  }
}

/** Freezes the timer display at one remaining budget without pausing the scene. */
function freezeTimerEvents(remainingMs: number): Array<{
  name: string
  data?: CompiledRecord
}> {
  const elapsedRatio = 1 - remainingMs / QUIZ_HUNT_TIMER_BUDGET_MS
  const elapsedOffset = ELAPSED_RING_CIRCUMFERENCE * (1 - elapsedRatio)
  const needleRotation = ((remainingMs / 1_000 / 60) * 360).toFixed(3)
  return [
    { name: 'tween:stop' },
    {
      name: TIMER_FREEZE_EVENT,
      data: { content: formatRemaining(remainingMs), style: { color: resolveTimerColor(elapsedRatio) } },
    },
    { name: TIMER_NEEDLE_SET_EVENT, data: { style: { transform: `rotate(${needleRotation}deg)` } } },
    { name: TIMER_ELAPSED_SET_EVENT, data: { attr: { 'stroke-dashoffset': elapsedOffset.toFixed(3) } } },
  ]
}

/** Emits one public expiry event after invalidating the current timer segment. */
function expireTimer(timer: ReturnType<typeof readTimerState>): StrapReturnValue {
  const eventName = timer.feedbackPending
    ? QUIZ_HUNT_EVENTS.timerExpiredDuringFeedback
    : QUIZ_HUNT_EVENTS.timerExpired
  return {
    update: {
      timer: {
        ...timer,
        status: 'expired',
        remainingMs: 0,
        generation: timer.generation + 1,
      },
    },
    events: [
      ...freezeTimerEvents(0),
      { name: eventName, data: { remainingMs: 0, feedbackPending: timer.feedbackPending }, visibility: 'public' },
    ],
  }
}

/** Converts one basket projection payload into per-color scene updates. */
function projectBasket(
  colors: readonly string[],
  finals: readonly QuizHuntFinal[],
  data: Readonly<Record<string, unknown>> | undefined,
): Readonly<{ events: readonly Readonly<{ name: string; data?: CompiledRecord }>[] }> {
  const values = typeof data?.basket === 'object' && data.basket !== null
    ? data.basket as Record<string, unknown>
    : {}
  const labelsById = new Map(finals.map((final) => [final.id, final.label]))
  const finalWordId = typeof data?.finalWordId === 'string' ? data.finalWordId : undefined
  const finalAvailable = data?.finalAvailable === true
  return {
    events: [
      ...colors.map((color) => {
        const wordId = typeof values[color] === 'string' ? values[color] as string : undefined
        return {
          name: basketColorEvent(color),
          data: { content: wordId === undefined ? '—' : labelsById.get(wordId) ?? wordId },
        }
      }),
      ...finals.map((final) => ({
        name: basketFinalButtonEvent(final.id, finalAvailable && final.id === finalWordId),
      })),
    ],
  }
}

/** Reads the timer's authored state or returns the idle budget. */
function readTimerState(value: unknown): Readonly<{
  status: TimerStatus
  remainingMs: number
  startedAtMs: number
  generation: number
  feedbackPending: boolean
}> {
  if (typeof value !== 'object' || value === null) {
    return {
      status: 'idle',
      remainingMs: QUIZ_HUNT_TIMER_BUDGET_MS,
      startedAtMs: 0,
      generation: 0,
      feedbackPending: false,
    }
  }
  const candidate = value as Record<string, unknown>
  const knownStatuses: TimerStatus[] = ['running', 'paused', 'stopped', 'expired']
  const status: TimerStatus = knownStatuses.includes(candidate.status as TimerStatus)
    ? candidate.status as TimerStatus
    : 'idle'
  return {
    status,
    remainingMs: typeof candidate.remainingMs === 'number'
      ? clampRemaining(candidate.remainingMs)
      : QUIZ_HUNT_TIMER_BUDGET_MS,
    startedAtMs: typeof candidate.startedAtMs === 'number' ? candidate.startedAtMs : 0,
    generation: typeof candidate.generation === 'number' ? candidate.generation : 0,
    feedbackPending: candidate.feedbackPending === true,
  }
}

/** Produces the countdown display for one continuous timer segment. */
function resolveTimerFrame({ progress, data }: TimerFrameInput): Readonly<Record<string, unknown>> {
  const remainingAtSegmentStart = typeof data?.remainingMs === 'number'
    ? clampRemaining(data.remainingMs)
    : QUIZ_HUNT_TIMER_BUDGET_MS
  const elapsedMs = Math.max(0, Math.min(1, progress)) * TIMER_TWEEN_DURATION_MS
  const remainingMs = clampRemaining(remainingAtSegmentStart - elapsedMs)
  const elapsedRatio = 1 - remainingMs / QUIZ_HUNT_TIMER_BUDGET_MS
  return { content: formatRemaining(remainingMs), style: { color: resolveTimerColor(elapsedRatio) } }
}

/** Produces the clock-needle pose for one continuous timer segment. */
function resolveNeedleFrame({ progress, data }: TimerFrameInput): Readonly<Record<string, unknown>> {
  const remainingAtSegmentStart = typeof data?.remainingMs === 'number'
    ? clampRemaining(data.remainingMs)
    : QUIZ_HUNT_TIMER_BUDGET_MS
  const elapsedMs = Math.max(0, Math.min(1, progress)) * TIMER_TWEEN_DURATION_MS
  const remainingMs = clampRemaining(remainingAtSegmentStart - elapsedMs)
  const rotation = ((remainingMs / 1_000 / 60) * 360).toFixed(3)
  return { style: { transform: `rotate(${rotation}deg)` } }
}

/** Produces the elapsed arc offset for one continuous timer segment. */
function resolveElapsedFrame({ progress, data }: TimerFrameInput): Readonly<Record<string, unknown>> {
  const remainingAtSegmentStart = typeof data?.remainingMs === 'number'
    ? clampRemaining(data.remainingMs)
    : QUIZ_HUNT_TIMER_BUDGET_MS
  const elapsedMs = Math.max(0, Math.min(1, progress)) * TIMER_TWEEN_DURATION_MS
  const remainingMs = clampRemaining(remainingAtSegmentStart - elapsedMs)
  const elapsedRatio = 1 - remainingMs / QUIZ_HUNT_TIMER_BUDGET_MS
  const dashOffset = ELAPSED_RING_CIRCUMFERENCE * (1 - elapsedRatio)
  return { attr: { 'stroke-dashoffset': dashOffset.toFixed(3) } }
}

/** Selects the original timer color for the elapsed fraction. */
function resolveTimerColor(elapsedRatio: number): string {
  return elapsedRatio < 0.5 ? '#4ade80' : elapsedRatio < 0.75 ? '#fb923c' : '#f87171'
}

/** Formats the remaining budget as the V1 minute-and-second display. */
function formatRemaining(value: number): string {
  const seconds = Math.max(0, Math.ceil(value / 1_000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

/** Clamps a remaining time to the configured budget. */
function clampRemaining(value: number): number {
  return Math.max(0, Math.min(QUIZ_HUNT_TIMER_BUDGET_MS, value))
}
