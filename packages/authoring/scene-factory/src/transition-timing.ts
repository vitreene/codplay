// TransitionTiming — resolves keyframe timeMs + transition data into the concrete trigger bounds
// consumers need. Pure computation, no side effects, no editor types imported (same convention as
// `CapsuleDistribution`/`CapsulePreset`: primitives only, `timeMs`/`durationMs`/`direction`).
// `2026-06-11-sequence-editor-grid-spec.md` §2.2 — the normative source for every formula here:
// `transitionIn` ends AT its keyframe (plays before), `transitionOut` starts AT its keyframe
// (plays after), an interpolated (decor-state) transition between two arbitrary keyframes can be
// shortened via `direction: 'before'|'after'` with the same "ends at"/"starts at" split.

export interface TransitionTimingKeyframe {
  timeMs: number
  transitionInDurationMs?: number
}

export class TransitionTiming {
  /**
   * The scene-wide time reserved before the user-facing timeline's own `0`, so that no item's
   * `transitionIn` (which ends AT its keyframe, per §2.2) ever needs to start at a negative time.
   * `0` when no item's first keyframe carries a `transitionIn` — never a wasted margin.
   *
   * A single value for the whole scene (not per capsule level) — decided so every level shares one
   * offset rather than accumulating one per nesting depth, which would drift the deeper an item
   * sits.
   */
  static computeScenePreRollMs(items: Array<{ firstKeyframe?: TransitionTimingKeyframe }>): number {
    return items.reduce((max, item) => Math.max(max, item.firstKeyframe?.transitionInDurationMs ?? 0), 0)
  }

  /**
   * A capsule child's locked intro bound, ready for `CapsuleDistribution.compute()`'s
   * `ChildInput.lockedIntroMs`. `preRollMs` (default `0`) shifts the whole reference frame before
   * the `transitionIn` duration is subtracted — omit it (Builder-only concept) for any caller that
   * must stay in its own local time reference (e.g. `sequence-editor`'s own preview).
   */
  static lockedIntroMs(firstKf: TransitionTimingKeyframe | undefined, preRollMs = 0): number | undefined {
    if (!firstKf) return undefined
    return firstKf.timeMs + preRollMs - (firstKf.transitionInDurationMs ?? 0)
  }

  /**
   * A capsule child's locked outro bound. Never subtracts anything — `transitionOut` starts AT its
   * keyframe (§2.2), so only the pre-roll shift applies, never the transition's own duration.
   */
  static lockedOutroMs(lastKf: { timeMs: number } | undefined, preRollMs = 0): number | undefined {
    if (!lastKf) return undefined
    return lastKf.timeMs + preRollMs
  }

  /**
   * When an interpolated (decor-state) transition between two arbitrary keyframes of the same item
   * is shortened via `direction`, this resolves where it actually triggers. `'before'` mirrors
   * `lockedIntroMs`'s own "ends at" logic for this arbitrary pair (destination kf, not necessarily
   * a capsule boundary) ; `'after'` (default) keeps the historical "starts at the source kf"
   * behavior unchanged.
   */
  static interpolatedTransitionTriggerMs(input: {
    sourceKfTimeMs: number
    destKfTimeMs: number
    durationMs: number
    direction: 'before' | 'after'
  }): number {
    return input.direction === 'before' ? input.destKfTimeMs - input.durationMs : input.sourceKfTimeMs
  }
}
