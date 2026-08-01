/** Authoring data and services supplied to one V2 component instance. */
export type ComponentInput<Initial extends Record<string, unknown> = Record<string, unknown>> = Readonly<{
  perso: Readonly<{
    id: string
    storyId: string
    initial: Initial
  }>
  services: ComponentServices
}>

/** One internal part discovered while materializing a component template. */
export type MaterializedPart = Readonly<{
  partId: string
  nodeRef: unknown
}>

/** One state update delivered by the V2 player to a component. */
export type ComponentUpdateInput<State extends Record<string, unknown> = Record<string, unknown>> = Readonly<{
  state: State
  timeMs: number
}>

/** Minimal runtime-facing service facade available to one component. */
export type ComponentServices = Readonly<{
  declare(names: readonly string[]): void
  apply(node: unknown, patch: Record<string, unknown>): void
  content?: Readonly<{
    apply(node: unknown, value: unknown): void
  }>
}>
