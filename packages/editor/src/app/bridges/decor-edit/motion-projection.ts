import { resolveSegmentTiming, type SegmentTiming } from '../../../builder-v2/keyframe-transition'
import type { OffsetPatch } from '../../../decor-editor/types'
import { resolveKeyframeChannel } from '../../commands/types'
import { createId } from '../../commands/ids'
import type { EditorScene, Item, OffsetData } from '../../commands/types'
import type { Command } from '../../controller/types'
import type { MotionOverlayRole, MotionOverlaySegment } from '../../../motion-editor/overlay'
import { sortPoseKeyframes, type Target } from './decor-target'
import { resolveSegmentProgress } from '../../../builder-v2/keyframe-transition'
import type { SelectionFrameValue } from '../../../decor-editor/types'
import type { FrameBorderInsetsPx } from '../../../motion-editor/border-insets'
import type { MotionOverlayGhost } from '../../../motion-editor/overlay'
import { STRAIGHT_MOTION_PATH } from '../../../motion-editor/item-rotation/item-rotation'
import {
  frameWithRotationAtPathAnchor,
  frameWithTangentAtPathAnchor,
  midpoint,
  motionPathAnchorForFrame,
  normalizeAngleDegrees,
  splitMotionPath,
  motionControlFromPath,
  motionPathTangentAngle,
  resolveMotionGeometryPose,
  type MotionGeometryPose,
} from '../../../motion-editor/geometry'
import { isSameAuthorTime } from '../../config/author-time'
import {
  itemUsesZonePlacement,
  resolveEffectiveKeyframePatch,
  resolveEffectivePosePatch,
  resolveMotionPath,
  zonePlacementAtPoseKeyframe,
} from './decor-patches'
import { frameToOffsetPatch, logicalFrameToPx, readLogicalFrame } from './frame-projection'
import { mergePatch } from '../../../decor-editor/merge'
import type { DecorPatch } from '../../../decor-editor/types'

/** Motion segments of an item: the keyframe pair a gesture edits, its pose clock and its path commands. */

/** Ephemeral source/target projection kept by the decor bridge after one motion drop. */
export type ActiveMotion = Readonly<{
  itemId: string
  sourceKeyframeId: string
  targetKeyframeId: string
  sourceTimeMs: number
  targetTimeMs: number
  /** Pose clock of the segment, shared with the Builder (`resolveSegmentTiming`). */
  timing: SegmentTiming
  path?: string
  orientToPath?: boolean
  role: MotionOverlayRole
}>

/**
 * Gesture state of the Decor bridge read by the overlay projection: the Selection Frame frames,
 * the edited target and the endpoint border insets (which follow an accepted preview).
 */
export type MotionProjectionView = Readonly<{
  /** Author time the bridge projects (`Keyframe.timeMs` reference). */
  authorTimeMs: number
  frameTarget: Target | null
  displayFrame: SelectionFrameValue | null
  authorFrame: SelectionFrameValue | null
  frameInsets: FrameBorderInsetsPx
  /** Frame kept authoritative after a commit, until the player presents it. */
  commitCandidate: SelectionFrameValue | null
  /** A gesture runs or a commit awaits presentation: the edited endpoint follows the frame. */
  frameOwnsEndpoint: boolean
  gestureActive: boolean
  endpointInsets: (scene: EditorScene, item: Item, keyframeId: string, rootWidthPx: number) => FrameBorderInsetsPx
}>

/** Gesture state read by the tangent and authored-rotation projections of the Selection Frame. */
export type GestureMotionContext = Readonly<{
  activeMotion: ActiveMotion | null
  authorTimeMs: number
  gestureActive: boolean
  /** Segments last published by the overlay projection. */
  projectedSegments: readonly MotionOverlaySegment[]
  frameInsets: FrameBorderInsetsPx
  authorFrame: SelectionFrameValue | null
}>

type MotionEndpointProjection = Readonly<{
  geometry: MotionGeometryPose
  insets: FrameBorderInsetsPx
  authorFrame: SelectionFrameValue
}>

