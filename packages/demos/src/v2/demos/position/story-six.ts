import type { PersoDoc, StoryDoc } from 'codplay'
import type { PlannedStrapHelpers, PlannedStrapOccurrence, StrapFunction } from 'codplay/runtime/player'
import {
  POSITION_NAMESPACE,
  POSITION_STORY_END_EVENT,
  POSITION_STORY_SIX_ID,
  POSITION_VIEW_SIX_INITIALIZE_EVENT,
} from './constants'
import { CAROUSEL_EVENTS_BY_STORY_ID, createViewRoot } from './carousel'
import type { StoryAnimationOccurrence } from './types'

type ContentId = 'qa' | 'qb' | 'qc' | 'qd' | 'qe' | 'qf' | 'ka' | 'kb' | 'kc' | 'kd' | 'ke' | 'kf'
type OwnerId = 'q' | 'k'
type ConclusionNodeId = 'a' | 'b' | 'c' | 'd'

type ContentExchange = Readonly<{
  name: string
  timeMs: number
  itemId: ContentId
  from: OwnerId
  to: OwnerId
}>

const STAGE_TARGET = 'position:view-six:stage'
const NODE_OUTLETS: Readonly<Record<ConclusionNodeId, string>> = {
  a: 'position:view-six:node:a',
  b: 'position:view-six:node:b',
  c: 'position:view-six:node:c',
  d: 'position:view-six:node:d',
}
const TRANSFER_Q_OUTLET = 'position:view-six:transfer:q'
const TRANSFER_K_OUTLET = 'position:view-six:transfer:k'
const TRANSFER_Q_LIST_ID = 'position-view-six-transfer-q'
const TRANSFER_K_LIST_ID = 'position-view-six-transfer-k'

const MOVE_A_EVENT = `${POSITION_NAMESPACE}:conclusion:move-a`
const MOVE_B_EVENT = `${POSITION_NAMESPACE}:conclusion:move-b`
const REVEAL_C_EVENT = `${POSITION_NAMESPACE}:conclusion:reveal-c`
const REVEAL_D_EVENT = `${POSITION_NAMESPACE}:conclusion:reveal-d`
const TRANSFER_Q_EVENT = `${POSITION_NAMESPACE}:conclusion:transfer-q`
const TRANSFER_K_EVENT = `${POSITION_NAMESPACE}:conclusion:transfer-k`

const BOUNDARY_TIME_MS = 1_000
const SECONDARY_CONTAINER_DURATION_MS = 8_150
const CONTAINER_DURATION_MS = 9_350
const TRANSFER_DURATION_MS = 7_275
const CONTENT_DURATION_MS = 875
const REVEAL_OPACITY_DURATION_MS = 360
const CONTENT_FIRST_EXCHANGE_MS = 1_200
const CONTENT_EXCHANGE_SPACING_MS = 500
const CONTENT_EASE = 'inOutQuad'
const CENTER_CURVE_PATH = 'M 0 0 A 0.8 0.8 0 0 0 1 0'
const STORY_SIX_END_OFFSET_MS = BOUNDARY_TIME_MS + 500 + SECONDARY_CONTAINER_DURATION_MS
const STORY_SIX_START_STRAP = `${POSITION_NAMESPACE}:view:6:start`

