import type { Camera } from 'three'
import { MOOD_BASELINES } from '../mood/mood-baselines.js'
import type {
  ActiveAnimation,
  AvatarBody,
  AvatarEngine,
  AvatarGestureFrame,
  AvatarGestureOverlay,
  AvatarGazeLookAhead,
  AvatarGazeTarget,
  AvatarGazeTargetTransition,
  AvatarHandTarget,
  AvatarMorphs,
  AvatarTimeline,
  AvatarTimelineSlot,
  AvatarVector3,
  AvatarView,
  BlinkScheduleFn,
  MoodName,
  TalkingHandsOptions,
  ThIdleOptions,
} from '../avatar-types.js'
import { sampleThIdle } from '../idle/th-idle-animation.js'
import { filterAvatarModelBaseline } from '../morph/morph-engine.js'
import { TH_GAZE_DEFAULTS } from '../gaze/gaze-service.js'

type GestureContribution = Readonly<{
  name: string
  seed: number
  mirror: boolean
  startAt: number
}> | null

type AnimationContribution = ActiveAnimation | null

const NO_ROOT_MOTION: AvatarVector3 = { x: 0, y: 0, z: 0 }

/** Collects feature contributions and applies them to one loaded Avatar engine. */
export class AvatarCoordinator {
  private engine: AvatarEngine | undefined
  private moodMorphs: AvatarMorphs
  private moodName: MoodName
  private idleProfile: ThIdleOptions
  private gesture: GestureContribution = null
  private pose: string | undefined
  private poseStartAt = 0
  private blinkSchedule: BlinkScheduleFn | null = null
  private gazeCamera: Camera | null = null
  private gazeEnabled = false
  private gazeContact: number | null = 1
  private gazeHeadMove: number | null = 1
  private gazeTarget: AvatarGazeTarget = 'camera'
  private gazeTargetTransition: AvatarGazeTargetTransition | undefined
  private gazeLookAhead: AvatarGazeLookAhead | null = null
  private idleEyeContact: number = TH_GAZE_DEFAULTS.idleContact
  private idleHeadMove: number = TH_GAZE_DEFAULTS.idleHeadMove
  private gazeMode: 'idle' | 'speaking' | 'listening' = 'idle'
  private gazeProfiles: Readonly<{
    idle?: number | null
    idleHeadMove?: number | null
    speaking?: number | null
    speakingHeadMove?: number | null
    listening?: number | null
    listeningHeadMove?: number | null
    ignoreCamera?: boolean
  }> = {}
  private gazeProfilesConfigured = false
  private animation: AnimationContribution = null
  private speechMorphs: AvatarMorphs = {}
  private readonly avatarBaseline: AvatarMorphs
  private readonly body: AvatarBody | undefined
  private readonly view: AvatarView
  private readonly timelines: Partial<Record<AvatarTimelineSlot, AvatarTimeline>> = {}
  private gestureMorphs: AvatarMorphs = {}
  private gestureOverlay: AvatarGestureOverlay | null = null
  private gestureActionStartAt: number | undefined
  private gestureEyeContact: number | undefined
  private gestureHeadMove: number | undefined
  private gestureGazeTarget: AvatarGazeTarget | undefined
  private gestureHandTargets: readonly AvatarHandTarget[] = []
  private gesturePose: string | undefined
  private gesturePoseStartAt: number | undefined
  private ambientOverlay: AvatarGestureOverlay | null = null
  private appliedMoodMorphs: AvatarMorphs | undefined
  private appliedAmbientMorphs: AvatarMorphs | undefined
  private appliedFixedMorphs: AvatarMorphs | undefined
  private appliedGestureKey: string | undefined
  private appliedPose: string | undefined
  private lastTimeMs: number | undefined
  private lastAppliedRevision: number | undefined
  private engineConfigurationDirty = true
  private revision = 0

