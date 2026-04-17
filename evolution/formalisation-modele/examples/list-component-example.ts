/**
 * Describes metadata for one specification example artifact.
 */
export type SpecExampleInfo = {
  id: string
  version: string
  status: 'draft' | 'review' | 'stable'
  updatedAt: string
}

/**
 * Provides versioning information for this example file.
 */
export const LIST_COMPONENT_EXAMPLE_INFO: SpecExampleInfo = {
  id: 'list-component-example',
  version: '0.4.0',
  status: 'draft',
  updatedAt: '2026-04-17'
}

/**
 * Represents one warning emitted by a permissive component/router.
 */
export type ComponentWarning = {
  code: string
  message: string
  details?: Record<string, unknown>
}

/**
 * Reports one component warning to the player trace channel.
 */
export type WarningReporter = (warning: ComponentWarning) => void

/**
 * Defines one common move mode used by all components.
 */
export type MoveMode = 'auto' | 'first' | 'last' | 'append' | 'prepend' | number

/**
 * Defines one common move command used by all components.
 */
export type MoveCommand = {
  parentId: string
  mode: MoveMode
  flip?: boolean
  reorder?: boolean
}

/**
 * Defines the payload forwarded by player for one component update call.
 */
export type ComponentUpdateInput = {
  persoId: string
  eventId: string
  eventSeq: number
  action: Record<string, unknown>
}

/**
 * Defines base visual patch fields reused by all component actions.
 */
export type BasePatch = {
  style?: Record<string, unknown>
  className?: string | { add?: string; remove?: string }
  attr?: Record<string, unknown>
}

/**
 * Defines the action shape supported by ListComponentExample.
 */
export type ListAction = BasePatch & {
  move?: MoveCommand
}

/**
 * Defines list instance config values.
 */
export type ListConfig = {
  reorderOnMove: boolean
  reorderOnAdd: boolean
  reorderOnRemove: boolean
}

/**
 * Defines one child entry transmitted to the FLIP runtime.
 */
export type ListFlipEntry = {
  childId: string
  nodeRef: unknown
}

/**
 * Defines one FLIP trigger payload emitted by the list component.
 */
export type ListFlipTrigger = {
  listId: string
  eventId: string
  eventSeq: number
  movedChildId: string
  reason: 'local-move' | 'transfer-in' | 'transfer-out' | 'auto' | 'detach'
  includeSize: boolean
  includeTransformMatrix: boolean
  entries: ListFlipEntry[]
  mutate: () => void
}

/**
 * Defines the bridge API used by list to delegate FLIP execution.
 */
export type ListFlipBridge = {
  run: (trigger: ListFlipTrigger) => void
}

/**
 * Defines one request to route a move for any runtime component.
 */
export type MoveRequest = {
  persoId: string
  move: MoveCommand
  eventId: string
  eventSeq: number
}

/**
 * Defines one request to detach a component after one outro transition.
 */
export type DetachAfterOutroRequest = {
  persoId: string
  eventId: string
  eventSeq: number
  runOutro: (onDone: () => void) => void
}

/**
 * Defines one minimal runtime registry for list routing.
 */
export type ListComponentRegistry = {
  getListById: (persoId: string) => ListComponentExample | null
  getPersoNodeById: (persoId: string) => HTMLElement | null
  getParentListId: (persoId: string) => string | null
  setParentListId: (persoId: string, parentListId: string | null) => void
}

/**
 * Defines one list move router contract.
 */
export type ListMoveRouter = {
  applyMoveForPerso: (request: MoveRequest) => void
  detachAfterOutro: (request: DetachAfterOutroRequest) => void
}

/**
 * Defines the DOM adapter contract used by this list example.
 */
export type DomListAdapter = {
  createFragmentFromTemplate: (template: string) => DocumentFragment
  appendChild: (parent: HTMLElement, child: HTMLElement) => void
  removeChild: (parent: HTMLElement, child: HTMLElement) => void
  applyStyle: (node: HTMLElement, patch: Record<string, unknown>) => void
  applyClassName: (node: HTMLElement, patch: string | { add?: string; remove?: string }) => void
  applyAttr: (node: HTMLElement, patch: Record<string, unknown>) => void
}

type PersistentPlacementRule = {
  mode: 'first' | 'last'
  insertedOrder: number
}

