import type { CodPlaySnapshot } from 'codplay'
import type { DecorPatch, OffsetPatch, SelectionFrameValue } from '../../../decor-editor/types'
import { modificationsFromDecorPatch, modificationsToDecorPatch } from '../../../decor-editor/modified-properties'
import { cqwToPx, offsetValuesPxToPatch } from '../../../decor-editor/units'
import { readLogicalLength, readLogicalNumber, readRotationOrigin, snapshotItemStyle } from '../presentation-reading'
import { normalizeAngleDegrees } from '../../../motion-editor/geometry'

/** Selection Frame projection between logical cqw frames, scene pixels and sparse offset patches. */

/** Resolves a logical frame from snapshot state, with document offset only as a missing-field fallback. */
export function readLogicalFrame(snapshot: CodPlaySnapshot | null, itemId: string, fallback: DecorPatch): SelectionFrameValue | null {
  const style = snapshotItemStyle(snapshot, itemId)
  const offset = fallback.offset
  const x = readLogicalLength(style.x) ?? offset?.translate?.x ?? offset?.x ?? undefined
  const y = readLogicalLength(style.y) ?? offset?.translate?.y ?? offset?.y ?? undefined
  const width = readLogicalLength(style.width) ?? offset?.width ?? undefined
  const height = readLogicalLength(style.height) ?? offset?.height ?? undefined
  if (x === undefined || y === undefined || width === undefined || height === undefined) return null
  return {
    x,
    y,
    width,
    height,
    rotate: readLogicalNumber(style.rotate) ?? offset?.rotate ?? 0,
    scaleX: readLogicalNumber(style.scaleX) ?? offset?.scale?.x ?? 1,
    scaleY: readLogicalNumber(style.scaleY) ?? offset?.scale?.y ?? 1,
    rotationOrigin: readRotationOrigin(style['transform-origin'])
      ?? readRotationOrigin(fallback.style?.['transform-origin'])
      ?? offset?.rotationOrigin,
  }
}

/** Projects one logical frame into the local pixel coordinate system of the scene root. */
export function logicalFrameToPx(value: SelectionFrameValue, rootWidthPx: number): SelectionFrameValue {
  return {
    x: cqwToPx(value.x, rootWidthPx),
    y: cqwToPx(value.y, rootWidthPx),
    width: cqwToPx(value.width, rootWidthPx),
    height: cqwToPx(value.height, rootWidthPx),
    rotate: value.rotate ?? 0,
    scaleX: value.scaleX ?? 1,
    scaleY: value.scaleY ?? 1,
    rotationOrigin: value.rotationOrigin === undefined ? undefined : { ...value.rotationOrigin },
  }
}

/** Converts one local pixel frame to the unitless structured offset vocabulary. */
export function frameToOffsetPatch(value: SelectionFrameValue, rootWidthPx: number): OffsetPatch {
  const patch = offsetValuesPxToPatch(value, rootWidthPx)
  return patch.rotate === undefined
    ? patch
    : { ...patch, rotate: normalizeAngleDegrees(patch.rotate) }
}

/** Converts ordinary frame gestures to pose edits. Zone offset handles scale separately. */
export function frameGesturePatch(base: SelectionFrameValue, candidate: SelectionFrameValue, rootWidthPx: number): DecorPatch {
  const { scale: _baseScale, ...baseOffset } = frameToOffsetPatch(base, rootWidthPx)
  const { scale: _candidateScale, ...candidateOffset } = frameToOffsetPatch(candidate, rootWidthPx)
  return modificationsToDecorPatch(modificationsFromDecorPatch(
    { offset: baseOffset },
    { offset: candidateOffset },
  ))
}
