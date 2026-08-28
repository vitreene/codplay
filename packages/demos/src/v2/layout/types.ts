import type {
  CompiledResourceManifest,
  RuntimePreloadMode,
  SceneDoc,
} from 'codplay'

/** Severity used by the non-blocking V2 demo log panel. */
export type V2DemoLogLevel = 'info' | 'warn' | 'error'

/** Scene module and its lazily loaded, instance-scoped stylesheet. */
export type V2DemoModule = Readonly<{
  createScene: () => SceneDoc
  /** Duration owned by the scene module and passed to the instance at mount. */
  durationMs: number
  stylesheetUrl: string
  /** Adds scene resources that are not derivable from compiled `src` fields. */
  preloadManifest?: CompiledResourceManifest
  /** Selects whether unavailable demo resources block the mount. */
  preloadMode?: RuntimePreloadMode
}>
