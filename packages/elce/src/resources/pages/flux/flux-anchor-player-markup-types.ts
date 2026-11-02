/** Identifies the CodPlay part used by a bdc anchor in a Flux Section. */
export type FluxAnchorTarget = Readonly<{
  readonly bdcId: string
  readonly partId: string
  readonly paddingBottom: string
  readonly layoutId: string
  readonly sectionBdcId?: string
}>

export type FluxAnchorMarkupTarget = Readonly<{
  readonly bdcId: string
  readonly partId: string
  readonly paddingBottom: string
}>
