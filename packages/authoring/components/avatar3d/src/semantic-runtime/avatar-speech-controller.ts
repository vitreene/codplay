import { ALL_VISEMES, resolveContinuousEndMs } from '../avatar3d-component.js'
import type { AvatarLayerOutput, AvatarMorphPose } from './avatar-pose-types.js'
import type { Avatar3DRuntimeUpdateInput } from './avatar3d-runtime-types.js'

type ActiveContinuousViseme = {
  name: string
  startMs: number
  endMs: number
  releaseEndMs: number
}

/** TalkingHead provided-viseme target levels: PP/FF are stronger lip-closure shapes. */
function resolveTalkingHeadVisemeWeight(name: string): number {
  return name === 'PP' || name === 'FF' ? 0.9 : 0.6
}

/** Computes the cue peak time following TalkingHead's modules/talkinghead.mjs timing. */
function resolveVisemePeakMs(active: ActiveContinuousViseme): number {
  return active.startMs + (active.endMs - active.startMs) / 2
}

/** Returns the cue envelope weight at one timeline position. */
function sampleVisemeEnvelope(active: ActiveContinuousViseme, timelineMs: number): number {
  if (timelineMs < active.startMs || timelineMs >= active.releaseEndMs) {
    return 0
  }

  const peakMs = resolveVisemePeakMs(active)
  if (timelineMs <= peakMs) {
    return Math.max(0, Math.min(1, (timelineMs - active.startMs) / Math.max(1, peakMs - active.startMs)))
  }

  return Math.max(0, Math.min(1, (active.releaseEndMs - timelineMs) / Math.max(1, active.releaseEndMs - peakMs)))
}

/** Handles avatar speech/lipsync state independently from the component. */
export class AvatarSpeechController {
  private readonly visemeWeight: number
  private continuousVisemes: ActiveContinuousViseme[] = []
  private instantViseme: string | null = null

  /** Creates one speech controller bound to the loaded avatar engine. */
  constructor(input: {
    visemeWeight: number
  }) {
    this.visemeWeight = input.visemeWeight
  }

  /** Handles a viseme update. Returns false when the action is not a viseme action. */
  handleUpdate(input: Avatar3DRuntimeUpdateInput): boolean {
    if (!('viseme' in input.action)) return false

    const endMs = resolveContinuousEndMs(input.action, input.eventMs)
    if (endMs === null) {
      this.continuousVisemes = []
      this.instantViseme = typeof input.action['viseme'] === 'string' ? input.action['viseme'] : null
      return true
    }

    const value = input.action['viseme']
    if (typeof value !== 'string' || endMs <= input.eventMs) {
      this.continuousVisemes = []
      this.instantViseme = null
      return true
    }

    const durationMs = endMs - input.eventMs
    this.instantViseme = null
    this.continuousVisemes.push({
      name: value,
      startMs: input.eventMs,
      endMs,
      releaseEndMs: endMs + durationMs / 2,
    })

    return true
  }

  /** Clears transient speech state before seek replay reconstructs it. */
  prepareSeek(): void {
    this.continuousVisemes = []
    this.instantViseme = null
  }

  /** Evaluates the active continuous viseme at one absolute timeline position. */
  evaluate(timelineMs: number): AvatarLayerOutput {
    if (this.continuousVisemes.length === 0) {
      return this.instantViseme === null ? {} : { morphs: this.resolveVisemePose(this.instantViseme) }
    }

    const morphs = this.resolveEmptyVisemePose()
    const stillActive: ActiveContinuousViseme[] = []
    for (const active of this.continuousVisemes) {
      const envelope = sampleVisemeEnvelope(active, timelineMs)
      if (timelineMs < active.releaseEndMs) {
        stillActive.push(active)
      }
      if (envelope <= 0) {
        continue
      }

      const key = 'viseme_' + active.name
      morphs[key] = Math.max(morphs[key] ?? 0, resolveTalkingHeadVisemeWeight(active.name) * this.visemeWeight * envelope)
    }

    this.continuousVisemes = stillActive

    return this.continuousVisemes.length === 0 && Object.values(morphs).every((value) => value === 0) ? {} : { morphs }
  }

  /** Stops all transient speech state and releases viseme overrides. */
  stop(): void {
    this.continuousVisemes = []
    this.instantViseme = null
  }

  /** Resolves a complete zeroed viseme morph layer. */
  private resolveEmptyVisemePose(): AvatarMorphPose {
    const morphs: AvatarMorphPose = {}
    for (const visemeName of ALL_VISEMES) {
      morphs['viseme_' + visemeName] = 0
    }
    return morphs
  }

  /** Resolves one complete viseme morph layer. */
  private resolveVisemePose(name: string, weightMultiplier = 1): AvatarMorphPose {
    const morphs = this.resolveEmptyVisemePose()
    const activeWeight = resolveTalkingHeadVisemeWeight(name) * this.visemeWeight * Math.max(0, Math.min(1, weightMultiplier))
    morphs['viseme_' + name] = activeWeight
    return morphs
  }
}
