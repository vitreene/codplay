import type {
  CompiledResourceManifest,
  CodPlayEngineOptions,
  CodPlayEventime,
  CodPlayEventimeTarget,
  RuntimePreloadMode,
  RuntimePreloadStrategy,
  SceneDoc,
} from 'codplay'
import type { CodPlayTelco } from 'codplay'
import type { HtmlSourceAdapterFactory } from 'codplay/runtime/runner-html'

type V2DemoTelcoStatus = ReturnType<CodPlayTelco['getState']>['status']

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

/** Progress and seek port supplied by a source component to the shared remote. */
export type V2DemoExternalTelcoState = Readonly<{
  timelineMs: number
  durationMs: number
  status?: V2DemoTelcoStatus
}>

export type V2DemoExternalTelcoTransport = Readonly<{
  getState: () => V2DemoExternalTelcoState
  getProgress: () => Readonly<{ timelineMs: number; durationMs: number }>
  readonly commandInFlight: boolean
  onProgress: (listener: (state: V2DemoExternalTelcoState) => void) => () => void
  seek: (targetMs: number) => Promise<void | Readonly<{
    ok: boolean
    error?: Readonly<{ message: string }>
  }>>
  rewind: () => Promise<void | Readonly<{
    ok: boolean
    error?: Readonly<{ message: string }>
  }>>
}>

/** Scene module and its lazily loaded, instance-scoped stylesheet. */
export type V2DemoModule = Readonly<{
  createScene: () => SceneDoc<string>
  stylesheetUrl: string
  /** Events sent through the public facade after the instance is ready. */
  initialEvents?: readonly V2DemoEventInjection[]
  /** Adds scene resources that are not derivable from compiled `src` fields. */
  preloadManifest?: CompiledResourceManifest
  /** Selects whether unavailable demo resources block the mount. */
  preloadMode?: RuntimePreloadMode
  /** Adds foreign capabilities while the shared layout retains engine ownership. */
  engineCapabilities?: Pick<CodPlayEngineOptions, 'components' | 'services' | 'modules' | 'libraries'>
  /** Adds optional browser sources at the shared HTML-host boundary. */
  sourceAdapterFactories?: readonly HtmlSourceAdapterFactory[]
  /** Supplies source-owned progress and seek while retaining the shared remote. */
  externalTelcoTransport?: V2DemoExternalTelcoTransport
  /** Strategies consumed by the shared V2 preload service. */
  preloadStrategies?: Readonly<Record<string, RuntimePreloadStrategy>>
  /** Optional external eventime sequence exposed by the common telco. */
  playback?: V2DemoPlayback
}>
