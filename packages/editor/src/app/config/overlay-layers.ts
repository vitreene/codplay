/** Stacking order of the editing overlays drawn above the scene, from back to front. */
export const OVERLAY_LAYERS = {
  /** Motion overlay root: paths and ghosts. */
  motionOverlay: '1050',
  /** Motion path control point. */
  motionControl: '1101',
  /** Selection Frame and the block move control. */
  selectionFrame: '1160',
  /** Path orientation toggle, above the Selection Frame. */
  orientationToggle: '1161',
} as const
