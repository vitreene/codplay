export { createAuthorApi } from './author-api'
export type { AuthorApi, PlayerAuthorState } from './author-api'

export { createSelectionFrame } from './selection-frame'
export { createMultiSelectionFrame } from './multi-selection-frame'

export { csMachine, DEFAULT_CAPABILITIES } from './machine'
export type { CsMachineContext, CsMachineEvent } from './machine'

export { createLibreAdapter } from './adapters/libre-adapter'
export type { LibreAdapter, LibreAdapterMode, LibreAdapterOptions } from './adapters/libre-adapter'

export { createFlexAdapter, FLEX_POINT_ALIGNMENT } from './adapters/flex-adapter'
export type { FlexAdapter, FlexAdapterOptions, FlexAlignment, FlexAlignmentPoint } from './adapters/flex-adapter'

export { createGridPlacementAdapter } from './adapters/grid-placement-adapter'
export type { GridPlacementAdapter, GridPlacementAdapterOptions } from './adapters/grid-placement-adapter'

export { createFlexAnchorTool } from './flex-anchor-tool'
export type { FlexAnchorToolHandle, FlexAnchorToolOptions } from './flex-anchor-tool'

export {
  measureGridTracks,
  parseResolvedTrackList,
  uniformTrackGeometry,
  trackAnchorPx,
  trackSpanPx,
  trackIndexAtPx,
  nearestTrackAnchor,
  nearestTrackSpan
} from './grid-geometry'
export type { GridTrackGeometry } from './grid-geometry'

export {
  captureOverlayPose,
  captureCombinedMatrixWithIndividualTransforms,
  captureNodeOwnMatrix,
  captureOwnTransformComponents,
  calibrateGhostToWorldSnapshot,
  ensureOverlayLayer,
  localFractionToViewportPoint,
  measureWorldRect,
  ownCornerDisplacement
} from './overlay-pose'
export type { OverlayPose, OwnTransformComponents } from './overlay-pose'

export type {
  CapabilityPreset,
  CreationGeometry,
  CreationResult,
  CsCapability,
  CsRawMoveDiff,
  CsRawRotateDiff,
  CsRawScaleDiff,
  CsRawSizeDiff,
  CsValueAdapter,
  MultiSelectionFrameOptions,
  SelectionFrameCreationOptions,
  SelectionFrameHandle,
  SelectionFrameOptions,
  SelectionFramePart
} from './types'
