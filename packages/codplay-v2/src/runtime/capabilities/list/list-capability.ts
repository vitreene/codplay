import { isPlainRecord } from '../../../shared'
import type { CompiledScene, CompiledRecord } from '../../../scene/compiled'
import type {
  RuntimeModuleServiceDefinition,
} from '../../catalog'
import type {
  RuntimeModuleServiceInstance,
  RuntimeStructuralOrder,
} from '../../engine'
import type { MoveOrderMode } from '../../config/move'
import {
  applyStructuralDeltas,
  type StructuralOrderDeltaContext,
  type StructuralOrderPolicy,
} from '../../player/structural-timeline'
import type { MoveStateDelta } from '../../move'
import type { SolvedScene } from '../../player/pipeline'

/** Runtime module identifier for components declaring the list capability. */
export const LIST_MODULE_SERVICE_ID = 'list' as const

/** Reordering policy applied by one list host to automatic placements. */
export type ListReorderConfig = Readonly<{
  reorderOnMove: boolean
  reorderOnAdd: boolean
  reorderOnRemove: boolean
}>

type PersistentPlacementRule = Readonly<{
  targetId: string
  mode: 'first' | 'last'
  insertedOrder: number
}>

/** Player-scoped list capability used by the structural order boundary. */
export type ListModuleServiceInstance = RuntimeModuleServiceInstance & Readonly<{
  getReorderConfig: (targetId: string) => ListReorderConfig
  resolveStructuralOrder: (
    previousOrder: RuntimeStructuralOrder,
    scene: SolvedScene,
    deltas: readonly MoveStateDelta[],
  ) => RuntimeStructuralOrder
}>

/** Default list policy: automatic placements reorder for every list operation. */
export const DEFAULT_LIST_REORDER_CONFIG: ListReorderConfig = Object.freeze({
  reorderOnMove: true,
  reorderOnAdd: true,
  reorderOnRemove: true,
})

/** Pure player-scoped state for list targets and their reorder policies. */
export class ListCapabilityState {
  private readonly reorderConfigByTargetId = new Map<string, ListReorderConfig>()
  private readonly persistentPlacementByPersoKey = new Map<string, PersistentPlacementRule>()
  private readonly targetsToReorder = new Set<string>()
  private nextPlacementOrder = 1

  /** Registers every list host declared by the compiled scene. */
  constructor(compiledScene: CompiledScene) {
    for (const story of Object.values(compiledScene.scene.stories)) {
      for (const perso of story.persos) {
        if (perso.type !== 'list' && perso.list === undefined) continue
        this.registerList(perso.id, readReorderConfig(perso.initial))
      }
    }
  }

  /** Registers or replaces one list target configuration within this player. */
  registerList(targetId: string, config: Partial<ListReorderConfig> = {}): void {
    if (targetId.trim().length === 0) throw new Error('List target ID must not be empty.')
    this.reorderConfigByTargetId.set(targetId, normalizeReorderConfig(config))
  }

  /** Returns one list policy, falling back to the all-enabled default. */
  getReorderConfig(targetId: string): ListReorderConfig {
    return this.reorderConfigByTargetId.get(targetId) ?? DEFAULT_LIST_REORDER_CONFIG
  }

  /** Resolves one complete structural order without reading or mutating a node. */
  resolveStructuralOrder(
    previousOrder: RuntimeStructuralOrder,
    scene: SolvedScene,
    deltas: readonly MoveStateDelta[],
  ): RuntimeStructuralOrder {
    this.targetsToReorder.clear()
    const policy: StructuralOrderPolicy = {
      shouldReorder: (operation, targetId, mode, reorder) => {
        if (targetId === undefined) return reorder !== false
        return this.shouldApplyReorder(operation, targetId, mode, reorder)
      },
      onDelta: (delta, context) => this.updatePersistentPlacement(delta, context),
      resolveTargetOrder: (targetId, itemIds) => this.resolvePersistentOrder(targetId, itemIds),
    }
    try {
      return applyStructuralDeltas(previousOrder, scene, deltas, policy)
    } finally {
      this.targetsToReorder.clear()
    }
  }

  /** Releases all player-scoped list declarations at final teardown. */
  clear(): void {
    this.reorderConfigByTargetId.clear()
    this.resetStructuralHistory()
  }

  /** Resets only historical placement metadata before a timeline rebuild. */
  resetStructuralHistory(): void {
    this.persistentPlacementByPersoKey.clear()
    this.targetsToReorder.clear()
    this.nextPlacementOrder = 1
  }