/** Resolves the adjacent pair represented by the current selection or playhead. */
export function resolveMotionPair(item: Item, selectedKeyframeId: string | null, timelineMs: number): {
  sourceKeyframe: Item['keyframes'][number]
  targetKeyframe: Item['keyframes'][number]
} | null {
  const keyframes = sortPoseKeyframes(item)
  const selectedKeyframe = selectedKeyframeId === null
    ? undefined
    : item.keyframes.find((keyframe) => keyframe.id === selectedKeyframeId)
  const selectedIndex = selectedKeyframeId === null
    ? -1
    : keyframes.findIndex((keyframe) => keyframe.id === selectedKeyframeId)
  // A selected first pose KF owns the outgoing segment; every later pose KF owns the incoming
  // segment. A decoration-only KF has no spatial endpoint, so its movement preview attaches to
  // the pose segment containing its time and can promote that KF on commit.
  const pairIndex = selectedKeyframe !== undefined && resolveKeyframeChannel(selectedKeyframe) === 'decor'
    ? keyframes.findIndex((keyframe, index) => {
      const next = keyframes[index + 1]
      return next !== undefined
        && selectedKeyframe.timeMs >= keyframe.timeMs
        && selectedKeyframe.timeMs <= next.timeMs
    })
    : selectedIndex > 0
      ? selectedIndex - 1
      : selectedIndex === 0 && keyframes.length > 1
        ? 0
        : selectedIndex < 0
          ? keyframes.findIndex((keyframe, index) => {
            const next = keyframes[index + 1]
            return next !== undefined && timelineMs > keyframe.timeMs && timelineMs < next.timeMs
          })
          : -1
  if (pairIndex < 0) return null
  const sourceKeyframe = keyframes[pairIndex]
  const targetKeyframe = keyframes[pairIndex + 1]
  return sourceKeyframe === undefined || targetKeyframe === undefined
    ? null
    : { sourceKeyframe, targetKeyframe }
}

/** Converts one projected active segment into the ephemeral motion state used by CS gestures. */
export function activeMotionFromSegment(
  scene: EditorScene,
  item: Item,
  segment: MotionOverlaySegment,
): ActiveMotion | null {
  const sourceKeyframeId = segment.sourceKeyframeId
  const targetKeyframeId = segment.targetKeyframeId
  if (sourceKeyframeId === undefined || targetKeyframeId === undefined) return null
  const sourceKeyframe = item.keyframes.find((keyframe) => keyframe.id === sourceKeyframeId)
  const targetKeyframe = item.keyframes.find((keyframe) => keyframe.id === targetKeyframeId)
  if (sourceKeyframe === undefined || targetKeyframe === undefined) return null
  return {
    itemId: item.id,
    sourceKeyframeId,
    targetKeyframeId,
    sourceTimeMs: sourceKeyframe.timeMs,
    targetTimeMs: targetKeyframe.timeMs,
    timing: resolveSegmentTiming(scene, item, sourceKeyframe, targetKeyframe),
    ...(segment.path === undefined ? {} : { path: segment.path }),
    ...(segment.orientToPath === true ? { orientToPath: true } : {}),
    role: segment.role ?? 'target',
  }
}

/** Builds one copy-on-write command batch for a segment-local path edit. */
export function buildMotionPathCommands(
  scene: EditorScene,
  itemId: string,
  keyframeId: string,
  path: string | undefined,
  endpointOffset?: OffsetPatch,
): Command[] {
  const item = scene.items.find((candidate) => candidate.id === itemId)
  const keyframe = item?.keyframes.find((candidate) => candidate.id === keyframeId)
  if (item === undefined || keyframe === undefined) return []
  // `undefined` is intentional here: the edit clears the optional field while retaining every
  // other property of the target decor. The builder treats it as a straight segment, so no null
  // sentinel is introduced into the V2 document vocabulary. A path always belongs to a segment's
  // target, never to the intro, so `setItemDecor` never writes it into the initial decor.
  return [{
    name: 'setItemDecor',
    args: {
      itemId,
      keyframeId,
      patch: { path, ...(endpointOffset === undefined ? {} : { offset: endpointOffset as OffsetData }) },
      forkDecorId: createId('decor'),
    },
  }]
}

