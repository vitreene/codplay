// CapsuleDistribution — computes virtual keyframe positions for capsule children.
// Pure computation, no side effects. All times are relative to capsule.intro.timeMs.

export interface ChildInput {
  trackId: string
  lockedIntroMs?: number   // real kf present — takes priority
  lockedOutroMs?: number   // real kf present — takes priority
}

export interface ChildOutput {
  trackId: string
  introMs: number
  outroMs: number
  visible: boolean         // false if the child falls outside the clip
}

export interface CapsuleDistributionInput {
  clipDurationMs: number
  mode: 'sequential' | 'stagger'
  order?: 'forward' | 'backward'
  staggerInMs?: number
  staggerOutMs?: number
  children: ChildInput[]
}

export interface CapsuleDistributionOutput {
  minDurationMs: number
  children: ChildOutput[]
}

export class CapsuleDistribution {
  static compute(input: CapsuleDistributionInput): CapsuleDistributionOutput {
    const { mode, children } = input
    if (children.length === 0) {
      return { minDurationMs: 0, children: [] }
    }

    // min_duration = max locked outro (constraint on capsule duration)
    const minDurationMs = children.reduce((max, c) => {
      return c.lockedOutroMs !== undefined ? Math.max(max, c.lockedOutroMs) : max
    }, 0)

    if (mode === 'stagger') {
      return { minDurationMs, children: CapsuleDistribution.computeStagger(input, minDurationMs) }
    }
    const order = input.order ?? 'forward'
    const seq = order === 'backward'
      ? CapsuleDistribution.computeSequentialBackward(input)
      : CapsuleDistribution.computeSequentialForward(input)
    return { minDurationMs, children: seq }
  }

  // ── Sequential forward (premier devant) ─────────────────────────────────────
  // Children placed left-to-right in list order. Locked intro creates a gap;
  // locked outro anchors the right boundary. Free children share remaining time.

  private static computeSequentialForward(
    input: CapsuleDistributionInput,
  ): ChildOutput[] {
    const { clipDurationMs, children } = input

    // Phase 1: compute share for children with free outro
    let cursor = 0
    let committedMs = 0
    let freeCount = 0

    for (const child of children) {
      const intro = child.lockedIntroMs !== undefined ? Math.max(cursor, child.lockedIntroMs) : cursor
      committedMs += intro - cursor  // gap before this child
      if (child.lockedOutroMs !== undefined) {
        committedMs += Math.max(intro, child.lockedOutroMs) - intro
        cursor = Math.max(intro, child.lockedOutroMs)
      } else {
        freeCount++
        // cursor does not advance for free children in phase 1
      }
    }

    const share = freeCount > 0 ? Math.max(0, clipDurationMs - committedMs) / freeCount : 0

    // Phase 2: place each child
    cursor = 0
    const result: ChildOutput[] = []

    for (const child of children) {
      const introMs = child.lockedIntroMs !== undefined ? Math.max(cursor, child.lockedIntroMs) : cursor
      const outroMs = child.lockedOutroMs !== undefined ? Math.max(introMs, child.lockedOutroMs) : introMs + share
      cursor = outroMs
      result.push({
        trackId: child.trackId,
        introMs,
        outroMs,
        visible: introMs < clipDurationMs && outroMs > 0,
      })
    }

    return result
  }

  // ── Sequential backward (dernier devant) ─────────────────────────────────────
  // Children placed right-to-left. Child at index 0 occupies the rightmost slot
  // (appears last in time). Cursor starts at clipDurationMs and moves left.

  private static computeSequentialBackward(
    input: CapsuleDistributionInput,
  ): ChildOutput[] {
    const { clipDurationMs, children } = input

    // Phase 1: compute share for children with free intro
    let cursor = clipDurationMs
    let committedMs = 0
    let freeCount = 0

    for (const child of children) {
      const outro = child.lockedOutroMs !== undefined ? Math.min(cursor, child.lockedOutroMs) : cursor
      committedMs += cursor - outro  // gap to the right of this child
      if (child.lockedIntroMs !== undefined) {
        committedMs += outro - Math.min(outro, child.lockedIntroMs)
        cursor = Math.min(outro, child.lockedIntroMs)
      } else {
        freeCount++
        cursor = outro  // cursor regresses to outro for free intro children
      }
    }

    const share = freeCount > 0 ? Math.max(0, clipDurationMs - committedMs) / freeCount : 0

    // Phase 2: place each child
    cursor = clipDurationMs
    const result: ChildOutput[] = new Array(children.length)

    for (let i = 0; i < children.length; i++) {
      const child = children[i]!
      const outroMs = child.lockedOutroMs !== undefined ? Math.min(cursor, child.lockedOutroMs) : cursor
      const introMs = child.lockedIntroMs !== undefined ? Math.min(outroMs, child.lockedIntroMs) : outroMs - share
      cursor = introMs
      result[i] = {
        trackId: child.trackId,
        introMs,
        outroMs,
        visible: introMs < clipDurationMs && outroMs > 0,
      }
    }

    return result
  }

  // ── Stagger ───────────────────────────────────────────────────────────────────

  private static computeStagger(
    input: CapsuleDistributionInput,
    _minDurationMs: number,
  ): ChildOutput[] {
    const { clipDurationMs, children, staggerInMs = 0, staggerOutMs = 0 } = input
    const N = children.length

    return children.map((c, i) => {
      // Locked children keep their bounds
      if (c.lockedIntroMs !== undefined && c.lockedOutroMs !== undefined) {
        return {
          trackId: c.trackId,
          introMs: c.lockedIntroMs,
          outroMs: c.lockedOutroMs,
          visible: c.lockedIntroMs < clipDurationMs && c.lockedOutroMs > 0,
        }
      }

      const introMs = c.lockedIntroMs ?? i * staggerInMs
      const outroMs = c.lockedOutroMs ?? clipDurationMs - (N - 1 - i) * staggerOutMs
      const visible = introMs < clipDurationMs && outroMs > 0

      return { trackId: c.trackId, introMs, outroMs, visible }
    })
  }
}
