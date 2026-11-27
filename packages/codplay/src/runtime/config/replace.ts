/** Default propagation envelope of split text, as a share of the duration. */
export const REPLACE_TEXT_STAGGER_SHARE = 0.4

/** Default propagation envelope of glyph rolls and mask grids, as a share of the duration. */
export const REPLACE_GRID_STAGGER_SHARE = 0.5

/** Mask grid used by `split: 'cells'` without dimensions. */
export const REPLACE_DEFAULT_GRID_COLUMNS = 4
export const REPLACE_DEFAULT_GRID_ROWS = 3

/**
 * Largest default propagation share of a replace duration, used to bound the
 * end of a split or cell transition before its DOM-measured duration is known.
 */
export const REPLACE_STAGGER_SHARE_UPPER_BOUND = Math.max(REPLACE_TEXT_STAGGER_SHARE, REPLACE_GRID_STAGGER_SHARE)