  /** Creates a coordinator with the Avatar's stable initial mood. */
  constructor(
    initialMood: MoodName = 'neutral',
    avatarBaseline: Readonly<Record<string, number>> = {},
    body?: AvatarBody,
    view: AvatarView = 'full',
  ) {
    this.moodName = initialMood
    this.avatarBaseline = filterAvatarModelBaseline(avatarBaseline)
    this.body = body
    this.view = view
    this.moodMorphs = { ...this.avatarBaseline, ...MOOD_BASELINES[initialMood] }
    this.idleProfile = {
      enabled: false,
      breathe: false,
      headMove: false,
      seed: 0,
      speaking: false,
      speakWithHands: false,
      body: this.body,
      view: this.view,
    }
  }

  /** Attaches the loaded native engine without exposing it to feature components. */
  attachEngine(engine: AvatarEngine): void {
    this.engine = engine
    this.engineConfigurationDirty = true
    this.appliedMoodMorphs = undefined
    this.appliedAmbientMorphs = undefined
    this.appliedFixedMorphs = undefined
    this.appliedGestureKey = undefined
    this.appliedPose = undefined
    this.lastTimeMs = undefined
    this.lastAppliedRevision = undefined
    this.idleEyeContact = TH_GAZE_DEFAULTS.idleContact
    this.idleHeadMove = TH_GAZE_DEFAULTS.idleHeadMove
    this.revision += 1
  }

  /** Releases the native engine owned by the central Avatar component. */
  detachEngine(): void {
    this.engine = undefined
    this.appliedMoodMorphs = undefined
    this.appliedAmbientMorphs = undefined
    this.appliedFixedMorphs = undefined
    this.appliedGestureKey = undefined
    this.gestureActionStartAt = undefined
    this.gestureEyeContact = undefined
    this.gestureHeadMove = undefined
    this.gestureGazeTarget = undefined
    this.gestureHandTargets = []
    this.gesturePose = undefined
    this.gesturePoseStartAt = undefined
    this.ambientOverlay = null
    this.appliedPose = undefined
    this.lastTimeMs = undefined
    this.lastAppliedRevision = undefined
    this.engineConfigurationDirty = true
    this.idleEyeContact = TH_GAZE_DEFAULTS.idleContact
    this.idleHeadMove = TH_GAZE_DEFAULTS.idleHeadMove
  }

  /** Returns the change revision used by the central presentation stream. */
  getRevision(): number {
    return this.revision
  }

  /** Stages one feature stream for the single central Avatar presentation. */
  setTimeline(slot: AvatarTimelineSlot, timeline: AvatarTimeline): void {
    if (this.timelines[slot] === timeline) return
    this.timelines[slot] = timeline
    this.revision += 1
  }

  /** Stores and applies the latest mood baseline contribution. */
  applyMood(morphs: AvatarMorphs): void {
    const next = { ...this.avatarBaseline, ...morphs }
    if (sameMorphs(this.moodMorphs, next)) return
    this.moodMorphs = next
    this.revision += 1
  }

  /** Stores the semantic mood used by the automatic TH animation templates. */
  setMood(name: MoodName): void {
    if (this.moodName === name) return
    this.moodName = name
    this.revision += 1
    this.engineConfigurationDirty = true
  }

  /** Stages the automatic TH idle channels owned by avatar-idle. */
  setIdleProfile(options: ThIdleOptions): void {
    const next = {
      ...options,
      body: options.body ?? this.body,
      view: options.view ?? this.view,
    }
    if (sameIdleProfile(this.idleProfile, next)) return
    this.idleProfile = next
    this.revision += 1
    this.appliedAmbientMorphs = undefined
    if (next.pose !== undefined) this.setPose(next.pose)
    this.engineConfigurationDirty = true
  }

  /** Stores the speech/lip-sync morph layer for the next central presentation. */
  applyMorphs(morphs: AvatarMorphs): void {
    if (sameMorphs(this.speechMorphs, morphs)) return
    this.speechMorphs = { ...morphs }
    this.revision += 1
  }

