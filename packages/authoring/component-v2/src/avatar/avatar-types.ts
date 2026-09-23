/**
 * Shared Avatar types.
 *
 * This file is the single type boundary for Avatar V2. Runtime modules keep
 * their algorithms and private implementation shapes locally; anything that
 * crosses two Avatar responsibilities or belongs to the author-facing API is
 * declared here.
 */
import type { PersoInitialCommon } from 'codplay'
import type { AnimationClip, Camera, Group, Object3D } from 'three'
import type { MorphEngine } from './morph/morph-engine.js'

/** One immutable three-axis value used by Avatar pose layers. */
export type AvatarVector3 = Readonly<{
  x: number
  y: number
  z: number
}>

/** One immutable quaternion value used by Avatar pose layers. */
export type AvatarQuaternion = Readonly<{
  x: number
  y: number
  z: number
  w: number
}>

/** One local transform contributed by an Avatar pose layer. */
export type AvatarPoseTransform = Readonly<{
  position?: AvatarVector3
  quaternion?: AvatarQuaternion
  scale?: AvatarVector3
}>

/** Complete local pose keyed by the native object it affects. */
export type AvatarPose = ReadonlyMap<Object3D, AvatarPoseTransform>

/** Additive transform contribution applied after semantic and clip layers. */
export type AvatarPoseDelta = ReadonlyMap<Object3D, Readonly<{
  rotation?: AvatarVector3
  position?: AvatarVector3
  scale?: AvatarVector3
}>>

/** One sampled Three.js animation layer. */
export type AvatarAnimationLayer = Readonly<{
  transforms: AvatarPose
  /** 0..1 while the clip enters from the semantic pose. */
  entryProgress?: number
  /** 0..1 during or after release toward the semantic pose. */
  releaseProgress?: number
  /** Horizontal offset applied by the central Avatar presentation group. */
  rootMotionOffset?: AvatarVector3
}>

/** Supported external animation containers. */
export type AvatarAnimationFormat = 'glb' | 'fbx'

/** Body form used by TalkingHead's model-specific idle alternatives. */
export type AvatarBody = 'M' | 'F'

/** Camera framing used by TalkingHead's model-specific idle alternatives. */
export type AvatarView = 'full' | 'mid' | 'upper' | 'head'

/** Named mood accepted by the Avatar expression layer. */
export type MoodName =
  | 'neutral' | 'happy' | 'angry' | 'sad' | 'fear' | 'disgust' | 'love' | 'sleep'
  | 'thinking' | 'nervous' | 'shy' | 'listen' | 'smirk' | 'grimace'
  | 'pleading' | 'sleeping' | 'frown' | 'squint' | 'curious'

/** Morph baseline associated with one mood. */
export type MoodBaseline = Record<string, number>

/** One resource associated with the central Avatar model. */
export type AvatarAnimationSource = Readonly<{
  /** URL of a preloaded GLB or FBX animation resource. */
  src: string
  /** Container format; inferred from `src` when omitted. */
  format?: AvatarAnimationFormat
  /** Clip name or zero-based clip index inside the resource. */
  clip?: string | number
  /** Whether the clip repeats or is held as a pose by default. */
  mode?: 'animation' | 'pose'
  /** Lets a one-shot clip bring the Avatar to its declared reference position. */
  rootMotion?: AvatarRootMotion
  /** Duration of the native transition into this clip. */
  entryTransitionMs?: number
  /** Position scale applied to imported animation tracks. */
  scale?: number
}>

/** Stable author data used to load one Avatar model into a Three host. */
export type AvatarInitial = PersoInitialCommon & Readonly<{
  /** URL of the prepared Avatar model resource. */
  src: string
  /** Prefix used to resolve the model morph targets. */
  morphPrefix?: string
  /** Named Three.js armature/model root. */
  modelRoot?: string
  /** Bone and model adjustment configuration. */
  retarget?: RetargetConfig
  /** Initial facial baseline. */
  mood?: MoodName
  /** Model-specific resting morph values. */
  baseline?: Readonly<Record<string, number>>
  /** Body form used by native idle-pose alternatives. */
  body?: AvatarBody
  /** Framing used by native idle-pose alternatives. */
  view?: AvatarView
  /** Limits standing-pose movement toward the straight reference. */
  modelMovementFactor?: number
  /** Initial rotation around the vertical axis, in radians. */
  modelRotationY?: number
  /** Reference position inside the Three host. */
  position?: readonly [number, number, number]
  /** Named animation resources loaded with this Avatar model. */
  animations?: Readonly<Record<string, AvatarAnimationSource>>
  /** Optional TalkingHead-style spring bones. */
  dynamicBones?: readonly AvatarDynamicBoneConfig[]
  /** Global TalkingHead DynamicBones switches. */
  dynamicBoneOptions?: AvatarDynamicBoneOptions
}>

