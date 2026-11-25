import type { CodPlayPresentationItem, CodPlaySnapshot } from 'codplay'
import { rotateSelectionFrameAffine } from '@codplay/selection-frame/v2'
import type { SelectionFrameDelta } from '@codplay/selection-frame/v2'
import { resolveOffsetAsStyle } from '../../../builder-v2/decor-resolution'
import {
  ITEM_PREVIEW_HEIGHT_PROPERTY,
  ITEM_PREVIEW_TRANSFORM_PROPERTY,
  ITEM_PREVIEW_WIDTH_PROPERTY,
  itemPreviewTransform,
} from '../../../item-presentation/item-preview'
import { applyFrameDelta } from './frame-delta'
import type { Target } from './decor-target'
import type { DecorPatch, OffsetPatch, SelectionFrameValue } from '../../../decor-editor/types'
import { modificationsFromDecorPatch, modificationsToDecorPatch } from '../../../decor-editor/modified-properties'
import { cqwToPx, offsetValuesPxToPatch, pxToCqw } from '../../../decor-editor/units'
import { readLogicalLength, readLogicalNumber, readRotationOrigin, snapshotItemStyle } from '../presentation-reading'
import { frameWithRotationAtPathAnchor, motionPathAnchorForFrame, normalizeAngleDegrees } from '../../../motion-editor/geometry'
import type { FrameBorderInsetsPx } from '../../../motion-editor/border-insets'

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

/** Stores the authored tangent-relative offset while keeping its gesture path anchor fixed. */
export function authorFrameForGesture(
  displayedFrame: SelectionFrameValue,
  authoredRotate: number,
  insets: FrameBorderInsetsPx,
  pathAnchor = motionPathAnchorForFrame(displayedFrame, insets),
): SelectionFrameValue {
  return frameWithRotationAtPathAnchor(
    displayedFrame,
    normalizeAngleDegrees(authoredRotate),
    pathAnchor,
    insets,
  )
}

/**
 * Snapshot style previewing one Decor patch: the patch style and offset, plus — for the item the
 * Selection Frame edits — its displayed content frame in cqw and, outside capsules, the preview
 * transform of the presented item (`item-presentation-spec`).
 */
export function previewStyle(
  patch: DecorPatch,
  contentFrame: SelectionFrameValue | null,
  rootWidthPx: number | null,
  framedTarget: Pick<Target, 'itemType'> | null,
  presented: Pick<CodPlayPresentationItem, 'pose' | 'representation'> | undefined,
): Record<string, unknown> {
  const style: Record<string, unknown> = {
    ...(patch.style ?? {}),
    ...resolveOffsetAsStyle(patch.offset),
  }
  if (rootWidthPx === null || contentFrame === null || framedTarget === null) return style
  Object.assign(style, {
    x: pxToCqw(contentFrame.x, rootWidthPx),
    y: pxToCqw(contentFrame.y, rootWidthPx),
    width: pxToCqw(contentFrame.width, rootWidthPx),
    height: pxToCqw(contentFrame.height, rootWidthPx),
    rotate: contentFrame.rotate ?? 0,
    scaleX: contentFrame.scaleX ?? 1,
    scaleY: contentFrame.scaleY ?? 1,
    'transform-origin': `${(contentFrame.rotationOrigin?.fx ?? 0.5) * 100}% ${(contentFrame.rotationOrigin?.fy ?? 0.5) * 100}%`,
  })
  if (presented === undefined || framedTarget.itemType === 'capsule') return style
  const transform = itemPreviewTransform(presented, contentFrame)
  if (transform === undefined) return style
  style[ITEM_PREVIEW_TRANSFORM_PROPERTY] = transform
  style[ITEM_PREVIEW_WIDTH_PROPERTY] = `${contentFrame.width}px`
  style[ITEM_PREVIEW_HEIGHT_PROPERTY] = `${contentFrame.height}px`
  return style
}

/**
 * Projects one Selection Frame delta into the authored frame written to the document, the frame
 * displayed by the Selection Frame and the base frame the sparse patch is measured from. A tangent
 * segment keeps its authored angle relative to the path; a `source` representation edits the
 * authored frame directly (`item-presentation-spec`).
 */
export function resolveGestureCandidate(input: Readonly<{
  delta: SelectionFrameDelta
  displayedBase: SelectionFrameValue
  authoredBase: SelectionFrameValue
  authoredBaseRotate: number
  tangentMotion: boolean
  sourceRepresentation: boolean
  zoneOffsetGesture: boolean
  insets: FrameBorderInsetsPx
  /** Display projection of an authored frame on the tangent path (path moves only). */
  displayForAuthor: (frame: SelectionFrameValue) => SelectionFrameValue
}>): { authorFrame: SelectionFrameValue; displayFrame: SelectionFrameValue; patchBaseFrame: SelectionFrameValue } {
  const { delta, displayedBase, authoredBase, authoredBaseRotate, tangentMotion, sourceRepresentation, insets } = input
  const rawDisplayCandidate = applyFrameDelta(displayedBase, delta)
  const tangentRotation = tangentMotion && delta.kind === 'rotate'
  const editsAuthorSource = sourceRepresentation && !input.zoneOffsetGesture && !tangentMotion
  const rotationDelta = normalizeAngleDegrees((rawDisplayCandidate.rotate ?? 0) - (displayedBase.rotate ?? 0))
  const authorFrame = tangentRotation
    ? frameWithRotationAtPathAnchor(
      authoredBase,
      normalizeAngleDegrees(authoredBaseRotate + rotationDelta),
      motionPathAnchorForFrame(authoredBase, insets),
      insets,
    )
    : editsAuthorSource
      ? {
        ...authoredBase,
        x: authoredBase.x + (rawDisplayCandidate.x - displayedBase.x),
        y: authoredBase.y + (rawDisplayCandidate.y - displayedBase.y),
        ...(delta.kind === 'resize' ? {
          width: authoredBase.width + (rawDisplayCandidate.width - displayedBase.width),
          height: authoredBase.height + (rawDisplayCandidate.height - displayedBase.height),
        } : {}),
        ...(delta.kind === 'rotate' ? {
          rotate: normalizeAngleDegrees(Math.round(authoredBaseRotate + rotationDelta)),
        } : {}),
        ...(delta.kind === 'pivot' ? { rotationOrigin: rawDisplayCandidate.rotationOrigin } : {}),
      }
      : delta.kind === 'move' && sourceRepresentation
        ? applyFrameDelta(authoredBase, delta)
        : tangentMotion
          ? authorFrameForGesture(rawDisplayCandidate, authoredBaseRotate, insets)
          : rawDisplayCandidate
  const displayFrame = tangentRotation
    ? rotateSelectionFrameAffine(
      displayedBase,
      rawDisplayCandidate.rotate ?? 0,
      frameWithRotationAtPathAnchor(
        displayedBase,
        rawDisplayCandidate.rotate ?? 0,
        motionPathAnchorForFrame(displayedBase, insets),
        insets,
      ),
    )
    // Size and pivot edits keep the live affine orientation; only a path move recalculates its tangent.
    : tangentMotion && delta.kind === 'move'
      ? input.displayForAuthor(authorFrame)
      : rawDisplayCandidate
  const patchBaseFrame = editsAuthorSource || delta.kind === 'move' || tangentRotation
    ? authoredBase
    : tangentMotion ? authorFrameForGesture(displayedBase, authoredBaseRotate, insets) : displayedBase
  return { authorFrame, displayFrame, patchBaseFrame }
}
