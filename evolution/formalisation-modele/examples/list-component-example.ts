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
  version: '0.2.0',
  status: 'draft',
  updatedAt: '2026-04-17'
}

/**
 * Represents one warning emitted by a permissive component.
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
 * Represents one geometric snapshot used for FLIP deltas.
 */
export type NodeRect = {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Represents one child FLIP delta from before/after snapshots.
 */
export type FlipChildDelta = {
  childId: string
  from: NodeRect
  to: NodeRect
  translateX: number
  translateY: number
}

/**
 * Represents one FLIP plan emitted by the list component.
 */
export type ListFlipPlan = {
  listId: string
  eventId: string
  eventSeq: number
  movedChildId: string
  reason: 'local-move' | 'transfer-in' | 'transfer-out' | 'auto'
  deltas: FlipChildDelta[]
}

/**
 * Receives one FLIP plan emitted by the list component.
 */
export type FlipPlanReporter = (plan: ListFlipPlan) => void

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
  measureRect: (node: HTMLElement) => NodeRect
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
 * Defines list move mode values agreed in current study.
 */
export type ListMoveMode = 'auto' | 'first' | 'last' | 'append' | 'prepend' | number

/**
 * Defines one list move command for one child perso.
 */
export type ListMoveCommand = {
  childId: string
  mode: ListMoveMode
  targetId?: string
  flip?: boolean
  reorder?: boolean
}

/**
 * Defines one child collection patch command.
 */
export type ListChildrenPatch = {
  add?: string[]
  remove?: string[]
}

/**
 * Defines the full action shape supported by ListComponentExample.
 */
export type ListAction = BasePatch & {
  partId?: 'root' | 'items'
  move?: ListMoveCommand
  children?: ListChildrenPatch
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
 * Defines one minimal runtime registry used for transfers and child node resolution.
 */
export type ListComponentRegistry = {
  getListById: (persoId: string) => ListComponentExample | null
  getPersoNodeById: (persoId: string) => HTMLElement | null
}

/**
 * Stores internal node references for one list instance.
 */
type ListRefs = {
  root: HTMLElement
  byPartId: Map<'root' | 'items', HTMLElement>
}

/**
 * Stores one persistent placement rule for one child item.
 */
type PersistentPlacementRule = {
  mode: 'first' | 'last'
  insertedOrder: number
}

/**
 * Stores mutable list state owned by one component instance.
 */
type ListModel = {
  childrenPersoIds: string[]
  persistentPlacementByChildId: Map<string, PersistentPlacementRule>
  childNodeById: Map<string, HTMLElement>
  nextPlacementOrder: number
  config: ListConfig
  lastFlipPlan: ListFlipPlan | null
}

/**
 * Applies shared style/className/attr patches.
 */
class BasePatchLayer {
  /**
   * Keeps adapter used to apply DOM patches.
   */
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
 * Handles list move rules, reorder, transfer orchestration, and FLIP plans.
 */
class ListMoveLayer {
  /**
   * Points to parent component instance.
   */
  private readonly parent: ListComponentExample

  /**
   * Points to shared mutable list model.
   */
  private readonly model: ListModel

  /**
   * Points to shared DOM references.
   */
  private readonly refs: ListRefs

  /**
   * Points to adapter used for DOM operations.
   */
  private readonly adapter: DomListAdapter

  /**
   * Creates one move layer bound to parent/model/refs/adapter.
   */
  constructor(parent: ListComponentExample, model: ListModel, refs: ListRefs, adapter: DomListAdapter) {
    this.parent = parent
    this.model = model
    this.refs = refs
    this.adapter = adapter
  }

  /**
   * Applies one move command using current list policies.
   */
  apply(
    command: ListMoveCommand,
    eventSeq: number,
    eventId: string,
    reasonOverride: 'local-move' | 'transfer-in' = 'local-move'
  ): void {
    if (!this.model.childNodeById.has(command.childId)) {
      this.parent.warnOnce(eventSeq, 'W_LIST_MOVE_CHILD_NOT_FOUND', {
        persoId: this.parent.getPersoId(),
        eventId,
        childId: command.childId
      })
      return
    }

    const targetId = command.targetId ?? this.parent.getPersoId()
    if (targetId !== this.parent.getPersoId()) {
      this.transferToTargetList(command, targetId, eventSeq, eventId)
      return
    }

    this.applyLocalMove(command, eventSeq, eventId, reasonOverride)
  }

  /**
   * Applies one move command inside current list instance.
   */
  private applyLocalMove(
    command: ListMoveCommand,
    eventSeq: number,
    eventId: string,
    reason: 'local-move' | 'transfer-in'
  ): void {
    const flipEnabled = command.flip !== false
    const beforeRects = flipEnabled ? this.captureRects() : new Map<string, NodeRect>()

    if (command.mode === 'auto') {
      this.clearPersistentRule(command.childId)
      if (flipEnabled) {
        this.emitFlipPlan(command.childId, eventSeq, eventId, 'auto', beforeRects)
      }
      return
    }

    if (command.mode === 'first' || command.mode === 'last') {
      this.setPersistentRule(command.childId, command.mode)
    } else {
      this.clearPersistentRule(command.childId)
    }

    this.moveChildByMode(command.childId, command.mode)

    // In current study, mode has priority over reorder override.
    const shouldReorder = true
    if (shouldReorder || this.model.config.reorderOnMove) {
      this.rebuildChildrenFromRules()
    }

    if (flipEnabled) {
      this.emitFlipPlan(command.childId, eventSeq, eventId, reason, beforeRects)
    }
  }

  /**
   * Applies one inter-list transfer using remove -> reparent -> add sequence.
   */
  private transferToTargetList(command: ListMoveCommand, targetListId: string, eventSeq: number, eventId: string): void {
    const targetList = this.parent.getRegistry().getListById(targetListId)
    if (targetList === null) {
      this.parent.warnOnce(eventSeq, 'W_LIST_MOVE_TARGET_NOT_FOUND', {
        persoId: this.parent.getPersoId(),
        eventId,
        targetId: targetListId,
        childId: command.childId
      })
      return
    }

    const childNode = this.model.childNodeById.get(command.childId)
    if (!childNode) {
      this.parent.warnOnce(eventSeq, 'W_LIST_MOVE_CHILD_NOT_FOUND', {
        persoId: this.parent.getPersoId(),
        eventId,
        childId: command.childId
      })
      return
    }

    const flipEnabled = command.flip !== false
    const beforeRects = flipEnabled ? this.captureRects() : new Map<string, NodeRect>()

    this.detachLocalChild(command.childId)

    if (flipEnabled) {
      this.emitFlipPlan(command.childId, eventSeq, eventId, 'transfer-out', beforeRects)
    }

    targetList.receiveTransferredChild({
      childId: command.childId,
      childNode,
      mode: command.mode,
      sourceListId: this.parent.getPersoId(),
      flip: command.flip,
      reorder: command.reorder,
      eventSeq,
      eventId
    })
  }

  /**
   * Detaches one child from this list model and DOM.
   */
  private detachLocalChild(childId: string): void {
    const node = this.model.childNodeById.get(childId)
    if (node) {
      this.adapter.removeChild(this.refs.byPartId.get('items') as HTMLElement, node)
    }

    this.model.childNodeById.delete(childId)
    this.model.childrenPersoIds = this.model.childrenPersoIds.filter((id) => id !== childId)
    this.clearPersistentRule(childId)

    if (this.model.config.reorderOnRemove) {
      this.rebuildChildrenFromRules()
    }
  }

  /**
   * Moves one child id according to mode within current children array.
   */
  private moveChildByMode(childId: string, mode: ListMoveMode): void {
    const currentIndex = this.model.childrenPersoIds.indexOf(childId)
    if (currentIndex < 0) {
      return
    }

    this.model.childrenPersoIds.splice(currentIndex, 1)

    if (mode === 'first' || mode === 'prepend') {
      this.model.childrenPersoIds.unshift(childId)
      return
    }

    if (mode === 'last' || mode === 'append') {
      this.model.childrenPersoIds.push(childId)
      return
    }

    if (typeof mode === 'number') {
      const maxIndex = this.model.childrenPersoIds.length
      const nextIndex = clamp(Math.floor(mode), 0, maxIndex)
      this.model.childrenPersoIds.splice(nextIndex, 0, childId)
      return
    }

    this.model.childrenPersoIds.push(childId)
  }

  /**
   * Rebuilds children order by applying persistent first/last rules.
   */
  private rebuildChildrenFromRules(): void {
    const firstIds = [...this.model.persistentPlacementByChildId.entries()]
      .filter((entry) => entry[1].mode === 'first')
      .sort((left, right) => left[1].insertedOrder - right[1].insertedOrder)
      .map((entry) => entry[0])

    const lastIds = [...this.model.persistentPlacementByChildId.entries()]
      .filter((entry) => entry[1].mode === 'last')
      .sort((left, right) => left[1].insertedOrder - right[1].insertedOrder)
      .map((entry) => entry[0])

    const constrained = new Set([...firstIds, ...lastIds])
    const middleIds = this.model.childrenPersoIds.filter((id) => !constrained.has(id))
    this.model.childrenPersoIds = [...firstIds, ...middleIds, ...lastIds]

    this.syncDomOrder()
  }

  /**
   * Reorders child DOM nodes to match model children order.
   */
  private syncDomOrder(): void {
    const itemsNode = this.refs.byPartId.get('items') as HTMLElement
    for (const childId of this.model.childrenPersoIds) {
      const node = this.model.childNodeById.get(childId)
      if (node) {
        this.adapter.appendChild(itemsNode, node)
      }
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
   * Clears one persistent placement rule for one child id.
   */
  private clearPersistentRule(childId: string): void {
    this.model.persistentPlacementByChildId.delete(childId)
  }

  /**
   * Captures one map of child rectangles from current DOM state.
   */
  private captureRects(): Map<string, NodeRect> {
    const result = new Map<string, NodeRect>()
    for (const childId of this.model.childrenPersoIds) {
      const node = this.model.childNodeById.get(childId)
      if (!node) {
        continue
      }

      result.set(childId, this.adapter.measureRect(node))
    }

    return result
  }

  /**
   * Builds and emits one FLIP plan from before/after snapshots.
   */
  private emitFlipPlan(
    movedChildId: string,
    eventSeq: number,
    eventId: string,
    reason: ListFlipPlan['reason'],
    beforeRects: Map<string, NodeRect>
  ): void {
    const afterRects = this.captureRects()
    const deltas: FlipChildDelta[] = []

    for (const [childId, before] of beforeRects.entries()) {
      const after = afterRects.get(childId)
      if (!after) {
        continue
      }

      const translateX = before.x - after.x
      const translateY = before.y - after.y
      if (translateX === 0 && translateY === 0) {
        continue
      }

      deltas.push({
        childId,
        from: before,
        to: after,
        translateX,
        translateY
      })
    }

    if (deltas.length === 0) {
      return
    }

    this.parent.pushFlipPlan({
      listId: this.parent.getPersoId(),
      eventId,
      eventSeq,
      movedChildId,
      reason,
      deltas
    })
  }
}

const LIST_TEMPLATE = `
<section data-part="root" class="list-component">
  <ul data-part="items" class="list-items"></ul>
</section>
`

/**
 * Example list component using composition layers and one aggregated update entry point.
 */
export class ListComponentExample {
  /**
   * Declares action properties handled by this component.
   */
  static readonly handledProps = ['move', 'children']

  /**
   * Stores current runtime perso id for this list instance.
   */
  private readonly persoId: string

  /**
   * Stores adapter used for all DOM operations.
   */
  private readonly adapter: DomListAdapter

  /**
   * Stores warning reporter bound to player traces.
   */
  private readonly warn: WarningReporter

  /**
   * Stores FLIP plan reporter bound to animation pipeline.
   */
  private readonly emitFlipPlan: FlipPlanReporter

  /**
   * Stores registry used for cross-list transfers and child node resolution.
   */
  private readonly registry: ListComponentRegistry

  /**
   * Stores root and part references after init.
   */
  private refs: ListRefs | null = null

  /**
   * Stores mutable list state updated by component actions.
   */
  private readonly model: ListModel

  /**
   * Applies shared base patch operations.
   */
  private basePatchLayer: BasePatchLayer | null = null

  /**
   * Applies list move operations and transfer logic.
   */
  private moveLayer: ListMoveLayer | null = null

  /**
   * Deduplicates warnings by {eventSeq, code}.
   */
  private readonly warningKeys = new Set<string>()

  /**
   * Creates one list component instance for one runtime perso.
   */
  constructor(input: {
    persoId: string
    adapter: DomListAdapter
    warn: WarningReporter
    emitFlipPlan: FlipPlanReporter
    registry: ListComponentRegistry
    config?: Partial<ListConfig>
  }) {
    this.persoId = input.persoId
    this.adapter = input.adapter
    this.warn = input.warn
    this.emitFlipPlan = input.emitFlipPlan
    this.registry = input.registry

    this.model = {
      childrenPersoIds: [],
      persistentPlacementByChildId: new Map<string, PersistentPlacementRule>(),
      childNodeById: new Map<string, HTMLElement>(),
      nextPlacementOrder: 1,
      lastFlipPlan: null,
      config: {
        reorderOnMove: input.config?.reorderOnMove ?? true,
        reorderOnAdd: input.config?.reorderOnAdd ?? true,
        reorderOnRemove: input.config?.reorderOnRemove ?? true
      }
    }
  }

  /**
   * Initializes list root, parts, layers, and initial children state.
   */
  init(initial: Record<string, unknown>): void {
    const fragment = this.adapter.createFragmentFromTemplate(LIST_TEMPLATE)
    const rootNode = fragment.firstElementChild
    if (!(rootNode instanceof HTMLElement)) {
      this.warnOnce(0, 'W_LIST_INIT_FAILED', {
        persoId: this.persoId,
        reason: 'root-missing'
      })
      return
    }

    this.refs = {
      root: rootNode,
      byPartId: collectListParts(rootNode)
    }

    this.basePatchLayer = new BasePatchLayer(this.adapter)
    this.moveLayer = new ListMoveLayer(this, this.model, this.refs, this.adapter)

    const initialChildren = Array.isArray(initial.children)
      ? initial.children.filter((value): value is string => typeof value === 'string')
      : []

    for (const childId of initialChildren) {
      this.addChild(childId)
    }
  }

  /**
   * Returns root node after successful initialization.
   */
  render(): HTMLElement {
    if (!this.refs) {
      throw new Error(`List component not initialized: ${this.persoId}`)
    }

    return this.refs.root
  }

  /**
   * Applies one aggregated list action payload.
   */
  update(input: ComponentUpdateInput): void {
    try {
      if (!this.refs || !this.basePatchLayer || !this.moveLayer) {
        this.warnOnce(input.eventSeq, 'W_LIST_NOT_INITIALIZED', {
          persoId: this.persoId,
          eventId: input.eventId
        })
        return
      }

      const action = input.action as ListAction

      if (action.children) {
        this.applyChildrenPatch(action.children)
      }

      if (action.move) {
        this.moveLayer.apply(action.move, input.eventSeq, input.eventId)
      }

      const partId = action.partId ?? 'root'
      const targetNode = this.refs.byPartId.get(partId)
      if (!targetNode) {
        this.warnOnce(input.eventSeq, 'W_LIST_PART_UNKNOWN', {
          persoId: this.persoId,
          eventId: input.eventId,
          partId
        })
        return
      }

      this.basePatchLayer.apply(targetNode, action)
    } catch (error) {
      this.warnOnce(input.eventSeq, 'W_LIST_UPDATE_FAILED', {
        persoId: this.persoId,
        eventId: input.eventId,
        message: error instanceof Error ? error.message : 'Unknown update error'
      })
    }
  }

  /**
   * Receives one child transfer from another list instance.
   */
  receiveTransferredChild(input: {
    childId: string
    childNode: HTMLElement
    mode: ListMoveMode
    sourceListId: string
    flip?: boolean
    reorder?: boolean
    eventSeq: number
    eventId: string
  }): void {
    this.model.childNodeById.set(input.childId, input.childNode)
    if (!this.model.childrenPersoIds.includes(input.childId)) {
      this.model.childrenPersoIds.push(input.childId)
    }

    const itemsNode = this.refs?.byPartId.get('items')
    if (itemsNode) {
      this.adapter.appendChild(itemsNode, input.childNode)
    }

    if (this.moveLayer) {
      this.moveLayer.apply(
        {
          childId: input.childId,
          mode: input.mode,
          flip: input.flip,
          reorder: input.reorder
        },
        input.eventSeq,
        input.eventId,
        'transfer-in'
      )
    }
  }

  /**
   * Returns current list children snapshot.
   */
  getChildrenSnapshot(): string[] {
    return [...this.model.childrenPersoIds]
  }

  /**
   * Returns last FLIP plan generated by this component.
   */
  getLastFlipPlan(): ListFlipPlan | null {
    return this.model.lastFlipPlan
  }

  /**
   * Returns this list runtime perso id.
   */
  getPersoId(): string {
    return this.persoId
  }

  /**
   * Returns registry used for cross-list operations.
   */
  getRegistry(): ListComponentRegistry {
    return this.registry
  }

  /**
   * Stores and emits one FLIP plan.
   */
  pushFlipPlan(plan: ListFlipPlan): void {
    this.model.lastFlipPlan = plan
    this.emitFlipPlan(plan)
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
   * Applies one add/remove child patch command.
   */
  private applyChildrenPatch(patch: ListChildrenPatch): void {
    const removeIds = patch.remove ?? []
    for (const childId of removeIds) {
      this.removeChild(childId)
    }

    const addIds = patch.add ?? []
    for (const childId of addIds) {
      this.addChild(childId)
    }
  }

  /**
   * Adds one child perso id and attaches its existing perso node.
   */
  private addChild(childId: string): void {
    if (this.model.childrenPersoIds.includes(childId)) {
      return
    }

    const childNode = this.registry.getPersoNodeById(childId)
    if (!childNode) {
      this.warnOnce(0, 'W_LIST_CHILD_NODE_NOT_FOUND', {
        persoId: this.persoId,
        childId
      })
      return
    }

    this.model.childrenPersoIds.push(childId)
    this.model.childNodeById.set(childId, childNode)

    const itemsNode = this.refs?.byPartId.get('items')
    if (itemsNode) {
      this.adapter.appendChild(itemsNode, childNode)
    }
  }

  /**
   * Removes one child id and its node from current list.
   */
  private removeChild(childId: string): void {
    const node = this.model.childNodeById.get(childId)
    const itemsNode = this.refs?.byPartId.get('items')
    if (node && itemsNode) {
      this.adapter.removeChild(itemsNode, node)
    }

    this.model.childNodeById.delete(childId)
    this.model.childrenPersoIds = this.model.childrenPersoIds.filter((id) => id !== childId)
    this.model.persistentPlacementByChildId.delete(childId)
  }
}

/**
 * Collects list parts from data-part attributes.
 */
function collectListParts(root: HTMLElement): Map<'root' | 'items', HTMLElement> {
  const byPartId = new Map<'root' | 'items', HTMLElement>()
  const pending: HTMLElement[] = [root]

  while (pending.length > 0) {
    const node = pending.pop()
    if (!node) {
      continue
    }

    const partId = node.dataset.part
    if (partId === 'root' || partId === 'items') {
      byPartId.set(partId, node)
    }

    for (const child of [...node.children]) {
      if (child instanceof HTMLElement) {
        pending.push(child)
      }
    }
  }

  return byPartId
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
    },
    measureRect: (node) => {
      const rect = node.getBoundingClientRect()
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      }
    }
  }
}

/**
 * Demonstrates one instantiation flow with two list components and one transfer.
 */
export function createListComponentInstantiationExample(): {
  listA: ListComponentExample
  listB: ListComponentExample
  rootA: HTMLElement
  rootB: HTMLElement
  warnings: ComponentWarning[]
  flipPlans: ListFlipPlan[]
} {
  const warnings: ComponentWarning[] = []
  const flipPlans: ListFlipPlan[] = []
  const adapter = createDefaultDomListAdapter()

  const listById = new Map<string, ListComponentExample>()
  const nodeByPersoId = new Map<string, HTMLElement>()

  const registry: ListComponentRegistry = {
    getListById: (persoId) => {
      return listById.get(persoId) ?? null
    },
    getPersoNodeById: (persoId) => {
      return nodeByPersoId.get(persoId) ?? null
    }
  }

  const listA = new ListComponentExample({
    persoId: 'list-a',
    adapter,
    registry,
    warn: (warning) => {
      warnings.push(warning)
    },
    emitFlipPlan: (plan) => {
      flipPlans.push(plan)
    }
  })

  const listB = new ListComponentExample({
    persoId: 'list-b',
    adapter,
    registry,
    warn: (warning) => {
      warnings.push(warning)
    },
    emitFlipPlan: (plan) => {
      flipPlans.push(plan)
    }
  })

  listById.set('list-a', listA)
  listById.set('list-b', listB)

  nodeByPersoId.set('item-1', createExamplePersoNode('item-1'))
  nodeByPersoId.set('item-2', createExamplePersoNode('item-2'))
  nodeByPersoId.set('item-3', createExamplePersoNode('item-3'))
  nodeByPersoId.set('item-9', createExamplePersoNode('item-9'))

  listA.init({ children: ['item-1', 'item-2', 'item-3'] })
  listB.init({ children: ['item-9'] })

  const rootA = listA.render()
  const rootB = listB.render()

  listA.update({
    persoId: 'list-a',
    eventId: 'evt-transfer-1',
    eventSeq: 1,
    action: {
      move: {
        childId: 'item-2',
        mode: 'append',
        targetId: 'list-b'
      }
    }
  })

  listB.update({
    persoId: 'list-b',
    eventId: 'evt-order-1',
    eventSeq: 2,
    action: {
      move: {
        childId: 'item-2',
        mode: 'first'
      }
    }
  })

  return {
    listA,
    listB,
    rootA,
    rootB,
    warnings,
    flipPlans
  }
}

/**
 * Creates one sample perso node owned by one child perso.
 */
function createExamplePersoNode(persoId: string): HTMLElement {
  const node = globalThis.document.createElement('li')
  node.dataset.persoId = persoId
  node.textContent = persoId
  return node
}
