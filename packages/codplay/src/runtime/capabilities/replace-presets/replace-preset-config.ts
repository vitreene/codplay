import presetCatalog from './replace-preset-catalog.json'
import type {
  ReplaceMotionProfile,
  ReplaceStaggerPattern,
  SlotReplaceShape,
  SlotReplaceTransition,
} from '../../components/component-surface-types'
import type { ReplacePresetDefinition, ReplacePresetName } from './replace-preset-author'
import {
  isFiniteNonNegativeNumber,
  isFinitePositiveNumber,
  isPlainRecord,
  isPositiveInteger,
  isReplaceDirection,
  REPLACE_DIRECTIONS,
} from './replace-value-validation'
import type { ReplaceDirection } from './replace-value-validation'

export { REPLACE_DIRECTIONS }
export type { ReplaceDirection }

/** Text segmentation modes retained by the V2 replace-text capability. */
export const REPLACE_TEXT_SPLITS = ['letter', 'word', 'line'] as const

/** Media segmentation mode retained by the V2 replace-media capability. */
export const REPLACE_MEDIA_SPLITS = ['cells'] as const
export const REPLACE_STAGGER_PATTERNS = ['manhattan', 'row-wave', 'column-wave'] as const
export const REPLACE_SLOT_TRANSITIONS = [
  'fade', 'fade-in', 'mask-reveal', 'curtain', 'wipe', 'slide-over', 'stack',
] as const

export type ReplaceTextSplit = (typeof REPLACE_TEXT_SPLITS)[number]
export type ReplaceMediaSplit = (typeof REPLACE_MEDIA_SPLITS)[number]

/** Authored image/video replace options shared by their component declarations. */
export type ReplaceMediaOptions = Readonly<{
  transition: ReplacePresetName | SlotReplaceTransition
  duration?: number
  shape?: SlotReplaceShape
  split?: ReplaceMediaSplit
  stagger?: number
  staggerPattern?: ReplaceStaggerPattern
  direction?: ReplaceDirection
  /** Responsive repeated-mask size as a percentage of media width; takes precedence over cellX/Y. */
  cellSize?: number
  cellX?: number
  cellY?: number
}>

/** Normalized options shared by text and media replacement commands. */
export type ReplacePresetCommand = Readonly<{
  transition: ReplacePresetName
  duration: number
  shape?: SlotReplaceShape
  split?: ReplaceTextSplit | ReplaceMediaSplit
  stagger?: number
  staggerPattern?: ReplaceStaggerPattern
  direction?: ReplaceDirection
  /** Responsive media-mask size as a percentage of media width. */
  cellSize?: number
  cellX?: number
  cellY?: number
  skipUnchanged?: boolean
  profile: ReplaceMotionProfile
  definition: ReplacePresetDefinition
}>

/** Checks that one value names a definition in the canonical JSON catalogue. */
export function isReplacePresetName(value: unknown): value is ReplacePresetName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(presetCatalog, value)
}

/** Checks one transition handled by the slot replacement capability. */
export function isReplaceSlotTransition(value: unknown): value is SlotReplaceTransition {
  return typeof value === 'string' && (REPLACE_SLOT_TRANSITIONS as readonly string[]).includes(value)
}

/** Parses a replace value and resolves its preset while retaining split options. */
export function normalizeReplacePresetCommand(
  raw: unknown,
  mode: ReplaceMotionProfile['mode'],
  allowedSplits: readonly (ReplaceTextSplit | ReplaceMediaSplit)[],
): ReplacePresetCommand | undefined {
  if (typeof raw !== 'string' && !isPlainRecord(raw)) return undefined
  const transition = typeof raw === 'string' ? raw : raw.transition
  if (!isReplacePresetName(transition)) return undefined

  const definition = presetCatalog[transition]
  const options = typeof raw === 'string' ? {} : raw
  const duration = options.duration ?? definition.durationMs
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) return undefined
  if (options.split !== undefined
    && (typeof options.split !== 'string' || !allowedSplits.includes(options.split as ReplaceTextSplit | ReplaceMediaSplit))) {
    return undefined
  }
  if (options.stagger !== undefined && !isFiniteNonNegativeNumber(options.stagger)) return undefined
  if (options.direction !== undefined && !isReplaceDirection(options.direction)) return undefined
  if (options.staggerPattern !== undefined
    && (options.split !== 'cells'
      || !allowedSplits.includes('cells')
      || !isReplaceStaggerPattern(options.staggerPattern)
      || (options.staggerPattern !== 'manhattan' && options.direction !== undefined))) return undefined
  if (options.cellSize !== undefined
    && (!allowedSplits.includes('cells') || options.split !== 'cells' || !isFinitePositiveNumber(options.cellSize))) {
    return undefined
  }
  if (options.cellX !== undefined && !isPositiveInteger(options.cellX)) return undefined
  if (options.cellY !== undefined && !isPositiveInteger(options.cellY)) return undefined
  if (options.skipUnchanged !== undefined && typeof options.skipUnchanged !== 'boolean') return undefined
  if (options.shape !== undefined && !isReplaceMaskShape(options.shape)) return undefined

  const split = options.split as ReplaceTextSplit | ReplaceMediaSplit | undefined
  const shape = options.shape as SlotReplaceShape | undefined
  return {
    transition,
    duration,
    ...(shape === undefined ? {} : { shape }),
    ...(split === undefined ? {} : { split }),
    ...(options.stagger === undefined ? {} : { stagger: options.stagger }),
    ...(options.staggerPattern === undefined ? {} : { staggerPattern: options.staggerPattern }),
    ...(options.direction === undefined ? {} : { direction: options.direction }),
    ...(options.cellSize === undefined ? {} : { cellSize: options.cellSize as number }),
    ...(options.cellX === undefined ? {} : { cellX: options.cellX }),
    ...(options.cellY === undefined ? {} : { cellY: options.cellY }),
    ...(options.skipUnchanged === undefined ? {} : { skipUnchanged: options.skipUnchanged }),
    profile: {
      transition,
      duration,
      ease: readDefinitionEase(definition),
      intro: definition.intro,
      outro: definition.outro,
      mode,
      ...(shape === undefined ? {} : { shape }),
      ...(options.staggerPattern === undefined ? {} : { staggerPattern: options.staggerPattern }),
    },
    definition,
  }
}

/** Checks the supported named replace-grid propagation pattern. */
export function isReplaceStaggerPattern(value: unknown): value is ReplaceStaggerPattern {
  return typeof value === 'string' && (REPLACE_STAGGER_PATTERNS as readonly string[]).includes(value)
}

/** Validates one named mask shape or one normalized author SVG path. */
export function isReplaceMaskShape(value: unknown): value is SlotReplaceShape {
  if (value === 'circle' || value === 'star' || value === 'diamond') return true
  if (!isPlainRecord(value)
    || typeof value.path !== 'string'
    || !/^\s*[Mm](?:(?:[MmLlHhVvCcSsQqTtAaZz])|(?:[\d.,+\-\sEe]))+$/.test(value.path)
    || typeof value.viewBox !== 'string') return false
  const bounds = value.viewBox.trim().split(/[\s,]+/).map(Number)
  return bounds.length === 4
    && bounds.every(Number.isFinite)
    && (bounds[2] ?? 0) > 0
    && (bounds[3] ?? 0) > 0
}

/** Reads the optional easing name from one heterogeneous JSON definition. */
function readDefinitionEase(definition: ReplacePresetDefinition): string | undefined {
  return 'ease' in definition && typeof definition.ease === 'string' ? definition.ease : undefined
}
