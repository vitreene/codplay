import { createRemote } from '@codplay/remote'
import type { CodPlayTelco } from '../../../../codplay-v2/src'

type V2DemoTelcoOptions = Readonly<{
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}>

/** Adapts the official V2 remote to the common demo layout logger. */
export function createV2DemoTelco(telco: CodPlayTelco, options: V2DemoTelcoOptions): {
  element: HTMLElement
  destroy: () => void
} {
  return createRemote({
    telco,
    onInfo: (message) => options.onLog(message),
    onError: (message) => options.onLog(message, 'error'),
  })
}
