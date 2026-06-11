import type { LayoutProfile } from './types'

export const LAYOUT_PROFILE_DESKTOP: LayoutProfile = {
  rowHeightElement: 28,
  rowHeightCapsule: 24,
  rowHeightCues: 32,
  rowHeightCuesExpanded: 80,
  rowHeightMarkers: 20,
  rowHeightWaveform: 48,
  snapThresholdPx: 8,
  keyframeHandleSizePx: 10,
}

export const LAYOUT_PROFILE_TOUCH: LayoutProfile = {
  rowHeightElement: 44,
  rowHeightCapsule: 36,
  rowHeightCues: 32,
  rowHeightCuesExpanded: 80,
  rowHeightMarkers: 28,
  rowHeightWaveform: 48,
  snapThresholdPx: 22,
  keyframeHandleSizePx: 20,
}

export const LAYOUT_PROFILE_DEFAULT: LayoutProfile = LAYOUT_PROFILE_DESKTOP
