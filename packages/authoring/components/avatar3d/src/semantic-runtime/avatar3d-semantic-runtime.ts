import type { AvatarEngine, GazeService } from '@codplay/avatar-engine'
import type { Avatar3DMotionCatalog } from '../semantic-motion/avatar3d-motion-types.js'
import { AvatarSpeechController } from './avatar-speech-controller.js'
import { AvatarMoodController } from './avatar-mood-controller.js'
import { AvatarMotionController } from './avatar-motion-controller.js'
import { AvatarAutoMotionController } from './avatar-auto-motion-controller.js'
import { AvatarDirectMorphController } from './avatar-direct-morph-controller.js'
import { AvatarSkeletalController } from './avatar-skeletal-controller.js'
import { AvatarPoseComposer } from './avatar-pose-composer.js'
import { AvatarPoseApplier } from './avatar-pose-applier.js'
import type { Avatar3DRuntimeMode, Avatar3DRuntimeUpdateInput, Avatar3DWarningReporter } from './avatar3d-runtime-types.js'

/** Business runtime for semantic avatar state, called by Avatar3DBaseComponent. */
export class Avatar3DSemanticRuntime {
  private readonly speech: AvatarSpeechController
  private readonly moodMotion: AvatarMotionController
  private readonly motion: AvatarMotionController
  private readonly skeletal: AvatarSkeletalController
  private readonly mood: AvatarMoodController
  private readonly directMorph = new AvatarDirectMorphController()
  private readonly autoMotion = new AvatarAutoMotionController()
  private readonly composer = new AvatarPoseComposer()
  private readonly applier: AvatarPoseApplier

  /** Creates one semantic runtime bound to the loaded avatar engine. */
  constructor(input: {
    engine: AvatarEngine
    initialMood?: Parameters<AvatarEngine['setMood']>[0]
    gaze?: GazeService
    localMotions?: Avatar3DMotionCatalog
    visemeWeight: number
    report: Avatar3DWarningReporter
  }) {
    this.speech = new AvatarSpeechController({
      visemeWeight: input.visemeWeight,
    })
    this.mood = new AvatarMoodController({
      initialMood: input.initialMood,
      report: input.report,
    })
    this.motion = new AvatarMotionController({
      localMotions: input.localMotions,
      supportedChannels: new Set([
        ...input.engine.morphEngine.morphs.keys(),
        ...Object.keys(input.engine.morphEngine.aliases),
      ]),
      track: 'action',
      setEyeContact: (value) => input.gaze?.setContact(value),
      setHeadMoveEnabled: (enabled) => this.autoMotion.setHeadMoveEnabled(enabled),
      report: input.report,
    })
    this.moodMotion = new AvatarMotionController({
      localMotions: input.localMotions,
      supportedChannels: new Set([
        ...input.engine.morphEngine.morphs.keys(),
        ...Object.keys(input.engine.morphEngine.aliases),
      ]),
      track: 'mood',
      report: input.report,
    })
    this.skeletal = new AvatarSkeletalController({
      engine: input.engine,
      localMotions: input.localMotions,
      report: input.report,
    })
    this.applier = new AvatarPoseApplier(input.engine)
  }

  /** Routes one CodPlay component update into the semantic avatar runtime. */
  handleUpdate(input: Avatar3DRuntimeUpdateInput): boolean {
    if (this.speech.handleUpdate(input)) return true
    if (this.mood.handleUpdate(input)) return true
    if (this.autoMotion.handleUpdate(input)) return true
    if ('motion' in input.action) {
      const moodMotionHandled = this.moodMotion.handleUpdate(input)
      const motionHandled = this.motion.handleUpdate(input)
      const skeletalHandled = this.skeletal.handleUpdate(input)
      return moodMotionHandled || motionHandled || skeletalHandled
    }
    if (this.skeletal.handleUpdate(input)) return true
    if (this.directMorph.handleUpdate(input)) return true
    return false
  }

  /** Clears transient state before CodPlay seek replay reconstructs events. */
  prepareSeek(): void {
    this.speech.prepareSeek()
    this.moodMotion.prepareSeek()
    this.motion.prepareSeek()
    this.skeletal.prepareSeek()
    this.mood.prepareSeek()
    this.directMorph.prepareSeek()
    this.autoMotion.prepareSeek()
    this.applier.clear()
  }

  /** Evaluates semantic layers at one absolute CodPlay timeline position. */
  evaluate(timelineMs: number, mode: Avatar3DRuntimeMode): void {
    this.skeletal.evaluate(timelineMs)
    this.applier.apply(this.composer.compose([
      this.mood.evaluate(timelineMs),
      this.moodMotion.evaluate(timelineMs),
      this.autoMotion.evaluate(timelineMs),
      this.motion.evaluate(timelineMs),
      this.directMorph.evaluate(timelineMs),
      this.speech.evaluate(timelineMs),
    ]), mode)
  }

  /** Stops all transient semantic state. */
  stop(): void {
    this.speech.stop()
    this.moodMotion.stop()
    this.motion.stop()
    this.skeletal.stop()
    this.mood.stop()
    this.directMorph.stop()
    this.autoMotion.stop()
    this.applier.clear()
  }
}
