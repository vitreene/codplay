import { cloneRecord, isPlainRecord } from '../../../shared'
import type { CompiledRecord } from '../../../scene/compiled'
import type { ResolvedScene } from './types'

/** One validated logical preview patch owned by a runtime player. */
export type RuntimeSnapshotPatch = Readonly<{
  storyId: string
  persoId: string
  timeMs: number
  state: Readonly<Record<string, unknown>>
}>

/** One normalized style contribution retained by the runtime player. */
export type RuntimeSnapshotContributionPatch = Readonly<{
  storyId: string
  persoId: string
  timeMs: number
  state: Readonly<{
    style: CompiledRecord
  }>
}>

/** Complete replacement preview retained outside the compiled scene and journal. */
export type RuntimeSnapshotContribution = Readonly<{
  timeMs: number
  patches: readonly RuntimeSnapshotContributionPatch[]
}>

/** One logical perso state exposed by the runtime snapshot read operation. */
export type RuntimeSnapshotState = Readonly<{
  storyId: string
  persoId: string
  state: CompiledRecord
}>

/** Read-only logical frame returned by the runtime snapshot read operation. */
export type RuntimeSnapshot = Readonly<{
  timeMs: number
  states: readonly RuntimeSnapshotState[]
}>

/** Result returned after validating and presenting one runtime snapshot replacement. */
export type RuntimeSnapshotSetResult = Readonly<
  | { ok: true }
  | { ok: false; code: 'INSTANCE_DESTROYED' | 'TIME_NOT_PRESENTED' | 'TARGET_NOT_PRESENT' | 'INVALID_PATCH' }
>

/** Applies one preview contribution after resolve and before solve. */
export function applyRuntimeSnapshotContribution(
  resolved: ResolvedScene,
  contribution: RuntimeSnapshotContribution | undefined,
): ResolvedScene {
  if (contribution === undefined || contribution.timeMs !== resolved.timeMs) return resolved
  const patchesByTarget = new Map(contribution.patches.map((patch) => [`${patch.storyId}\u0000${patch.persoId}`, patch]))
  const persos: Record<string, ResolvedScene['persos'][string]> = {}
  for (const perso of Object.values(resolved.persos)) {
    const patch = patchesByTarget.get(`${perso.storyId}\u0000${perso.persoId}`)
    if (patch === undefined) {
      persos[perso.key] = perso
      continue
    }
    const state = cloneRecord(perso.state)
    const style = isPlainRecord(state.style) ? cloneRecord(state.style) : {}
    persos[perso.key] = {
      ...perso,
      state: { ...state, style: { ...style, ...cloneRecord(patch.state.style) } },
    }
  }
  return { ...resolved, persos }
}
