import { diffSolvedScenes, type MoveStateDelta } from '../../move'
import { applyStructuralDeltas } from '../structural-timeline'
import type {
  RuntimeModuleServiceInstance,
  RuntimeModuleServiceSeekHandle,
  RuntimeStructuralOrder,
} from '../../engine'
import type { SolvedScene } from '../pipeline'

/** Initializes every player-scoped module from the first solved snapshot. */
export function initializeModuleServices(
  instances: ReadonlyMap<string, RuntimeModuleServiceInstance>,
  solved: SolvedScene,
): void {
  for (const instance of instances.values()) instance.initializeScene?.(solved)
}

/** Notifies player-scoped capabilities after one solved scene reaches components. */
export function notifyModuleScenePresented(
  instances: ReadonlyMap<string, RuntimeModuleServiceInstance>,
  scene: SolvedScene,
  playbackState: 'playing' | 'paused',
): void {
  for (const instance of instances.values()) instance.onScenePresented?.(scene, playbackState)
}

/** Notifies player-scoped capabilities when the player changes playback state. */
export function notifyModulePlaybackState(
  instances: ReadonlyMap<string, RuntimeModuleServiceInstance>,
  state: 'playing' | 'paused',
  currentTimeMs: number,
): void {
  for (const instance of instances.values()) instance.onPlaybackStateChange?.(state, currentTimeMs)
}

/** Notifies player-scoped capabilities that own native clocks of one rate change. */
export function notifyModuleRateChange(
  instances: ReadonlyMap<string, RuntimeModuleServiceInstance>,
  rate: number,
): void {
  for (const instance of instances.values()) instance.onRateChange?.(rate)
}

/** Lets one player-scoped capability provide the active logical clock. */
export function resolveModuleTimeline(
  instances: ReadonlyMap<string, RuntimeModuleServiceInstance>,
  fallbackTimeMs: number,
): number {
  let timeMs = fallbackTimeMs
  for (const instance of instances.values()) {
    const resolved = instance.resolveTimelineMs?.(timeMs)
    if (resolved !== undefined && Number.isFinite(resolved) && resolved >= 0) timeMs = resolved
  }
  return timeMs
}

/** Composes structural policies while preserving one canonical order timeline. */
export function resolveStructuralOrder(
  instances: ReadonlyMap<string, RuntimeModuleServiceInstance>,
  previousOrder: RuntimeStructuralOrder,
  scene: SolvedScene,
  deltas: readonly MoveStateDelta[],
): RuntimeStructuralOrder {
  let order = previousOrder
  let resolvedByModule = false
  for (const instance of instances.values()) {
    const resolve = instance.resolveStructuralOrder
    if (resolve === undefined) continue
    order = resolve(order, scene, deltas)
    resolvedByModule = true
  }
  return resolvedByModule ? order : applyStructuralDeltas(order, scene, deltas)
}

/** Sends generic placement deltas to player-scoped module services. */
export function notifyModuleMoveDeltas(
  instances: ReadonlyMap<string, RuntimeModuleServiceInstance>,
  before: SolvedScene | undefined,
  after: SolvedScene,
  excludedInstances: ReadonlySet<RuntimeModuleServiceInstance> = new Set(),
  deltas = before === undefined ? [] : diffSolvedScenes(before, after),
): void {
  if (before === undefined) return
  for (const delta of deltas) {
    for (const instance of instances.values()) {
      if (!excludedInstances.has(instance)) instance.onMoveDelta?.(delta)
    }
  }
}

/** Aborts staged module-service seek state before a grouped commit can occur. */
export function abortPendingModuleSeek(
  pending: Array<Readonly<{
    instance: RuntimeModuleServiceInstance
    handle: RuntimeModuleServiceSeekHandle
  }>>,
): void {
  for (const { handle } of [...pending].reverse()) handle.abort?.()
  pending.length = 0
}