type ListModel = {
  orderedChildIds: string[]
  childNodeById: Map<string, HTMLElement>
  persistentPlacementByChildId: Map<string, PersistentPlacementRule>
  nextPlacementOrder: number
  config: ListConfig
}

type ListRefs = {
  root: HTMLElement
  items: HTMLElement
}

/**
 * Applies shared style/className/attr patches.
 */
class BasePatchLayer {
  private readonly adapter: DomListAdapter

  /**
   * Creates one base patch helper bound to one adapter instance.
   */
  constructor(adapter: DomListAdapter) {
    this.adapter = adapter
  }

  /**
   * Applies style/className/attr changes to one target node.
   */
  apply(node: HTMLElement, patch: BasePatch): void {
    if (patch.style) {
      this.adapter.applyStyle(node, patch.style)
    }

    if (patch.className !== undefined) {
      this.adapter.applyClassName(node, patch.className)
    }

    if (patch.attr) {
      this.adapter.applyAttr(node, patch.attr)
    }
  }
}

/**
 * Represents one list component instance aligned with child->parent routing.
 */
export class ListComponentExample {
  static readonly handledProps = ['move']

  private readonly persoId: string
  private readonly adapter: DomListAdapter
  private readonly warn: WarningReporter
  private readonly flipBridge: ListFlipBridge
  private readonly warningKeys = new Set<string>()
  private readonly model: ListModel

  private refs: ListRefs | null = null
  private basePatchLayer: BasePatchLayer | null = null

  /**
   * Creates one list component instance for one runtime perso.
   */
  constructor(input: {
    persoId: string
    adapter: DomListAdapter
    warn: WarningReporter
    flipBridge: ListFlipBridge
    config?: Partial<ListConfig>
  }) {
    this.persoId = input.persoId
    this.adapter = input.adapter
    this.warn = input.warn
    this.flipBridge = input.flipBridge

    this.model = {
      orderedChildIds: [],
      childNodeById: new Map<string, HTMLElement>(),
      persistentPlacementByChildId: new Map<string, PersistentPlacementRule>(),
      nextPlacementOrder: 1,
      config: {
        reorderOnMove: input.config?.reorderOnMove ?? true,
        reorderOnAdd: input.config?.reorderOnAdd ?? true,
        reorderOnRemove: input.config?.reorderOnRemove ?? true
      }
    }
  }

  /**
   * Initializes list root and internal references.
   */
  init(initial: Record<string, unknown>): void {
    const fragment = this.adapter.createFragmentFromTemplate(
      '<section class="list-component"><ul class="list-items"></ul></section>'
    )

    const rootNode = fragment.firstElementChild
    if (!(rootNode instanceof HTMLElement)) {
      this.warnOnce(0, 'W_LIST_INIT_FAILED', { persoId: this.persoId, reason: 'root-missing' })
      return
    }

    const itemsNode = rootNode.firstElementChild
    if (!(itemsNode instanceof HTMLElement)) {
      this.warnOnce(0, 'W_LIST_INIT_FAILED', { persoId: this.persoId, reason: 'items-missing' })
      return
    }

    this.refs = {
      root: rootNode,
      items: itemsNode
    }

    this.basePatchLayer = new BasePatchLayer(this.adapter)
    this.basePatchLayer.apply(rootNode, initial as BasePatch)
  }

  /**
   * Returns root node once initialization completed.
   */
  render(): HTMLElement {
    if (this.refs === null) {
      throw new Error(`List component not initialized: ${this.persoId}`)
    }

    return this.refs.root
  }

  /**
   * Applies list-local actions (base patch + optional self move forwarding).
   */
  update(input: ComponentUpdateInput, requestMove: (request: MoveRequest) => void): void {
    try {
      if (this.refs === null || this.basePatchLayer === null) {
        this.warnOnce(input.eventSeq, 'W_LIST_NOT_INITIALIZED', {
          persoId: this.persoId,
          eventId: input.eventId
        })
        return
      }

      const action = input.action as ListAction
      if (action.move) {
        requestMove({
          persoId: this.persoId,
          move: action.move,
          eventId: input.eventId,
          eventSeq: input.eventSeq
        })
      }

      this.basePatchLayer.apply(this.refs.root, action)
    } catch (error) {
      this.warnOnce(input.eventSeq, 'W_LIST_UPDATE_FAILED', {
        persoId: this.persoId,
        eventId: input.eventId,
        message: error instanceof Error ? error.message : 'Unknown update error'
      })
    }
  }