  /** Stores one sampled gesture action and its absolute semantic start position. */
  applyGestureMotion(frame: AvatarGestureFrame, seed = 0, startAt = 0, actionStartAt = 0): void {
    const actionChanged = this.gestureActionStartAt !== actionStartAt
    const nextGesture = frame.released || frame.gesture === null
      ? null
      : { name: frame.gesture, seed, mirror: frame.mirror, startAt }
    const nextMorphs = actionChanged ? {} : { ...this.gestureMorphs }
    if (frame.released) {
      for (const name of Object.keys(nextMorphs)) delete nextMorphs[name]
    } else {
      for (const [name, value] of Object.entries(frame.morphs)) {
        if (typeof value === 'number') {
          nextMorphs[name] = value + (this.moodMorphs[name] ?? 0)
        }
      }
    }
    const nextEyeContact = frame.released
      ? undefined
      : actionChanged ? frame.eyeContact : frame.eyeContact ?? this.gestureEyeContact
    const nextHeadMove = frame.released
      ? undefined
      : actionChanged ? frame.headMove : frame.headMove ?? this.gestureHeadMove
    const nextGazeTarget = frame.released
      ? undefined
      : frame.gazeTarget === null
        ? undefined
        : frame.gazeTarget === undefined
          ? actionChanged ? undefined : this.gestureGazeTarget
          : this.resolveGestureGazeTarget(frame.gazeTarget)
    const nextHandTargets = frame.released ? [] : frame.handTargets
    const nextPose = frame.released
      ? undefined
      : actionChanged ? frame.pose : frame.pose ?? this.gesturePose
    const nextPoseStartAt = frame.released
      ? undefined
      : frame.poseStartMs === undefined
        ? actionChanged ? undefined : this.gesturePoseStartAt
        : actionStartAt + frame.poseStartMs
    const poseChanged = this.gesturePose !== nextPose
      || this.gesturePoseStartAt !== nextPoseStartAt
    const changed = !sameGesture(this.gesture, nextGesture)
      || this.gestureActionStartAt !== (frame.released ? undefined : actionStartAt)
      || !sameMorphs(this.gestureMorphs, nextMorphs)
      || !sameOverlay(this.gestureOverlay, frame.overlay)
      || !sameHandTargets(this.gestureHandTargets, nextHandTargets)
      || this.gesturePose !== nextPose
      || this.gesturePoseStartAt !== nextPoseStartAt
      || this.gestureEyeContact !== nextEyeContact
      || this.gestureHeadMove !== nextHeadMove
      || this.gestureGazeTarget !== nextGazeTarget
    if (!changed) return

    this.gesture = nextGesture
    this.gestureActionStartAt = frame.released ? undefined : actionStartAt
    this.gestureMorphs = nextMorphs
    this.gestureOverlay = frame.overlay
    this.gestureHandTargets = nextHandTargets.map((target) => ({
      ...target,
      position: { ...target.position },
    }))
    this.gesturePose = nextPose
    this.gesturePoseStartAt = nextPoseStartAt
    this.gestureEyeContact = nextEyeContact
    this.gestureHeadMove = nextHeadMove
    this.gestureGazeTarget = nextGazeTarget
    this.revision += 1
    this.engineConfigurationDirty = true
    this.setGazeTarget(
      this.resolveEffectiveGazeTarget(),
      resolveGestureGazeTransition(
        frame,
        actionStartAt,
        this.gazeProfiles.ignoreCamera === true,
      ),
    )
    if (poseChanged) this.appliedPose = undefined
  }

  /** Stores the active body pose and lets AvatarEngine ease toward it. */
  setPose(name: string): void {
    if (this.pose === name) return
    this.pose = name
    this.poseStartAt = 0
    this.revision += 1
    this.engineConfigurationDirty = true
  }

