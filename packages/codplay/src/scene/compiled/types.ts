/** JSON-compatible primitive accepted by the compiled artifact. */
export type CompiledPrimitive = string | number | boolean | null

/** Named external function reference produced during compilation. */
export type CompiledFunctionReference = Readonly<{
  ref: string
}>

/** Serializable event declaration produced by a capture conclusion. */
export type CompiledCaptureEvent = Readonly<{
  name: string
  data?: CompiledRecord
  cascade?: boolean
  mode?: 'apply-now' | 'persist-only'
}>

/** Serializable capture declaration with functions held as external references. */
export type CompiledCaptureDeclaration = Readonly<{
  trackOn?: readonly string[]
  endOn?: readonly string[]
  stateScope?: 'scene' | 'story'
  initCaptureStateRef?: CompiledFunctionReference
  trackCommandRef?: CompiledFunctionReference
  endEmit?: CompiledCaptureEvent
  endCaptureRef?: CompiledFunctionReference
}>

/** Serializable emit rule containing the optional capture declaration. */
export type CompiledEmitRule = Readonly<{
  event: CompiledCaptureEvent
  capture?: CompiledCaptureDeclaration
}>

/** Emit declarations indexed by the source trigger understood by an adapter. */
export type CompiledEmitDeclaration = Readonly<Record<string, CompiledEmitRule | readonly CompiledEmitRule[]>>

/** Recursive serializable value used by compiled scene sections. */
export type CompiledValue =
  | CompiledPrimitive
  | CompiledFunctionReference
  | readonly CompiledValue[]
  | CompiledRecord

/** Serializable record used by canonical compiled scene data. */
export interface CompiledRecord {
  readonly [key: string]: CompiledValue
}

/** One compiled listen declaration after function extraction. */
export type CompiledListenRule = Readonly<{
  on: string
  transform?: readonly CompiledFunctionReference[]
  emit?: readonly CompiledRecord[]
  straps?: readonly string[]
}>

/** One canonical compiled perso. */
export type CompiledPerso = Readonly<{
  id: string
  name?: string
  type: string
  initial: CompiledRecord
  actions: Readonly<Record<string, CompiledValue>>
  list?: CompiledRecord
  emit?: CompiledEmitDeclaration
}>

/** One relative timeline occurrence in the compiled story journal. */
export type CompiledEventime = Readonly<{
  name: string
  startAt: number
  visibility?: 'story' | 'scene' | 'public'
  data?: CompiledRecord
  events?: readonly CompiledEventime[]
}>

/** One canonical compiled story. */
export type CompiledStory = Readonly<{
  id: string
  name?: string
  trackId?: string
  initial?: CompiledRecord
  persos: readonly CompiledPerso[]
  tracks?: CompiledRecord
  straps?: readonly string[]
  listen: readonly CompiledListenRule[]
  eventimes?: readonly CompiledEventime[]
  state?: CompiledRecord
  init?: CompiledFunctionReference
}>

/** Canonical scene payload read by the player. */
export type CompiledSceneData = Readonly<{
  id: string
  name?: string
  stories: Readonly<Record<string, CompiledStory>>
  initial?: CompiledRecord
  straps?: readonly string[]
  listen: readonly CompiledListenRule[]
  state?: CompiledRecord
  tracks: CompiledRecord
  defaults?: CompiledRecord
  init?: CompiledFunctionReference
  onStart?: CompiledFunctionReference
  onSequenceEnd?: CompiledFunctionReference
}>

/** One resource entry declared by the compiled scene. */
export type CompiledResource = Readonly<{
  url: string
  type: string
  policy: Readonly<{
    cache: 'default' | 'no-store' | 'immutable'
    version?: string
    hash?: string
    priority?: 'high' | 'normal' | 'low'
  }>
}>

/** Resource manifest carried by the compiled artifact. */
export type CompiledResourceManifest = Readonly<{
  entries: readonly CompiledResource[]
}>

/** Capabilities required by one compiled scene. */
export type CompiledRequirements = Readonly<{
  components: readonly string[]
  services: readonly string[]
  modules: readonly string[]
  resources: readonly string[]
}>

/** One target identity indexed from an already compiled action declaration. */
export type CompiledActionTarget = Readonly<{
  storyId: string
  persoId: string
}>

/** Derived lookup from an action name to its compiled perso targets. */
export type CompiledActionTargetIndex = Readonly<Record<string, readonly CompiledActionTarget[]>>

/** Versioned, serializable, immutable-at-runtime playback artifact. */
export type CompiledScene = Readonly<{
  schemaVersion: string
  createdAt: string
  scene: CompiledSceneData
  resources: CompiledResourceManifest
  rootNodeIds: readonly string[]
  requirements: CompiledRequirements
  /** Derived index emitted from the fixed action declarations by SceneBuilder. */
  actionTargetIndex: CompiledActionTargetIndex
}>