  /**
   * Attaches one child node and applies one placement mode in this list.
   */
  attachChild(input: {
    childId: string
    childNode: HTMLElement
    mode: MoveMode
    flip?: boolean
    eventId: string
    eventSeq: number
    reason: 'transfer-in' | 'local-move' | 'auto'
  }): void {
    this.runFlipAwareMutation({
      movedChildId: input.childId,
      eventId: input.eventId,
      eventSeq: input.eventSeq,
      reason: input.reason,
      flip: input.flip,
      mutate: () => {
        this.model.childNodeById.set(input.childId, input.childNode)
        if (!this.model.orderedChildIds.includes(input.childId)) {
          this.model.orderedChildIds.push(input.childId)
        }

        this.applyPlacementMode(input.childId, input.mode)
        this.syncDomOrder()
      }
    })
  }

  /**
   * Repositions one already attached child inside this list.
   */
  repositionChild(input: {
    childId: string
    mode: MoveMode
    flip?: boolean
    eventId: string
    eventSeq: number
    reason: 'local-move' | 'auto'
  }): void {
    if (!this.model.childNodeById.has(input.childId)) {
      this.warnOnce(input.eventSeq, 'W_LIST_MOVE_CHILD_NOT_FOUND', {
        persoId: this.persoId,
        eventId: input.eventId,
        childId: input.childId
      })
      return
    }

    this.runFlipAwareMutation({
      movedChildId: input.childId,
      eventId: input.eventId,
      eventSeq: input.eventSeq,
      reason: input.reason,
      flip: input.flip,
      mutate: () => {
        this.applyPlacementMode(input.childId, input.mode)
        this.syncDomOrder()
      }
    })
  }

  /**
   * Detaches one child from this list and returns its node when available.
   */
  detachChild(input: {
    childId: string
    flip?: boolean
    eventId: string
    eventSeq: number
    reason: 'transfer-out' | 'detach'
  }): HTMLElement | null {
    const node = this.model.childNodeById.get(input.childId) ?? null
    if (node === null) {
      return null
    }

    this.runFlipAwareMutation({
      movedChildId: input.childId,
      eventId: input.eventId,
      eventSeq: input.eventSeq,
      reason: input.reason,
      flip: input.flip,
      mutate: () => {
        if (this.refs) {
          this.adapter.removeChild(this.refs.items, node)
        }

        this.model.childNodeById.delete(input.childId)
        this.model.orderedChildIds = this.model.orderedChildIds.filter((id) => id !== input.childId)
        this.model.persistentPlacementByChildId.delete(input.childId)

        if (this.model.config.reorderOnRemove) {
          this.syncDomOrder()
        }
      }
    })

    return node
  }

  /**
   * Returns whether one child is currently attached in this list.
   */
  hasChild(childId: string): boolean {
    return this.model.childNodeById.has(childId)
  }

  /**
   * Returns this list runtime perso id.
   */
  getPersoId(): string {
    return this.persoId
  }

  /**
   * Returns one stable snapshot of attached children order.
   */
  getChildrenSnapshot(): string[] {
    return [...this.model.orderedChildIds]
  }

  /**
   * Emits one warning once for one {eventSeq, code} key.
   */
  warnOnce(eventSeq: number, code: string, details?: Record<string, unknown>): void {
    const key = `${eventSeq}:${code}`
    if (this.warningKeys.has(key)) {
      return
    }

    this.warningKeys.add(key)
    this.warn({ code, message: code, details })
  }

