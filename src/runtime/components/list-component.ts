import { BaseComponent } from './base-component'
import {
  applyAttrProps,
  applyClassNameProps,
  applyStyleProps,
  createComponentRoot,
  resetComponentRoot,
  setComponentRootId
} from './lib'
import { appendDomChild, isDomElement, removeDomChild, resetRuntimeNodeState } from './dom-component-adapter'
import type { RuntimeComponentUpdateInput, RuntimeListComponent } from './types'
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

type ListState = {
  id?: unknown
  className?: string | { add?: string; remove?: string }
  style?: Record<string, unknown>
  attr?: Record<string, unknown>
  config?: unknown
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
 * Creates one non-DOM fallback node for list items.
 */
function createObjectItemsNode(): Record<string, unknown> {
  return {
    tagName: 'UL',
    style: {},
    attributes: {}
  }
}

/**
 * Implements the list component with internal child ordering.
 */
export class ListComponent extends BaseComponent implements RuntimeListComponent {
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
   * Initializes root and items containers used by this list.
   */
  init(initial: Record<string, unknown>): void {
    const state = initial as ListState

    this.rootNode ??= createComponentRoot(this.item, 'section', this.createElementOptions)
    resetComponentRoot(this.rootNode)
    this.childNodeById.clear()
    this.orderedChildIds = []
    this.persistentPlacementByChildId.clear()
    this.nextPlacementOrder = 1

    if (isDomElement(this.rootNode)) {
      const existingItemsNode = this.itemsNode ?? this.rootNode.querySelector('ul')
      this.itemsNode = existingItemsNode ?? globalThis.document.createElement('ul')
      appendDomChild(this.rootNode, this.itemsNode)
    } else {
      this.itemsNode ??= createObjectItemsNode()
    }

    resetRuntimeNodeState(this.itemsNode)

    setComponentRootId(this.rootNode, this.item.id, state.id)
    applyClassNameProps(this.rootNode, state.className)
    applyStyleProps(this.rootNode, state.style)
    applyAttrProps(this.rootNode, state.attr)

    this.reorderConfig = this.resolveReorderConfig(initial)
  }

  /**
   * Applies one aggregated root-level patch action.
   */
  update(input: RuntimeComponentUpdateInput): void {
    if (this.rootNode === null) {
      this.warn('RUNTIME_LIST_NOT_INITIALIZED', 'List component update rejected because init is missing', {
        eventId: input.eventId,
        eventSeq: input.eventSeq
      })
      return
    }

    const state = input.action as ListState

    applyClassNameProps(this.rootNode, state.className)
    applyStyleProps(this.rootNode, state.style, {
      skipTransitionValues: true
    })
    applyAttrProps(this.rootNode, state.attr)
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
      this.warn('RUNTIME_LIST_MOVE_COMPONENT_DETACHED', 'List move cannot reposition a detached child', {
        listId: this.item.id,
        childId: input.childId
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
    const rawConfig = (initial as ListState).config
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
