import type { SightyRuntimeApi } from '@codplay/sighty'

/** Levels accepted by the shared Sighty demonstration journal. */
export type SightyDemoLogLevel = 'info' | 'warn' | 'error'

/** Receives one message produced by a Sighty scenario or page control. */
export type SightyDemoLogger = (message: string, level?: SightyDemoLogLevel) => void

/** Groups the three transport operations exposed by the common page remote. */
export type SightyDemoTransport = Readonly<{
  play: () => Promise<void>
  pause: () => Promise<void>
  relaunch: () => Promise<void>
}>

/** Represents controls that a scenario optionally adds to the shared page. */
export type SightyDemoControls = Readonly<{
  destroy: () => void
}>

/** Provides the page-owned inputs needed to construct one Sighty scenario. */
export type SightyDemoFactoryOptions = Readonly<{
  stage: HTMLElement
  onLog: SightyDemoLogger
}>

/** Describes one mounted scenario independently from the page layout. */
export type SightyDemoSession = Readonly<{
  transport: SightyDemoTransport
  /** Controls whether the shared page transport is shown for this scenario. */
  showRemote?: boolean
  initialize: () => Promise<void>
  createOptionalControls?: (container: HTMLElement) => SightyDemoControls
  destroy: () => void
}>

/** Registers one scenario in the shared Sighty demo selector. */
export type SightyDemoDefinition = Readonly<{
  id: string
  title: string
  create: (options: SightyDemoFactoryOptions) => SightyDemoSession
}>

/** Narrows the generic runtime API to the common transport helper boundary. */
export type SightyDemoRuntime<SceneKey extends string = string, SlotName extends string = string> =
  SightyRuntimeApi<SceneKey, SlotName>