  /**
   * Applies one placement mode on one child id.
   */
  private applyPlacementMode(childId: string, mode: MoveMode): void {
    const currentIndex = this.model.orderedChildIds.indexOf(childId)
    if (currentIndex >= 0) {
      this.model.orderedChildIds.splice(currentIndex, 1)
    }

    if (mode === 'auto') {
      this.clearPersistentRule(childId)
      this.model.orderedChildIds.push(childId)
      return
    }

    if (mode === 'first') {
      this.setPersistentRule(childId, 'first')
      this.model.orderedChildIds.unshift(childId)
      this.rebuildFromPersistentRules()
      return
    }

    if (mode === 'last') {
      this.setPersistentRule(childId, 'last')
      this.model.orderedChildIds.push(childId)
      this.rebuildFromPersistentRules()
      return
    }

    this.clearPersistentRule(childId)

    if (mode === 'prepend') {
      this.model.orderedChildIds.unshift(childId)
      return
    }

    if (mode === 'append') {
      this.model.orderedChildIds.push(childId)
      return
    }

    const maxIndex = this.model.orderedChildIds.length
    const nextIndex = clamp(Math.floor(mode), 0, maxIndex)
    this.model.orderedChildIds.splice(nextIndex, 0, childId)
  }

  /**
   * Rebuilds one children order from persistent first/last rules.
   */
  private rebuildFromPersistentRules(): void {
    const firstIds = [...this.model.persistentPlacementByChildId.entries()]
      .filter((entry) => entry[1].mode === 'first')
      .sort((left, right) => left[1].insertedOrder - right[1].insertedOrder)
      .map((entry) => entry[0])

    const lastIds = [...this.model.persistentPlacementByChildId.entries()]
      .filter((entry) => entry[1].mode === 'last')
      .sort((left, right) => left[1].insertedOrder - right[1].insertedOrder)
      .map((entry) => entry[0])

    const constrained = new Set([...firstIds, ...lastIds])
    const middleIds = this.model.orderedChildIds.filter((childId) => !constrained.has(childId))
    this.model.orderedChildIds = [...firstIds, ...middleIds, ...lastIds]
  }

  /**
   * Synchronizes DOM order from model order.
   */
  private syncDomOrder(): void {
    if (this.refs === null) {
      return
    }

    for (const childId of this.model.orderedChildIds) {
      const childNode = this.model.childNodeById.get(childId)
      if (!childNode) {
        continue
      }

      this.adapter.appendChild(this.refs.items, childNode)
    }
  }

  /**
   * Sets one persistent first/last rule for one child id.
   */
  private setPersistentRule(childId: string, mode: 'first' | 'last'): void {
    this.model.persistentPlacementByChildId.set(childId, {
      mode,
      insertedOrder: this.model.nextPlacementOrder
    })
    this.model.nextPlacementOrder += 1
  }

  /**
   * Clears one persistent rule for one child id.
   */
  private clearPersistentRule(childId: string): void {
    this.model.persistentPlacementByChildId.delete(childId)
  }

  /**
   * Executes one mutation with FLIP bridge delegation when enabled.
   */
  private runFlipAwareMutation(input: {
    movedChildId: string
    eventId: string
    eventSeq: number
    reason: ListFlipTrigger['reason']
    flip?: boolean
    mutate: () => void
  }): void {
    const flipEnabled = input.flip !== false
    if (!flipEnabled) {
      input.mutate()
      return
    }

    const entries: ListFlipEntry[] = []
    for (const childId of this.model.orderedChildIds) {
      const nodeRef = this.model.childNodeById.get(childId)
      if (!nodeRef) {
        continue
      }

      entries.push({ childId, nodeRef })
    }

    this.flipBridge.run({
      listId: this.persoId,
      eventId: input.eventId,
      eventSeq: input.eventSeq,
      movedChildId: input.movedChildId,
      reason: input.reason,
      includeSize: true,
      includeTransformMatrix: true,
      entries,
      mutate: input.mutate
    })
  }
}

/**
 * Creates one move router aligned with child->parent placement.
 */
