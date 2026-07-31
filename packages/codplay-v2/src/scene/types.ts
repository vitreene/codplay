/** Function value allowed in authoring data before compilation extracts it. */
export type AuthorFunction = (...args: readonly unknown[]) => unknown

/** Open authoring record normalized by the scene builder. */
export type AuthorRecord = Record<string, unknown>

/** One authoring listen declaration. */
export type SceneListenRule = Readonly<{
  on: string
  transform?: readonly AuthorFunction[]
  emit?: readonly Readonly<Record<string, unknown>>[]
  straps?: readonly string[]
}>

/** One authoring perso document with fields normalized by the builder. */
export type PersoDoc = Readonly<{
  id: string
  name?: string
  type: string
  initial?: AuthorRecord
  actions?: Readonly<Record<string, unknown>>
  list?: AuthorRecord
  emit?: AuthorRecord
}>

/** One authoring story document with optional authoring conveniences. */
export type StoryDoc = Readonly<{
  id: string
  name?: string
  trackId?: string
  initial?: AuthorRecord
  persos: readonly PersoDoc[]
  tracks?: AuthorRecord
  straps?: readonly string[]
  listen?: readonly SceneListenRule[]
  eventimes?: readonly AuthorRecord[]
  state?: AuthorRecord
  init?: AuthorFunction
  disabled?: boolean
}>

/** Authoring scene document accepted by the V2 builder. */
export type SceneDoc = Readonly<{
  id: string
  name?: string
  stories: Readonly<Record<string, StoryDoc>>
  initial?: AuthorRecord
  straps?: readonly string[]
  listen?: readonly SceneListenRule[]
  state?: AuthorRecord
  tracks?: AuthorRecord
  init?: AuthorFunction
  onStart?: AuthorFunction
  onSequenceEnd?: AuthorFunction
  defaults?: AuthorRecord
}>

/** Canonical perso shape after authoring defaults have been completed. */
export type CanonicalPersoDoc = Omit<PersoDoc, 'initial' | 'actions'> & Readonly<{
  initial: AuthorRecord
  actions: Readonly<Record<string, unknown>>
}>

/** Canonical story shape after authoring defaults have been completed. */
export type CanonicalStoryDoc = Omit<StoryDoc, 'persos' | 'listen' | 'tracks'> & Readonly<{
  persos: readonly CanonicalPersoDoc[]
  listen: readonly SceneListenRule[]
  tracks: AuthorRecord
}>

/** Canonical scene shape consumed by V2 compilation stages. */
export type CanonicalSceneDoc = Omit<SceneDoc, 'stories' | 'listen' | 'tracks'> & Readonly<{
  stories: Readonly<Record<string, CanonicalStoryDoc>>
  listen: readonly SceneListenRule[]
  tracks: AuthorRecord
}>