const CONTENT_EXCHANGES: readonly ContentExchange[] = [
  { name: `${POSITION_NAMESPACE}:conclusion:exchange-qa`, timeMs: CONTENT_FIRST_EXCHANGE_MS, itemId: 'qa', from: 'q', to: 'k' },
  { name: `${POSITION_NAMESPACE}:conclusion:exchange-ka`, timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS, itemId: 'ka', from: 'k', to: 'q' },
  { name: `${POSITION_NAMESPACE}:conclusion:exchange-qb`, timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 2, itemId: 'qb', from: 'q', to: 'k' },
  { name: `${POSITION_NAMESPACE}:conclusion:exchange-kb`, timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 3, itemId: 'kb', from: 'k', to: 'q' },
  { name: `${POSITION_NAMESPACE}:conclusion:exchange-qc`, timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 4, itemId: 'qc', from: 'q', to: 'k' },
  { name: `${POSITION_NAMESPACE}:conclusion:exchange-kc`, timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 5, itemId: 'kc', from: 'k', to: 'q' },
  { name: `${POSITION_NAMESPACE}:conclusion:exchange-qd`, timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 6, itemId: 'qd', from: 'q', to: 'k' },
  { name: `${POSITION_NAMESPACE}:conclusion:exchange-kd`, timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 7, itemId: 'kd', from: 'k', to: 'q' },
  { name: `${POSITION_NAMESPACE}:conclusion:exchange-qe`, timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 8, itemId: 'qe', from: 'q', to: 'k' },
  { name: `${POSITION_NAMESPACE}:conclusion:exchange-ke`, timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 9, itemId: 'ke', from: 'k', to: 'q' },
  { name: `${POSITION_NAMESPACE}:conclusion:exchange-qf`, timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 10, itemId: 'qf', from: 'q', to: 'k' },
  { name: `${POSITION_NAMESPACE}:conclusion:exchange-kf`, timeMs: CONTENT_FIRST_EXCHANGE_MS + CONTENT_EXCHANGE_SPACING_MS * 11, itemId: 'kf', from: 'k', to: 'q' },
]

const ITEM_LABELS: Readonly<Record<ContentId, string>> = {
  qa: 'Qa',
  qb: 'Qb',
  qc: 'Qc',
  qd: 'Qd',
  qe: 'Qe',
  qf: 'Qf',
  ka: 'Ka',
  kb: 'Kb',
  kc: 'Kc',
  kd: 'Kd',
  ke: 'Ke',
  kf: 'Kf',
}

/** Creates one position-styled container with the same outlet structure as flip-stress. */
function conclusionNodeMarkup(label: ConclusionNodeId, outletId: string): string {
  return `
    <article>
      <header class="position-conclusion-node__header">
        <span class="position-conclusion-node__mark">${label.toUpperCase()}</span>
      </header>
      <div class="position-conclusion-node__outlet" data-part="${outletId}"></div>
    </article>
  `
}

/** Creates one position-styled transfer frame with its list outlet. */
function transferFrameMarkup(outletId: string): string {
  return `
    <section>
      <div class="position-conclusion-transfer-frame__outlet" data-part="${outletId}"></div>
    </section>
  `
}

/** Creates a repeatable pseudo-random source for one content identifier. */
function createDeterministicRandom(seed: string): () => number {
  let state = 2166136261
  for (const character of seed) state = Math.imul(state ^ character.charCodeAt(0), 16777619)
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return (state >>> 0) / 4294967296
  }
}

/** Formats one generated path coordinate with stable authoring precision. */
function formatPathNumber(value: number): string {
  return value.toFixed(2)
}

/** Builds the deterministic two-lobed path used by each flip-stress content move. */
function createSmoothContentPath(itemId: ContentId): string {
  const random = createDeterministicRandom(`flip-stress:${itemId}`)
  const radiusX = 0.5 + random() * 0.24
  const radiusY = 0.32 + random() * 0.4
  const rotation = -18 + random() * 36
  const firstSweep = random() < 0.5 ? 0 : 1
  const secondSweep = firstSweep === 1 ? 0 : 1
  return [
    'M 0 0',
    `A ${formatPathNumber(radiusX)} ${formatPathNumber(radiusY)} ${formatPathNumber(rotation)} 0 ${firstSweep} 0.5 0`,
    `A ${formatPathNumber(radiusX)} ${formatPathNumber(radiusY)} ${formatPathNumber(rotation)} 0 ${secondSweep} 1 0`,
  ].join(' ')
}

/** Creates one content item with its exact flip-stress exchange move. */
function contentPerso(exchange: ContentExchange): PersoDoc {
  const sourceListId = exchange.from === 'q' ? TRANSFER_Q_LIST_ID : TRANSFER_K_LIST_ID
  const targetListId = exchange.to === 'q' ? TRANSFER_Q_LIST_ID : TRANSFER_K_LIST_ID
  const itemId = `position-view-six-item-${exchange.itemId}`
  return {
    id: itemId,
    type: 'tag',
    initial: {
      tag: 'span',
      content: ITEM_LABELS[exchange.itemId],
      className: `position-conclusion-item position-conclusion-item--${exchange.itemId}`,
      attr: { role: 'listitem', 'aria-label': ITEM_LABELS[exchange.itemId] },
      move: { target: sourceListId },
    },
    actions: {
      [exchange.name]: {
        move: {
          target: targetListId,
          transition: {
            duration: CONTENT_DURATION_MS,
            ease: CONTENT_EASE,
            path: createSmoothContentPath(exchange.itemId),
          },
        },
      },
    },
  }
}

