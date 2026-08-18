import {
  MOVE_ORDER_MODE_APPEND,
  MOVE_ORDER_MODE_AUTO,
  MOVE_ORDER_MODE_FIRST,
  MOVE_ORDER_MODE_LAST,
  MOVE_ORDER_MODE_PREPEND,
  MOVE_OPERATION_UNMOUNT,
  type MoveOrderMode,
} from '../../config/move'
import type { MoveStateDelta } from '../../move'
import type { RuntimeModuleLayoutProjectionState, RuntimeModuleServiceDefinition } from '../../engine'
import type { SolvedScene } from '../../player/pipeline'

/** Runtime module identifier for the generic list capability. */
export const LIST_MODULE_SERVICE_ID = 'list' as const

/** Reorder policies owned by one list capability instance. */
export type ListCapabilityConfig = Readonly<{
  reorderOnMove?: boolean
  reorderOnAdd?: boolean
  reorderOnRemove?: boolean
}>

type ListItemState = {
  parentId?: string
  mounted: boolean
  mode?: MoveOrderMode
}

/** Pure list capability state consuming generic move deltas. */
export class ListCapabilityState {
  private readonly containers = new Map<string, ListCapabilityConfig>()
  private readonly children = new Map<string, string[]>()
  private readonly items = new Map<string, ListItemState>()
  private readonly pendingTouchedItemIds = new Set<string>()

  /** Registers one logical list target and its reorder policies. */
  registerContainer(id: string, config: ListCapabilityConfig = {}): void {
    this.containers.set(id, config)
    if (!this.children.has(id)) this.children.set(id, [])
  }

  /** Registers one detached item before the first mount delta. */
  registerDetachedItem(itemId: string): void {
    this.items.set(itemId, { mounted: false })
  }

  /** Rebuilds list-owned order from one solved scene before the first projection. */
  initializeScene(scene: SolvedScene): void {
    for (const perso of Object.values(scene.persos)) {
      if (perso.type === 'list') this.registerContainer(perso.persoId)
      this.items.set(perso.key, {
        parentId: perso.placement.targetId,
        mounted: perso.placement.mounted,
        mode: perso.placement.mode,
      })
    }
    for (const containerId of this.containers.keys()) {
      this.children.set(containerId, [...(scene.childrenByTarget[containerId] ?? [])])
    }
    this.pendingTouchedItemIds.clear()
  }

  /** Applies one generic core delta without touching a renderer. */
  applyDelta(delta: MoveStateDelta): void {
    const touched = new Set<string>([delta.persoKey])
    addChildren(this.children.get(delta.fromTargetId ?? ''), touched)
    addChildren(this.children.get(delta.toTargetId ?? ''), touched)
    const previous = this.items.get(delta.persoKey) ?? { mounted: delta.mountedBefore }
    const sourceConfig = delta.fromTargetId === undefined ? undefined : this.containers.get(delta.fromTargetId)
    const targetConfig = delta.toTargetId === undefined ? undefined : this.containers.get(delta.toTargetId)
    const sameContainer = delta.fromTargetId !== undefined && delta.fromTargetId === delta.toTargetId
    const mode = delta.toPlacement?.mode
    const explicitMode = mode !== undefined && mode !== MOVE_ORDER_MODE_AUTO && mode !== MOVE_ORDER_MODE_APPEND

    if (delta.fromTargetId !== undefined && !sameContainer) {
      this.removeChild(delta.fromTargetId, delta.persoKey)
      if (sourceConfig?.reorderOnRemove !== false) this.reorderContainer(delta.fromTargetId)
    }

    if (delta.operation === MOVE_OPERATION_UNMOUNT) {
      this.items.set(delta.persoKey, { mounted: false, mode: undefined })
      addChildren(this.children.get(delta.fromTargetId ?? ''), touched)
      this.addPendingTouched(touched)
      return
    }

    if (delta.toTargetId === undefined) {
      this.items.set(delta.persoKey, { mounted: delta.mountedAfter, mode })
      addChildren(this.children.get(delta.fromTargetId ?? ''), touched)
      this.addPendingTouched(touched)
      return
    }

    if (sameContainer) {
      const shouldReorder = explicitMode
        || (targetConfig?.reorderOnMove !== false && delta.toPlacement?.reorder !== false)
      if (shouldReorder) {
        this.removeChild(delta.toTargetId, delta.persoKey)
        this.insertChild(delta.toTargetId, delta.persoKey, mode)
      }
    } else {
      const shouldReorder = explicitMode
        || (targetConfig?.reorderOnAdd !== false && delta.toPlacement?.reorder !== false)
      this.insertChild(delta.toTargetId, delta.persoKey, shouldReorder ? mode : undefined)
    }

    this.items.set(delta.persoKey, {
      parentId: delta.toTargetId,
      mounted: delta.mountedAfter,
      mode: previous.mode === MOVE_ORDER_MODE_FIRST || previous.mode === MOVE_ORDER_MODE_LAST
        ? mode ?? previous.mode
        : mode,
    })
    addChildren(this.children.get(delta.fromTargetId ?? ''), touched)
    addChildren(this.children.get(delta.toTargetId), touched)
    this.addPendingTouched(touched)
  }

