import { animate } from 'animejs'

import { createAnimationAdapter, type AnimeImplementation } from '../animation/adapter'
import { createFlipEngine } from '../runtime/flip-engine'

type DemoCard = {
  id: string
  label: string
}

type ScenarioId = 'reorder' | 'add' | 'delete'

/**
 * Builds an anime.js implementation wrapper compatible with the runtime adapter.
 */
function createAnimeImplementation(onDispatch: (parameters: Record<string, unknown>) => void): AnimeImplementation {
  return (parameters) => {
    onDispatch(parameters)

    const targets = parameters.targets
    const { targets: _ignoredTargets, ...rest } = parameters

    const animationTargets = targets as Parameters<typeof animate>[0]
    const animationParameters = rest as Parameters<typeof animate>[1]
    return animate(animationTargets, animationParameters)
  }
}

/**
 * Creates one card node used in the FLIP demo grid.
 */
function createCard(card: DemoCard): HTMLDivElement {
  const cardNode = document.createElement('div')
  const cardNumber = Number.parseInt(card.id.replace('card-', ''), 10)
  const numericValue = Number.isFinite(cardNumber) ? cardNumber : 0
  const baseTransforms = [
    'rotate(-4deg) scale(0.97)',
    'rotate(3deg) scale(1.03)',
    'rotate(-2deg) scale(1.02)',
    'rotate(5deg) scale(0.98)',
    'rotate(-6deg) scale(1.01)'
  ]
  const baseTransform = baseTransforms[numericValue % baseTransforms.length]

  cardNode.className = 'flip-card'
  cardNode.dataset.flipId = card.id
  cardNode.textContent = card.label
  cardNode.style.transform = baseTransform
  return cardNode
}

/**
 * Mounts a real-DOM FLIP demo with deterministic scenarios.
 */
