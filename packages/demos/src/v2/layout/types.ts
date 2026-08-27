import type { SceneDoc } from '../../../../codplay-v2/src/scene/types'

/** Severity used by the non-blocking V2 demo log panel. */
export type V2DemoLogLevel = 'info' | 'warn' | 'error'

/** Scene module and its lazily loaded, instance-scoped stylesheet. */
export type V2DemoModule = Readonly<{
  createScene: () => SceneDoc
  stylesheetUrl: string
}>