  /** Returns the current logical parent of one item. */
  getParentId(itemId: string): string | null {
    return this.items.get(itemId)?.parentId ?? null
  }

  /** Returns whether one item is currently mounted. */
  isMounted(itemId: string): boolean {
    return this.items.get(itemId)?.mounted === true
  }

  /** Returns an immutable child-order snapshot for one registered container. */
  getChildrenIds(containerId: string): readonly string[] {
    return [...(this.children.get(containerId) ?? [])]
  }

  /** Consumes authoritative order and touched-item data for one render commit. */
  consumeLayoutProjectionState(): RuntimeModuleLayoutProjectionState {
    const childrenByTarget = Object.fromEntries([...this.containers.keys()].map((containerId) => [
      containerId,
      [...(this.children.get(containerId) ?? [])],
    ]))
    const touchedItemIds = [...this.pendingTouchedItemIds]
    this.pendingTouchedItemIds.clear()
    return { childrenByTarget, touchedItemIds }
  }

  /** Removes one item from a container without changing item ownership. */
  private removeChild(containerId: string, itemId: string): void {
    const children = this.children.get(containerId)
    if (children === undefined) return
    const index = children.indexOf(itemId)
    if (index >= 0) children.splice(index, 1)
  }

  /** Inserts one item using the list-specific mode policy. */
  private insertChild(containerId: string, itemId: string, mode?: MoveOrderMode): void {
    const children = this.children.get(containerId)
    if (children === undefined || children.includes(itemId)) return
    if (mode === MOVE_ORDER_MODE_FIRST || mode === MOVE_ORDER_MODE_PREPEND) children.unshift(itemId)
    else if (mode === MOVE_ORDER_MODE_LAST || mode === MOVE_ORDER_MODE_APPEND) children.push(itemId)
    else if (typeof mode === 'number' && Number.isFinite(mode)) children.splice(clampIndex(mode, children.length), 0, itemId)
    else children.push(itemId)
  }

  /** Reapplies persistent ordering metadata after a removal. */
  private reorderContainer(containerId: string): void {
    const children = this.children.get(containerId)
    if (children === undefined) return
    for (const itemId of [...children]) {
      const mode = this.items.get(itemId)?.mode
      if (mode === MOVE_ORDER_MODE_FIRST || mode === MOVE_ORDER_MODE_PREPEND) this.moveChild(containerId, itemId, 0)
      else if (mode === MOVE_ORDER_MODE_LAST || mode === MOVE_ORDER_MODE_APPEND) this.moveChild(containerId, itemId, children.length)
    }
  }

  /** Moves one existing child to a bounded position. */
  private moveChild(containerId: string, itemId: string, index: number): void {
    this.removeChild(containerId, itemId)
    this.insertChild(containerId, itemId, index)
  }

  /** Adds one affected group to the pending render touched set. */
  private addPendingTouched(itemIds: ReadonlySet<string>): void {
    for (const itemId of itemIds) this.pendingTouchedItemIds.add(itemId)
  }
}

/** Creates one player-scoped runtime module around the pure list state. */
export function createListModuleServiceDefinition(): RuntimeModuleServiceDefinition {
  return {
    id: LIST_MODULE_SERVICE_ID,
    create: () => {
      const state = new ListCapabilityState()
      return {
        initializeScene: (scene) => state.initializeScene(scene),
        onMoveDelta: (delta) => state.applyDelta(delta),
        consumeLayoutProjectionState: () => state.consumeLayoutProjectionState(),
        destroy: () => undefined,
      }
    },
  }
}

/** Clamps one numeric list index to the current insertion range. */
function clampIndex(index: number, length: number): number {
  return Math.max(0, Math.min(Math.trunc(index), length))
}

/** Adds one existing child array to an affected-item set. */
function addChildren(children: readonly string[] | undefined, touched: Set<string>): void {
  if (children === undefined) return
  for (const itemId of children) touched.add(itemId)
}
