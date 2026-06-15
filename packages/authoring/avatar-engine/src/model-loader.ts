/**
 * GLB model loading — discovers morph targets and registers them with MorphEngine.
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
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
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
 * Load a GLB and register all morph targets with the given MorphEngine.
 *
 * @param url    - URL of the GLB file.
 * @param engine - MorphEngine instance to populate.
 * @param opts   - Optional prefix stripping.
 */
export async function loadModel(
  url: string,
  engine: MorphEngine,
  opts: ModelLoaderOptions = {},
): Promise<LoadedModel> {
  const loader = new GLTFLoader()
  const gltf = await loadGltf(loader, url)
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

function loadGltf(loader: GLTFLoader, url: string): Promise<GLTF> {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject)
  })
}