/** Optional mood contribution attached to one Avatar target. */
export type AvatarMoodInitial = PersoInitialCommon & Readonly<{
  /** Initial facial expression. */
  mood?: MoodName
  /** Default transition duration. */
  durationMs?: number
}>

/** Optional lip-sync contribution attached to one Avatar target. */
export type AvatarLipSyncInitial = PersoInitialCommon & Readonly<{
  /** Initial canonical viseme, or null for a released mouth. */
  viseme?: string | null
  /** Initial viseme intensity multiplier. */
  weight?: number
  /** Default morph transition duration. */
  durationMs?: number
}>

/** Optional gesture contribution attached to one Avatar target. */
export type AvatarGestureInitial = PersoInitialCommon & Readonly<{
  /** Initial gesture name, or null for the active body pose. */
  gesture?: string | null
  /** Initial deterministic seed. */
  seed?: number
  /** Default active duration. */
  durationMs?: number
  /** Mirrors the native hand gesture. */
  mirror?: boolean
}>

/** Optional idle contribution attached to one Avatar target. */
export type AvatarIdleInitial = PersoInitialCommon & Readonly<{
  /** Initial body pose. */
  pose?: string
  /** Enables spontaneous eye blinking. */
  blink?: boolean
  /** Seed used to reproduce the blink schedule after seek. */
  blinkSeed?: number
  /** Enables the native TalkingHead breathing channel. */
  breathe?: boolean
  /** Enables the native TalkingHead head-movement channel. */
  headDrift?: boolean
  /** Allows delayed native pose changes. */
  poseChanges?: boolean
  /** Allows deterministic speaking-hand phrases. */
  speakWithHands?: boolean
  /** Probability of a speaking-hand phrase. */
  speakWithHandsProbability?: number
}>

/** Optional gaze contribution attached to one Avatar target. */
export type AvatarGazeInitial = PersoInitialCommon & Readonly<{
  /** Enables camera contact at initialization. */
  enabled?: boolean
  /** Initial camera-contact strength. */
  contact?: number | null
  /** Initial head-motion strength. */
  headMove?: number | null
  /** Default transition duration. */
  durationMs?: number
  /** Contact strength while idle. */
  idleContact?: number | null
  /** Head-motion strength while idle. */
  idleHeadMove?: number | null
  /** Contact strength while speaking. */
  speakingContact?: number | null
  /** Head-motion strength while speaking. */
  speakingHeadMove?: number | null
  /** Contact strength while listening. */
  listeningContact?: number | null
  /** Head-motion strength while listening. */
  listeningHeadMove?: number | null
  /** Uses TalkingHead's forward look-ahead behavior. */
  ignoreCamera?: boolean
}>

/** Optional animation contribution attached to one Avatar target. */
export type AvatarMotionInitial = PersoInitialCommon & Readonly<{
  /** Initial named animation or pose. */
  motion?: string | null
  /** Default playback speed. */
  speed?: number
  /** Default loop choice. */
  loop?: boolean
  /** Active duration before the motion returns to the Avatar pose. */
  durationMs?: number
}>

/** Dynamic payload accepted by one named mood action. */
export type AvatarMoodAction = Readonly<{
  /** Transition duration for this occurrence. */
  durationMs?: number
}>

/** Dynamic payload accepted by one ordinary viseme action. */
export type AvatarLipSyncAction = Readonly<{
  /** Canonical viseme carried by this occurrence. */
  viseme?: string | null
  /** Per-occurrence intensity multiplier. */
  weight?: number
  /** Morph transition duration. */
  durationMs?: number
}>

/** Dynamic payload accepted by one named gesture action. */
export type AvatarGestureAction = Readonly<{
  /** Optional deterministic seed. */
  seed?: number
  /** Optional active duration. */
  durationMs?: number
  /** Mirrors the native hand gesture. */
  mirror?: boolean
}>

/** Dynamic payload accepted by one named gaze action. */
export type AvatarGazeAction = Readonly<{
  /** Camera-contact strength. */
  contact?: number | null
  /** Head-motion strength. */
  headMove?: number | null
  /** Transition duration. */
  durationMs?: number
}>

