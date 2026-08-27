import type {
  CompiledResourceManifest,
  RuntimePreloadMode,
  SceneDoc,
} from '../../../../codplay-v2/src'

/** Severity used by the non-blocking V2 demo log panel. */
export type V2DemoLogLevel = 'info' | 'warn' | 'error'

/** Scene module and its lazily loaded, instance-scoped stylesheet. */
export type V2DemoModule = Readonly<{
  createScene: () => SceneDoc
  stylesheetUrl: string
  /** Adds scene resources that are not derivable from compiled `src` fields. */
  preloadManifest?: CompiledResourceManifest
  /** Selects whether unavailable demo resources block the mount. */
  preloadMode?: RuntimePreloadMode
}>