export function createListMoveRouter(input: {
  registry: ListComponentRegistry
  warn: WarningReporter
}): ListMoveRouter {
  const warningKeys = new Set<string>()

  /**
   * Emits one deduplicated warning for one {eventSeq, code} key.
   */
  function warnOnce(eventSeq: number, code: string, details?: Record<string, unknown>): void {
    const key = `${eventSeq}:${code}`
    if (warningKeys.has(key)) {
      return
    }

    warningKeys.add(key)
    input.warn({ code, message: code, details })
  }

  /**
   * Applies one move request for one arbitrary component instance.
   */
  function applyMoveForPerso(request: MoveRequest): void {
    const sourceListId = input.registry.getParentListId(request.persoId)
    const sourceList = sourceListId ? input.registry.getListById(sourceListId) : null
    const targetList = input.registry.getListById(request.move.parentId)

    if (targetList === null) {
      if (sourceList) {
        sourceList.detachChild({
          childId: request.persoId,
          flip: request.move.flip,
          eventId: request.eventId,
          eventSeq: request.eventSeq,
          reason: 'detach'
        })
      }

      input.registry.setParentListId(request.persoId, null)
      warnOnce(request.eventSeq, 'W_LIST_MOVE_TARGET_NOT_FOUND', {
        persoId: request.persoId,
        parentId: request.move.parentId,
        eventId: request.eventId
      })
      return
    }

    if (sourceList && sourceList.getPersoId() === targetList.getPersoId()) {
      targetList.repositionChild({
        childId: request.persoId,
        mode: request.move.mode,
        flip: request.move.flip,
        eventId: request.eventId,
        eventSeq: request.eventSeq,
        reason: request.move.mode === 'auto' ? 'auto' : 'local-move'
      })
      input.registry.setParentListId(request.persoId, targetList.getPersoId())
      return
    }

    let childNode: HTMLElement | null = null
    if (sourceList) {
      childNode = sourceList.detachChild({
        childId: request.persoId,
        flip: request.move.flip,
        eventId: request.eventId,
        eventSeq: request.eventSeq,
        reason: 'transfer-out'
      })
    }

    if (childNode === null) {
      childNode = input.registry.getPersoNodeById(request.persoId)
    }

    if (childNode === null) {
      input.registry.setParentListId(request.persoId, null)
      warnOnce(request.eventSeq, 'W_LIST_CHILD_NODE_NOT_FOUND', {
        persoId: request.persoId,
        eventId: request.eventId
      })
      return
    }

    targetList.attachChild({
      childId: request.persoId,
      childNode,
      mode: request.move.mode,
      flip: request.move.flip,
      eventId: request.eventId,
      eventSeq: request.eventSeq,
      reason: 'transfer-in'
    })

    input.registry.setParentListId(request.persoId, targetList.getPersoId())
  }

  /**
   * Applies one outro-driven detach chain using one single public event.
   */
  function detachAfterOutro(request: DetachAfterOutroRequest): void {
    request.runOutro(() => {
      const sourceListId = input.registry.getParentListId(request.persoId)
      const sourceList = sourceListId ? input.registry.getListById(sourceListId) : null
      if (sourceList) {
        sourceList.detachChild({
          childId: request.persoId,
          flip: true,
          eventId: request.eventId,
          eventSeq: request.eventSeq,
          reason: 'detach'
        })
      }

      input.registry.setParentListId(request.persoId, null)
    })
  }

  return {
    applyMoveForPerso,
    detachAfterOutro
  }
}

/**
 * Clamps one numeric value into one inclusive [min, max] range.
 */
function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min
  }

  if (value > max) {
    return max
  }

  return value
}

/**
 * Creates one default DOM adapter implementation for this list example.
 */
export function createDefaultDomListAdapter(): DomListAdapter {
  return {
    createFragmentFromTemplate: (template) => {
      const host = globalThis.document.createElement('template')
      host.innerHTML = template
      return host.content.cloneNode(true) as DocumentFragment
    },
    appendChild: (parent, child) => {
      parent.appendChild(child)
    },
    removeChild: (parent, child) => {
      parent.removeChild(child)
    },
    applyStyle: (node, patch) => {
      for (const [key, value] of Object.entries(patch)) {
        ;(node.style as unknown as Record<string, unknown>)[key] = value
      }
    },
    applyClassName: (node, patch) => {
      if (typeof patch === 'string') {
        node.className = patch
        return
      }

      const classSet = new Set(node.className.split(/\s+/).filter((token) => token.length > 0))
      for (const token of (patch.add ?? '').split(/\s+/)) {
        if (token.length > 0) {
          classSet.add(token)
        }
      }
      for (const token of (patch.remove ?? '').split(/\s+/)) {
        if (token.length > 0) {
          classSet.delete(token)
        }
      }
      node.className = [...classSet].join(' ')
    },
    applyAttr: (node, patch) => {
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === null || value === false) {
          node.removeAttribute(key)
          continue
        }

        node.setAttribute(key, String(value))
      }
    }
  }
}

