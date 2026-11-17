import type { CardAnchorSide, CardAnchorWidth } from '../../anchoring/card-placement/card-anchor-placement'

/** Identifies the CodPlay part used by a bdc anchor in a Flux Section. */
export type FluxAnchorTarget = Readonly<{
  readonly bdcId: string
  readonly partId: string
  readonly paddingBottom: string
  readonly placementWidth?: CardAnchorWidth
  readonly placementSide?: CardAnchorSide
  readonly layoutId: string
  readonly sectionBdcId?: string
}>

export type FluxAnchorMarkupTarget = Readonly<{
  readonly bdcId: string
  readonly partId: string
  readonly paddingBottom: string
  readonly placementWidth?: CardAnchorWidth
  readonly placementSide?: CardAnchorSide
}>
