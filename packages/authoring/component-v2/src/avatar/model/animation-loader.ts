import { Euler, Quaternion, QuaternionKeyframeTrack } from 'three'
import type { AnimationClip, Group } from 'three'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { AvatarAnimationSource } from '../avatar-types.js'

type FbxAnimationRoot = Group & Readonly<{
  animations?: readonly AnimationClip[]
}>

/** Parses one preloaded Avatar animation resource into a normalized clip. */
export async function parseAvatarAnimation(
  buffer: ArrayBuffer,
  source: AvatarAnimationSource,
  fallbackName: string,
): Promise<AnimationClip> {
  const format = source.format ?? inferAnimationFormat(source.src)
  const clips = format === 'fbx'
    ? await parseFbxAnimations(buffer)
    : await parseGltfAnimations(buffer)
  const clip = selectClip(clips, source.clip, fallbackName)
  if (clip === undefined) {
    throw new Error(`Avatar animation "${fallbackName}" was not found in "${source.src}".`)
  }
  return normalizeClip(clip, format, source.scale)
}

/** Infers the supported animation container from one resource URL. */
function inferAnimationFormat(src: string): 'glb' | 'fbx' {
  const path = src.split(/[?#]/, 1)[0] ?? src
  return path.toLowerCase().endsWith('.fbx') ? 'fbx' : 'glb'
}

/** Parses one GLB resource with the Three.js GLTF loader. */
function parseGltfAnimations(buffer: ArrayBuffer): Promise<readonly AnimationClip[]> {
  const loader = new GLTFLoader()
  return new Promise((resolve, reject) => {
    loader.parse(buffer, '', (gltf) => resolve(gltf.animations), reject)
  })
}

/** Parses one FBX resource with the Three.js FBX loader. */
function parseFbxAnimations(buffer: ArrayBuffer): Promise<readonly AnimationClip[]> {
  const root = new FBXLoader().parse(buffer, '') as FbxAnimationRoot
  return Promise.resolve(root.animations ?? [])
}

/** Selects one named or indexed clip, with a single-clip convenience fallback. */
function selectClip(
  clips: readonly AnimationClip[],
  selector: string | number | undefined,
  fallbackName: string,
): AnimationClip | undefined {
  if (typeof selector === 'number') return clips[Math.trunc(selector)]
  if (typeof selector === 'string') return clips.find((clip) => clip.name === selector)
  return clips.find((clip) => clip.name === fallbackName) ?? (clips.length === 1 ? clips[0] : undefined)
}

/** Clones one clip and adapts common Mixamo names and source units. */
export function normalizeClip(
  sourceClip: AnimationClip,
  format: 'glb' | 'fbx',
  scale: number | undefined,
): AnimationClip {
  const clip = sourceClip.clone()
  const normalizedTracks = [] as typeof clip.tracks
  const positionScale = scale ?? (format === 'fbx' ? 0.01 : 1)

  for (const track of clip.tracks) {
    track.name = track.name.replace(/^mixamorig:?/, '')
    if (track.name.endsWith('.rotation') && track.getValueSize() === 3) {
      const values: number[] = []
      const euler = new Euler()
      const quaternion = new Quaternion()
      for (let index = 0; index < track.values.length; index += 3) {
        euler.set(
          track.values[index] ?? 0,
          track.values[index + 1] ?? 0,
          track.values[index + 2] ?? 0,
          'XYZ',
        )
        quaternion.setFromEuler(euler).normalize()
        values.push(quaternion.x, quaternion.y, quaternion.z, quaternion.w)
      }
      normalizedTracks.push(new QuaternionKeyframeTrack(
        track.name.replace(/\.rotation$/, '.quaternion'),
        track.times,
        values,
      ))
      continue
    }
    if (track.name.endsWith('.position') && positionScale !== 1) {
      for (let index = 0; index < track.values.length; index += 1) {
        track.values[index] = (track.values[index] ?? 0) * positionScale
      }
    }
    normalizedTracks.push(track)
  }

  clip.tracks = normalizedTracks
  return clip
}