export function mountFlipEngineDomExample(container: HTMLElement): void {
  container.className = 'flip-lab'
  container.innerHTML = `
    <h1>FLIP Lab</h1>
    <p>
      Deterministic scenarios in a grid container with pre-transformed items.
      Toggle transform mode to run the same scenarios inside a transformed parent container.
    </p>

    <div class="flip-controls">
      <label class="flip-toggle">
        <input id="flip-transform-toggle" type="checkbox" />
        Run with transformed parent
      </label>
      <button id="flip-reorder" type="button">Reorder</button>
      <button id="flip-add" type="button">Add</button>
      <button id="flip-delete" type="button">Delete</button>
    </div>

    <section class="flip-lane" id="flip-lane">
      <h2>Grid lane + pre-transformed items</h2>
      <div class="flip-list" id="flip-list"></div>
    </section>

    <p id="flip-log" class="flip-log">Ready. Try Reorder first.</p>
    <pre id="flip-debug" class="flip-debug"></pre>
  `

  const transformToggle = container.querySelector<HTMLInputElement>('#flip-transform-toggle')
  const reorderButton = container.querySelector<HTMLButtonElement>('#flip-reorder')
  const addButton = container.querySelector<HTMLButtonElement>('#flip-add')
  const deleteButton = container.querySelector<HTMLButtonElement>('#flip-delete')
  const lane = container.querySelector<HTMLDivElement>('#flip-list')
  const laneSection = container.querySelector<HTMLElement>('#flip-lane')
  const log = container.querySelector<HTMLParagraphElement>('#flip-log')
  const debug = container.querySelector<HTMLPreElement>('#flip-debug')

  if (!transformToggle || !reorderButton || !addButton || !deleteButton || !lane || !laneSection || !log || !debug) {
    return
  }

  const transformToggleElement: HTMLInputElement = transformToggle
  const reorderButtonElement: HTMLButtonElement = reorderButton
  const addButtonElement: HTMLButtonElement = addButton
  const deleteButtonElement: HTMLButtonElement = deleteButton
  const laneElement: HTMLDivElement = lane
  const laneSectionElement: HTMLElement = laneSection
  const logElement: HTMLParagraphElement = log
  const debugElement: HTMLPreElement = debug

  let lastAnimePayloads: Array<Record<string, unknown>> = []

  const animationAdapter = createAnimationAdapter(
    createAnimeImplementation((parameters) => {
      lastAnimePayloads.push(parameters)
    })
  )
  const flipEngine = createFlipEngine()

  let nextCardNumber = 7
  let cards: DemoCard[] = [
    { id: 'card-1', label: 'A' },
    { id: 'card-2', label: 'B' },
    { id: 'card-3', label: 'C' },
    { id: 'card-4', label: 'D' },
    { id: 'card-5', label: 'E' },
    { id: 'card-6', label: 'F' }
  ]

  const cardNodesById = new Map<string, HTMLDivElement>()

  /**
   * Updates lane and card rendering from the current state.
   */
  function renderDomState(): void {
    const withTransform = transformToggleElement.checked
    laneSectionElement.classList.toggle('is-parent-transformed', withTransform)

    const activeIds = new Set(cards.map((card) => card.id))
    for (const [cardId, cardNode] of cardNodesById.entries()) {
      if (!activeIds.has(cardId)) {
        cardNode.remove()
        cardNodesById.delete(cardId)
      }
    }

    for (const card of cards) {
      let cardNode = cardNodesById.get(card.id)
      if (!cardNode) {
        cardNode = createCard(card)
        cardNodesById.set(card.id, cardNode)
      }

      laneElement.appendChild(cardNode)
    }
  }

  /**
   * Collects FLIP entries from all mounted cards.
   */
  function collectFlipEntries(): Array<{ id: string; nodeRef: HTMLDivElement }> {
    const entries: Array<{ id: string; nodeRef: HTMLDivElement }> = []

    for (const card of cards) {
      const cardNode = cardNodesById.get(card.id)
      if (cardNode) {
        entries.push({ id: card.id, nodeRef: cardNode })
      }
    }

    return entries
  }

  /**
   * Prepares one deterministic mutation callback for the requested scenario.
   */
  function prepareScenarioMutation(scenarioId: ScenarioId): () => void {
    if (scenarioId === 'reorder') {
      return () => {
        if (cards.length < 2) {
          return
        }

        cards = [...cards.slice(1), cards[0]]
      }
    }

    if (scenarioId === 'add') {
      return () => {
        const newCardNumber = nextCardNumber
        nextCardNumber += 1

        const newCard: DemoCard = {
          id: `card-${newCardNumber}`,
          label: String.fromCharCode(64 + Math.min(newCardNumber, 90))
        }

        const insertionIndex = Math.min(2, cards.length)
        cards = [...cards.slice(0, insertionIndex), newCard, ...cards.slice(insertionIndex)]
      }
    }

    return () => {
      if (cards.length <= 2) {
        return
      }

      const deleteIndex = Math.min(2, cards.length - 1)
      cards = [...cards.slice(0, deleteIndex), ...cards.slice(deleteIndex + 1)]
    }
  }

  /**
   * Runs one FLIP scenario and updates the debug panel.
   */
  async function runScenario(scenarioId: ScenarioId): Promise<void> {
    const mutate = prepareScenarioMutation(scenarioId)
    const entries = collectFlipEntries()
    lastAnimePayloads = []

    const result = await flipEngine.run({
      entries,
      animationAdapter,
      applyInvertTransformToTarget: false,
      options: {
        includeSize: false,
        includeTransformMatrix: true,
        durationMs: 620,
        easing: 'easeInOutCubic',
        staggerMs: 20
      },
      mutate: () => {
        mutate()
        renderDomState()
      }
    })

    logElement.textContent = `${scenarioId.toUpperCase()} | transitions=${result.transitions.length} | animationCalls=${result.animation.appliedCount}`

    const debugPreview = lastAnimePayloads.slice(0, 2).map((payload) => {
      const clone = { ...payload }
      if ('targets' in clone) {
        clone.targets = '[DOMElement]'
      }

      return clone
    })

    debugElement.textContent = `Anime payloads (grouped calls):\n${JSON.stringify(debugPreview, null, 2)}`
  }

  reorderButtonElement.addEventListener('click', () => {
    void runScenario('reorder')
  })

  addButtonElement.addEventListener('click', () => {
    void runScenario('add')
  })

  deleteButtonElement.addEventListener('click', () => {
    void runScenario('delete')
  })

  transformToggleElement.addEventListener('change', () => {
    renderDomState()
    logElement.textContent = `Mode transforms: ${transformToggleElement.checked ? 'ON' : 'OFF'}`
    debugElement.textContent = ''
  })

  renderDomState()
}
