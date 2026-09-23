/**
 * Per-instance model setup — parse + discover morph targets + register them
 * with MorphEngine. The GLB fetch is a separate, cacheable-by-URL step
 * (threejs-preload.ts) that holds raw bytes; this module parses those bytes per
 * instance so each avatar gets a fresh, independent scene with the model's
 * original single-skeleton topology. (Parsing once and cloning via
 * SkeletonUtils would split the one shared skeleton into one-per-SkinnedMesh,
 * making retarget apply its origin offset once per skeleton — the buste/visage
 * framing regression.)
 *
 * Prerequisite: the model must expose ARKit blend shapes.
 * Supported naming conventions:
 *   - Direct ARKit names: "mouthSmileLeft", "eyeBlinkLeft", …
 *   - Prefixed ARKit names: "Wolf3D_Head_mouthSmileLeft" → stripped by morphPrefix config
 *
 * Attribution: morph discovery logic derived from TalkingHead by Mika Suominen (met4citizen), MIT.
 * Source: https://github.com/met4citizen/TalkingHead
 */
import { Float32BufferAttribute } from 'three'
import type { AnimationClip, BufferAttribute, Group, Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { MorphEngine } from '../morph/morph-engine.js'
import { BONE_MORPH_NAMES, TH_MIXED_MORPHS } from '../morph/morph-engine.js'
import { retarget } from './retargeter.js'
import type { LoadedModel, ModelLoaderOptions } from '../avatar-types.js'

type MorphMesh = Object3D & {
  isSkinnedMesh?: boolean
  frustumCulled?: boolean
  geometry?: {
    morphAttributes: {
      position?: BufferAttribute[]
      normal?: BufferAttribute[]
    }
  }
  morphTargetDictionary?: Record<string, number>
  morphTargetInfluences?: number[]
}

function stripPrefix(name: string, prefix: string | RegExp | undefined): string {
  if (!prefix) return name
  if (typeof prefix === 'string') {
    return name.startsWith(prefix) ? name.slice(prefix.length) : name
  }
  return name.replace(prefix, '')
}

/**
 * Parses preloaded GLB bytes into a fresh scene and registers all its morph
 * targets with the given MorphEngine. Async — GLTFLoader.parse is callback
 * based — but the network fetch already happened in threejs-preload.ts, so this
 * only re-parses cached bytes. Each call yields an independent scene with the
 * model's original single-skeleton topology (see module header).
 *
 * @param buffer - Raw .glb ArrayBuffer from a preloaded Three.js entry.
 * @param engine - MorphEngine instance to populate.
 * @param opts   - Optional prefix stripping + retarget.
 */
export async function buildModelInstance(
  buffer: ArrayBuffer,
  engine: MorphEngine,
  opts: ModelLoaderOptions = {},
): Promise<LoadedModel> {
  const loader = new GLTFLoader()
  const gltf = await new Promise<{ scene: Group; animations: readonly AnimationClip[] }>((resolve, reject) => {
    loader.parse(buffer, '', resolve, reject)
  })
  const scene = gltf.scene

  let detectedArmature: Object3D | null = null
  const morphNames = new Set<string>()
  const boneMap = new Map<string, Object3D>()
  const morphMeshes: MorphMesh[] = []

  scene.traverse((node: Object3D) => {
    if (node.name) boneMap.set(node.name, node)
    // TalkingHead disables culling for every model node so animated parts are
    // not dropped when a pose moves them outside their bind-pose bounds.
    node.frustumCulled = false
    // Find skeleton root (first Bone or Object3D named "Armature")
    if (!detectedArmature) {
      const asAny = node as { isBone?: boolean }
      if (asAny.isBone || node.name.toLowerCase() === 'armature') {
        detectedArmature = node
      }
    }

    // Register morph targets from SkinnedMesh
    const mesh = node as MorphMesh

    if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) {
      return
    }

    morphMeshes.push(mesh)

    const influences = mesh.morphTargetInfluences

    for (const [rawName, index] of Object.entries(mesh.morphTargetDictionary)) {
      const name = stripPrefix(rawName, opts.morphPrefix)

      // Skip bone-driven names — they are registered separately via registerBoneMorphs
      if ((BONE_MORPH_NAMES as readonly string[]).includes(name)) continue

      engine.registerBlendMorph(name, { influences, index })
      morphNames.add(name)
    }
  })

  registerTalkingHeadMixedMorphs(morphMeshes, engine, morphNames, opts.morphPrefix)

  if (opts.retarget) {
    retarget(scene, opts.retarget)
  }

  return {
    scene,
    armature: opts.modelRoot === undefined
      ? detectedArmature
      : scene.getObjectByName(opts.modelRoot) ?? detectedArmature,
    morphNames: Array.from(morphNames),
    boneMap,
    animations: gltf.animations,
  }
}