/** Resolves the selected path owner before falling back to the keyframe/time default pair. */
export function resolveGestureMotion(
  scene: EditorScene,
  item: Item,
  target: Target,
  activeMotion: ActiveMotion | null,
  authorTimeMs: number,
): {
  sourceKeyframe: Item['keyframes'][number]
  targetKeyframe: Item['keyframes'][number]
  path: string | undefined
  orientToPath: boolean
  timing: SegmentTiming
} | null {
  const motion = activeMotion
  const motionContainsTarget = motion !== null
    && motion.itemId === item.id
    && (target.keyframeId === null
      ? authorTimeMs > motion.sourceTimeMs && authorTimeMs < motion.targetTimeMs
      : target.keyframeId === motion.sourceKeyframeId || target.keyframeId === motion.targetKeyframeId)
  const pair = motionContainsTarget
    ? {
      sourceKeyframe: item.keyframes.find((keyframe) => keyframe.id === motion.sourceKeyframeId),
      targetKeyframe: item.keyframes.find((keyframe) => keyframe.id === motion.targetKeyframeId),
    }
    : resolveMotionPair(item, target.keyframeId, authorTimeMs)
  if (pair === null || pair.sourceKeyframe === undefined || pair.targetKeyframe === undefined) return null
  return {
    sourceKeyframe: pair.sourceKeyframe,
    targetKeyframe: pair.targetKeyframe,
    path: motionContainsTarget ? motion.path : resolveMotionPath(scene, item, pair.targetKeyframe.id),
    orientToPath: item.rotationMode === 'tangent',
    timing: motionContainsTarget
      ? motion.timing
      : resolveSegmentTiming(scene, item, pair.sourceKeyframe, pair.targetKeyframe),
  }
}