/** Creates story 6 as the position-styled declarative conclusion of flip-stress. */
export function createStorySix(): StoryDoc {
  const storyEvents = CAROUSEL_EVENTS_BY_STORY_ID[POSITION_STORY_SIX_ID]
  const view = createViewRoot(POSITION_STORY_SIX_ID, `
    <section class="position-view__frame position-view__frame--conclusion">
      <div class="position-conclusion-network" data-part="${STAGE_TARGET}"></div>
      <div class="position-story-caption">
        <span class="position-story-caption__number">06</span>
        <p>Conclusion : quatre conteneurs, deux cadres en transfert et douze items échangent leurs places par des moves réels.</p>
      </div>
    </section>
  `)

  return {
    id: POSITION_STORY_SIX_ID,
    straps: {
      [STORY_SIX_START_STRAP]: createStorySixStartStrap(),
    },
    listen: [
      { on: storyEvents.enter, active: true, reset: true },
      { on: storyEvents.leave, active: false },
      { on: storyEvents.reset, reset: true },
      { on: POSITION_VIEW_SIX_INITIALIZE_EVENT, straps: [STORY_SIX_START_STRAP] },
    ],
    eventimes: [],
    persos: [
      view,
      {
        id: 'position-view-six-node-a',
        type: 'layout',
        initial: {
          move: { target: STAGE_TARGET },
          className: 'position-conclusion-node position-conclusion-node--a',
          style: { rotate: '-15deg' },
          markup: conclusionNodeMarkup('a', NODE_OUTLETS.a),
        },
        actions: {
          [MOVE_A_EVENT]: {
            style: {
              top: { from: '5%', to: '28%', duration: CONTAINER_DURATION_MS, ease: 'linear' },
              rotate: { to: '10deg', duration: CONTAINER_DURATION_MS, ease: 'linear' },
            },
          },
        },
      },
      {
        id: 'position-view-six-node-b',
        type: 'layout',
        initial: {
          move: { target: STAGE_TARGET },
          className: 'position-conclusion-node position-conclusion-node--b',
          style: { rotate: '12deg' },
          markup: conclusionNodeMarkup('b', NODE_OUTLETS.b),
        },
        actions: {
          [MOVE_B_EVENT]: {
            style: {
              top: { from: '36%', to: '13%', duration: CONTAINER_DURATION_MS, ease: 'linear' },
              rotate: { to: '-8deg', duration: CONTAINER_DURATION_MS, ease: 'linear' },
            },
          },
        },
      },
      {
        id: 'position-view-six-node-c',
        type: 'layout',
        initial: {
          move: '@off',
          className: 'position-conclusion-node position-conclusion-node--c',
          style: { rotate: '-10deg' },
          markup: conclusionNodeMarkup('c', NODE_OUTLETS.c),
        },
        actions: {
          [REVEAL_C_EVENT]: {
            move: { target: STAGE_TARGET },
            style: {
              bottom: { from: '5%', to: '28%', duration: SECONDARY_CONTAINER_DURATION_MS, ease: 'linear' },
              rotate: { to: '14deg', duration: 5_000, ease: 'linear' },
              opacity: { from: 0, to: 1, duration: REVEAL_OPACITY_DURATION_MS, ease: 'linear' },
            },
          },
        },
      },
      {
        id: 'position-view-six-node-d',
        type: 'layout',
        initial: {
          move: '@off',
          className: 'position-conclusion-node position-conclusion-node--d',
          style: { rotate: '9deg' },
          markup: conclusionNodeMarkup('d', NODE_OUTLETS.d),
        },
        actions: {
          [REVEAL_D_EVENT]: {
            move: { target: STAGE_TARGET },
            style: {
              top: {
                from: 'min(52%, calc(100% - var(--position-conclusion-node-size)))',
                to: 'min(75%, calc(100% - var(--position-conclusion-node-size)))',
                duration: SECONDARY_CONTAINER_DURATION_MS,
                ease: 'linear',
              },
              rotate: { to: '-13deg', duration: 6_000, ease: 'linear' },
              opacity: { from: 0, to: 1, duration: REVEAL_OPACITY_DURATION_MS, ease: 'linear' },
            },
          },
        },
      },
      {
        id: 'position-view-six-transfer-q-frame',
        type: 'layout',
        initial: {
          move: { target: NODE_OUTLETS.a },
          className: 'position-conclusion-transfer-frame position-conclusion-transfer-frame--q',
          markup: transferFrameMarkup(TRANSFER_Q_OUTLET),
        },
        actions: {
          [TRANSFER_Q_EVENT]: {
            move: {
              target: NODE_OUTLETS.b,
              transition: {
                duration: TRANSFER_DURATION_MS,
                ease: CONTENT_EASE,
                path: CENTER_CURVE_PATH,
              },
            },
          },
        },
      },
      {
        id: 'position-view-six-transfer-k-frame',
        type: 'layout',
        initial: {
          move: { target: NODE_OUTLETS.d },
          className: 'position-conclusion-transfer-frame position-conclusion-transfer-frame--k',
          markup: transferFrameMarkup(TRANSFER_K_OUTLET),
        },
        actions: {
          [TRANSFER_K_EVENT]: {
            move: {
              target: NODE_OUTLETS.c,
              transition: {
                duration: TRANSFER_DURATION_MS,
                ease: CONTENT_EASE,
                path: CENTER_CURVE_PATH,
              },
            },
          },
        },
      },
      {
        id: TRANSFER_Q_LIST_ID,
        type: 'list',
        initial: {
          tag: 'section',
          move: { target: TRANSFER_Q_OUTLET },
          className: 'position-conclusion-list position-conclusion-list--q',
          attr: { role: 'list', 'aria-label': 'Q' },
        },
      },
      {
        id: TRANSFER_K_LIST_ID,
        type: 'list',
        initial: {
          tag: 'section',
          move: { target: TRANSFER_K_OUTLET },
          className: 'position-conclusion-list position-conclusion-list--k',
          attr: { role: 'list', 'aria-label': 'K' },
        },
      },
      ...CONTENT_EXCHANGES.map((exchange) => contentPerso(exchange)),
    ],
  }
}

