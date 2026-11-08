import type { CompiledRecord } from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'
import type { StrapFunction, StrapReturnValue } from 'codplay/runtime/player'
import type { QuizHuntDocument, QuizHuntGroup, QuizHuntPage } from '../document/quiz-hunt-document-types'
import type { QuizHuntGameCatalog } from './quiz-hunt-game-catalog'
import { resolveQuizHuntColorStyle } from './quiz-hunt-color-style.ts'

export const QUIZ_HUNT_BASKET_EVENT = {
  PROJECT: 'quiz-hunt:basket:project',
  TIMER_PLAY: 'quiz-hunt:timer:play',
  TIMER_PROJECT: 'quiz-hunt:timer:project',
  TIMER_PAUSE: 'quiz-hunt:timer:pause',
  TIMER_STOP: 'quiz-hunt:timer:stop',
  TIMER_PAUSED: 'quiz-hunt:timer:paused',
  TIMER_CHECK: 'quiz-hunt:timer:expiry-check',
  TIMER_EXPIRED: 'quiz-hunt:timer:expired',
  TIMER_EXPIRED_DURING_FEEDBACK: 'quiz-hunt:timer:expired-during-feedback',
  TIMER_FEEDBACK_PENDING: 'quiz-hunt:timer:feedback-pending',
  TIMER_FEEDBACK_FINISHED: 'quiz-hunt:timer:feedback-finished',
  FINAL_READY: 'quiz-hunt:menu:final:ready',
  FINAL_LOCKED: 'quiz-hunt:menu:final:locked',
  RESTART_AVAILABLE: 'quiz-hunt:menu:restart:available',
  RESTART_LOCKED: 'quiz-hunt:menu:restart:locked',
} as const

const TIMER_RENDER_EVENT = 'quiz-hunt:basket:timer:render'
const TIMER_FREEZE_EVENT = 'quiz-hunt:basket:timer:freeze'
const TIMER_NEEDLE_SET_EVENT = 'quiz-hunt:basket:timer:needle-set'
const TIMER_ELAPSED_SET_EVENT = 'quiz-hunt:basket:timer:elapsed-set'
const TIMER_ELAPSED_SLOT = 'quiz-hunt:basket:timer:elapsed-slot'
const ELAPSED_RING_RADIUS = 132
const ELAPSED_RING_CIRCUMFERENCE = 2 * Math.PI * ELAPSED_RING_RADIUS

type BasketPerso = SceneDoc<string>['stories'][string]['persos'][number]
type TimerStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'expired'
type TimerFrameInput = Readonly<{ progress: number; data?: Readonly<Record<string, unknown>> }>

/** Builds the persistent colored basket and its own CodPlay-controlled countdown. */
export function buildQuizHuntBasketScene(
  document: QuizHuntDocument,
  game: QuizHuntGameCatalog,
): Readonly<{ sceneDoc: SceneDoc<string>; styleSheet: string }> {
  const groups = document.settings.groups
  const pagesById = new Map(document.pages.map((page) => [page.id, page]))
  const finalPage = document.pages.find((page) => page.id === game.finalPageId)
  const budgetMs = document.settings.timeBudgetMs
  return {
    sceneDoc: {
      id: 'quiz-hunt-basket-scene',
      stories: {
        main: {
          id: 'main',
          initial: { move: '@root' },
          state: {
            timer: { status: 'idle', remainingMs: budgetMs, startedAtMs: 0, generation: 0, feedbackPending: false },
          },
          straps: {
            'quiz-hunt-basket-timer': createTimerStrap(budgetMs),
            'quiz-hunt-basket-project': ({ event }) => projectBasket(groups, pagesById, event.data),
            'quiz-hunt-basket-timer-project': ({ event }) => ({
              events: freezeTimerEvents(clampRemaining(
                typeof event.data?.remainingMs === 'number' ? event.data.remainingMs : budgetMs,
                budgetMs,
              ), budgetMs),
            }),
          },
          listen: [
            { on: QUIZ_HUNT_BASKET_EVENT.TIMER_PLAY, straps: ['quiz-hunt-basket-timer'] },
            { on: QUIZ_HUNT_BASKET_EVENT.TIMER_PAUSE, straps: ['quiz-hunt-basket-timer'] },
            { on: QUIZ_HUNT_BASKET_EVENT.TIMER_STOP, straps: ['quiz-hunt-basket-timer'] },
            { on: QUIZ_HUNT_BASKET_EVENT.TIMER_FEEDBACK_PENDING, straps: ['quiz-hunt-basket-timer'] },
            { on: QUIZ_HUNT_BASKET_EVENT.TIMER_FEEDBACK_FINISHED, straps: ['quiz-hunt-basket-timer'] },
            { on: QUIZ_HUNT_BASKET_EVENT.TIMER_CHECK, straps: ['quiz-hunt-basket-timer'] },
            { on: QUIZ_HUNT_BASKET_EVENT.PROJECT, straps: ['quiz-hunt-basket-project'] },
            { on: QUIZ_HUNT_BASKET_EVENT.TIMER_PROJECT, straps: ['quiz-hunt-basket-timer-project'] },
          ],
          persos: [
            createBasketLayout(),
            ...groups.flatMap((group, index) => createBasketSlot(group, index)),
            ...(finalPage === undefined ? [] : [createFinalButton(finalPage)]),
            createRestartButton(),
            createTimerDisplay(budgetMs),
            createTimerNeedle(budgetMs),
            createTimerElapsedRing(budgetMs),
          ],
        },
      },
    },
    styleSheet: '',
  }
}