/** Builds all adjacent document segments for the selected item in one shared overlay projection. */
export function resolveMotionOverlaySegments(
  scene: EditorScene,
  item: Item,
  selectedKeyframeId: string | null,
  rootWidthPx: number,
  currentMotion: ActiveMotion | null,
  timelineMs: number,
  view: MotionProjectionView,
): { selection: MotionGeometryPose | null; segments: MotionOverlaySegment[] } {
  const selectionGeometry = view.displayFrame === null
    ? null
    : resolveMotionGeometryPose(view.displayFrame, view.frameInsets)
  if (itemUsesZonePlacement(scene, item, timelineMs, selectedKeyframeId)) return { selection: selectionGeometry, segments: [] }
  const keyframes = sortPoseKeyframes(item)
  const selectedPair = resolveMotionPair(item, selectedKeyframeId, timelineMs)
  const activeSourceId = currentMotion?.sourceKeyframeId ?? selectedPair?.sourceKeyframe.id
  const activeTargetId = currentMotion?.targetKeyframeId ?? selectedPair?.targetKeyframe.id
  const content = item.contentId === null ? undefined : scene.contents[item.contentId]
  const selectedKeyframe = selectedKeyframeId === null
    ? undefined
    : item.keyframes.find((keyframe) => keyframe.id === selectedKeyframeId)
  const selectedTargetIsAtTimeline = selectedKeyframe !== undefined
    && isSameAuthorTime(selectedKeyframe.timeMs, timelineMs)
  const endpointGeometry = new Map<string, MotionEndpointProjection>()
  for (const keyframe of keyframes) {
    const logicalFrame = readLogicalFrame(
      null,
      item.id,
      resolveEffectiveKeyframePatch(scene, item, keyframe.id, content),
    )
    if (logicalFrame === null) continue
    const isSelectedEndpoint = view.frameTarget?.itemId === item.id
      && !view.frameTarget.isTemporary
      && view.frameTarget.keyframeId === keyframe.id
      && selectedTargetIsAtTimeline
    const insets = view.endpointInsets(scene, item, keyframe.id, rootWidthPx)
    const authorFrame = isSelectedEndpoint && view.authorFrame !== null
      ? view.authorFrame
      : logicalFrameToPx(logicalFrame, rootWidthPx)
    // Endpoint anchors belong to the document, independently of selection/seek history.
    // Only an active or just-committed author gesture may replace its current endpoint.
    const previewFrame = isSelectedEndpoint && view.frameOwnsEndpoint
      ? view.commitCandidate ?? view.displayFrame
      : null
    const geometry = resolveMotionGeometryPose(previewFrame ?? authorFrame, insets)
    endpointGeometry.set(keyframe.id, {
      geometry,
      insets,
      authorFrame,
    })
  }
  const segments: MotionOverlaySegment[] = []

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const sourceKeyframe = keyframes[index]!
    const targetKeyframe = keyframes[index + 1]!
    if (zonePlacementAtPoseKeyframe(scene, item, sourceKeyframe.id) !== null
      && zonePlacementAtPoseKeyframe(scene, item, targetKeyframe.id) !== null) continue
    const sourceEndpoint = endpointGeometry.get(sourceKeyframe.id)
    const targetEndpoint = endpointGeometry.get(targetKeyframe.id)
    if (sourceEndpoint === undefined || targetEndpoint === undefined) continue
    const sourceGeometry = sourceEndpoint.geometry
    const targetGeometry = targetEndpoint.geometry

    const pairIsActive = activeSourceId === sourceKeyframe.id && activeTargetId === targetKeyframe.id
    const sourceDocumentFrame = sourceEndpoint.authorFrame
    const targetDocumentFrame = targetEndpoint.authorFrame
    const path = pairIsActive && currentMotion !== null
      ? currentMotion.path
      : resolveMotionPath(scene, item, targetKeyframe.id)
    const orientToPath = item.rotationMode === 'tangent'
    const sourceInsets = sourceEndpoint.insets
    const targetInsets = targetEndpoint.insets
    const sourceCenter = sourceGeometry.pathAnchor
    const targetCenter = targetGeometry.pathAnchor
    const tangentPath = orientToPath ? path ?? STRAIGHT_MOTION_PATH : undefined
    const sourceTangent = tangentPath === undefined
      ? undefined
      : motionPathTangentAngle(tangentPath, sourceCenter, targetCenter, 0)
    const targetTangent = tangentPath === undefined
      ? undefined
      : motionPathTangentAngle(tangentPath, sourceCenter, targetCenter, 1)
    const sourceFrame = sourceTangent === undefined
      ? sourceDocumentFrame
      : frameWithTangentAtPathAnchor(
        sourceDocumentFrame,
        sourceCenter,
        sourceTangent,
        sourceInsets,
      )
    const targetFrame = targetTangent === undefined
      ? targetDocumentFrame
      : frameWithTangentAtPathAnchor(
        targetDocumentFrame,
        targetCenter,
        targetTangent,
        targetInsets,
      )
    const control = path === undefined
      ? midpoint(sourceCenter, targetCenter)
      : motionControlFromPath(path, sourceCenter, targetCenter) ?? midpoint(sourceCenter, targetCenter)
    const role = pairIsActive
      ? currentMotion?.role ?? (selectedPair?.sourceKeyframe.id === sourceKeyframe.id ? 'source' : 'target')
      : undefined
    const isTemporary = pairIsActive
      && (selectedKeyframe === undefined || resolveKeyframeChannel(selectedKeyframe) === 'decor')
      && timelineMs > sourceKeyframe.timeMs
      && timelineMs < targetKeyframe.timeMs
    const sourcePose = sourceTangent === undefined
      ? sourceGeometry
      : resolveMotionGeometryPose(sourceFrame, sourceInsets)
    const targetPose = targetTangent === undefined
      ? targetGeometry
      : resolveMotionGeometryPose(targetFrame, targetInsets)
    segments.push({
      id: `${item.id}:${sourceKeyframe.id}->${targetKeyframe.id}`,
      sourceKeyframeId: sourceKeyframe.id,
      targetKeyframeId: targetKeyframe.id,
      sourceGeometry: sourcePose,
      targetGeometry: targetPose,
      ...(selectionGeometry === null ? {} : { selectionGeometry }),
      control,
      ...(path === undefined ? {} : { path }),
      ...(orientToPath ? { orientToPath: true } : {}),
      active: pairIsActive,
      ...(role === undefined ? {} : { role }),
      ...(isTemporary ? {
        isTemporary: true,
        splitProgress: resolveSegmentProgress(resolveSegmentTiming(scene, item, sourceKeyframe, targetKeyframe), timelineMs),
        ...(!view.gestureActive ? {} : { posePreview: true }),
      } : {}),
    })
  }
  return { selection: selectionGeometry, segments }
}

