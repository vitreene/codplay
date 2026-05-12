import {
  appendDomChild,
  applyAttrPatch,
  applyClassNamePatch,
  applyNodeId,
  applyStylePatch,
  createRuntimeNode,
  isDomElement,
  removeDomChild,
  resetRuntimeNodeState
} from './dom-component-adapter'
import type {
  RuntimeComponentClassInput,
  RuntimeComponentUpdateInput,
  RuntimeListComponent
} from './types'
import type { MoveMode } from '../types'

type ReorderOperation = 'move' | 'add' | 'remove'

type ListReorderConfig = {
  reorderOnMove: boolean
  reorderOnAdd: boolean
  reorderOnRemove: boolean
}

type PersistentPlacementRule = {
  mode: 'first' | 'last'
  insertedOrder: number
}

/**
 * Clamps one numeric position into one inclusive range.
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
 * Implements the runtime list component with internal child ordering.
 */
export class ListRuntimeComponent implements RuntimeListComponent {
  private readonly input: RuntimeComponentClassInput
  private readonly item: RuntimeComponentClassInput['item']

  private rootNode: unknown | null = null
  private itemsNode: unknown | null = null

  private readonly childNodeById = new Map<string, unknown>()
  private orderedChildIds: string[] = []
  private readonly persistentPlacementByChildId = new Map<string, PersistentPlacementRule>()
  private nextPlacementOrder = 1
  private reorderConfig: ListReorderConfig = {
    reorderOnMove: true,
    reorderOnAdd: true,
    reorderOnRemove: true
  }

  /**
   * Creates one list component instance for one specific item.
   */
  constructor(input: RuntimeComponentClassInput) {
    this.input = input
    this.item = input.item
  }

  /**
   * Initializes root and items containers used by this list.
   */
  init(initial: Record<string, unknown>): void {
    try {
      this.rootNode = createRuntimeNode(this.item, 'section', this.input.createElementOptions)
      resetRuntimeNodeState(this.rootNode)

      if (isDomElement(this.rootNode)) {
        this.itemsNode = globalThis.document.createElement('ul')
        appendDomChild(this.rootNode, this.itemsNode)
      } else {
        this.itemsNode = {
          tagName: 'UL',
          style: {},
          attributes: {}
        }
      }

      resetRuntimeNodeState(this.itemsNode)

      applyNodeId(this.rootNode, typeof initial.id === 'string' ? initial.id : this.item.id)

      applyClassNamePatch(
        this.rootNode,
        typeof initial.className === 'string' || typeof initial.className === 'object'
          ? (initial.className as string | { add?: string; remove?: string })
          : undefined
      )

      applyStylePatch(
        this.rootNode,
        typeof initial.style === 'object' && initial.style !== null
          ? (initial.style as Record<string, unknown>)
          : undefined
      )

      applyAttrPatch(
        this.rootNode,
        typeof initial.attr === 'object' && initial.attr !== null
          ? (initial.attr as Record<string, unknown>)
          : undefined
      )

      this.reorderConfig = this.resolveReorderConfig(initial)
    } catch (error) {
      this.input.warn({
        code: 'RUNTIME_LIST_INIT_FAILED',
        message: 'List component init failed',
        details: {
          persoId: this.item.id,
          error: error instanceof Error ? error.message : 'unknown_error'
        }
      })
    }
  }

  /**
   * Returns the root node rendered by this list component.
   */
  render(): unknown {
    return this.rootNode
  }

