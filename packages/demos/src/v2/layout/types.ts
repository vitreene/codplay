import type {
  CompiledResourceManifest,
  CodPlayEventime,
  CodPlayEventimeTarget,
  RuntimePreloadMode,
  SceneDoc,
} from 'codplay'

/** Severity used by the non-blocking V2 demo log panel. */
export type V2DemoLogLevel = 'info' | 'warn' | 'error'

/** One externally targeted eventime used by a shared V2 demo control. */
export type V2DemoEventInjection = Readonly<{
  eventime: CodPlayEventime
  target: CodPlayEventimeTarget
}>

/** Declarative playback capability rendered by the common layout telco. */
export type V2DemoPlayback = Readonly<{
  label: string
  injections: readonly V2DemoEventInjection[]
}>

/** Scene module and its lazily loaded, instance-scoped stylesheet. */
export type V2DemoModule = Readonly<{
  createScene: () => SceneDoc
  stylesheetUrl: string
  /** Adds scene resources that are not derivable from compiled `src` fields. */
  preloadManifest?: CompiledResourceManifest
  /** Selects whether unavailable demo resources block the mount. */
  preloadMode?: RuntimePreloadMode
  /** Optional external eventime sequence exposed by the common telco. */
  playback?: V2DemoPlayback
}>