/** Builds one ghost projection for every real keyframe in the item's temporal chain. */
export function resolveMotionOverlayGhosts(
  scene: EditorScene,
  item: Item,
  selectedKeyframeId: string | null,
  rootWidthPx: number,
  timelineMs: number,
  projectedSegments: readonly MotionOverlaySegment[],
  selectionGeometry: MotionGeometryPose | null,
  view: MotionProjectionView,
): MotionOverlayGhost[] {
  if (itemUsesZonePlacement(scene, item, timelineMs, selectedKeyframeId)) return []
  const keyframes = sortPoseKeyframes(item)
  const content = item.contentId === null ? undefined : scene.contents[item.contentId]
  const activeSegment = projectedSegments.find((candidate) => candidate.active === true)
  const selectedIndex = selectedKeyframeId === null
    ? -1
    : keyframes.findIndex((keyframe) => keyframe.id === selectedKeyframeId)
  const activeSourceIndex = activeSegment?.sourceKeyframeId === undefined
    ? -1
    : keyframes.findIndex((keyframe) => keyframe.id === activeSegment.sourceKeyframeId)
  const activeTargetIndex = activeSegment?.targetKeyframeId === undefined
    ? -1
    : keyframes.findIndex((keyframe) => keyframe.id === activeSegment.targetKeyframeId)
  const anchorIndices = selectedIndex >= 0
    ? [selectedIndex]
    : [activeSourceIndex, activeTargetIndex].filter((index) => index >= 0)

  return keyframes.flatMap((keyframe, index) => {
    if (zonePlacementAtPoseKeyframe(scene, item, keyframe.id) !== null) return []
    const outgoingSegment = projectedSegments.find((segment) =>
      segment.sourceKeyframeId === keyframe.id && segment.path !== undefined)
    const incomingSegment = projectedSegments.find((segment) => segment.targetKeyframeId === keyframe.id)
    const ownerSegment = outgoingSegment ?? incomingSegment
    const projectedGeometry = ownerSegment === undefined
      ? undefined
      : ownerSegment === outgoingSegment
        ? ownerSegment.sourceGeometry
        : ownerSegment.targetGeometry
    const fallbackPatch = resolveEffectiveKeyframePatch(scene, item, keyframe.id, content)
    const fallbackFrame = projectedGeometry === undefined
      ? readLogicalFrame(null, item.id, fallbackPatch)
      : null
    const fallbackInsets = projectedGeometry === undefined
      ? view.endpointInsets(scene, item, keyframe.id, rootWidthPx)
      : undefined
    const geometry = projectedGeometry
      ?? (fallbackFrame === null ? undefined : resolveMotionGeometryPose(
        logicalFrameToPx(fallbackFrame, rootWidthPx), fallbackInsets!,
      ))
    if (geometry === undefined) return []
    const atCurrentKeyframe = view.frameTarget?.itemId === item.id
      && isSameAuthorTime(view.authorTimeMs, keyframe.timeMs)
    const currentFrame = atCurrentKeyframe ? view.commitCandidate ?? view.displayFrame : null
    // At the current KF the acknowledged presentation (or accepted preview) owns the ghost,
    // including the compiler's path quantization. Other KFs use their owning segment projection.
    const usesSelectedGeometry = atCurrentKeyframe
      && view.frameTarget?.keyframeId === keyframe.id
      && selectionGeometry !== null
    const ghostGeometry = usesSelectedGeometry
      ? selectionGeometry
      : currentFrame === null
        ? geometry
        : resolveMotionGeometryPose(currentFrame, geometry.insets)
    const chainDistance = anchorIndices.length === 0
      ? index
      : Math.min(...anchorIndices.map((anchorIndex) => Math.abs(index - anchorIndex)))
    return [{
      id: `${item.id}:ghost:${keyframe.id}`,
      keyframeId: keyframe.id,
      geometry: ghostGeometry,
      chainDistance,
      ...(index === 0 ? { isInitial: true } : {}),
    }]
  })
}