  /** Stages the idle blink schedule for the next central presentation. */
  setBlinkSchedule(schedule: BlinkScheduleFn | null): void {
    if (this.blinkSchedule === schedule) return
    this.blinkSchedule = schedule
    this.revision += 1
    this.engineConfigurationDirty = true
  }

  /** Stages the gaze selection for the next central presentation. */
  setGaze(enabled: boolean, contact?: number | null, headMove?: number | null): void {
    const nextContact = contact === undefined ? this.resolveGazeContact() : contact
    const nextHeadMove = headMove === undefined ? this.resolveGazeHeadMove() : headMove
    const nextEnabled = enabled
    if (this.gazeEnabled === nextEnabled
      && this.gazeContact === nextContact
      && this.gazeHeadMove === nextHeadMove) return
    this.gazeEnabled = nextEnabled
    this.gazeContact = nextContact
    this.gazeHeadMove = nextHeadMove
    this.revision += 1
    this.engineConfigurationDirty = true
  }

  /** Selects camera contact or the native look-ahead direction. */
  setGazeTarget(target: AvatarGazeTarget, transition?: AvatarGazeTargetTransition): void {
    const nextTransition = transition === undefined ? undefined : { ...transition }
    if (this.gazeTarget === target && sameGazeTargetTransition(this.gazeTargetTransition, nextTransition)) return
    this.gazeTarget = target
    this.gazeTargetTransition = nextTransition
    this.revision += 1
    this.engineConfigurationDirty = true
  }

  /** Stores the finite native look-ahead template selected by avatar-gaze. */
  setGazeLookAhead(request: AvatarGazeLookAhead | null): void {
    if (sameGazeLookAhead(this.gazeLookAhead, request)) return
    this.gazeLookAhead = request === null ? null : { ...request }
    this.revision += 1
    this.engineConfigurationDirty = true
  }

  /** Selects the current TH gaze profile without owning the camera. */
  setGazeMode(mode: 'idle' | 'speaking' | 'listening'): void {
    if (this.gazeMode === mode) return
    this.gazeMode = mode
    this.idleProfile = { ...this.idleProfile, speaking: mode === 'speaking' }
    this.setGaze(this.gazeEnabled, this.resolveGazeContact())
    this.engineConfigurationDirty = true
  }

  /** Stores the state-specific contact strengths supplied by avatar-gaze. */
  setGazeProfiles(profiles: Readonly<{
    idle?: number | null
    idleHeadMove?: number | null
    speaking?: number | null
    speakingHeadMove?: number | null
    listening?: number | null
    listeningHeadMove?: number | null
    ignoreCamera?: boolean
  }>): void {
    this.gazeProfiles = { ...profiles }
    if (!this.gazeProfilesConfigured) {
      this.gazeProfilesConfigured = true
      this.setGazeTarget(profiles.ignoreCamera === true ? 'ahead' : 'camera')
    }
    this.setGaze(this.gazeEnabled, this.resolveGazeContact())
    this.engineConfigurationDirty = true
  }

  /** Stages the host camera used by the next central gaze sample. */
  setGazeCamera(camera: Camera | null): void {
    if (this.gazeCamera === camera) return
    this.gazeCamera = camera
    this.revision += 1
    this.engineConfigurationDirty = true
  }

  /** Stores one animation selection for absolute-time application. */
  setAnimation(animation: ActiveAnimation): void {
    if (sameAnimation(this.animation, animation)) return
    this.animation = { ...animation }
    this.revision += 1
    this.engineConfigurationDirty = true
  }

  /** Releases the current animation and leaves other Avatar layers active. */
  releaseAnimation(): void {
    if (this.animation === null) return
    this.animation = null
    this.revision += 1
    this.engineConfigurationDirty = true
  }

