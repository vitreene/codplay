import type { SceneDoc } from '../../../../codplay-v2/src/scene/types'

/** Severity used by the non-blocking V2 demo log panel. */
export type V2DemoLogLevel = 'info' | 'warn' | 'error'

/** Scene-only module contract loaded lazily for one selected V2 demo. */
export type V2DemoModule = Readonly<{
  createScene: () => SceneDoc
}>
