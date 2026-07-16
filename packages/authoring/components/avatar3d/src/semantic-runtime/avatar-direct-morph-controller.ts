import { resolveContinuousEndMs } from '../avatar3d-component.js'
import type { AvatarLayerOutput } from './avatar-pose-types.js'
import type { Avatar3DRuntimeUpdateInput } from './avatar3d-runtime-types.js'

type DirectMorphState = {
  value: number
  snap: boolean
  transition: {
    from: number
    to: number
    startMs: number
    endMs: number
  } | null
}

/** Smoothstep interpolation for direct morph timeline transitions. */
function easeDirectMorphProgress(progress: number): number {
  const t = Math.max(0, Math.min(1, progress))
  return t * t * (3 - 2 * t)
}

/** Owns direct morph actions that need deterministic timeline interpolation. */
export class AvatarDirectMorphController {
  private readonly states = new Map<string, DirectMorphState>()

  /** Handles direct morph actions when they are continuous or already owned by this controller. */
  handleUpdate(input: Avatar3DRuntimeUpdateInput): boolean {
    const name = input.action['name']
    const value = input.action['value']
    if (typeof name !== 'string' || typeof value !== 'number' || !Number.isFinite(value)) {
      return false
    }

    const endMs = resolveContinuousEndMs(input.action, input.eventMs)
    if (endMs === null) {
      if (!this.states.has(name)) {
        return false
      }

      this.states.set(name, { value, snap: true, transition: null })
      return true
    }

    if (endMs <= input.eventMs) {
      this.states.set(name, { value, snap: true, transition: null })
      return true
    }

    const from = this.evaluateMorphValue(name, input.eventMs)
    this.states.set(name, {
      value,
      snap: false,
      transition: {
        from,
        to: value,
        startMs: input.eventMs,
        endMs,
      },
    })
    return true
  }

  /** Resets direct morph state before seek replay. */
  prepareSeek(): void {
    this.states.clear()
  }

  /** Emits active direct morph values at one timeline position. */
  evaluate(timelineMs: number): AvatarLayerOutput {
    const morphs: Record<string, number> = {}
    const snapMorphs = new Set<string>()
    for (const [name, state] of this.states) {
      morphs[name] = this.evaluateMorphValue(name, timelineMs)
      if (state.snap) snapMorphs.add(name)
    }
    return Object.keys(morphs).length > 0 ? { morphs, snapMorphs } : {}
  }

  /** Stops all direct morph overrides. */
  stop(): void {
    this.states.clear()
  }

  /** Resolves one direct morph value and completes elapsed transitions. */
  private evaluateMorphValue(name: string, timelineMs: number): number {
    const state = this.states.get(name)
    if (state === undefined || state.transition === null) {
      return state?.value ?? 0
    }

    if (timelineMs >= state.transition.endMs) {
      state.transition = null
      return state.value
    }

    if (timelineMs <= state.transition.startMs) {
      return state.transition.from
    }

    const progress = easeDirectMorphProgress(
      (timelineMs - state.transition.startMs) / (state.transition.endMs - state.transition.startMs),
    )
    return state.transition.from + (state.transition.to - state.transition.from) * progress
  }
}
