// CapsulePreset — resolves a capsule's sub-type + author distribution setting into the concrete
// mode/values `CapsuleDistribution.compute()` needs. Pure computation, no side effects.
// `2026-06-12-capsule-distribution-spec.md` §3.3 — owns the ENTIRE CapsuleKind vocabulary and its
// resolution; neither `CapsuleDistribution` nor the ed2 Builder know about capsule sub-types at
// all, this is the one place that knowledge lives.

/**
 * The 5 ed2 capsule sub-types — the single declaration of this vocabulary across the codebase.
 * `sequence-editor`'s own `CapsuleKind` (`TrackNode.capsuleType`) re-exports this type rather than
 * redeclaring it — a second, separately-declared copy previously drifted out of sync with reality
 * once (same class of bug as the old `GRID_MODE`/`GRID_POLICY` duplication).
 */
export type CapsuleKind = 'carousel' | 'rangee' | 'liste' | 'grille' | 'card'

export type DistributionMode = 'sequential' | 'stagger'

/** Author-facing distribution override — mirrors `sequence-editor`'s own `TrackDistribution`. */
export interface CapsuleDistributionSetting {
  mode: DistributionMode
  staggerInMs?: number
  staggerOutMs?: number
}

export interface CapsulePresetInput {
  capsuleType: CapsuleKind
  /**
   * The author's own distribution choice (`TrackDistribution`/`CapsulePatch.sequencing`) —
   * required for every `capsuleType` except `carousel`. `carousel`'s grid is forced to a single
   * cell (`GRID_MODE.forced`, capsule-automation), which by itself forces children to take turns:
   * `sequential` isn't a guess there, it's the only behavior a 1-cell grid can express. Every
   * other sub-type has several cells — there is no way to infer from `capsuleType` alone whether
   * its children should take turns or coexist, or with what stagger spacing, so an explicit
   * setting is required there.
   */
  distribution?: CapsuleDistributionSetting
}

export type CapsulePresetResolution = {
  mode: DistributionMode
  staggerInMs?: number
  staggerOutMs?: number
}

export class CapsulePreset {
  /**
   * Resolves one capsule's own distribution setting — ready to pass straight into
   * `CapsuleDistribution.compute()` (`mode`, `staggerInMs`, `staggerOutMs`).
   */
  static resolve(input: CapsulePresetInput): CapsulePresetResolution {
    if (input.distribution) {
      return {
        mode: input.distribution.mode,
        staggerInMs: input.distribution.staggerInMs,
        staggerOutMs: input.distribution.staggerOutMs,
      }
    }
    if (input.capsuleType === 'carousel') {
      return { mode: 'sequential' }
    }
    throw new Error(
      `CapsulePreset.resolve: capsuleType '${input.capsuleType}' has no structural default — an explicit \`distribution\` is required (author choice, not something this class can infer)`,
    )
  }
}
