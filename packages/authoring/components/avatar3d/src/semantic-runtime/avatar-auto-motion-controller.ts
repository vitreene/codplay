import type { BlinkScheduleFn, HeadDriftFn } from '@codplay/avatar-engine'
import type { AvatarLayerOutput, AvatarMorphPose } from './avatar-pose-types.js'
import type { Avatar3DRuntimeUpdateInput } from './avatar3d-runtime-types.js'

/** Owns automatic avatar layers such as head drift and blink. */
export class AvatarAutoMotionController {
  private headDrift: { fn: HeadDriftFn; startMs: number } | null = null
  private blink: { fn: BlinkScheduleFn; startMs: number } | null = null
  private headMoveEnabled = true

  /** Enables or suppresses automatic head drift while semantic motions play. */
  setHeadMoveEnabled(enabled: boolean): void {
    this.headMoveEnabled = enabled
  }

  /** Handles auto-motion actions. Returns false for unrelated actions. */
  handleUpdate(input: Avatar3DRuntimeUpdateInput): boolean {
    if ('headDrift' in input.action) {
      const fn = input.action['headDrift']
      this.headDrift = typeof fn === 'function' ? { fn: fn as HeadDriftFn, startMs: input.eventMs } : null
      return true
    }

    if ('blink' in input.action) {
      const fn = input.action['blink']
      this.blink = typeof fn === 'function' ? { fn: fn as BlinkScheduleFn, startMs: input.eventMs } : null
      return true
    }

    return false
  }

  /** Clears transient auto-motion state before seek replay. */
  prepareSeek(): void {
    this.headDrift = null
    this.blink = null
    this.headMoveEnabled = true
  }

  /** Emits the automatic morph/bone-morph layer at one timeline position. */
  evaluate(timelineMs: number): AvatarLayerOutput {
    const morphs: AvatarMorphPose = {}

    if (this.headMoveEnabled && this.headDrift) {
      const elapsed = Math.max(0, timelineMs - this.headDrift.startMs)
      const output = this.headDrift.fn({ elapsed })
      if (output?.headRotateX !== undefined) morphs.headRotateX = output.headRotateX
      if (output?.headRotateY !== undefined) morphs.headRotateY = output.headRotateY
    }

    if (this.blink) {
      const elapsed = Math.max(0, timelineMs - this.blink.startMs)
      const output = this.blink.fn({ elapsed })
      if (output && output.eyesClosed > 0) morphs.eyesClosed = output.eyesClosed
    }

    return Object.keys(morphs).length === 0 ? {} : { morphs }
  }

  /** Stops all automatic layers owned by this controller. */
  stop(): void {
    this.prepareSeek()
  }
}