  /** Applies all collected contributions at one absolute CodPlay time. */
  applyAt(timeMs: number): AvatarVector3 {
    const engine = this.engine
    if (engine === undefined) return NO_ROOT_MOTION

    const seeking = this.lastTimeMs !== undefined && (
      timeMs < this.lastTimeMs
      || (timeMs === this.lastTimeMs
        && this.lastAppliedRevision !== undefined
        && this.lastAppliedRevision !== this.revision)
    )
    if (seeking) {
      engine.prepareSeek()
      this.appliedMoodMorphs = undefined
      this.appliedAmbientMorphs = undefined
      this.appliedFixedMorphs = undefined
      this.appliedGestureKey = undefined
      this.appliedPose = undefined
      this.lastTimeMs = 0
      this.engineConfigurationDirty = true
    }

    this.applyTimelines(timeMs)
    this.applyMoodLayer()
    this.applyAmbientLayer(timeMs)
    this.applyFixedLayer()
    this.applyPoseLayer(timeMs)

    this.applyGestureSelection(timeMs)
    this.applyOverlayLayer()
    this.applyEngineConfiguration()

    if (seeking) {
      engine.commitSeek(timeMs)
    } else {
      const deltaMs = Math.max(0, timeMs - (this.lastTimeMs ?? timeMs))
      engine.animate(deltaMs)
    }
    const rootMotion = engine.applyAnimationAt(timeMs)
    this.lastTimeMs = timeMs
    this.lastAppliedRevision = this.revision
    return rootMotion
  }

  /** Samples feature streams in dependency order before composing the Avatar pose. */
  private applyTimelines(timeMs: number): void {
    for (const slot of ['mood', 'lip-sync', 'gaze', 'gesture'] as const) {
      this.timelines[slot]?.sample(timeMs)?.apply()
    }
  }

  /** Applies staged Avatar configuration only from the CodPlay presentation tick. */
  private applyEngineConfiguration(): void {
    const engine = this.engine
    if (engine === undefined) return

    if (this.engineConfigurationDirty) {
      engine.setBlinkScheduleFn(this.blinkSchedule)
      engine.setMood(this.moodName)
      engine.setTalkingHands(resolveTalkingHandsOptions(this.idleProfile))
      engine.setAnimation(this.animation)
      this.engineConfigurationDirty = false
    }

    engine.setGazeCamera(this.gazeCamera)
    engine.setGazeContact(this.resolveGazeContact())
    engine.setGazeHeadMove(this.resolveGazeHeadMove())
    engine.setGazeTarget(this.resolveEffectiveGazeTarget(), this.gazeTargetTransition)
    engine.setGazeLookAhead(this.gazeLookAhead)
    engine.setGazeEnabled(this.gazeEnabled)
    engine.setExplicitHandTargets(this.gestureHandTargets)
  }

  /** Applies the current mood baselines only when their layer changed. */
  private applyMoodLayer(): void {
    const engine = this.engine
    if (engine === undefined || sameMorphs(this.appliedMoodMorphs, this.moodMorphs)) return

    const names = new Set([
      ...Object.keys(this.appliedMoodMorphs ?? {}),
      ...Object.keys(this.moodMorphs),
    ])
    for (const name of names) {
      engine.morphEngine.setBaseline(name, this.moodMorphs[name] ?? null)
    }
    this.appliedMoodMorphs = { ...this.moodMorphs }
  }

  /** Samples and applies the deterministic TH idle/mood animation layer. */
  private applyAmbientLayer(timeMs: number): void {
    const engine = this.engine
    if (engine === undefined) return

    const frame = sampleThIdle(
      this.moodName,
      timeMs,
      this.resolveIdleTemplateOptions(),
      this.moodMorphs,
    )
    const morphs = frame.morphs
    this.ambientOverlay = frame.overlay
    this.idleEyeContact = frame.eyeContact ?? 0
    this.idleHeadMove = frame.headMove ?? 0
    if (frame.pose !== undefined && frame.pose !== this.pose) {
      this.pose = frame.pose
      this.poseStartAt = frame.poseStartAt ?? timeMs
      this.appliedPose = undefined
    }
    if (sameMorphs(this.appliedAmbientMorphs, morphs)) return

    const names = new Set([
      ...Object.keys(this.appliedAmbientMorphs ?? {}),
      ...Object.keys(morphs),
    ])
    for (const name of names) {
      engine.morphEngine.snapAmbient(name, morphs[name] ?? null)
    }
    this.appliedAmbientMorphs = { ...morphs }
  }