/** Reports whether the target pose is presented on a path-owned tangent segment. */
export function targetUsesTangent(scene: EditorScene, target: Target, context: GestureMotionContext): boolean {
  const item = scene.items.find((candidate) => candidate.id === target.itemId)
  if (item === undefined) return false
  const motion = resolveGestureMotion(scene, item, target, context.activeMotion, context.authorTimeMs)
  return motion !== null && motion.orientToPath
}

/** Resolves the path tangent for a gesture candidate using the document endpoint frames. */
export function resolveTangentGestureProjection(
  scene: EditorScene,
  target: Target,
  candidateFrame: SelectionFrameValue,
  candidateInsets: FrameBorderInsetsPx,
  context: GestureMotionContext,
): { angle: number; pathAnchor: { x: number; y: number } } | null {
  const item = scene.items.find((candidate) => candidate.id === target.itemId)
  if (item === undefined) return null
  const motion = resolveGestureMotion(scene, item, target, context.activeMotion, context.authorTimeMs)
  if (motion === null || !motion.orientToPath) return null
  const tangentPath = motion.path ?? STRAIGHT_MOTION_PATH
  const projectedSegment = context.projectedSegments.find((segment) =>
    segment.sourceKeyframeId === motion.sourceKeyframe.id
    && segment.targetKeyframeId === motion.targetKeyframe.id)
  if (projectedSegment === undefined) return null
  const candidateIsSource = target.keyframeId === motion.sourceKeyframe.id
  const candidateIsTarget = target.keyframeId === motion.targetKeyframe.id
  const pathAnchor = motionPathAnchorForFrame(candidateFrame, candidateInsets)
  const sourceAnchor = candidateIsSource ? pathAnchor : projectedSegment.sourceGeometry.pathAnchor
  const targetAnchor = candidateIsTarget ? pathAnchor : projectedSegment.targetGeometry.pathAnchor
  const selectedKeyframe = target.keyframeId === null
    ? undefined
    : item.keyframes.find((keyframe) => keyframe.id === target.keyframeId)
  const timelineMs = selectedKeyframe?.timeMs ?? context.authorTimeMs
  const easedProgress = resolveSegmentProgress(motion.timing, timelineMs)
  const tangentProgress = candidateIsSource ? 0 : candidateIsTarget ? 1 : easedProgress
  if (!candidateIsSource && !candidateIsTarget && context.gestureActive) {
    const waypoint = motionPathAnchorForFrame(candidateFrame, candidateInsets)
    const split = splitMotionPath(tangentPath, sourceAnchor, waypoint, targetAnchor, easedProgress)
    const angle = split.after === undefined
      ? undefined
      : motionPathTangentAngle(split.after, split.waypoint, targetAnchor, 0)
    return angle === undefined ? null : { angle, pathAnchor: split.waypoint }
  }
  const angle = motionPathTangentAngle(tangentPath, sourceAnchor, targetAnchor, tangentProgress)
  return angle === undefined ? null : { angle, pathAnchor }
}

/** Projects every author-frame candidate through the same path, border and tangent conversion. */
export function displayFrameForAuthorFrame(
  scene: EditorScene,
  target: Target,
  value: SelectionFrameValue,
  context: GestureMotionContext,
  insets = context.frameInsets,
): SelectionFrameValue {
  const projection = resolveTangentGestureProjection(scene, target, value, insets, context)
  const displayedFrame = projection === null ? value : frameWithTangentAtPathAnchor(
    value, projection.pathAnchor, projection.angle, insets,
  )
  return { ...displayedFrame, rotate: normalizeAngleDegrees(displayedFrame.rotate ?? 0) }
}

