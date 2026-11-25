import { resolveSegmentTiming, type SegmentTiming } from '../../../builder-v2/keyframe-transition'
import type { OffsetPatch } from '../../../decor-editor/types'
import { resolveKeyframeChannel } from '../../commands/types'
import { createId } from '../../commands/ids'
import type { EditorScene, Item, OffsetData } from '../../commands/types'
import type { Command } from '../../controller/types'
import type { MotionOverlayRole, MotionOverlaySegment } from '../../../motion-editor/overlay'
import { sortPoseKeyframes } from './decor-target'

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
