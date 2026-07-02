import { BaseComponent } from './lib/base-component'
import { isDomNode } from './lib/dom-component-adapter'
import { RUNTIME_CONFIG } from '../config'
import type { MoveMode, PersoActionCommon, PersoInitialCommon } from '../perso-shared-types'
import type { RuntimeComponentClassInput } from './types'
import type { ComponentRenderResult, RuntimeComponentUpdateInput, RuntimeListComponent } from './types'

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

export type ListInitial = PersoInitialCommon & {
  tag?: unknown
  config?: unknown
}

export type ListAction = PersoActionCommon

/**
 * Clamps one numeric position into one inclusive range.
 */
function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

/**
 * Appends one child node to a DOM or object parent.
 */
function appendChildToNode(parentNode: unknown, childNode: unknown): void {
  if (isDomNode(parentNode) && isDomNode(childNode)) {
    parentNode.appendChild(childNode)
    return
  }

  if (typeof parentNode !== 'object' || parentNode === null || typeof childNode !== 'object' || childNode === null) {
    return
  }

  const mutableParent = parentNode as Record<string, unknown>
  const mutableChild = childNode as Record<string, unknown>

  if (typeof mutableChild.parentNode === 'object' && mutableChild.parentNode !== null) {
    removeChildFromNode(mutableChild.parentNode, mutableChild)
  }

  const currentChildren = Array.isArray(mutableParent.children) ? mutableParent.children : []
  mutableParent.children = currentChildren.filter((candidate) => candidate !== childNode).concat([childNode])
  mutableChild.parentNode = parentNode
}

/**
 * Removes one child node from a DOM or object parent.
 */
function removeChildFromNode(parentNode: unknown, childNode: unknown): void {
  if (isDomNode(parentNode) && isDomNode(childNode)) {
    parentNode.removeChild(childNode)
    return
  }

  if (typeof parentNode !== 'object' || parentNode === null || typeof childNode !== 'object' || childNode === null) {
    return
  }

  const mutableParent = parentNode as Record<string, unknown>
  const mutableChild = childNode as Record<string, unknown>
  const currentChildren = Array.isArray(mutableParent.children) ? mutableParent.children : []
  mutableParent.children = currentChildren.filter((candidate) => candidate !== childNode)

  if (mutableChild.parentNode === parentNode) {
    mutableChild.parentNode = null
  }
}

/**
 * Implements the list component with internal child ordering.
 */
export class ListComponent extends BaseComponent implements RuntimeListComponent {
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
   * Declares services and module capabilities.
   */
  constructor(input: RuntimeComponentClassInput) {
    super(input)
    this.modules.declare(['list'])
    this.services.declare(['className', 'style', 'attr'])
  }

  /**
   * Returns runtime list id associated with this component.
   */
  getPersoId(): string {
    return this.perso.id
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
      if (this.node !== null) {
        appendChildToNode(this.node, input.childNode)
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
      this.report('RUNTIME_LIST_MOVE_COMPONENT_DETACHED', 'List move cannot reposition a detached child', {
        listId: this.perso.id,
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

    if (this.node !== null) {
      removeChildFromNode(this.node, childNode)
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
    if (this.node === null) {
      return
    }

    for (const childId of this.orderedChildIds) {
      const childNode = this.childNodeById.get(childId)
      if (childNode === undefined) {
        continue
      }
      appendChildToNode(this.node, childNode)
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
  private resolveReorderConfig(state: ListInitial): ListReorderConfig {
    const rawConfig = state.config
    if (typeof rawConfig !== 'object' || rawConfig === null) {
      return { reorderOnMove: true, reorderOnAdd: true, reorderOnRemove: true }
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
    if (mode !== 'auto') return true
    if (reorder === false) return false
    if (operation === 'move') return this.reorderConfig.reorderOnMove
    if (operation === 'add') return this.reorderConfig.reorderOnAdd
    return this.reorderConfig.reorderOnRemove
  }

  /**
   * Applies one aggregated root-level patch action.
   */
  update(input: RuntimeComponentUpdateInput): void {
    this.services.apply(this.node, input.action, input.serviceContext)
  }

  /**
   * Initializes root and child containers. Reuses the existing root node on refresh.
   */
  render(): ComponentRenderResult {
    const state = this.perso.initial as ListInitial
    const tag = typeof state.tag === 'string' && state.tag.trim().length > 0
      ? state.tag
      : RUNTIME_CONFIG.list.defaultTagName
    const rootNode = this.buildNode(tag)

    this.childNodeById.clear()
    this.orderedChildIds = []
    this.persistentPlacementByChildId.clear()
    this.nextPlacementOrder = 1

    this.services.apply(rootNode, this.perso.initial)
    this.reorderConfig = this.resolveReorderConfig(state)

    return rootNode as Node
  }
}
