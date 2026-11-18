import type { EditorScene, Item, Keyframe } from '../../app/commands/types'
import { resolveDecorationStyleAtTime, resolveKeyframePoseStyle } from '../decor-resolution'
import type { StyleDefaultCapture } from '../types'
import { resolveContentInsetsPx } from '../../motion-editor/border-insets'
import { motionPathTangentAngle, normalizeAngleDegrees, resolveMotionGeometryPose } from '../../motion-editor/geometry'
import { resolveInitialPathRotation, STRAIGHT_MOTION_PATH } from '../../motion-editor/item-rotation/item-rotation'

/** Physical context used only to prepare the transient motion capture geometry. */
export type MotionProjection = Readonly<{ rootWidthPx: number; pixelRatio: number }>

/** Resolves the incoming heading shared by both captures of the next free-position segment. */
export function resolveTangentReferenceAngle(
  scene: EditorScene,
  item: Item,
  source: Keyframe,
  destination: Keyframe,
  projection: MotionProjection,
  styleDefaults?: StyleDefaultCapture,
): number | undefined {
  const initialAngle = resolveInitialPathRotation(scene, item)
  const tangent = resolveTangentSegmentAngle(scene, item, source, destination, 1, projection, styleDefaults)
  return tangent === undefined ? undefined : tangent + initialAngle
}

/** Resolves one path heading from the same projected endpoint geometry used by Editor. */
export function resolveTangentSegmentAngle(
  scene: EditorScene,
  item: Item,
  source: Keyframe,
  destination: Keyframe,
  progress: number,
  projection: MotionProjection,
  styleDefaults?: StyleDefaultCapture,
): number | undefined {
  const initialAngle = resolveInitialPathRotation(scene, item)
  const endpoints = [source, destination].map((keyframe) => {
    const style = resolveKeyframePoseStyle(scene, item, keyframe)
    if (typeof style.x !== 'number' || typeof style.y !== 'number'
      || typeof style.width !== 'number' || typeof style.height !== 'number') return undefined
    const origin = typeof style['transform-origin'] === 'string'
      ? style['transform-origin'].split(/\s+/).map(value => Number.parseFloat(value) / 100)
      : undefined
    const ratio = projection.rootWidthPx / 100
    const frame = {
      x: style.x * ratio, y: style.y * ratio,
      width: style.width * ratio, height: style.height * ratio,
      rotate: initialAngle,
      scaleX: typeof style.scaleX === 'number' ? style.scaleX : 1,
      scaleY: typeof style.scaleY === 'number' ? style.scaleY : 1,
      ...(origin === undefined ? {} : { rotationOrigin: { fx: origin[0]!, fy: origin[1]! } }),
    }
    const insets = resolveContentInsetsPx(
      resolveDecorationStyleAtTime(scene, item, keyframe.timeMs, styleDefaults),
      projection.rootWidthPx, projection.pixelRatio,
    )
    return resolveMotionGeometryPose(frame, insets).pathAnchor
  })
  if (endpoints[0] === undefined || endpoints[1] === undefined) return undefined
  const path = scene.decors[destination.decorId]?.path ?? STRAIGHT_MOTION_PATH
  return motionPathTangentAngle(path, endpoints[0], endpoints[1], progress)
}

/** Chooses the outgoing segment's starting offset so its displayed angle meets the incoming end. */
export function resolveTangentJoinRotationOffset(
  scene: EditorScene,
  item: Item,
  previous: Keyframe,
  source: Keyframe,
  destination: Keyframe,
  projection: MotionProjection,
  styleDefaults?: StyleDefaultCapture,
): number | undefined {
  const incomingAngle = resolveTangentReferenceAngle(scene, item, previous, source, projection, styleDefaults)
  const outgoingTangent = resolveTangentSegmentAngle(scene, item, source, destination, 0, projection, styleDefaults)
  if (incomingAngle === undefined || outgoingTangent === undefined) return undefined
  const initialAngle = resolveInitialPathRotation(scene, item)
  const outgoingAngle = outgoingTangent + initialAngle
  return initialAngle + normalizeAngleDegrees(incomingAngle - outgoingAngle)
}
