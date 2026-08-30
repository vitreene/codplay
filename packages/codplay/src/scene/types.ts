import type { AuthorEmitDeclaration } from './capture/authoring-types'
import type { StrapFunction } from '../runtime/player/pipeline/strap-executor'
import type { ImageAction, ImageInitial } from '../runtime/components/image'
import type { InputAction, InputInitial } from '../runtime/components/input'
import type { LayoutAction, LayoutInitial } from '../runtime/components/layout'
import type { ListAction, ListInitial } from '../runtime/components/list'
import type { MediaAction, MediaInitial } from '../runtime/components/media'
import type { PolygonAction, PolygonInitial } from '../runtime/components/polygon'
import type { TagAction, TagInitial } from '../runtime/components/tag'

/** Function value allowed in authoring data before compilation extracts it. */
export type AuthorFunction = (...args: readonly unknown[]) => unknown

/** Named strap implementations owned by one scene or story. */
export type AuthorStrapCollection = Readonly<Record<string, StrapFunction>>

/** Strap declarations owned locally or named as an explicit reusable reference. */
export type AuthorStrapDeclarations = AuthorStrapCollection | readonly string[]

/** Open authoring record normalized by the scene builder. */
export type AuthorRecord = Record<string, unknown>

/** Component profiles exposed to the V2 SceneDoc authoring boundary. */
export interface PersoTypeRegistry {
  tag: { initial: TagInitial; action: TagAction }
  img: { initial: ImageInitial; action: ImageAction }
  input: { initial: InputInitial; action: InputAction }
  layout: { initial: LayoutInitial; action: LayoutAction }
  list: { initial: ListInitial; action: ListAction }
  media: { initial: MediaInitial; action: MediaAction }
  polygon: { initial: PolygonInitial; action: PolygonAction }
}

/** Built-in component type names understood by the V2 core catalog. */
export type CorePersoType = keyof PersoTypeRegistry

/** Author placement shared by initial profiles and action patches. */
type PersoPlacement = string | AuthorRecord

/** Common initial fields supplied by the scene boundary rather than a component. */
type PersoInitialCommon = Readonly<{
  move?: PersoPlacement
}>

/** Common action fields supplied by the scene boundary rather than a component. */
type PersoActionCommon = Readonly<{
  move?: PersoPlacement
  broadcast?: AuthorRecord
  ref?: string
  duration?: number
  delayMs?: number
  ease?: string
  /** Function payload accepted by the compiled TweenAction boundary. */
  fn?: (...args: never[]) => unknown
}>

/** One component-specific action patch with scene-level routing fields. */
type PersoActionPatch<T extends CorePersoType> = PersoActionCommon
  & PersoTypeRegistry[T]['action']
  & AuthorRecord

/** One static action-sequence step accepted in a typed V2 perso declaration. */
export type PersoActionSequenceStep<T extends CorePersoType> = Readonly<{
  action: PersoActionPatch<T>
  durationMs?: number
  startAt?: number
}>

/** Action declaration accepted by one typed V2 perso. */
export type PersoActionValue<T extends CorePersoType> =
  | PersoActionPatch<T>
  | true
  | null
  | readonly PersoActionSequenceStep<T>[]

/** Typed authoring perso for one built-in V2 component type. */
type CorePersoDoc<T extends CorePersoType> = Readonly<{
  id: string
  name?: string
  type: T
  initial?: PersoInitialCommon & PersoTypeRegistry[T]['initial']
  actions?: Readonly<Record<string, PersoActionValue<T>>>
  list?: AuthorRecord
  emit?: AuthorEmitDeclaration
}>

/** Open authoring perso form used when a foreign component type is registered. */
export type CustomPersoDoc<T extends string = string> = Readonly<{
  id: string
  name?: string
  type: T
  initial?: AuthorRecord
  actions?: Readonly<Record<string, unknown>>
  list?: AuthorRecord
  emit?: AuthorEmitDeclaration
}>

/** Event shape accepted as one output of an authoring listen transform. */
export type AuthorListenEvent = Readonly<{
  name: string
  data?: AuthorRecord
  visibility?: 'story' | 'scene' | 'public'
}>

/** V1-compatible listen transform contract producing ordered events. */
export type AuthorListenTransform = (event: AuthorListenEvent) => readonly AuthorListenEvent[] | undefined

/** One authoring listen declaration. */
export type SceneListenRule = Readonly<{
  on: string
  transform?: readonly AuthorListenTransform[]
  emit?: readonly Readonly<Record<string, unknown>>[]
  straps?: readonly string[]
}>

/** One authoring perso document, typed by its built-in or foreign component type. */
export type PersoDoc<T extends string = CorePersoType> = T extends CorePersoType
  ? CorePersoDoc<T>
  : CustomPersoDoc<T>

/** One authoring story document with optional authoring conveniences. */
export type StoryDoc<T extends string = CorePersoType> = Readonly<{
  id: string
  name?: string
  trackId?: string
  initial?: AuthorRecord
  persos: readonly PersoDoc<T>[]
  tracks?: AuthorRecord
  straps?: AuthorStrapDeclarations
  listen?: readonly SceneListenRule[]
  eventimes?: readonly AuthorRecord[]
  state?: AuthorRecord
  init?: AuthorFunction
  disabled?: boolean
}>

/** Runtime options passed to the V1-compatible scene lifecycle callbacks. */
export type SceneLifecycleOptions = Readonly<{
  /**
   * Keeps the V1 callback shape. V2 compiles every declared story and its
   * eventimes before playback, so scheduling an already compiled story is a
   * no-op at runtime.
   */
  schedule: (story: string | StoryDoc<string>) => void
}>

/** V1-compatible scene lifecycle callback signature retained at the V2 boundary. */
export type SceneLifecycleFunction = (scene: SceneDoc<string>, options: SceneLifecycleOptions) => void

/** Authoring scene document accepted by the V2 builder. */
export type SceneDoc<T extends string = CorePersoType> = Readonly<{
  id: string
  name?: string
  stories: Readonly<Record<string, StoryDoc<T>>>
  initial?: AuthorRecord
  straps?: AuthorStrapDeclarations
  listen?: readonly SceneListenRule[]
  state?: AuthorRecord
  tracks?: AuthorRecord
  init?: SceneLifecycleFunction
  onStart?: SceneLifecycleFunction
  onSequenceEnd?: SceneLifecycleFunction
  defaults?: AuthorRecord
}>

/** Canonical perso shape after authoring defaults have been completed. */
export type CanonicalPersoDoc = Readonly<{
  id: string
  name?: string
  type: string
  initial: AuthorRecord
  actions: Readonly<Record<string, unknown>>
  list?: AuthorRecord
  emit?: AuthorEmitDeclaration
}>

/** Canonical story shape after authoring defaults have been completed. */
export type CanonicalStoryDoc = Omit<StoryDoc<string>, 'persos' | 'listen' | 'tracks'> & Readonly<{
  persos: readonly CanonicalPersoDoc[]
  listen: readonly SceneListenRule[]
  tracks: AuthorRecord
}>

/** Canonical scene shape consumed by V2 compilation stages. */
export type CanonicalSceneDoc = Omit<SceneDoc<string>, 'stories' | 'listen' | 'tracks'> & Readonly<{
  stories: Readonly<Record<string, CanonicalStoryDoc>>
  listen: readonly SceneListenRule[]
  tracks: AuthorRecord
}>