  /** Resolves the contact value for the active TH interaction state. */
  private resolveGazeContact(): number | null {
    if (this.gestureEyeContact !== undefined) return this.gestureEyeContact
    const selected = this.gazeProfiles[this.gazeMode]
    const base = selected === undefined ? this.gazeContact : selected
    return base === null ? this.idleEyeContact : base * this.idleEyeContact
  }

  /** Resolves the TH head-motion profile for the current interaction state. */
  private resolveGazeHeadMove(): number | null {
    if (this.gestureHeadMove !== undefined) return this.gestureHeadMove
    const key = `${this.gazeMode}HeadMove` as keyof typeof this.gazeProfiles
    const selected = this.gazeProfiles[key]
    const base = typeof selected === 'boolean' || selected === undefined ? this.gazeHeadMove : selected
    return base === null ? this.idleHeadMove : base * this.idleHeadMove
  }

  /** Adds the active TH gaze profile to the idle template evaluator. */
  private resolveIdleTemplateOptions(): ThIdleOptions {
    const speaking = this.idleProfile.speaking === true
    const contact = this.gazeMode === 'speaking'
      ? this.gazeProfiles.speaking
      : this.gazeMode === 'listening'
        ? this.gazeProfiles.listening
        : this.gazeProfiles.idle
    const headMove = this.gazeMode === 'speaking'
      ? this.gazeProfiles.speakingHeadMove
      : this.gazeMode === 'listening'
        ? this.gazeProfiles.listeningHeadMove
        : this.gazeProfiles.idleHeadMove
    return {
      ...this.idleProfile,
      eyeContactProbability: contact ?? (speaking
        ? TH_GAZE_DEFAULTS.speakingContact
        : TH_GAZE_DEFAULTS.idleContact),
      headMoveProbability: headMove ?? (speaking
        ? TH_GAZE_DEFAULTS.speakingHeadMove
        : TH_GAZE_DEFAULTS.idleHeadMove),
    }
  }

  /** Resolves the camera target after a temporary TH emoji override. */
  private resolveEffectiveGazeTarget(): AvatarGazeTarget {
    return this.gestureGazeTarget ?? this.gazeTarget
  }

  /** Applies TalkingHead's forward fallback when camera contact is disabled. */
  private resolveGestureGazeTarget(target: AvatarGazeTarget): AvatarGazeTarget {
    return target === 'camera' && this.gazeProfiles.ignoreCamera === true ? 'ahead' : target
  }

  /** Applies fixed morph targets and leaves playback easing to MorphEngine. */
  private applyFixedLayer(): void {
    const engine = this.engine
    const fixedMorphs = { ...this.gestureMorphs, ...this.speechMorphs }
    if (engine === undefined || sameMorphs(this.appliedFixedMorphs, fixedMorphs)) return

    const names = new Set([
      ...Object.keys(this.appliedFixedMorphs ?? {}),
      ...Object.keys(fixedMorphs),
    ])
    for (const name of names) {
      engine.morphEngine.setFixed(name, fixedMorphs[name] ?? null)
    }
    this.appliedFixedMorphs = { ...fixedMorphs }
  }

  /** Applies the current native gesture selection once per change or replay. */
  private applyGestureSelection(timeMs: number): void {
    const engine = this.engine
    if (engine === undefined) return

    const gestureKey = this.gesture === null
      ? 'none'
      : `${this.gesture.name}:${this.gesture.seed}:${this.gesture.mirror}:${this.gesture.startAt}`
    if (this.appliedGestureKey === gestureKey) return
    if (this.gesture === null) {
      engine.releaseGesture(timeMs)
    } else {
      engine.playGesture(
        this.gesture.name,
        createSeededRng(this.gesture.seed),
        this.gesture.mirror,
        this.gesture.startAt,
      )
    }
    this.appliedGestureKey = gestureKey
  }