/** Starts the story-local conclusion timeline after the story is active. */
function createStorySixStartStrap(): StrapFunction {
  return ({ context }) => planStorySixAnimation(context.planned)
}

/** Schedules the conclusion events relative to one story activation. */
export function planStorySixAnimation(
  planned: Pick<PlannedStrapHelpers, 'wait'>,
): readonly PlannedStrapOccurrence[] {
  return createStorySixAnimationPlan().flatMap((occurrence) => planned.wait(occurrence.offsetMs, {
    event: {
      name: occurrence.name,
      visibility: 'story',
      ...(occurrence.data === undefined ? {} : { data: occurrence.data }),
    },
  }))
}

/** Schedules the same four container, two frame and twelve content events as flip-stress. */
export function createStorySixAnimationPlan(): readonly StoryAnimationOccurrence[] {
  return [
    { name: MOVE_A_EVENT, offsetMs: 0 },
    { name: MOVE_B_EVENT, offsetMs: 0 },
    { name: REVEAL_C_EVENT, offsetMs: BOUNDARY_TIME_MS },
    { name: REVEAL_D_EVENT, offsetMs: BOUNDARY_TIME_MS + 500 },
    { name: TRANSFER_Q_EVENT, offsetMs: BOUNDARY_TIME_MS + 1_000 },
    { name: TRANSFER_K_EVENT, offsetMs: BOUNDARY_TIME_MS + 1_000 },
    ...CONTENT_EXCHANGES.map((exchange) => ({ name: exchange.name, offsetMs: exchange.timeMs })),
    { name: POSITION_STORY_END_EVENT, offsetMs: STORY_SIX_END_OFFSET_MS },
  ]
}
