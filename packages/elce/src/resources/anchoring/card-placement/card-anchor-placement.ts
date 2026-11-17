export const CARD_ANCHOR_WIDTH = {
  FULL: 'full',
  HALF: 'half',
  THIRD: 'third',
  QUARTER: 'quarter',
} as const

export type CardAnchorWidth = typeof CARD_ANCHOR_WIDTH[keyof typeof CARD_ANCHOR_WIDTH]

export const CARD_ANCHOR_SIDE = {
  LEFT: 'left',
  RIGHT: 'right',
} as const

export type CardAnchorSide = typeof CARD_ANCHOR_SIDE[keyof typeof CARD_ANCHOR_SIDE]

export type CardAnchorPlacement = Readonly<{
  width: CardAnchorWidth
  side: CardAnchorSide
}>

export const DEFAULT_CARD_ANCHOR_PLACEMENT: CardAnchorPlacement = {
  width: CARD_ANCHOR_WIDTH.FULL,
  side: CARD_ANCHOR_SIDE.LEFT,
}

/** Validates the serialized width option at the Section markup boundary. */
export function cardAnchorWidthFrom(value: unknown): CardAnchorWidth {
  if (value === CARD_ANCHOR_WIDTH.HALF || value === CARD_ANCHOR_WIDTH.THIRD || value === CARD_ANCHOR_WIDTH.QUARTER) return value
  return CARD_ANCHOR_WIDTH.FULL
}

/** Validates the serialized side option at the Section markup boundary. */
export function cardAnchorSideFrom(value: unknown): CardAnchorSide {
  return value === CARD_ANCHOR_SIDE.RIGHT ? CARD_ANCHOR_SIDE.RIGHT : CARD_ANCHOR_SIDE.LEFT
}

/** Converts an authoring width choice to the CSS fraction used by the slot. */
export function cardAnchorInlineSizeFor(width: CardAnchorWidth): string {
  if (width === CARD_ANCHOR_WIDTH.HALF) return '50%'
  if (width === CARD_ANCHOR_WIDTH.THIRD) return '33.3333333333%'
  if (width === CARD_ANCHOR_WIDTH.QUARTER) return '25%'
  return '100%'
}

/** Builds the responsive float box that reserves the anchored Card's own ratio. */
export function cardAnchorSlotStyleFor(
  placement: CardAnchorPlacement,
  aspectRatio: string | null,
  fixedBlockSize: string | null,
): Readonly<Record<string, string>> {
  return {
    display: 'block',
    float: placement.side,
    width: cardAnchorInlineSizeFor(placement.width),
    aspectRatio: aspectRatio ?? 'auto',
    height: fixedBlockSize ?? 'auto',
    marginLeft: placement.width !== CARD_ANCHOR_WIDTH.FULL && placement.side === CARD_ANCHOR_SIDE.RIGHT ? '1rem' : '0',
    marginRight: placement.width !== CARD_ANCHOR_WIDTH.FULL && placement.side === CARD_ANCHOR_SIDE.LEFT ? '1rem' : '0',
    marginBlock: '2rem',
  }
}

/** Places the Card frame on its float slot without stretching its media ratio. */
export function cardAnchorFrameStyleFor(
  placement: CardAnchorPlacement,
  aspectRatio: string | null,
  fixedBlockSize: string | null,
): Readonly<Record<string, string>> {
  return {
    position: 'absolute',
    insetInlineStart: placement.side === CARD_ANCHOR_SIDE.LEFT ? 'anchor(left)' : 'auto',
    insetInlineEnd: placement.side === CARD_ANCHOR_SIDE.RIGHT ? 'anchor(right)' : 'auto',
    insetBlockStart: 'anchor(top)',
    width: 'anchor-size(width)',
    aspectRatio: aspectRatio ?? 'auto',
    height: fixedBlockSize ?? 'auto',
  }
}