  /**
   * Applies one aggregated root-level patch action.
   */
  update(input: RuntimeComponentUpdateInput): void {
    if (this.rootNode === null) {
      this.input.warn({
        code: 'RUNTIME_LIST_NOT_INITIALIZED',
        message: 'List component update rejected because init is missing',
        details: {
          persoId: input.persoId,
          eventId: input.eventId,
          eventSeq: input.eventSeq
        }
      })
      return
    }

    try {
      applyClassNamePatch(
        this.rootNode,
        typeof input.action.className === 'string' || typeof input.action.className === 'object'
          ? (input.action.className as string | { add?: string; remove?: string })
          : undefined
      )

      applyStylePatch(
        this.rootNode,
        typeof input.action.style === 'object' && input.action.style !== null
          ? (input.action.style as Record<string, unknown>)
          : undefined,
        {
          skipTransitionValues: true
        }
      )

      applyAttrPatch(
        this.rootNode,
        typeof input.action.attr === 'object' && input.action.attr !== null
          ? (input.action.attr as Record<string, unknown>)
          : undefined
      )
    } catch (error) {
      this.input.warn({
        code: 'RUNTIME_LIST_UPDATE_FAILED',
        message: 'List component update failed',
        details: {
          persoId: input.persoId,
          eventId: input.eventId,
          eventSeq: input.eventSeq,
          error: error instanceof Error ? error.message : 'unknown_error'
        }
      })
    }
  }

  /**
   * Returns runtime list id associated with this component.
   */
  getPersoId(): string {
    return this.item.id
  }

  /**
   * Returns one stable snapshot of child ids currently attached.
   */
  getChildrenSnapshot(): string[] {
    return [...this.orderedChildIds]
  }

  /**
   * Attaches one child node and applies requested placement mode.
   */
  attachChild(input: {
    childId: string
    childNode: unknown
    mode: MoveMode | undefined
    reorder?: boolean
    eventId: string
    eventSeq: number
  }): void {
    void input.eventId
    void input.eventSeq

    this.childNodeById.set(input.childId, input.childNode)
    if (!this.orderedChildIds.includes(input.childId)) {
      this.orderedChildIds.push(input.childId)
    }

    const mode = input.mode ?? 'append'
    if (!this.shouldApplyReorder('add', mode, input.reorder)) {
      if (this.itemsNode !== null) {
        appendDomChild(this.itemsNode, input.childNode)
      }

      return
    }

    this.applyPlacementMode(input.childId, mode)
    this.syncDomOrder()
  }

  /**
   * Repositions one child already attached in this list.
   */
  repositionChild(input: {
    childId: string
    mode: MoveMode | undefined
    reorder?: boolean
    eventId: string
    eventSeq: number
  }): void {
    void input.eventId
    void input.eventSeq

    if (!this.childNodeById.has(input.childId)) {
      this.input.warn({
        code: 'RUNTIME_LIST_MOVE_COMPONENT_DETACHED',
        message: 'List move cannot reposition a detached child',
        details: {
          listId: this.item.id,
          childId: input.childId
        }
      })
      return
    }

    const mode = input.mode ?? 'append'
    if (!this.shouldApplyReorder('move', mode, input.reorder)) {
      return
    }

    this.applyPlacementMode(input.childId, mode)
    this.syncDomOrder()
  }

  /**
   * Detaches one child from this list and returns its node when available.
   */
  detachChild(input: {
    childId: string
    mode: MoveMode | undefined
    reorder?: boolean
    eventId: string
    eventSeq: number
  }): unknown | null {
    void input.eventId
    void input.eventSeq

    const childNode = this.childNodeById.get(input.childId) ?? null
    if (childNode === null) {
      return null
    }

    if (this.itemsNode !== null) {
      removeDomChild(this.itemsNode, childNode)
    }

    this.childNodeById.delete(input.childId)
    this.orderedChildIds = this.orderedChildIds.filter((childId) => childId !== input.childId)
    this.persistentPlacementByChildId.delete(input.childId)

    const mode = input.mode ?? 'append'
    if (this.shouldApplyReorder('remove', mode, input.reorder)) {
      this.syncDomOrder()
    }

    return childNode
  }

