import type { PersoDoc } from 'codplay'
import { POSITION_NAMESPACE } from './constants'
import { createViewRoot } from './carousel'
import { createPositionMoveData } from './shared'
import type { StoryAnimationOccurrence } from './types'

type ConclusionTransfer = Readonly<{
  name: string
  itemId: string
  targetNode: string
  atMs: number
  path: string
}>

const INITIAL_TARGETS: Readonly<Record<string, string>> = {
  a: 'position:view-six:node:a',
  b: 'position:view-six:node:b',
  c: 'position:view-six:node:c',
  d: 'position:view-six:node:d',
}

const CONCLUSION_TRANSFERS: readonly ConclusionTransfer[] = [
  {
    name: `${POSITION_NAMESPACE}:conclusion:a-to-b`,
    itemId: 'a',
    targetNode: 'position:view-six:node:b',
    atMs: 650,
    path: 'M 0 0 A 0.72 0.38 0 0 1 0.5 0 A 0.72 0.38 0 0 0 1 0',
  },
  {
    name: `${POSITION_NAMESPACE}:conclusion:b-to-c`,
    itemId: 'b',
    targetNode: 'position:view-six:node:c',
    atMs: 900,
    path: 'M 0 0 A 0.56 0.58 0 0 0 0.5 0 A 0.56 0.58 0 0 1 1 0',
  },
  {
    name: `${POSITION_NAMESPACE}:conclusion:c-to-d`,
    itemId: 'c',
    targetNode: 'position:view-six:node:d',
    atMs: 1_150,
    path: 'M 0 0 A 0.64 0.42 0 0 1 0.5 0 A 0.64 0.42 0 0 0 1 0',
  },
  {
    name: `${POSITION_NAMESPACE}:conclusion:d-to-a`,
    itemId: 'd',
    targetNode: 'position:view-six:node:a',
    atMs: 1_400,
    path: 'M 0 0 A 0.58 0.5 0 0 0 0.5 0 A 0.58 0.5 0 0 1 1 0',
  },
  {
    name: `${POSITION_NAMESPACE}:conclusion:b-to-d`,
    itemId: 'b',
    targetNode: 'position:view-six:node:d',
    atMs: 2_250,
    path: 'M 0 0 A 0.75 0.3 0 0 1 0.5 0 A 0.75 0.3 0 0 0 1 0',
  },
  {
    name: `${POSITION_NAMESPACE}:conclusion:a-to-c`,
    itemId: 'a',
    targetNode: 'position:view-six:node:c',
    atMs: 2_500,
    path: 'M 0 0 A 0.5 0.62 0 0 0 0.5 0 A 0.5 0.62 0 0 1 1 0',
  },
  {
    name: `${POSITION_NAMESPACE}:conclusion:d-to-b`,
    itemId: 'd',
    targetNode: 'position:view-six:node:b',
    atMs: 2_750,
    path: 'M 0 0 A 0.68 0.44 0 0 1 0.5 0 A 0.68 0.44 0 0 0 1 0',
  },
  {
    name: `${POSITION_NAMESPACE}:conclusion:c-to-a`,
    itemId: 'c',
    targetNode: 'position:view-six:node:a',
    atMs: 3_000,
    path: 'M 0 0 A 0.62 0.54 0 0 0 0.5 0 A 0.62 0.54 0 0 1 1 0',
  },
]

/** Creates the final conclusion view with several simultaneous item paths. */
export function createStorySix(): readonly PersoDoc[] {
  const view = createViewRoot(5, `
    <section class="position-view__frame position-view__frame--conclusion">
      <div class="position-conclusion-network">
        <svg class="position-conclusion-network__paths" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path d="M 14 24 C 32 3, 64 3, 86 24"></path>
          <path d="M 86 24 C 68 48, 32 48, 14 76"></path>
          <path d="M 14 76 C 38 98, 66 98, 86 76"></path>
          <path d="M 24 19 C 42 44, 58 60, 76 81"></path>
        </svg>
        <article class="position-conclusion-node position-conclusion-node--a">
          <span class="position-conclusion-node__mark">A</span>
          <strong>source</strong>
          <div data-part="position:view-six:node:a"></div>
        </article>
        <article class="position-conclusion-node position-conclusion-node--b">
          <span class="position-conclusion-node__mark">B</span>
          <strong>cible</strong>
          <div data-part="position:view-six:node:b"></div>
        </article>
        <article class="position-conclusion-node position-conclusion-node--c">
          <span class="position-conclusion-node__mark">C</span>
          <strong>source</strong>
          <div data-part="position:view-six:node:c"></div>
        </article>
        <article class="position-conclusion-node position-conclusion-node--d">
          <span class="position-conclusion-node__mark">D</span>
          <strong>cible</strong>
          <div data-part="position:view-six:node:d"></div>
        </article>
      </div>
      <div class="position-story-caption">
        <span class="position-story-caption__number">06</span>
        <p>Reparenting, ancres, paths et trajectoires multiples : le même moteur compose le mouvement.</p>
      </div>
    </section>
  `)

  const actionsByItem = new Map<string, Record<string, true>>()
  for (const transfer of CONCLUSION_TRANSFERS) {
    const actions = actionsByItem.get(transfer.itemId) ?? {}
    actions[transfer.name] = true
    actionsByItem.set(transfer.itemId, actions)
  }

  const items: PersoDoc[] = []
  for (const itemId of Object.keys(INITIAL_TARGETS)) {
    items.push({
      id: `position-view-six-item-${itemId}`,
      type: 'tag',
      initial: {
        tag: 'span',
        content: itemId,
        className: `position-conclusion-item position-conclusion-item--${itemId}`,
        move: { target: INITIAL_TARGETS[itemId] },
      },
      actions: actionsByItem.get(itemId) ?? {},
    })
  }
  return [view, ...items]
}

/** Schedules the eight two-second reparentings of the conclusion network. */
export function createStorySixAnimationPlan(): readonly StoryAnimationOccurrence[] {
  return CONCLUSION_TRANSFERS.map((transfer) => ({
    name: transfer.name,
    offsetMs: transfer.atMs,
    data: createPositionMoveData(transfer.targetNode, transfer.path),
  }))
}