/**
 * Creates one default FLIP bridge recorder for this example.
 */
export function createListFlipBridgeRecorder(trace: ListFlipTrigger[]): ListFlipBridge {
  return {
    run: (trigger) => {
      trace.push(trigger)
      trigger.mutate()
    }
  }
}

/**
 * Demonstrates one child->parent move flow with detached-first lifecycle.
 */
export function createListComponentInstantiationExample(): {
  listA: ListComponentExample
  listB: ListComponentExample
  rootA: HTMLElement
  rootB: HTMLElement
  warnings: ComponentWarning[]
  flipTriggers: ListFlipTrigger[]
  parentByPersoId: Map<string, string | null>
} {
  const warnings: ComponentWarning[] = []
  const flipTriggers: ListFlipTrigger[] = []
  const adapter = createDefaultDomListAdapter()
  const flipBridge = createListFlipBridgeRecorder(flipTriggers)

  const listById = new Map<string, ListComponentExample>()
  const nodeByPersoId = new Map<string, HTMLElement>()
  const parentByPersoId = new Map<string, string | null>()

  const registry: ListComponentRegistry = {
    getListById: (persoId) => {
      return listById.get(persoId) ?? null
    },
    getPersoNodeById: (persoId) => {
      return nodeByPersoId.get(persoId) ?? null
    },
    getParentListId: (persoId) => {
      return parentByPersoId.get(persoId) ?? null
    },
    setParentListId: (persoId, parentListId) => {
      parentByPersoId.set(persoId, parentListId)
    }
  }

  const moveRouter = createListMoveRouter({
    registry,
    warn: (warning) => {
      warnings.push(warning)
    }
  })

  const listA = new ListComponentExample({
    persoId: 'list-a',
    adapter,
    warn: (warning) => {
      warnings.push(warning)
    },
    flipBridge
  })

  const listB = new ListComponentExample({
    persoId: 'list-b',
    adapter,
    warn: (warning) => {
      warnings.push(warning)
    },
    flipBridge
  })

  listById.set('list-a', listA)
  listById.set('list-b', listB)

  nodeByPersoId.set('img-1', createExamplePersoNode('img-1'))
  nodeByPersoId.set('img-2', createExamplePersoNode('img-2'))
  nodeByPersoId.set('img-3', createExamplePersoNode('img-3'))

  parentByPersoId.set('img-1', null)
  parentByPersoId.set('img-2', null)
  parentByPersoId.set('img-3', null)

  listA.init({ className: 'gallery-a' })
  listB.init({ className: 'gallery-b' })

  const rootA = listA.render()
  const rootB = listB.render()

  // Detached -> mounted in list-a.
  moveRouter.applyMoveForPerso({
    persoId: 'img-1',
    move: { parentId: 'list-a', mode: 'append' },
    eventId: 'evt-1',
    eventSeq: 1
  })

  moveRouter.applyMoveForPerso({
    persoId: 'img-2',
    move: { parentId: 'list-a', mode: 'append' },
    eventId: 'evt-2',
    eventSeq: 2
  })

  // Local reorder in same parent list.
  moveRouter.applyMoveForPerso({
    persoId: 'img-2',
    move: { parentId: 'list-a', mode: 'first' },
    eventId: 'evt-3',
    eventSeq: 3
  })

  // Inter-list transfer.
  moveRouter.applyMoveForPerso({
    persoId: 'img-2',
    move: { parentId: 'list-b', mode: 'append' },
    eventId: 'evt-4',
    eventSeq: 4
  })

  // One-event outro -> detached lifecycle.
  moveRouter.detachAfterOutro({
    persoId: 'img-2',
    eventId: 'evt-5',
    eventSeq: 5,
    runOutro: (onDone) => {
      onDone()
    }
  })

  return {
    listA,
    listB,
    rootA,
    rootB,
    warnings,
    flipTriggers,
    parentByPersoId
  }
}

/**
 * Creates one sample node owned by one runtime component.
 */
function createExamplePersoNode(persoId: string): HTMLElement {
  const node = globalThis.document.createElement('li')
  node.dataset.persoId = persoId
  node.textContent = persoId
  return node
}
