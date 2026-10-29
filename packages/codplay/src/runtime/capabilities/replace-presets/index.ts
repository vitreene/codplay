export {
  REPLACE_DIRECTIONS,
  REPLACE_SLOT_TRANSITIONS,
  REPLACE_STAGGER_PATTERNS,
  REPLACE_MEDIA_SPLITS,
  REPLACE_TEXT_SPLITS,
  isReplacePresetName,
  isReplaceSlotTransition,
  isReplaceMaskShape,
  isReplaceStaggerPattern,
  normalizeReplacePresetCommand,
} from './replace-preset-config'
export type {
  ReplaceDirection,
  ReplaceMediaSplit,
  ReplaceMediaOptions,
  ReplacePresetCommand,
  ReplaceTextSplit,
} from './replace-preset-config'
export type { ReplaceStaggerPattern } from '../../components/component-surface-types'
export { computeReplaceStaggerDelays, computeReplaceStaggerTiming } from './stagger-order'
export type { ReplaceStaggerTiming } from './stagger-order'
export {
  REPLACE_PRESET_CHOICES,
  assertReplacePresetChoiceCoverage,
  resolveReplacePresetChoice,
} from './replace-preset-author'
export type {
  ReplacePresetChoice,
  ReplacePresetDefinition,
  ReplacePresetName,
  ReplacePresetOrientation,
  ReplacePresetType,
} from './replace-preset-author'
