import type { CompiledRecord } from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'
import type { StrapFunction, StrapReturnValue } from 'codplay/runtime/player'
import type { QuizHuntDocument, QuizHuntGroup, QuizHuntPage } from '../document/quiz-hunt-document-types'

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
} as const

const TIMER_RENDER_EVENT = 'quiz-hunt:basket:timer:render'
const TIMER_FREEZE_EVENT = 'quiz-hunt:basket:timer:freeze'

type BasketPerso = SceneDoc<string>['stories'][string]['persos'][number]
type TimerStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'expired'
type TimerFrameInput = Readonly<{ progress: number; data?: Readonly<Record<string, unknown>> }>

const QUIZ_HUNT_BASKET_STYLE_SHEET = `
.quiz-hunt-basket {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr)) auto;
  grid-template-rows: auto auto auto;
  align-items: stretch;
  gap: 0.5rem;
  min-width: 0;
  padding: 0.5rem;
}

.quiz-hunt-basket__slot {
  display: grid;
  align-content: center;
  min-width: 0;
  min-height: 3rem;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--quiz-hunt-group-color, #64748b);
  border-radius: 0.55rem;
  background: rgb(15 23 42 / 82%);
  color: #f8fafc;
}

.quiz-hunt-basket__group { font-size: 0.7em; opacity: 0.8; }
.quiz-hunt-basket__word { overflow: hidden; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }

.quiz-hunt-basket__timer-zone {
  grid-column: 3;
  grid-row: 1 / span 2;
  display: grid;
  place-items: center;
  min-width: 5.5rem;
  min-height: 5.5rem;
  aspect-ratio: 1;
}

.quiz-hunt-basket__timer {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border: 0.45rem solid #64748b;
  border-radius: 50%;
  background: #0f172a;
  color: #4ade80;
  font-family: ui-monospace, monospace;
  font-size: clamp(0.95rem, 2.4vw, 1.25rem);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  box-shadow: inset 0 0 0 0.3rem rgb(148 163 184 / 12%), 0 0.2rem 0.7rem rgb(15 23 42 / 28%);
}

@media (orientation: landscape) and (min-width: 40em) {
  .quiz-hunt-basket { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: auto auto auto auto; }
  .quiz-hunt-basket__timer-zone { grid-column: 1 / -1; grid-row: 3; justify-self: center; width: 8rem; height: 8rem; }
}

@media (orientation: portrait) {
  .quiz-hunt-basket { grid-template-columns: repeat(2, minmax(0, 1fr)) auto; }
}
`

/** Builds the persistent colored basket and its own CodPlay-controlled countdown. */
export function buildQuizHuntBasketScene(
  document: QuizHuntDocument,
): Readonly<{ sceneDoc: SceneDoc<string>; styleSheet: string }> {
  const groups = document.settings.groups
  const pagesById = new Map(document.pages.map((page) => [page.id, page]))
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
              events: [{ name: TIMER_FREEZE_EVENT, data: { content: formatRemaining(clampRemaining(
                typeof event.data?.remainingMs === 'number' ? event.data.remainingMs : budgetMs,
                budgetMs,
              )) } }],
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
            createBasketLayout(groups),
            ...groups.flatMap((group, index) => createBasketSlot(group, index)),
            createTimerDisplay(budgetMs),
          ],
        },
      },
    },
    styleSheet: QUIZ_HUNT_BASKET_STYLE_SHEET,
  }
}

/** Creates the layout marker that keeps all basket colors and the clock together. */
function createBasketLayout(groups: readonly QuizHuntGroup[]): BasketPerso {
  const slots = groups.map((_group, index) => `<!-- data-part="quiz-hunt:basket:slot:${index}" -->`).join('')
  return {
    id: 'quiz-hunt-basket-layout',
    type: 'layout',
    initial: {
      move: '@root',
      className: 'quiz-hunt-basket',
      markup: `<section id="quiz-hunt-basket-root" class="quiz-hunt-basket" aria-label="Panier et minuteur">
        ${slots}
        <div id="quiz-hunt-basket-timer-zone" class="quiz-hunt-basket__timer-zone">
          <span id="quiz-hunt-basket-timer" class="quiz-hunt-basket__timer" data-part="quiz-hunt:basket:timer"></span>
        </div>
      </section>`,
    },
    actions: {},
  }
}

/** Creates one displayed color slot, initially empty until the scenario projects its basket. */
function createBasketSlot(group: QuizHuntGroup, index: number): readonly BasketPerso[] {
  const wordEvent = `quiz-hunt:basket:word:${index}`
  return [
    {
      id: `quiz-hunt-basket-slot-${index + 1}`,
      type: 'layout',
      initial: {
        move: { target: `quiz-hunt:basket:slot:${index}` },
        className: 'quiz-hunt-basket__slot',
        markup: `<div id="quiz-hunt-basket-slot-${index + 1}-root" class="quiz-hunt-basket__slot" style="--quiz-hunt-group-color:${escapeAttribute(group.color)}">
          <span id="quiz-hunt-basket-slot-${index + 1}-group" class="quiz-hunt-basket__group">${escapeHtml(group.name)}</span>
          <span id="quiz-hunt-basket-slot-${index + 1}-word-host" class="quiz-hunt-basket__word"><!-- data-part="${wordEvent}" --></span>
        </div>`,
      },
      actions: {},
    },
    {
      id: `quiz-hunt-basket-slot-${index + 1}-word`,
      type: 'tag',
      initial: { tag: 'span', content: '—', move: { target: wordEvent } },
      actions: { [wordEvent]: {} },
    },
  ]
}

/** Renders the countdown for the complete configured timer budget. */
function createTimerDisplay(budgetMs: number): BasketPerso {
  return {
    id: 'quiz-hunt-basket-timer-display',
    type: 'tag',
    initial: {
      tag: 'span',
      content: formatRemaining(budgetMs),
      className: 'quiz-hunt-basket__timer',
      attr: { 'aria-label': 'Temps restant' },
      move: { target: 'quiz-hunt:basket:timer' },
    },
    actions: {
      [TIMER_RENDER_EVENT]: { duration: budgetMs, ease: 'linear', fn: ({ progress, data }: TimerFrameInput) => timerFrame(progress, data, budgetMs) },
      [TIMER_FREEZE_EVENT]: {},
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
        ...freezeTimerEvents(remainingMs),
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
      ...freezeTimerEvents(0),
      { name: eventName, data: { remainingMs: 0, feedbackPending: timer.feedbackPending, budgetMs }, visibility: 'public' },
    ],
  }
}

/** Freezes the display event stream at the supplied remaining duration. */
function freezeTimerEvents(remainingMs: number): { name: string; data?: CompiledRecord }[] {
  return [
    { name: 'tween:stop' },
    { name: TIMER_FREEZE_EVENT, data: { content: formatRemaining(remainingMs) } },
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
    events: groups.map((group, index) => {
      const pageId = basket[group.id]
      const page = typeof pageId === 'string' ? pagesById.get(pageId) : undefined
      return {
        name: `quiz-hunt:basket:word:${index}`,
        data: { content: page?.name ?? '—' },
      }
    }),
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
  const segmentStart = typeof data?.remainingMs === 'number' ? clampRemaining(data.remainingMs, budgetMs) : budgetMs
  const remainingMs = clampRemaining(segmentStart - Math.max(0, Math.min(1, progress)) * budgetMs, budgetMs)
  return { content: formatRemaining(remainingMs) }
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

/** Escapes author values before inserting them in the shared basket markup. */
function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/** Escapes a color value before writing the controlled inline style attribute. */
function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
