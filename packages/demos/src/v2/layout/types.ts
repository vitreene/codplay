import type { RuntimeTelco } from '../../../../codplay-v2/src/runtime/telco'

/** Severity used by the non-blocking V2 demo log panel. */
export type V2DemoLogLevel = 'info' | 'warn' | 'error'

/** Context supplied to one V2 demo after the common shell is mounted. */
export type V2DemoMountContext = Readonly<{
  stage: HTMLElement
  setTelco: (telco: RuntimeTelco) => void
  log: (message: string, level?: V2DemoLogLevel) => void
}>

/** Module contract loaded lazily for one selected V2 demo. */
export type V2DemoModule = Readonly<{
  mount: (context: V2DemoMountContext) => void | (() => void) | Promise<void | (() => void)>
}>