/** Resolves the offset angle for the pose currently shown by the Selection Frame. */
export function authoredRotationAtGestureStart(
  scene: EditorScene,
  target: Target,
  displayedBase: SelectionFrameValue,
  context: GestureMotionContext,
): number {
  const item = scene.items.find((candidate) => candidate.id === target.itemId)
  if (item === undefined) return context.authorFrame?.rotate ?? displayedBase.rotate ?? 0

  const content = item.contentId === null ? undefined : scene.contents[item.contentId]
  const selectedKeyframe = target.keyframeId === null
    ? undefined
    : item.keyframes.find((keyframe) => keyframe.id === target.keyframeId)
  if (selectedKeyframe !== undefined && resolveKeyframeChannel(selectedKeyframe) === 'pose') {
    const documentFrame = readLogicalFrame(
      null,
      item.id,
      resolveEffectivePosePatch(scene, item, selectedKeyframe.id, content),
    )
    return documentFrame?.rotate ?? 0
  }

  const motion = resolveGestureMotion(scene, item, target, context.activeMotion, context.authorTimeMs)
  if (motion === null) return context.authorFrame?.rotate ?? displayedBase.rotate ?? 0
  const sourcePatch = resolveEffectivePosePatch(scene, item, motion.sourceKeyframe.id, content)
  const targetPatch = resolveEffectivePosePatch(scene, item, motion.targetKeyframe.id, content)
  const sourceFrame = readLogicalFrame(null, item.id, sourcePatch)
  const targetFrame = readLogicalFrame(null, item.id, targetPatch)
  const sourceAngle = sourceFrame?.rotate ?? 0
  const targetAngle = targetFrame?.rotate ?? 0
  const easedProgress = resolveSegmentProgress(motion.timing, context.authorTimeMs)

  // Same shortest-arc rule as the Builder's rotation tween, so the gesture starts from the shown angle.
  return sourceAngle + normalizeAngleDegrees(targetAngle - sourceAngle) * easedProgress
}

/**
 * Splits the path of the segment a waypoint is inserted into: the waypoint frame is moved onto the
 * path, its own decor takes the first half (`splitPatch`) and the segment target keeps the second
 * half with its frozen pose (`splitCommands`). A straight segment is not split.
 */
export function resolveWaypointSplit(
  scene: EditorScene,
  item: Item,
  originalSegment: MotionOverlaySegment | undefined,
  requestedTargetFrame: SelectionFrameValue,
  insets: FrameBorderInsetsPx,
  rootWidthPx: number,
): { targetDocumentFrame: SelectionFrameValue; splitPatch: DecorPatch; splitCommands: Command[] } {
  const split = originalSegment?.path === undefined ? null : splitMotionPath(
    originalSegment.path,
    originalSegment.sourceGeometry.pathAnchor,
    motionPathAnchorForFrame(requestedTargetFrame, insets),
    originalSegment.targetGeometry.pathAnchor,
    originalSegment.splitProgress ?? 0.5,
  )
  if (split === null || originalSegment === undefined) {
    return { targetDocumentFrame: requestedTargetFrame, splitPatch: {}, splitCommands: [] }
  }
  const targetDocumentFrame = frameWithRotationAtPathAnchor(
    requestedTargetFrame,
    requestedTargetFrame.rotate ?? 0,
    split.waypoint,
    insets,
  )
  const splitPatch: DecorPatch = split.before === undefined ? {} : { path: split.before }
  const preservedTargetPatch = originalSegment.targetKeyframeId === undefined ? null : resolveEffectivePosePatch(
    scene, item, originalSegment.targetKeyframeId,
  )
  const preservedTargetFrame = preservedTargetPatch === null ? null : readLogicalFrame(null, item.id, preservedTargetPatch)
  const preservedTargetOffset = preservedTargetFrame === null ? undefined : mergePatch(preservedTargetPatch!, {
    offset: frameToOffsetPatch(logicalFrameToPx(preservedTargetFrame, rootWidthPx), rootWidthPx),
  }).offset
  const splitCommands = originalSegment.targetKeyframeId === undefined
    ? []
    : buildMotionPathCommands(scene, item.id, originalSegment.targetKeyframeId, split.after, preservedTargetOffset)
  return { targetDocumentFrame, splitPatch, splitCommands }
}