  /** Updates first/last rules after one accepted structural placement. */
  private updatePersistentPlacement(
    delta: MoveStateDelta,
    context: StructuralOrderDeltaContext,
  ): void {
    const targetId = delta.toTargetId
    const sourceChanged = delta.fromTargetId !== undefined && delta.fromTargetId !== targetId
    if (context.targetReordered && targetId !== undefined && this.reorderConfigByTargetId.has(targetId)) {
      this.targetsToReorder.add(targetId)
    }
    if (context.sourceReordered
      && delta.fromTargetId !== undefined
      && (delta.operation === 'unmount' || sourceChanged)
      && this.reorderConfigByTargetId.has(delta.fromTargetId)) {
      this.targetsToReorder.add(delta.fromTargetId)
    }
    if (delta.operation === 'unmount' || sourceChanged) {
      this.persistentPlacementByPersoKey.delete(delta.persoKey)
    }
    if (!context.targetReordered || targetId === undefined || !this.reorderConfigByTargetId.has(targetId)) return

    const mode = delta.toPlacement?.mode
    if (mode !== 'first' && mode !== 'last') {
      this.persistentPlacementByPersoKey.delete(delta.persoKey)
      return
    }
    this.persistentPlacementByPersoKey.set(delta.persoKey, {
      targetId,
      mode,
      insertedOrder: this.nextPlacementOrder,
    })
    this.nextPlacementOrder += 1
  }

  /** Rebuilds one list order from the persistent first/last rules. */
  private resolvePersistentOrder(targetId: string, itemIds: readonly string[]): readonly string[] {
    if (!this.reorderConfigByTargetId.has(targetId) || !this.targetsToReorder.has(targetId)) return itemIds
    const firstIds = [...this.persistentPlacementByPersoKey.entries()]
      .filter(([persoKey, rule]) => rule.targetId === targetId && rule.mode === 'first' && itemIds.includes(persoKey))
      .sort((left, right) => left[1].insertedOrder - right[1].insertedOrder)
      .map(([persoKey]) => persoKey)
    const lastIds = [...this.persistentPlacementByPersoKey.entries()]
      .filter(([persoKey, rule]) => rule.targetId === targetId && rule.mode === 'last' && itemIds.includes(persoKey))
      .sort((left, right) => left[1].insertedOrder - right[1].insertedOrder)
      .map(([persoKey]) => persoKey)
    const constrained = new Set([...firstIds, ...lastIds])
    const middleIds = itemIds.filter((persoKey) => !constrained.has(persoKey))
    return [...firstIds, ...middleIds, ...lastIds]
  }

  /** Applies the automatic-reorder rule while honoring explicit modes. */
  private shouldApplyReorder(
    operation: 'add' | 'move' | 'remove',
    targetId: string,
    mode: MoveOrderMode | undefined,
    reorder: boolean | undefined,
  ): boolean {
    if (mode !== 'auto') return reorder !== false
    if (reorder === false) return false
    const config = this.getReorderConfig(targetId)
    if (operation === 'move') return config.reorderOnMove
    if (operation === 'add') return config.reorderOnAdd
    return config.reorderOnRemove
  }
}

/** Creates the list module definition used by the unified V2 catalog. */
export function createListModuleServiceDefinition(): RuntimeModuleServiceDefinition {
  return {
    id: LIST_MODULE_SERVICE_ID,
    create: ({ compiledScene }) => {
      const state = new ListCapabilityState(compiledScene)
      const instance: ListModuleServiceInstance = {
        getReorderConfig: (targetId) => state.getReorderConfig(targetId),
        resetStructuralOrder: () => state.resetStructuralHistory(),
        resolveStructuralOrder: (previousOrder, scene, deltas) => state.resolveStructuralOrder(previousOrder, scene, deltas),
        destroy: () => state.clear(),
      }
      return instance
    },
  }
}

/** Reads the list reorder configuration from the list component initial state. */
function readReorderConfig(initial: CompiledRecord): Partial<ListReorderConfig> {
  if (!isPlainRecord(initial.config)) return {}
  return initial.config as Partial<ListReorderConfig>
}

/** Normalizes the three boolean switches and preserves safe defaults. */
function normalizeReorderConfig(config: Partial<ListReorderConfig>): ListReorderConfig {
  return Object.freeze({
    reorderOnMove: config.reorderOnMove !== false,
    reorderOnAdd: config.reorderOnAdd !== false,
    reorderOnRemove: config.reorderOnRemove !== false,
  })
}
