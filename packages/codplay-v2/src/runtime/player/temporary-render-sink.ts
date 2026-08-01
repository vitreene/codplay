import type { CompiledRecord, CompiledScene } from '../../scene/compiled'
import { evaluateTemporaryScene } from './temporary-scene-evaluator'

/** One initial-only snapshot emitted by the temporary render probe. */
export type TemporaryRenderSnapshot = Readonly<{
  instanceId: string
  sceneId: string
  timeMs: number
  persos: Readonly<Record<string, CompiledRecord>>
}>

/** Minimal output boundary used before component and renderer contracts exist. */
export type TemporaryRenderSink = Readonly<{
  present(snapshot: TemporaryRenderSnapshot): void
}>

/** In-memory render sink retaining snapshots for deterministic tests. */
export class MemoryRenderSink implements TemporaryRenderSink {
  private readonly snapshots: TemporaryRenderSnapshot[] = []

  /** Stores one snapshot without mutating its input. */
  present(snapshot: TemporaryRenderSnapshot): void {
    this.snapshots.push({
      ...snapshot,
      persos: { ...snapshot.persos },
    })
  }

  /** Returns all snapshots in presentation order. */
  getSnapshots(): readonly TemporaryRenderSnapshot[] {
    return this.snapshots.map((snapshot) => ({ ...snapshot, persos: { ...snapshot.persos } }))
  }

  /** Removes all retained snapshots. */
  clear(): void {
    this.snapshots.length = 0
  }
}

/** Creates the initial-only logical render snapshot for one compiled scene. */
export function createTemporaryRenderSnapshot(
  instanceId: string,
  scene: CompiledScene,
  timeMs: number,
): TemporaryRenderSnapshot {
  return { instanceId, sceneId: scene.scene.id, timeMs, persos: evaluateTemporaryScene(scene, timeMs) }
}