/** Creates the layout marker that keeps all basket colors and the clock together. */
function createBasketLayout(): BasketPerso {
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
            <div id="quiz-hunt-timer-dot" class="quiz-hunt-chrono-dot"></div>
            <div id="quiz-hunt-timer-host" data-part="quiz-hunt:basket:timer"></div>
          </div>
        </div>
        <div id="quiz-hunt-basket-tools" class="quiz-hunt-basket-tools">
          <div id="quiz-hunt-basket-final-slot" class="quiz-hunt-basket-final-slot" data-part="quiz-hunt:basket:final"></div>
          <div id="quiz-hunt-basket-restart-slot" class="quiz-hunt-basket-restart-slot" data-part="quiz-hunt:basket:restart"></div>
        </div>
      </div>`,
    },
    actions: {},
  }
}

/** Creates the original SVG timer face with sixty ticks and twelve labels. */
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

/** Creates the original hidden final-question control in the basket tools. */
function createFinalButton(page: QuizHuntPage): BasketPerso {
  return {
    id: `quiz-hunt-basket-final-${page.id}`,
    type: 'tag',
    initial: {
      tag: 'button',
      content: 'Épreuve finale',
      attr: {
        id: `quiz-hunt-basket-final-${page.id}-button`,
        type: 'button',
        disabled: true,
        'aria-label': `Épreuve finale : ${page.name}`,
      },
      className: 'quiz-hunt-final-button is-hidden',
      style: { '--quiz-hunt-accent': '#2563eb' },
      move: { target: 'quiz-hunt:basket:final' },
    },
    emit: { click: { event: { name: 'quiz-hunt:final:open', visibility: 'public' } } },
    actions: {
      [QUIZ_HUNT_BASKET_EVENT.FINAL_READY]: {
        className: { remove: 'is-hidden' },
        attr: { disabled: false },
      },
      [QUIZ_HUNT_BASKET_EVENT.FINAL_LOCKED]: {
        className: { add: 'is-hidden' },
        attr: { disabled: true },
      },
    },
  }
}

/** Creates the terminal restart control that is available from the Sommaire. */
function createRestartButton(): BasketPerso {
  return {
    id: 'quiz-hunt-basket-restart',
    type: 'tag',
    initial: {
      tag: 'button',
      content: 'Recommencer',
      attr: { id: 'quiz-hunt-basket-restart-button', type: 'button', disabled: true, 'aria-label': 'Recommencer la partie' },
      className: 'quiz-hunt-summary-restart is-hidden',
      move: { target: 'quiz-hunt:basket:restart' },
    },
    emit: { click: { event: { name: 'quiz-hunt:game:restart', visibility: 'public' } } },
    actions: {
      [QUIZ_HUNT_BASKET_EVENT.RESTART_AVAILABLE]: {
        className: { remove: 'is-hidden' },
        attr: { disabled: false },
      },
      [QUIZ_HUNT_BASKET_EVENT.RESTART_LOCKED]: {
        className: { add: 'is-hidden' },
        attr: { disabled: true },
      },
    },
  }
}

/** Creates one displayed color slot, initially empty until the scenario projects its basket. */
function createBasketSlot(group: QuizHuntGroup, index: number): BasketPerso {
  const wordEvent = `quiz-hunt:basket:word:${index}`
  const colorStyle = resolveQuizHuntColorStyle(group.name, group.color)
  return {
    id: `quiz-hunt-basket-slot-${index + 1}`,
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
    actions: { [wordEvent]: null },
  }
}

/** Renders the countdown for the complete configured timer budget. */
function createTimerDisplay(budgetMs: number): BasketPerso {
  return {
    id: 'quiz-hunt-basket-timer-display',
    type: 'tag',
    initial: {
      tag: 'span',
      content: formatRemaining(budgetMs),
      className: 'quiz-hunt-chrono-display',
      attr: { 'aria-label': 'Temps restant' },
      move: { target: 'quiz-hunt:basket:timer' },
    },
    actions: {
      [TIMER_RENDER_EVENT]: { duration: budgetMs, ease: 'linear', fn: ({ progress, data }: TimerFrameInput) => timerFrame(progress, data, budgetMs) },
      [TIMER_FREEZE_EVENT]: {},
    },
  }
}

/** Creates the original clock needle and animates it with the configured budget. */
function createTimerNeedle(budgetMs: number): BasketPerso {
  return {
    id: 'quiz-hunt-basket-timer-needle',
    type: 'tag',
    initial: {
      tag: 'span',
      className: 'quiz-hunt-chrono-needle',
      move: { target: 'quiz-hunt:basket:timer-wrapper' },
    },
    actions: {
      [TIMER_RENDER_EVENT]: {
        duration: budgetMs,
        ease: 'linear',
        fn: ({ progress, data }: TimerFrameInput) => needleFrame(progress, data, budgetMs),
      },
      [TIMER_NEEDLE_SET_EVENT]: {},
    },
  }
}

/** Creates the original elapsed-time ring inside the clock's SVG face. */
function createTimerElapsedRing(budgetMs: number): BasketPerso {
  return {
    id: 'quiz-hunt-basket-timer-elapsed-ring',
    type: 'layout',
    initial: {
      format: 'svg',
      markup: `<circle id="quiz-hunt-timer-elapsed-ring-circle" class="quiz-hunt-chrono-elapsed-ring" cx="150" cy="150" r="${ELAPSED_RING_RADIUS}" fill="none" stroke-width="28" stroke-linecap="butt" stroke-dasharray="${ELAPSED_RING_CIRCUMFERENCE}" stroke-dashoffset="${ELAPSED_RING_CIRCUMFERENCE}" transform="rotate(-90 150 150)"/>`,
      move: { target: TIMER_ELAPSED_SLOT },
    },
    actions: {
      [TIMER_RENDER_EVENT]: {
        duration: budgetMs,
        ease: 'linear',
        fn: ({ progress, data }: TimerFrameInput) => elapsedFrame(progress, data, budgetMs),
      },
      [TIMER_ELAPSED_SET_EVENT]: {},
    },
  }
}

/** Starts, freezes, or invalidates the timer without pausing the persistent scene. */
function createTimerStrap(budgetMs: number): StrapFunction {
  return ({ event, state, context }) => {
    const timer = readTimerState(state.timer, budgetMs)

    if (event.name === QUIZ_HUNT_BASKET_EVENT.TIMER_CHECK) {
      if (timer.status !== 'running' || event.data?.generation !== timer.generation) return undefined
      const nowMs = event.applyAtMs ?? timer.startedAtMs + timer.remainingMs
      const remainingMs = clampRemaining(timer.remainingMs - Math.max(0, nowMs - timer.startedAtMs), budgetMs)
      if (remainingMs > 0) return context.planned.wait(remainingMs, { event: { name: QUIZ_HUNT_BASKET_EVENT.TIMER_CHECK, data: { generation: timer.generation }, visibility: 'public' } })
      return expireTimer(timer, budgetMs)
    }

    if (event.name === QUIZ_HUNT_BASKET_EVENT.TIMER_FEEDBACK_PENDING) {
      return { update: { timer: { ...timer, feedbackPending: true } } }
    }
    if (event.name === QUIZ_HUNT_BASKET_EVENT.TIMER_FEEDBACK_FINISHED) {
      return { update: { timer: { ...timer, feedbackPending: false } } }
    }

    if (event.name === QUIZ_HUNT_BASKET_EVENT.TIMER_PLAY) {
      if (timer.status === 'running' || timer.status === 'expired') return undefined
      const requestedRemaining = event.data?.remainingMs
      const remainingMs = timer.status === 'paused' || timer.status === 'stopped'
        ? timer.remainingMs
        : typeof requestedRemaining === 'number' ? clampRemaining(requestedRemaining, budgetMs) : timer.remainingMs
      const startedAtMs = event.applyAtMs ?? 0
      const generation = timer.generation + 1
      if (remainingMs <= 0) return expireTimer({ ...timer, generation }, budgetMs)
      return [
        {
          update: { timer: { ...timer, status: 'running', remainingMs, startedAtMs, generation } },
          events: [{ name: TIMER_RENDER_EVENT, data: { remainingMs, duration: budgetMs } }],
        },
        context.planned.wait(remainingMs, { event: { name: QUIZ_HUNT_BASKET_EVENT.TIMER_CHECK, data: { generation }, visibility: 'public' } }),
      ]
    }

    if (event.name === QUIZ_HUNT_BASKET_EVENT.TIMER_STOP && timer.status !== 'running') {
      if (timer.status === 'expired') return undefined
      return { update: { timer: { ...timer, status: 'stopped', generation: timer.generation + 1 } } }
    }

    if ((event.name !== QUIZ_HUNT_BASKET_EVENT.TIMER_PAUSE && event.name !== QUIZ_HUNT_BASKET_EVENT.TIMER_STOP)
      || timer.status !== 'running') return undefined
    const nowMs = event.applyAtMs ?? timer.startedAtMs
    const remainingMs = clampRemaining(timer.remainingMs - Math.max(0, nowMs - timer.startedAtMs), budgetMs)
    const generation = timer.generation + 1
    if (remainingMs <= 0) return expireTimer({ ...timer, generation }, budgetMs)
    const status = event.name === QUIZ_HUNT_BASKET_EVENT.TIMER_STOP ? 'stopped' : 'paused'
    return {
      update: { timer: { ...timer, status, remainingMs, generation } },
      events: [
        ...freezeTimerEvents(remainingMs, budgetMs),
        { name: QUIZ_HUNT_BASKET_EVENT.TIMER_PAUSED, data: { remainingMs }, visibility: 'public' },
      ],
    }
  }
}

/** Emits the correct public expiry event and freezes the remaining time at zero. */
function expireTimer(timer: ReturnType<typeof readTimerState>, budgetMs: number): StrapReturnValue {
  const eventName = timer.feedbackPending
    ? QUIZ_HUNT_BASKET_EVENT.TIMER_EXPIRED_DURING_FEEDBACK
    : QUIZ_HUNT_BASKET_EVENT.TIMER_EXPIRED
  return {
    update: { timer: { ...timer, status: 'expired', remainingMs: 0, generation: timer.generation + 1 } },
    events: [
      ...freezeTimerEvents(0, budgetMs),
      { name: eventName, data: { remainingMs: 0, feedbackPending: timer.feedbackPending, budgetMs }, visibility: 'public' },
    ],
  }
}

/** Freezes the original digital, needle, and elapsed-ring displays at one time. */
function freezeTimerEvents(remainingMs: number, budgetMs: number): { name: string; data?: CompiledRecord }[] {
  const elapsedRatio = 1 - remainingMs / budgetMs
  const elapsedOffset = ELAPSED_RING_CIRCUMFERENCE * (1 - elapsedRatio)
  const needleRotation = ((remainingMs / 1_000 / 60) * 360).toFixed(3)
  return [
    { name: 'tween:stop' },
    { name: TIMER_FREEZE_EVENT, data: { content: formatRemaining(remainingMs), style: { color: resolveTimerColor(elapsedRatio) } } },
    { name: TIMER_NEEDLE_SET_EVENT, data: { style: { transform: `rotate(${needleRotation}deg)` } } },
    { name: TIMER_ELAPSED_SET_EVENT, data: { attr: { 'stroke-dashoffset': elapsedOffset.toFixed(3) } } },
  ]
}

/** Converts the current color-to-page mapping into one text update per slot. */
function projectBasket(
  groups: readonly QuizHuntGroup[],
  pagesById: ReadonlyMap<string, QuizHuntPage>,
  data: Readonly<Record<string, unknown>> | undefined,
): Readonly<{ events: readonly Readonly<{ name: string; data?: CompiledRecord }>[] }> {
  const basket = readRecord(data?.basket)
  return {
    events: [
      ...groups.map((group, index) => {
        const pageId = basket[group.id]
        const page = typeof pageId === 'string' ? pagesById.get(pageId) : undefined
        return { name: `quiz-hunt:basket:word:${index}`, data: { content: page?.name ?? '—' } }
      }),
      { name: data?.finalReady === true ? QUIZ_HUNT_BASKET_EVENT.FINAL_READY : QUIZ_HUNT_BASKET_EVENT.FINAL_LOCKED },
      { name: data?.restartAvailable === true ? QUIZ_HUNT_BASKET_EVENT.RESTART_AVAILABLE : QUIZ_HUNT_BASKET_EVENT.RESTART_LOCKED },
    ],
  }
}

/** Reads one local timer state or initializes the configured game budget. */
function readTimerState(value: unknown, budgetMs: number): Readonly<{
  status: TimerStatus
  remainingMs: number
  startedAtMs: number
  generation: number
  feedbackPending: boolean
}> {
  const candidate = readRecord(value)
  const status = ['running', 'paused', 'stopped', 'expired'].includes(String(candidate.status))
    ? candidate.status as TimerStatus
    : 'idle'
  return {
    status,
    remainingMs: typeof candidate.remainingMs === 'number' ? clampRemaining(candidate.remainingMs, budgetMs) : budgetMs,
    startedAtMs: typeof candidate.startedAtMs === 'number' ? candidate.startedAtMs : 0,
    generation: typeof candidate.generation === 'number' ? candidate.generation : 0,
    feedbackPending: candidate.feedbackPending === true,
  }
}

/** Interpolates and formats one countdown action frame. */
function timerFrame(progress: number, data: Readonly<Record<string, unknown>> | undefined, budgetMs: number): Readonly<Record<string, unknown>> {
  const remainingMs = remainingAtFrame(progress, data, budgetMs)
  return {
    content: formatRemaining(remainingMs),
    style: { color: resolveTimerColor(1 - remainingMs / budgetMs) },
  }
}

/** Computes the remaining time for a shared linear timer frame. */
function remainingAtFrame(progress: number, data: Readonly<Record<string, unknown>> | undefined, budgetMs: number): number {
  const segmentStart = typeof data?.remainingMs === 'number' ? clampRemaining(data.remainingMs, budgetMs) : budgetMs
  return clampRemaining(segmentStart - Math.max(0, Math.min(1, progress)) * budgetMs, budgetMs)
}

/** Produces the original moving needle pose for one timer frame. */
function needleFrame(progress: number, data: Readonly<Record<string, unknown>> | undefined, budgetMs: number): Readonly<Record<string, unknown>> {
  const remainingMs = remainingAtFrame(progress, data, budgetMs)
  const rotation = ((remainingMs / 1_000 / 60) * 360).toFixed(3)
  return { style: { transform: `rotate(${rotation}deg)` } }
}

/** Produces the original elapsed-ring offset for one timer frame. */
function elapsedFrame(progress: number, data: Readonly<Record<string, unknown>> | undefined, budgetMs: number): Readonly<Record<string, unknown>> {
  const remainingMs = remainingAtFrame(progress, data, budgetMs)
  const elapsedRatio = 1 - remainingMs / budgetMs
  const dashOffset = ELAPSED_RING_CIRCUMFERENCE * (1 - elapsedRatio)
  return { attr: { 'stroke-dashoffset': dashOffset.toFixed(3) } }
}

/** Selects the original timer color for the elapsed portion of the game. */
function resolveTimerColor(elapsedRatio: number): string {
  return elapsedRatio < 0.5 ? '#4ade80' : elapsedRatio < 0.75 ? '#fb923c' : '#f87171'
}

/** Formats one millisecond duration as a stable minute-and-second label. */
function formatRemaining(value: number): string {
  const seconds = Math.max(0, Math.ceil(value / 1_000))
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

/** Clamps remaining time to the project's configured timer budget. */
function clampRemaining(value: number, budgetMs: number): number {
  return Math.max(0, Math.min(budgetMs, value))
}

/** Reads one untyped scene value as a record. */
function readRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

