/**
 * Root motion — prepares and samples the horizontal arrival path of one clip.
 *
 * The skeleton keeps its local vertical movement while the Avatar presentation
 * group receives the horizontal path exactly once.
 */
import { InterpolateDiscrete, InterpolateSmooth } from 'three'
import type { AnimationClip, KeyframeTrack } from 'three'
import type {
  ArrivalRootMotion,
  AvatarArrivalMotion,
  AvatarVector3,
} from '../avatar-types.js'

const HIPS_POSITION_TRACK = 'Hips.position'

/** Prepares a clip whose horizontal root translation is carried by Avatar presentation. */
export function prepareArrivalRootMotion(
  source: AnimationClip,
  options: AvatarArrivalMotion | undefined,
): ArrivalRootMotion {
  const sourceTrack = findHipsPositionTrack(source)
  if (sourceTrack === undefined) {
    throw new Error(`Avatar arrival animation "${source.name}" requires a ${HIPS_POSITION_TRACK} track.`)
  }

  const start = readTrackVector(sourceTrack, 0)
  const end = readTrackVector(sourceTrack, source.duration)
  const interpolant = createTrackInterpolant(sourceTrack)
  const clip = source.clone()
  const clipTrack = findHipsPositionTrack(clip)
  if (clipTrack === undefined) {
    throw new Error(`Avatar arrival animation "${source.name}" could not prepare its ${HIPS_POSITION_TRACK} track.`)
  }
  flattenHorizontalTranslation(clipTrack, start)

  return {
    clip,
    decelerate: options?.easing === 'ease-out',
    transitionMs: options?.transitionMs,
    offsetAt(clipTime) {
      const values = interpolant.evaluate(clamp(clipTime, 0, source.duration))
      return {
        x: (values[0] ?? 0) - end.x,
        y: 0,
        z: (values[2] ?? 0) - end.z,
      }
    },
  }
}

/** Resolves the canonical root translation track from one normalized Avatar clip. */
function findHipsPositionTrack(clip: AnimationClip): KeyframeTrack | undefined {
  return clip.tracks.find((track) => track.name === HIPS_POSITION_TRACK && track.getValueSize() === 3)
}

/** Samples one horizontal root position while preserving Three.js interpolation. */
function readTrackVector(track: KeyframeTrack, time: number): AvatarVector3 {
  const values = createTrackInterpolant(track).evaluate(time)
  return {
    x: values[0] ?? 0,
    y: values[1] ?? 0,
    z: values[2] ?? 0,
  }
}

/** Removes only the horizontal root path from the skeletal version of the clip. */
function flattenHorizontalTranslation(track: KeyframeTrack, start: AvatarVector3): void {
  const values = track.values as Float32Array
  for (let index = 0; index < values.length; index += 3) {
    values[index] = start.x
    values[index + 2] = start.z
  }
}

/** Creates the native Three.js interpolant selected by one position track. */
function createTrackInterpolant(track: KeyframeTrack) {
  const result = new Float32Array(3)
  if (track.getInterpolation() === InterpolateDiscrete) {
    return track.InterpolantFactoryMethodDiscrete(result)
  }
  if (track.getInterpolation() === InterpolateSmooth) {
    return track.InterpolantFactoryMethodSmooth(result)
  }
  return track.InterpolantFactoryMethodLinear(result)
}

/** Keeps native interpolation queries inside one clip's available time range. */
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value))
}
