/** JSON-compatible primitive accepted by the compiled artifact. */
export type CompiledPrimitive = string | number | boolean | null

/** Named external function reference produced during compilation. */
export type CompiledFunctionReference = Readonly<{
  ref: string
}>

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
  emit?: CompiledRecord
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
  eventimes?: readonly CompiledRecord[]
  state?: CompiledRecord
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

/** Versioned, serializable, immutable-at-runtime playback artifact. */
export type CompiledScene = Readonly<{
  schemaVersion: string
  createdAt: string
  scene: CompiledSceneData
  resources: CompiledResourceManifest
  rootNodeIds: readonly string[]
  requirements: CompiledRequirements
}>
