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
  captureOverlayPose,
  captureCombinedMatrixWithIndividualTransforms,
  captureNodeOwnMatrix,
  calibrateGhostToWorldSnapshot,
  ensureOverlayLayer,
  localFractionToViewportPoint,
  measureWorldRect
} from './overlay-pose'
export type { OverlayPose } from './overlay-pose'

export type {
  CapabilityPreset,
  CsCapability,
  CsRawMoveDiff,
  CsRawRotateDiff,
  CsRawScaleDiff,
  CsRawSizeDiff,
  CsValueAdapter,
  MultiSelectionFrameOptions,
  SelectionFrameHandle,
  SelectionFrameOptions,
  SelectionFramePart
} from './types'