  /** Combines ambient hand phrases with an authored gesture before composition. */
  private applyOverlayLayer(): void {
    this.engine?.setGestureOverlay(mergeOverlays(this.ambientOverlay, this.gestureOverlay))
  }

  /** Applies the selected body pose once per change or replay. */
  private applyPoseLayer(timeMs: number): void {
    const engine = this.engine
    const selectedPose = this.gesturePose ?? this.pose
    if (engine === undefined || selectedPose === undefined || this.appliedPose === selectedPose) return
    const startAt = this.gesturePose === undefined
      ? this.poseStartAt
      : this.gesturePoseStartAt ?? timeMs
    engine.setPose(selectedPose, Math.min(startAt, timeMs))
    this.appliedPose = selectedPose
  }
}

/** Compares two optional gesture contributions without serializing them. */
function sameGesture(left: GestureContribution, right: GestureContribution): boolean {
  if (left === null || right === null) return left === right
  return left.name === right.name
    && left.seed === right.seed
    && left.mirror === right.mirror
    && left.startAt === right.startAt
}

/** Builds the finite camera-contact transition used by TH emoji gestures. */
function resolveGestureGazeTransition(
  frame: AvatarGestureFrame,
  actionStartAt: number,
  ignoreCamera: boolean,
): AvatarGazeTargetTransition | undefined {
  if (frame.gazeTarget === undefined || frame.gazeTransitionMs === undefined) return undefined
  const durationMs = Math.max(0, frame.gazeTransitionMs)
  if (durationMs === 0) return undefined
  const target = frame.gazeTarget === 'camera' && ignoreCamera ? 'ahead' : frame.gazeTarget
  return {
    startAt: target === null ? actionStartAt + durationMs : actionStartAt,
    durationMs,
  }
}

/** Compares two absolute-time animation selections without serializing them. */
function sameAnimation(left: AnimationContribution, right: AnimationContribution): boolean {
  if (left === null || right === null) return left === right
  return left.name === right.name
    && left.startAt === right.startAt
    && left.speed === right.speed
    && left.loop === right.loop
    && left.durationMs === right.durationMs
    && left.releaseAt === right.releaseAt
    && left.transitionMs === right.transitionMs
}

/** Compares two finite look-ahead requests without serializing their payload. */
function sameGazeLookAhead(
  left: AvatarGazeLookAhead | null,
  right: AvatarGazeLookAhead | null,
): boolean {
  if (left === null || right === null) return left === right
  return left.startAt === right.startAt
    && left.durationMs === right.durationMs
    && left.seed === right.seed
}

/** Compares the optional absolute transition staged for the gaze target. */
function sameGazeTargetTransition(
  left: AvatarGazeTargetTransition | undefined,
  right: AvatarGazeTargetTransition | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right
  return left.startAt === right.startAt && left.durationMs === right.durationMs
}

/** Compares two morph layers without serializing their values. */
function sameMorphs(left: AvatarMorphs | undefined, right: AvatarMorphs): boolean {
  if (left === undefined) return false
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every((name) => Object.is(left[name], right[name]))
}

/** Compares idle options without keeping a second mutable animation state. */
function sameIdleProfile(left: ThIdleOptions, right: ThIdleOptions): boolean {
  return left.enabled === right.enabled
    && left.breathe === right.breathe
    && left.headMove === right.headMove
    && left.seed === right.seed
    && left.speaking === right.speaking
    && left.speakWithHands === right.speakWithHands
    && left.speakWithHandsProbability === right.speakWithHandsProbability
    && left.poseChanges === right.poseChanges
    && left.pose === right.pose
    && left.body === right.body
    && left.view === right.view
}