/** Dynamic payload accepted by one named Avatar motion action. */
export type AvatarMotionAction = Readonly<{
  /** Playback speed. */
  speed?: number
  /** Whether this motion repeats. */
  loop?: boolean
  /** Active motion duration, or release hand-off duration on avatar:motion:release. */
  durationMs?: number
}>

/** Camera attention target used by the gaze layer. */
export type AvatarGazeTarget = 'camera' | 'ahead'

/** Absolute transition between two gaze targets. */
export type AvatarGazeTargetTransition = Readonly<{
  startAt: number
  durationMs: number
}>

/** One finite TalkingHead look-ahead template request. */
export type AvatarGazeLookAhead = Readonly<{
  startAt: number
  durationMs: number
  seed: number
}>

/** Scene-local timing options for an arrival animation. */
export type AvatarArrivalMotion = Readonly<{
  /** Identifies this resource as an arrival animation. */
  type: 'arrival'
  /** Slows the complete clip toward its final frame. */
  easing?: 'ease-out'
  /** Hand-off duration after the natural end. */
  transitionMs?: number
}>

/** Root-motion behavior selected by one Avatar animation resource. */
export type AvatarRootMotion = 'arrival' | AvatarArrivalMotion

/** Prepared arrival data shared by the clip sampler and presentation group. */
export type ArrivalRootMotion = Readonly<{
  clip: AnimationClip
  decelerate: boolean
  transitionMs?: number
  offsetAt: (clipTime: number) => AvatarVector3
}>

/** Configuration used while parsing one Avatar model. */
export type ModelLoaderOptions = Readonly<{
  /** Prefix stripped from raw morph target names. */
  morphPrefix?: string | RegExp
  /** Named armature/model root. */
  modelRoot?: string
  /** Mixamo retarget configuration. */
  retarget?: RetargetConfig
}>

/** Result of parsing one Avatar model resource. */
export type LoadedModel = Readonly<{
  scene: Group
  armature: Object3D | null
  morphNames: string[]
  boneMap: Map<string, Object3D>
  animations: readonly AnimationClip[]
}>

/** Bone adjustment configuration used by the model retargeter. */
export type RetargetConfig = Record<string, unknown>

/** Playback mode associated with one Avatar animation resource. */
export type AvatarAnimationMode = 'animation' | 'pose'

/** Absolute-time playback state selected by the Avatar motion component. */
export type ActiveAnimation = Readonly<{
  name: string
  startAt: number
  speed: number
  loop?: boolean
  /** Optional active duration before the clip hands back to the Avatar pose. */
  durationMs?: number
  releaseAt?: number
  transitionMs?: number
}>

/** Interface used to sample registered clips on the CodPlay clock. */
export type AvatarAnimationPlayer = Readonly<{
  register: (
    name: string,
    clip: AnimationClip,
    mode: AvatarAnimationMode,
    rootMotion?: AvatarRootMotion,
    entryTransitionMs?: number,
  ) => void
  get: (name: string) => AvatarAnimationMode | undefined
  set: (animation: ActiveAnimation | null) => void
  prepareSeek: () => void
  sampleAt: (timeMs: number) => AvatarAnimationLayer | null
  dispose: () => void
}>

/** One absolute rotation delta produced by a semantic motion overlay. */
export type AvatarOverlayRotation = Readonly<{
  x: number
  y: number
  z: number
}>

/** One absolute position delta produced by a semantic motion overlay. */
export type AvatarOverlayPosition = Readonly<{
  x: number
  y: number
  z: number
}>

/** Bone deltas sampled for one Avatar motion frame. */
export type AvatarGestureOverlay = Readonly<Record<string, Readonly<{
  rotation?: AvatarOverlayRotation
  position?: AvatarOverlayPosition
}>>>

/** Frame passed from the gesture component to the Avatar coordinator. */
export type AvatarGestureFrame = Readonly<{
  morphs: Readonly<Record<string, number | null>>
  gesture: string | null
  gestureStartMs: number
  mirror: boolean
  overlay: AvatarGestureOverlay | null
  eyeContact?: number
  headMove?: number
  pose?: string
  poseStartMs?: number
  handTargets: readonly AvatarHandTarget[]
  gazeTarget?: AvatarGazeTarget | null
  gazeTransitionMs?: number
  released: boolean
}>