  /**
   * Applies one list placement mode on one child id.
   */
  private applyPlacementMode(childId: string, mode: MoveMode): void {
    const currentIndex = this.orderedChildIds.indexOf(childId)
    if (currentIndex >= 0) {
      this.orderedChildIds.splice(currentIndex, 1)
    }

    if (mode === 'auto') {
      this.clearPersistentPlacementRule(childId)
      this.orderedChildIds.push(childId)
      return
    }

    if (mode === 'first') {
      this.setPersistentPlacementRule(childId, 'first')
      this.orderedChildIds.unshift(childId)
      this.rebuildOrderFromPersistentRules()
      return
    }

    if (mode === 'last') {
      this.setPersistentPlacementRule(childId, 'last')
      this.orderedChildIds.push(childId)
      this.rebuildOrderFromPersistentRules()
      return
    }

    this.clearPersistentPlacementRule(childId)

    if (mode === 'prepend') {
      this.orderedChildIds.unshift(childId)
      return
    }

    if (mode === 'append') {
      this.orderedChildIds.push(childId)
      return
    }

    const maxIndex = this.orderedChildIds.length
    const normalizedIndex = clamp(Math.floor(mode), 0, maxIndex)
    this.orderedChildIds.splice(normalizedIndex, 0, childId)
  }

  /**
   * Rebuilds one deterministic order from persistent first/last rules.
   */
  private rebuildOrderFromPersistentRules(): void {
    const firstIds = [...this.persistentPlacementByChildId.entries()]
      .filter((entry) => entry[1].mode === 'first')
      .sort((left, right) => left[1].insertedOrder - right[1].insertedOrder)
      .map((entry) => entry[0])

    const lastIds = [...this.persistentPlacementByChildId.entries()]
      .filter((entry) => entry[1].mode === 'last')
      .sort((left, right) => left[1].insertedOrder - right[1].insertedOrder)
      .map((entry) => entry[0])

    const constrainedIds = new Set([...firstIds, ...lastIds])
    const middleIds = this.orderedChildIds.filter((childId) => !constrainedIds.has(childId))
    this.orderedChildIds = [...firstIds, ...middleIds, ...lastIds]
  }

  /**
   * Synchronizes real DOM child order from runtime model order.
   */
  private syncDomOrder(): void {
    if (this.itemsNode === null) {
      return
    }

    for (const childId of this.orderedChildIds) {
      const childNode = this.childNodeById.get(childId)
      if (childNode === undefined) {
        continue
      }

      appendDomChild(this.itemsNode, childNode)
    }
  }

  /**
   * Stores one persistent placement rule for later reorder passes.
   */
  private setPersistentPlacementRule(childId: string, mode: 'first' | 'last'): void {
    this.persistentPlacementByChildId.set(childId, {
      mode,
      insertedOrder: this.nextPlacementOrder
    })
    this.nextPlacementOrder += 1
  }

  /**
   * Removes one persistent placement rule for one child id.
   */
  private clearPersistentPlacementRule(childId: string): void {
    this.persistentPlacementByChildId.delete(childId)
  }

  /**
   * Resolves list reorder policy from initial config with safe defaults.
   */
  private resolveReorderConfig(initial: Record<string, unknown>): ListReorderConfig {
    const rawConfig = initial.config
    if (typeof rawConfig !== 'object' || rawConfig === null) {
      return {
        reorderOnMove: true,
        reorderOnAdd: true,
        reorderOnRemove: true
      }
    }

    const config = rawConfig as Record<string, unknown>
    return {
      reorderOnMove: config.reorderOnMove !== false,
      reorderOnAdd: config.reorderOnAdd !== false,
      reorderOnRemove: config.reorderOnRemove !== false
    }
  }

  /**
   * Resolves whether reorder must run for one operation and move input.
   */
  private shouldApplyReorder(operation: ReorderOperation, mode: MoveMode, reorder: boolean | undefined): boolean {
    if (mode !== 'auto') {
      return true
    }

    if (reorder === false) {
      return false
    }

    if (operation === 'move') {
      return this.reorderConfig.reorderOnMove
    }

    if (operation === 'add') {
      return this.reorderConfig.reorderOnAdd
    }

    return this.reorderConfig.reorderOnRemove
  }
}