/** Converts the idle profile into the internal TH hand planner options. */
function resolveTalkingHandsOptions(options: ThIdleOptions): TalkingHandsOptions {
  return {
    enabled: options.speaking === true && options.speakWithHands === true,
    probability: options.speakWithHandsProbability ?? 0.5,
    seed: options.seed,
  }
}

/** Merges additive overlays without letting one source become a second writer. */
function mergeOverlays(
  ambient: AvatarGestureOverlay | null,
  gesture: AvatarGestureOverlay | null,
): AvatarGestureOverlay | null {
  if (ambient === null) return gesture
  if (gesture === null) return ambient

  const result: Record<string, {
    rotation?: { x: number; y: number; z: number }
    position?: { x: number; y: number; z: number }
  }> = {}
  for (const name of new Set([...Object.keys(ambient), ...Object.keys(gesture)])) {
    const left = ambient[name]
    const right = gesture[name]
    if (left === undefined) {
      result[name] = cloneOverlayValue(right)
      continue
    }
    if (right === undefined) {
      result[name] = cloneOverlayValue(left)
      continue
    }
    result[name] = {
      rotation: addVector(left.rotation, right.rotation),
      position: addVector(left.position, right.position),
    }
  }
  return result
}

/** Copies one overlay value while omitting absent channels. */
function cloneOverlayValue(value: NonNullable<AvatarGestureOverlay[string]>): {
  rotation?: { x: number; y: number; z: number }
  position?: { x: number; y: number; z: number }
} {
  return {
    ...(value.rotation === undefined ? {} : { rotation: { ...value.rotation } }),
    ...(value.position === undefined ? {} : { position: { ...value.position } }),
  }
}

/** Adds two optional overlay vectors. */
function addVector(
  left: { x: number; y: number; z: number } | undefined,
  right: { x: number; y: number; z: number } | undefined,
): { x: number; y: number; z: number } | undefined {
  if (left === undefined) return right === undefined ? undefined : { ...right }
  if (right === undefined) return { ...left }
  return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z }
}

/** Compares two optional sampled overlays without serializing Three.js data. */
function sameOverlay(left: AvatarGestureOverlay | null, right: AvatarGestureOverlay | null): boolean {
  if (left === null || right === null) return left === right
  const leftBones = Object.keys(left)
  const rightBones = Object.keys(right)
  if (leftBones.length !== rightBones.length) return false
  for (const boneName of leftBones) {
    const leftDelta = left[boneName]
    const rightDelta = right[boneName]
    if (leftDelta === undefined || rightDelta === undefined) return false
    if (!sameVector(leftDelta.rotation, rightDelta.rotation)) return false
    if (!sameVector(leftDelta.position, rightDelta.position)) return false
  }
  return true
}

/** Compares explicit TH hand tasks without serializing their target objects. */
function sameHandTargets(
  left: readonly AvatarHandTarget[],
  right: readonly AvatarHandTarget[],
): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    const first = left[index]!
    const second = right[index]!
    if (first.side !== second.side
      || first.startAt !== second.startAt
      || first.durationMs !== second.durationMs
      || first.release !== second.release
      || first.position.x !== second.position.x
      || first.position.y !== second.position.y
      || first.position.z !== second.position.z) return false
  }
  return true
}

/** Compares two optional three-axis deltas. */
function sameVector(
  left: { x: number; y: number; z: number } | undefined,
  right: { x: number; y: number; z: number } | undefined,
): boolean {
  if (left === undefined || right === undefined) return left === right
  return left.x === right.x && left.y === right.y && left.z === right.z
}


/** Creates the deterministic random source expected by the gesture engine. */
function createSeededRng(seed: number): { random: () => number } {
  let state = seed | 0
  return {
    random: () => {
      state = Math.imul(state ^ (state >>> 15), 1 | state)
      state = (state + Math.imul(state ^ (state >>> 7), 61 | state)) ^ state
      return ((state ^ (state >>> 14)) >>> 0) / 0x1_0000_0000
    },
  }
}