/** Public metadata describing one available semantic Avatar motion. */
export type AvatarMotionDefinition = Readonly<{
  name: string
  track: 'action' | 'mood'
  description: string
  tags: readonly string[]
  durationMs: number
}>

/** Resolved semantic motion sampled on the CodPlay absolute clock. */
export type AvatarMotionPlayer = Readonly<{
  name: string
  durationMs: number
  sample: (timeMs: number) => AvatarGestureFrame
}>

/** Deterministic random source supplied to Avatar samplers. */
export type RandomSource = Readonly<{ random: () => number }>

/** Minimal seeded random interface used by the gesture engine. */
export type Rng = RandomSource

/** Fully resolved semantic skeletal pose. */
export type ResolvedPose = AvatarPose

/** Options for the deterministic TalkingHead speaking-hands layer. */
export type TalkingHandsOptions = Readonly<{
  enabled: boolean
  probability: number
  seed: number
}>

/** One native TalkingHead hand IK task. */
export type AvatarHandTarget = Readonly<{
  side: 'Left' | 'Right'
  position: Readonly<{ x: number; y: number; z: number }>
  startAt: number
  durationMs: number
  release: boolean
}>

/** One value accepted by a TalkingHead animation-template channel. */
export type ThTemplateNumber =
  | number
  | readonly [number, number]
  | readonly [number, number, number]
  | readonly [number, number, number, number]

/** One numeric animation-template channel. */
export type ThTemplateChannel = readonly (ThTemplateNumber | null)[]

/** The template subset used by Avatar idle layers. */
export type ThAnimationTemplate = Readonly<{
  delay?: ThTemplateNumber
  dt?: readonly ThTemplateNumber[]
  vs: Readonly<Record<string, ThTemplateChannel>>
}>

/** One probability-weighted template alternative. */
export type ThTemplateAlternative = Readonly<{
  probability?: number
  template: ThAnimationTemplate
}>

/** Native TalkingHead mood names used by the idle table. */
export type ThNativeMood =
  | 'neutral' | 'happy' | 'angry' | 'sad' | 'fear' | 'disgust' | 'love' | 'sleep'

/** Complete recurring animation family for one native mood. */
export type ThMoodTemplateSet = Readonly<{
  breathing: ThAnimationTemplate
  head: ThAnimationTemplate
  speakingHead: ThAnimationTemplate
  eyes: readonly ThTemplateAlternative[]
  speakingEyes: readonly ThTemplateAlternative[]
  blink: readonly ThTemplateAlternative[]
  mouth: ThAnimationTemplate
  misc: ThAnimationTemplate
}>

/** One body-pose variant selected by TalkingHead's state hierarchy. */
export type ThPoseVariant = Readonly<{
  name: string
  delay?: ThTemplateNumber
}>

/** One delayed body-pose choice from the native mood table. */
export type ThPoseChoice = Readonly<{
  name: string
  probability?: number
  delay: ThTemplateNumber
  body?: Readonly<Partial<Record<AvatarBody, ThPoseVariant>>>
  view?: Readonly<Partial<Record<AvatarView, ThPoseVariant>>>
}>

/** Mood names accepted by the idle animation layer. */
export type ThIdleMood =
  | 'neutral' | 'happy' | 'angry' | 'sad' | 'fear' | 'disgust' | 'love' | 'sleep'
  | 'thinking' | 'nervous' | 'shy' | 'listen' | 'smirk' | 'grimace'
  | 'pleading' | 'sleeping' | 'frown' | 'squint' | 'curious' | 'surprise'

/** Values produced by the internal idle layer before MorphEngine. */
export type ThIdleMorphs = Readonly<Record<string, number>>

/** Complete deterministic frame produced by the TalkingHead idle layer. */
export type ThIdleFrame = Readonly<{
  morphs: ThIdleMorphs
  overlay: AvatarGestureOverlay | null
  eyeContact?: number
  headMove?: number
  pose?: string
  poseStartAt?: number
}>

/** Options controlled by avatar-idle. */
export type ThIdleOptions = Readonly<{
  enabled: boolean
  breathe: boolean
  headMove: boolean
  seed: number
  /** TH probability for selecting the eye-contact alternative. */
  eyeContactProbability?: number
  /** TH probability for starting an automatic head-move task. */
  headMoveProbability?: number
  speaking?: boolean
  speakWithHands?: boolean
  speakWithHandsProbability?: number
  poseChanges?: boolean
  pose?: string
  body?: AvatarBody
  view?: AvatarView
}>

