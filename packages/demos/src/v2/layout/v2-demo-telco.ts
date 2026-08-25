import { createTelcoRemote } from '../../../../codplay-v2/demos/shared/telco-remote'
import type { RuntimeTelco } from '../../../../codplay-v2/src/runtime/telco'

type V2DemoTelcoOptions = Readonly<{
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}>

/** Adapts the shared V2 validation remote to the common demo layout logger. */
export function createV2DemoTelco(telco: RuntimeTelco, options: V2DemoTelcoOptions): {
  element: HTMLElement
  destroy: () => void
} {
  return createTelcoRemote({
    telco,
    durationMs: telco.getState().durationMs,
    onInfo: (message) => options.onLog(message),
    onError: (message) => options.onLog(message, 'error'),
  })
}
