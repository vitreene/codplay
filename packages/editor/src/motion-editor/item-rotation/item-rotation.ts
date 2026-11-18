import { resolveKeyframeChannel } from '../../app/commands/types'
import type { EditorScene, Item } from '../../app/commands/types'

/** Native normalized straight path used for implicit segments in tangent mode. */
export const STRAIGHT_MOTION_PATH = 'M 0 0 L 1 0'

/** Reads the one initial angle reused unchanged by every tangent segment. */
export function resolveInitialPathRotation(scene: EditorScene, item: Item): number {
  const first = item.keyframes.filter((keyframe) => resolveKeyframeChannel(keyframe) === 'pose')
    .sort((left, right) => left.timeMs - right.timeMs)[0]
  return (first === undefined ? undefined : scene.decors[first.decorId]?.offset?.rotate)
    ?? scene.decors[item.initialDecorId]?.offset?.rotate
    ?? 0
}