/** Per-frame blink value produced by the idle capability. */
export type BlinkScheduleFn = (args: { elapsed: number; mood?: string }) => { eyesClosed: number } | null | void

/** One value accepted by a native TalkingHead emoji template. */
export type ThEmojiValue =
  | number
  | string
  | boolean
  | null
  | readonly unknown[]
  | Readonly<Record<string, unknown>>

/** One source template copied from TalkingHead's animEmojis table. */
export type ThEmojiMotion = Readonly<{
  link?: string
  delay?: number | readonly number[]
  dt?: readonly (number | readonly number[])[]
  rescale?: readonly number[]
  vs: Readonly<Record<string, readonly ThEmojiValue[]>>
}>

/** Rotation range accepted by native gesture templates. */
export type RotationValue = number | [number, number] | [number, number, number, number]

/** Template values keyed by native bone property. */
export type GestureTemplate = Record<string, {
  x?: RotationValue
  y?: RotationValue
  z?: RotationValue
}>

/** Body-pose template keyed by native bone property. */
export type BodyPoseTemplate = GestureTemplate

/** Pose classification used to choose safe transition steps. */
export type AvatarPoseFlags = Readonly<{
  standing?: boolean
  sitting?: boolean
  bend?: boolean
  kneeling?: boolean
  lying?: boolean
}>

/** Complete native body-pose definition. */
export type AvatarPoseRotation = Readonly<{ x?: number; y?: number; z?: number }>

/** Complete native pose definition copied from TalkingHead. */
export type AvatarPoseDefinition = Readonly<{
  standing?: boolean
  sitting?: boolean
  bend?: boolean
  kneeling?: boolean
  lying?: boolean
  props: Readonly<Record<string, AvatarPoseRotation>>
}>

/** Dynamic-bone integration mode from TalkingHead. */
export type AvatarDynamicBoneType = 'point' | 'link' | 'mix1' | 'mix2' | 'full'

/** One optional dynamic-bone exclusion volume. */
export type AvatarDynamicBoneExclude = Readonly<{
  bone: string
  radius: number
  deltaLocal?: readonly [number, number, number]
}>

/** Author configuration for one dynamic bone. */
export type AvatarDynamicBoneConfig = Readonly<{
  bone: string
  type?: AvatarDynamicBoneType
  stiffness?: number | readonly [number, number, number, number]
  damping?: number | readonly [number, number, number, number]
  external?: number
  movementFactor?: number
  limits?: readonly (readonly [number | null, number | null] | null)[]
  pivot?: boolean
  deltaLocal?: readonly [number, number, number]
  deltaWorld?: readonly [number, number, number]
  excludes?: readonly AvatarDynamicBoneExclude[]
}>

/** Global DynamicBones switches exposed by TalkingHead. */
export type AvatarDynamicBoneOptions = Readonly<{
  warmupMs?: number
  sensitivityFactor?: number
  movementFactor?: number
  isExcludes?: boolean
  isPivots?: boolean
  isLimits?: boolean
}>

/** One morph target slot in a Three.js mesh. */
export type MorphSlot = { influences: number[]; index: number }

/** Bone-driven morph names handled by Avatar's pose layer. */
export type BoneMorphName =
  | 'bodyRotateX' | 'bodyRotateY' | 'bodyRotateZ'
  | 'headRotateX' | 'headRotateY' | 'headRotateZ'
  | 'handFistLeft' | 'handFistRight'
  | 'chestInhale'

/** Mutable state held by one MorphEngine entry. */
export type MorphEntry = {
  fixed: number | null
  system: number | null
  ambient: number | null
  baseline: number | null
  value: number
  applied: number
  v: number
  needsUpdate: boolean
  acc: number
  maxv: number
  min: number
  max: number
  limit: ((value: number) => number) | null
  onchange: ((value: number) => void) | null
  slots: MorphSlot[]
  boneName?: BoneMorphName
}

/** Alias that fans out to multiple real morphs. */
export type MorphAlias = {
  targets: { name: string; factor: number }[]
}

/** Receives values for bone-driven morphs. */
export type BoneCallback = (name: BoneMorphName, value: number) => void

/** Stores bone-morph values and exposes their skeletal contribution. */
export type BoneMorphBinding = BoneCallback & Readonly<{
  getDelta: () => AvatarPoseDelta
}>

/** Morph layer contributed by one Avatar capability. */
export type AvatarMorphs = Readonly<Record<string, number>>