/** Adds the ARKit convenience shapes that TalkingHead synthesizes per model. */
function registerTalkingHeadMixedMorphs(
  meshes: readonly MorphMesh[],
  engine: MorphEngine,
  morphNames: Set<string>,
  morphPrefix: string | RegExp | undefined,
): void {
  for (const [name, sources] of Object.entries(TH_MIXED_MORPHS)) {
    for (const mesh of meshes) {
      const index = addMixedMorphTarget(mesh, name, sources, morphPrefix)
      if (index === undefined || mesh.morphTargetInfluences === undefined) continue
      engine.registerBlendMorph(name, { influences: mesh.morphTargetInfluences, index })
      morphNames.add(name)
    }
  }
}

/** Creates one relative Three.js morph target from the available source shapes. */
export function addMixedMorphTarget(
  mesh: MorphMesh,
  name: string,
  sources: Readonly<Record<string, number>>,
  morphPrefix?: string | RegExp,
): number | undefined {
  const dictionary = mesh.morphTargetDictionary
  const geometry = mesh.geometry
  if (
    dictionary === undefined
    || geometry === undefined
    || resolveMorphIndex(dictionary, name, morphPrefix) !== undefined
  ) return undefined

  const positions = geometry.morphAttributes.position
  if (positions === undefined) return undefined

  let mixedPosition: Float32BufferAttribute | undefined
  let mixedNormal: Float32BufferAttribute | undefined
  for (const [sourceName, factor] of Object.entries(sources)) {
    const sourceIndex = resolveMorphIndex(dictionary, sourceName, morphPrefix)
    const position = sourceIndex === undefined ? undefined : positions[sourceIndex]
    if (position === undefined) continue

    mixedPosition ??= new Float32BufferAttribute(position.count * 3, 3)
    for (let index = 0; index < position.count; index += 1) {
      mixedPosition.setXYZ(
        index,
        mixedPosition.getX(index) + position.getX(index) * factor,
        mixedPosition.getY(index) + position.getY(index) * factor,
        mixedPosition.getZ(index) + position.getZ(index) * factor,
      )
    }

    const normal = sourceIndex === undefined
      ? undefined
      : geometry.morphAttributes.normal?.[sourceIndex]
    if (normal !== undefined) {
      mixedNormal ??= new Float32BufferAttribute(normal.count * 3, 3)
      for (let index = 0; index < normal.count; index += 1) {
        mixedNormal.setXYZ(
          index,
          mixedNormal.getX(index) + normal.getX(index) * factor,
          mixedNormal.getY(index) + normal.getY(index) * factor,
          mixedNormal.getZ(index) + normal.getZ(index) * factor,
        )
      }
    }
  }

  if (mixedPosition === undefined || mesh.morphTargetInfluences === undefined) return undefined
  positions.push(mixedPosition)
  if (mixedNormal !== undefined) geometry.morphAttributes.normal?.push(mixedNormal)
  const index = positions.length - 1
  mesh.morphTargetInfluences[index] = 0
  dictionary[name] = index
  return index
}

/** Finds one canonical morph in a Three.js dictionary, including prefixed names. */
function resolveMorphIndex(
  dictionary: Readonly<Record<string, number>>,
  canonicalName: string,
  morphPrefix: string | RegExp | undefined,
): number | undefined {
  const direct = dictionary[canonicalName]
  if (direct !== undefined) return direct

  for (const [rawName, index] of Object.entries(dictionary)) {
    if (stripPrefix(rawName, morphPrefix) === canonicalName) return index
  }

  return undefined
}
