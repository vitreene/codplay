import type { Camera } from 'three'
import { MOOD_BASELINES } from '../mood/mood-baselines.js'
import type {
  ActiveAnimation,
  AvatarBody,
  AvatarEngine,
  AvatarGestureFrame,
  AvatarGestureHistoryEvent,
  AvatarGestureOverlay,
  AvatarGazeLookAhead,
  AvatarGazeTarget,
  AvatarGazeTargetTransition,
  AvatarHandTarget,
  AvatarMoodOccurrence,
  AvatarMorphs,
  AvatarTimeline,
  AvatarTimelineSlot,
  AvatarVector3,
  AvatarView,
  BlinkScheduleFn,
  MoodName,
  TalkingHandsOptions,
  ThIdleFrame,
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
  private moodStartAt = 0
  private moodHistory: readonly AvatarMoodOccurrence[]
  private idleProfile: ThIdleOptions
  private gesture: GestureContribution = null
  private gestureHistory: readonly AvatarGestureHistoryEvent[] = []
  private gestureReleaseAt = 0
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
  private gestureMorphWeight = 1
  private gestureMorphWeights: AvatarMorphs = {}
  private gestureOverlay: AvatarGestureOverlay | null = null
  private gestureActionStartAt: number | undefined
  private gestureGazeTarget: AvatarGazeTarget | undefined
  private gestureHandTargets: readonly AvatarHandTarget[] = []
  private gesturePose: string | undefined
  private gesturePoseStartAt: number | undefined
  private ambientOverlay: AvatarGestureOverlay | null = null
  private appliedMoodMorphs: AvatarMorphs | undefined
  private appliedAmbientMorphs: AvatarMorphs | undefined
  private appliedFixedMorphs: AvatarMorphs | undefined
  private appliedSpeechMorphs: AvatarMorphs | undefined
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
    this.moodHistory = [{ mood: initialMood, startAt: 0 }]
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
    this.appliedSpeechMorphs = undefined
    this.appliedGestureKey = undefined
    this.appliedPose = undefined
    this.lastTimeMs = undefined
    this.lastAppliedRevision = undefined
    this.revision += 1
  }

  /** Releases the native engine owned by the central Avatar component. */
  detachEngine(): void {
    this.engine = undefined
    this.appliedMoodMorphs = undefined
    this.appliedAmbientMorphs = undefined
    this.appliedFixedMorphs = undefined
    this.appliedSpeechMorphs = undefined
    this.appliedGestureKey = undefined
    this.gestureActionStartAt = undefined
    this.gestureGazeTarget = undefined
    this.gestureHandTargets = []
    this.gesturePose = undefined
    this.gesturePoseStartAt = undefined
    this.ambientOverlay = null
    this.appliedPose = undefined
    this.lastTimeMs = undefined
    this.lastAppliedRevision = undefined
    this.engineConfigurationDirty = true
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

  /** Stages skeletal gesture markers for reconstruction in the common stream. */
  setGestureHistory(events: readonly AvatarGestureHistoryEvent[]): void {
    if (sameGestureHistory(this.gestureHistory, events)) return
    this.gestureHistory = events.map((event) => ({ ...event }))
    this.revision += 1
  }

  /** Stores and applies the latest mood baseline contribution. */
  applyMood(morphs: AvatarMorphs): void {
    const next = { ...this.avatarBaseline, ...morphs }
    if (sameMorphs(this.moodMorphs, next)) return
    this.moodMorphs = next
    this.revision += 1
  }

  /** Stores the mood and the eventime from which its TH loops begin. */
  setMood(name: MoodName, startAt = 0): void {
    this.setMoodHistory([
      ...this.moodHistory.filter((occurrence) => occurrence.startAt < startAt),
      { mood: name, startAt },
    ])
  }

  /** Replaces the active mood history used to rebuild spontaneous pose changes. */
  setMoodHistory(occurrences: readonly AvatarMoodOccurrence[]): void {
    const next = [...occurrences].sort((left, right) => left.startAt - right.startAt)
    if (sameMoodHistory(this.moodHistory, next)) return
    this.moodHistory = next
    const latest = next.at(-1)
    const mood = latest?.mood ?? 'neutral'
    const startAt = latest?.startAt ?? 0
    if (this.moodName !== mood || this.moodStartAt !== startAt) {
      this.moodName = mood
      this.moodStartAt = startAt
      this.engineConfigurationDirty = true
    }
    this.revision += 1
  }

  /** Stages the automatic TH channels configured by the mood perso. */
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
    const nextMorphWeight = frame.released ? 0 : frame.morphWeight ?? 1
    const nextMorphWeights = frame.released || actionChanged ? {} : { ...this.gestureMorphWeights }
    if (frame.released) {
      for (const name of Object.keys(nextMorphs)) delete nextMorphs[name]
    } else {
      for (const [name, value] of Object.entries(frame.morphs)) {
        if (typeof value === 'number') {
          nextMorphs[name] = value
          const weight = frame.morphWeights?.[name]
          if (weight === undefined) delete nextMorphWeights[name]
          else nextMorphWeights[name] = weight
        }
      }
    }
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
      || this.gestureMorphWeight !== nextMorphWeight
      || !sameMorphs(this.gestureMorphWeights, nextMorphWeights)
      || !sameOverlay(this.gestureOverlay, frame.overlay)
      || !sameHandTargets(this.gestureHandTargets, nextHandTargets)
      || this.gesturePose !== nextPose
      || this.gesturePoseStartAt !== nextPoseStartAt
      || this.gestureGazeTarget !== nextGazeTarget
    if (!changed) return

    this.gesture = nextGesture
    if (nextGesture === null) this.gestureReleaseAt = startAt
    this.gestureActionStartAt = frame.released ? undefined : actionStartAt
    this.gestureMorphs = nextMorphs
    this.gestureMorphWeight = nextMorphWeight
    this.gestureMorphWeights = nextMorphWeights
    this.gestureOverlay = frame.overlay
    this.gestureHandTargets = nextHandTargets.map((target) => ({
      ...target,
      position: { ...target.position },
    }))
    this.gesturePose = nextPose
    this.gesturePoseStartAt = nextPoseStartAt
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
    const nextHeadMove = headMove === undefined ? this.gazeHeadMove : headMove
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
  applyAt(timeMs: number, applyRootMotion?: (offset: AvatarVector3) => void): AvatarVector3 {
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
      this.appliedAmbientMorphs = undefined
      this.appliedFixedMorphs = undefined
      this.appliedSpeechMorphs = undefined
      this.appliedGestureKey = undefined
      this.appliedPose = undefined
      this.lastTimeMs = 0
      this.engineConfigurationDirty = true
    }

    engine.resetSemantic?.()
    const rebuildSemantic = seeking || this.lastTimeMs === undefined
      || engine.resetSemantic !== undefined

    this.applyTimelines(timeMs)
    this.applyMoodLayer()
    this.applyAmbientLayer(timeMs, rebuildSemantic)
    this.applyFixedLayer()
    this.applyPoseLayer(timeMs)

    this.applyGestureSelection(rebuildSemantic)
    this.applyOverlayLayer()
    this.applyEngineConfiguration()

    if (seeking) {
      engine.commitSeek(timeMs)
    } else {
      const deltaMs = Math.max(0, timeMs - (this.lastTimeMs ?? timeMs))
      engine.animate(deltaMs, timeMs)
    }
    const rootMotion = engine.applyAnimationAt(timeMs, applyRootMotion)
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
      engine.setBlinkScheduleFn(this.blinkSchedule === null
        ? null
        : ({ elapsed, mood }) => this.blinkSchedule?.({
          elapsed: elapsed - this.moodStartAt,
          mood,
        }))
      engine.setMood(this.moodName)
      engine.setTalkingHands(resolveTalkingHandsOptions(this.idleProfile))
      engine.setAnimation(this.animation)
      this.engineConfigurationDirty = false
    }

    engine.setGazeCamera(this.gazeCamera)
    engine.setGazeContact(this.resolveGazeContact())
    engine.setGazeHeadMove(this.gazeHeadMove)
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
      engine.morphEngine.snapBaseline(name, this.moodMorphs[name] ?? null)
    }
    this.appliedMoodMorphs = { ...this.moodMorphs }
  }

  /** Samples and applies the deterministic TH idle/mood animation layer. */
  private applyAmbientLayer(timeMs: number, rebuildPoseHistory: boolean): void {
    const engine = this.engine
    if (engine === undefined) return

    const frame = this.sampleAmbientHistory(timeMs)
    if (rebuildPoseHistory) this.rebuildMoodPoseHistory(timeMs)
    const morphs = frame.morphs
    this.ambientOverlay = frame.overlay
    const framePoseStartAt = frame.poseStartAt === undefined
      ? timeMs
      : this.moodStartAt + frame.poseStartAt
    if (frame.pose !== undefined && (
      frame.pose !== this.pose || framePoseStartAt !== this.poseStartAt
    )) {
      this.pose = frame.pose
      this.poseStartAt = framePoseStartAt
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

  /** Rebuilds TH template handoffs and unfinished head tasks from mood events. */
  private sampleAmbientHistory(timeMs: number): ThIdleFrame {
    const options = this.resolveIdleTemplateOptions()
    const occurrences = this.moodHistory.filter((occurrence) => occurrence.startAt <= timeMs)
    if (occurrences.length === 0) {
      return sampleThIdle(this.moodName, 0, options, this.moodMorphs)
    }

    const continuedTasks: {
      occurrence: AvatarMoodOccurrence
      initialMorphs: AvatarMorphs
      endAt: number
      markerCutoffAt: number
      resolveHeadSourceAt: (elapsedMs: number) => Readonly<Record<string, number>>
    }[] = []
    let initialMorphs: AvatarMorphs = {}
    let frame: ThIdleFrame = { morphs: {}, overlay: null }

    for (let index = 0; index < occurrences.length; index += 1) {
      const occurrence = occurrences[index]!
      const next = occurrences[index + 1]
      const sampleAt = Math.min(timeMs, next?.startAt ?? timeMs)
      const previousTasks = [...continuedTasks]
      /** Resolves the latest autonomous head task before this mood takes ownership. */
      const resolveHeadSourceAt = (elapsedMs: number): Readonly<Record<string, number>> => {
        const absoluteAt = occurrence.startAt + elapsedMs
        for (const task of [...previousTasks].reverse()) {
          if (absoluteAt >= task.endAt) continue
          const previous = sampleThIdle(
            task.occurrence.mood,
            absoluteAt - task.occurrence.startAt,
            options,
            task.occurrence.baseline ?? MOOD_BASELINES[task.occurrence.mood],
            task.initialMorphs,
            task.markerCutoffAt,
            task.resolveHeadSourceAt,
          )
          if (previous.headMoveTask?.lastStartedAt !== undefined) return previous.morphs
        }
        return {}
      }
      const ownFrame = sampleThIdle(
        occurrence.mood,
        sampleAt - occurrence.startAt,
        options,
        occurrence.baseline ?? MOOD_BASELINES[occurrence.mood],
        initialMorphs,
        Number.POSITIVE_INFINITY,
        resolveHeadSourceAt,
      )
      const morphs: Record<string, number> = { ...ownFrame.morphs }
      if (ownFrame.headMoveTask?.lastStartedAt === undefined) {
        copyHeadRotation(morphs, resolveHeadSourceAt(sampleAt - occurrence.startAt))
      }
      if (ownFrame.headMoveTask !== undefined) copyHeadRotation(morphs, ownFrame.morphs)
      frame = { ...ownFrame, morphs }

      if (next === undefined) return frame
      if (ownFrame.headMoveTask !== undefined
        && occurrence.startAt + ownFrame.headMoveTask.endAt > next.startAt) {
        continuedTasks.push({
          occurrence,
          initialMorphs,
          endAt: occurrence.startAt + ownFrame.headMoveTask.endAt,
          markerCutoffAt: next.startAt - occurrence.startAt,
          resolveHeadSourceAt,
        })
      }
      initialMorphs = morphs
    }

    return frame
  }

  /** Replays mood and gesture skeletal selections in authored time order. */
  private rebuildMoodPoseHistory(timeMs: number): void {
    const engine = this.engine
    const initialPose = this.idleProfile.pose
    if (engine === undefined) return

    const poseEvents: AvatarGestureHistoryEvent[] = []
    if (this.idleProfile.enabled && initialPose !== undefined) {
      engine.setPose(initialPose, 0, 0)
      this.pose = initialPose
      this.poseStartAt = 0
      const options = this.resolveIdleTemplateOptions()
      const occurrences = this.moodHistory.filter((occurrence) => occurrence.startAt <= timeMs)
      for (let index = 0; index < occurrences.length; index += 1) {
        const occurrence = occurrences[index]!
        const nextOccurrence = occurrences[index + 1]
        const stopAt = Math.min(timeMs, nextOccurrence?.startAt ?? timeMs)
        const frame = sampleThIdle(
          occurrence.mood,
          Math.max(0, stopAt - occurrence.startAt),
          options,
          occurrence.baseline ?? MOOD_BASELINES[occurrence.mood],
        )
        for (const pose of frame.poseHistory ?? []) {
          const startAt = occurrence.startAt + pose.startAt
          if (nextOccurrence !== undefined && startAt >= nextOccurrence.startAt) continue
          if (startAt > timeMs) continue
          poseEvents.push({
            kind: 'pose', name: pose.name, startAt, seed: 0, mirror: false,
          })
        }
      }
    }

    let moodPose = initialPose
    let gesturePose: string | null = null
    let lastAppliedPose = initialPose
    const events = [
      ...poseEvents.map((event) => ({ ...event, source: 'mood' as const })),
      ...this.gestureHistory
        .filter((event) => event.startAt <= timeMs)
        .map((event) => ({ ...event, source: 'gesture' as const })),
    ].sort((left, right) => left.startAt - right.startAt)
    for (const event of events) {
      if (event.kind === 'gesture') {
        if (event.name === null) engine.releaseGesture(event.startAt)
        else engine.playGesture(event.name, createSeededRng(event.seed), event.mirror, event.startAt)
        continue
      }
      if (event.source === 'mood') {
        moodPose = event.name ?? undefined
        if (event.name !== null) {
          this.pose = event.name
          this.poseStartAt = event.startAt
        }
      } else {
        gesturePose = event.name
      }
      const selected = gesturePose ?? moodPose
      if (selected === undefined) continue
      engine.setPose(selected, event.startAt, undefined)
      lastAppliedPose = selected
    }
    this.appliedPose = lastAppliedPose
  }

  /** Keeps authored camera contact independent of spontaneous TH eye phrases. */
  private resolveGazeContact(): number | null {
    return this.gazeContact
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

  /** Applies already sampled speech and gesture morphs at the CodPlay date. */
  private applyFixedLayer(): void {
    const engine = this.engine
    const gestureMorphs: Record<string, number> = {}
    for (const [name, value] of Object.entries(this.gestureMorphs)) {
      const weight = this.gestureMorphWeights[name] ?? this.gestureMorphWeight
      const ambient = this.appliedAmbientMorphs?.[name] ?? this.moodMorphs[name] ?? 0
      gestureMorphs[name] = value + (this.moodMorphs[name] ?? 0) * weight
        + ambient * (1 - weight)
    }
    const fixedMorphs = { ...gestureMorphs, ...this.speechMorphs }
    if (engine === undefined || (
      sameMorphs(this.appliedFixedMorphs, fixedMorphs)
      && sameMorphs(this.appliedSpeechMorphs, this.speechMorphs)
    )) return

    const names = new Set([
      ...Object.keys(this.appliedFixedMorphs ?? {}),
      ...Object.keys(fixedMorphs),
    ])
    for (const name of names) {
      engine.morphEngine.snapFixed(name, fixedMorphs[name] ?? null)
    }
    this.appliedFixedMorphs = { ...fixedMorphs }
    this.appliedSpeechMorphs = { ...this.speechMorphs }
  }

  /** Applies the current native gesture selection once per change or replay. */
  private applyGestureSelection(historyRebuilt = false): void {
    const engine = this.engine
    if (engine === undefined) return

    const gestureKey = this.gesture === null
      ? 'none'
      : `${this.gesture.name}:${this.gesture.seed}:${this.gesture.mirror}:${this.gesture.startAt}`
    if (historyRebuilt && this.gestureHistory.length > 0) {
      this.appliedGestureKey = gestureKey
      return
    }
    if (this.appliedGestureKey === gestureKey) return
    if (this.gesture === null) {
      engine.releaseGesture(this.gestureReleaseAt)
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
    engine.setPose(
      selectedPose,
      Math.min(startAt, timeMs),
      this.gesturePose === undefined && startAt === 0 ? 0 : undefined,
    )
    this.appliedPose = selectedPose
  }
}

/** Compares authored skeletal markers without treating each update as a new action. */
function sameGestureHistory(
  left: readonly AvatarGestureHistoryEvent[],
  right: readonly AvatarGestureHistoryEvent[],
): boolean {
  return left.length === right.length && left.every((event, index) => {
    const other = right[index]
    return other !== undefined
      && event.kind === other.kind
      && event.name === other.name
      && event.startAt === other.startAt
      && event.seed === other.seed
      && event.mirror === other.mirror
  })
}

/** Preserves a native head task without replacing the new mood's eye loop. */
function copyHeadRotation(target: Record<string, number>, source: Readonly<Record<string, number>>): void {
  for (const name of ['headRotateX', 'headRotateY', 'headRotateZ']) {
    const value = source[name]
    if (value !== undefined) target[name] = value
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
  return left.startAt === right.startAt
    && left.durationMs === right.durationMs
    && left.from === right.from
}

/** Compares two morph layers without serializing their values. */
function sameMorphs(left: AvatarMorphs | undefined, right: AvatarMorphs): boolean {
  if (left === undefined) return false
  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  return leftKeys.every((name) => Object.is(left[name], right[name]))
}

/** Compares mood occurrences without retaining sampled pose frames. */
function sameMoodHistory(
  left: readonly AvatarMoodOccurrence[],
  right: readonly AvatarMoodOccurrence[],
): boolean {
  return left.length === right.length
    && left.every((occurrence, index) => {
      const other = right[index]
      return other !== undefined
        && occurrence.mood === other.mood
        && occurrence.startAt === other.startAt
        && (occurrence.baseline === undefined
          ? other.baseline === undefined
          : other.baseline !== undefined && sameMorphs(occurrence.baseline, other.baseline))
    })
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