/** One absolute-time frame staged for the central Avatar presentation. */
export type AvatarTimelineFrame = Readonly<{
  value: unknown
  apply: () => void
}>

/** One feature timeline sampled by Avatar's single CodPlay-clocked stream. */
export type AvatarTimeline = Readonly<{
  id: string
  startAt: number
  endAt: number
  sample: (timeMs: number) => AvatarTimelineFrame | undefined
}>

/** Feature slot used to keep Avatar contribution order deterministic. */
export type AvatarTimelineSlot = 'mood' | 'lip-sync' | 'gaze' | 'gesture'

/** Capability published by the central Avatar component to attached features. */
export type AvatarTarget = Readonly<{
  /** Replaces one feature's absolute-time contribution before the next tick. */
  setTimeline: (slot: AvatarTimelineSlot, timeline: AvatarTimeline) => void
  applyMood: (morphs: AvatarMorphs) => void
  setMood?: (name: MoodName) => void
  setIdleProfile: (options: Readonly<{
    enabled: boolean
    breathe: boolean
    headMove: boolean
    seed: number
    speaking?: boolean
    speakWithHands?: boolean
    speakWithHandsProbability?: number
    poseChanges?: boolean
    pose?: string
  }>) => void
  applyMorphs: (morphs: AvatarMorphs) => void
  applyGestureMotion: (
    frame: AvatarGestureFrame,
    seed?: number,
    startAt?: number,
    actionStartAt?: number,
  ) => void
  setBlinkSchedule: (schedule: BlinkScheduleFn | null) => void
  setGaze: (enabled: boolean, contact?: number | null, headMove?: number | null) => void
  setGazeTarget?: (target: AvatarGazeTarget, transition?: AvatarGazeTargetTransition) => void
  setGazeLookAhead?: (request: AvatarGazeLookAhead | null) => void
  setGazeMode?: (mode: 'idle' | 'speaking' | 'listening') => void
  setGazeProfiles?: (profiles: Readonly<{
    idle?: number | null
    idleHeadMove?: number | null
    speaking?: number | null
    speakingHeadMove?: number | null
    listening?: number | null
    listeningHeadMove?: number | null
    ignoreCamera?: boolean
  }>) => void
  setAnimation: (animation: ActiveAnimation) => void
  releaseAnimation: () => void
}>

/** Options used to build one Avatar engine instance. */
export type AvatarEngineOptions = {
  mood?: MoodName
  baseline?: Readonly<Record<string, number>>
  modelMovementFactor?: number
  dynamicBones?: readonly AvatarDynamicBoneConfig[]
  dynamicBoneOptions?: AvatarDynamicBoneOptions
}

/** Runtime interface exposed by the internal Avatar coordinator. */
export type AvatarEngine = {
  loadModel(buffer: ArrayBuffer, opts?: ModelLoaderOptions): Promise<{
    scene: Group
    boneMap: Map<string, Object3D>
    animations: readonly AnimationClip[]
  }>
  animate(deltaMs: number): void
  prepareSeek(): void
  commitSeek(timelineMs: number): void
  setMood(name: MoodName): void
  setPose(name: string, startAt?: number): boolean
  playGesture(name: string, rng: Rng, mirror?: boolean, startAt?: number): ResolvedPose | null
  releaseGesture(startAt?: number): void
  setGestureOverlay(overlay: AvatarGestureOverlay | null): void
  setTalkingHands(options: TalkingHandsOptions): void
  setExplicitHandTargets(targets: readonly AvatarHandTarget[]): void
  setBlinkScheduleFn(fn: BlinkScheduleFn | null): void
  setGazeCamera(camera: Camera | null): void
  setGazeEnabled(enabled: boolean): void
  setGazeContact(value: number | null): void
  setGazeHeadMove(value: number | null): void
  setGazeTarget(target: AvatarGazeTarget, transition?: AvatarGazeTargetTransition): void
  setGazeLookAhead(request: AvatarGazeLookAhead | null): void
  readonly morphEngine: MorphEngine
  registerAnimation(
    name: string,
    clip: AnimationClip,
    mode: AvatarAnimationMode,
    rootMotion?: AvatarRootMotion,
    entryTransitionMs?: number,
  ): void
  getAnimation(name: string): AvatarAnimationMode | undefined
  setAnimation(animation: ActiveAnimation | null): void
  applyAnimationAt(timeMs: number): AvatarVector3
}
