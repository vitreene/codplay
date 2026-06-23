/**
 * Per-instance model setup — parse + discover morph targets + register them
 * with MorphEngine. The GLB fetch is a separate, cacheable-by-URL step
 * (model-preload.ts) that holds raw bytes; this module parses those bytes per
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
import type { Group, Object3D } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { MorphEngine } from './morph-engine.js'
import { BONE_MORPH_NAMES } from './morph-engine.js'
import { retarget } from './retargeter.js'
import type { RetargetConfig } from './retargeter.js'

export type ModelLoaderOptions = {
  /**
   * Prefix stripped from raw morph target names in the GLB.
   * ReadyPlayerMe models: "Wolf3D_Head_" or "Wolf3D_Teeth_"
   * Pure ARKIT models: "" (no prefix)
   *
   * The strip regex removes all characters up to and including
   * the matched prefix: e.g. "Wolf3D_Head_mouthSmileLeft" → "mouthSmileLeft".
   * If morphs are already in ARKit format, leave undefined or "".
   */
  morphPrefix?: string | RegExp
  /**
   * Mixamo retarget config applied after loading (bone adjustments + scale + origin).
   * See RetargetConfig for the full shape. Example:
   *   { Neck: { z: -0.01, rx: -0.15 }, scaleToEyesLevel: 1.0, origin: { y: -0.1 } }
   */
  retarget?: RetargetConfig
}

export type { RetargetConfig }

export type LoadedModel = {
  /** Root Three.js group (GLTF scene). */
  scene: Group
  /** Skeleton root (first bone found). */
  armature: Object3D | null
  /** Morph names found in the model (canonical, after prefix strip). */
  morphNames: string[]
  /** All named nodes in the scene, keyed by node name. */
  boneMap: Map<string, Object3D>
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
 * based — but the network fetch already happened in model-preload.ts, so this
 * only re-parses cached bytes. Each call yields an independent scene with the
 * model's original single-skeleton topology (see module header).
 *
 * @param buffer - Raw .glb ArrayBuffer from a preloaded entry (model-preload.ts).
 * @param engine - MorphEngine instance to populate.
 * @param opts   - Optional prefix stripping + retarget.
 */
export async function buildModelInstance(
  buffer: ArrayBuffer,
  engine: MorphEngine,
  opts: ModelLoaderOptions = {},
): Promise<LoadedModel> {
  const loader = new GLTFLoader()
  const gltf = await new Promise<{ scene: Group }>((resolve, reject) => {
    loader.parse(buffer, '', resolve, reject)
  })
  const scene = gltf.scene

  let armature: Object3D | null = null
  const morphNames = new Set<string>()
  const boneMap = new Map<string, Object3D>()

  scene.traverse((node: Object3D) => {
    if (node.name) boneMap.set(node.name, node)
    // Find skeleton root (first Bone or Object3D named "Armature")
    if (!armature) {
      const asAny = node as { isBone?: boolean }
      if (asAny.isBone || node.name.toLowerCase() === 'armature') {
        armature = node
      }
    }

    // Register morph targets from SkinnedMesh
    const mesh = node as {
      isSkinnedMesh?: boolean
      morphTargetDictionary?: Record<string, number>
      morphTargetInfluences?: number[]
    }

    if (!mesh.isSkinnedMesh || !mesh.morphTargetDictionary || !mesh.morphTargetInfluences) {
      return
    }

    const influences = mesh.morphTargetInfluences

    for (const [rawName, index] of Object.entries(mesh.morphTargetDictionary)) {
      const name = stripPrefix(rawName, opts.morphPrefix)

      // Skip bone-driven names — they are registered separately via registerBoneMorphs
      if ((BONE_MORPH_NAMES as readonly string[]).includes(name)) continue

      engine.registerBlendMorph(name, { influences, index })
      morphNames.add(name)
    }
  })

  if (opts.retarget) {
    retarget(scene, opts.retarget)
  }

  return {
    scene,
    armature,
    morphNames: Array.from(morphNames),
    boneMap,
  }
}
