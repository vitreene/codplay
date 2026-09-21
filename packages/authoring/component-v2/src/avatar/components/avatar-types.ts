/** Public authoring types for the Avatar component family. */
import type { PersoInitialCommon } from 'codplay'
import type { MoodName } from '../mood/expression-engine'
import type { RetargetConfig } from '../model/model-loader'
export type { AvatarMorphs } from '../runtime/avatar-target'

/** Supported external animation container understood by the Avatar loader. */
export type AvatarAnimationFormat = 'glb' | 'fbx'

/** One animation resource associated with the central Avatar model. */
export type AvatarAnimationSource = Readonly<{
  /** URL of a preloaded GLB or FBX animation resource. */
  src: string
  /** Container format; inferred from `src` when omitted. */
  format?: AvatarAnimationFormat
  /** Clip name or zero-based clip index inside the resource. */
  clip?: string | number
  /** Whether the clip is a repeating animation or a held pose by default. */
  mode?: 'animation' | 'pose'
  /** Position scale applied to imported animation tracks. */
  scale?: number
}>

/** Stable author data used to load one Avatar model into a Three host. */
export type AvatarInitial = PersoInitialCommon & Readonly<{
  /** URL of the prepared Avatar model resource. */
  src: string
  /** Prefix used to resolve the model morph targets. */
  morphPrefix?: string
  /** Bone and model adjustment configuration applied by the Avatar engine. */
  retarget?: RetargetConfig
  /** Initial facial baseline applied before mood actions occur. */
  mood?: MoodName
  /** Initial rotation around the model's vertical axis, in radians. */
  modelRotationY?: number
  /** Initial local position of the model inside its Three host. */
  position?: readonly [number, number, number]
  /** Named animation resources loaded with this Avatar model. */
  animations?: Readonly<Record<string, AvatarAnimationSource>>
}>

/** Optional mood contribution attached to one Avatar target. */
export type AvatarMoodInitial = PersoInitialCommon & Readonly<{
  /** Initial facial expression selected by the mood component. */
  mood?: MoodName
  /** Default transition duration used when an authored mood event has none. */
  durationMs?: number
}>

/** Optional lip-sync contribution attached to one Avatar target. */
export type AvatarLipSyncInitial = PersoInitialCommon & Readonly<{
  /** Initial canonical viseme, or null for a released mouth. */
  viseme?: string | null
  /** Initial multiplier applied to the resolved viseme intensity. */
  weight?: number
  /** Default morph transition duration used when an event has none. */
  durationMs?: number
}>

/** Optional gesture contribution attached to one Avatar target. */
export type AvatarGestureInitial = PersoInitialCommon & Readonly<{
  /** Initial gesture name, or null for the active body pose. */
  gesture?: string | null
  /** Initial deterministic seed used by gesture variation. */
  seed?: number
  /** Default active duration used when a semantic motion event has none. */
  durationMs?: number
}>

/** Optional idle contribution attached to one Avatar target. */
export type AvatarIdleInitial = PersoInitialCommon & Readonly<{
  /** Initial body pose name applied before spontaneous idle motion. */
  pose?: string
  /** Enables spontaneous eye blinking. */
  blink?: boolean
  /** Seed used to reproduce the blink schedule after a seek. */
  blinkSeed?: number
  /** Enables the native breathing trigger. */
  breathe?: boolean
  /** Enables the contained body and head drift. */
  headDrift?: boolean
}>

/** Optional gaze contribution attached to one Avatar target. */
export type AvatarGazeInitial = PersoInitialCommon & Readonly<{
  /** Enables the camera-contact correction at initialization. */
  enabled?: boolean
  /** Initial camera-contact strength; null selects the native default. */
  contact?: number | null
  /** Default transition duration used when a gaze event has none. */
  durationMs?: number
}>

/** Optional animation contribution attached to one Avatar target. */
export type AvatarMotionInitial = PersoInitialCommon & Readonly<{
  /** Initial named animation or pose, or null to leave the Avatar idle. */
  motion?: string | null
  /** Default playback speed applied to motion actions. */
  speed?: number
  /** Default loop choice; the resource mode supplies the fallback. */
  loop?: boolean
}>

/** Dynamic payload accepted by one named mood action. */
export type AvatarMoodAction = Readonly<{
  /** Transition duration for this mood occurrence. */
  durationMs?: number
}>

/** Dynamic payload accepted by one ordinary viseme action. */
export type AvatarLipSyncAction = Readonly<{
  /** Canonical viseme carried by this speech occurrence. */
  viseme?: string | null
  /** Per-occurrence multiplier applied to the viseme intensity. */
  weight?: number
  /** Morph transition duration for this speech occurrence. */
  durationMs?: number
}>

/** Dynamic payload accepted by one named gesture action. */
export type AvatarGestureAction = Readonly<{
  /** Optional deterministic seed for this gesture occurrence. */
  seed?: number
  /** Optional active duration for this semantic motion occurrence. */
  durationMs?: number
}>

/** Dynamic payload accepted by one named gaze action. */
export type AvatarGazeAction = Readonly<{
  /** Camera-contact strength for this gaze occurrence. */
  contact?: number | null
  /** Transition duration for this gaze occurrence. */
  durationMs?: number
}>

/** Dynamic payload accepted by one named Avatar motion action. */
export type AvatarMotionAction = Readonly<{
  /** Playback speed for this motion occurrence. */
  speed?: number
  /** Whether this motion repeats until another motion or release arrives. */
  loop?: boolean
  /** Duration of the eased hand-off when this occurrence is a release action. */
  durationMs?: number
}>
