/**
 * GLB preload — fetch + parse only, cached by URL, shared across instances.
 *
 * Mirrors packages/authoring/components/rive/src/rive-preload.ts: the per-URL
 * cache holds the raw parsed result (here: gltf.scene), never touched by any
 * specific instance. Cloning + traversal + retarget + morph registration is
 * per-instance work done in model-loader.ts at init() time, not here.
 */
import type { Group } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export type ModelPreloadEntry = {
  status: 'loading' | 'ready' | 'error'
  scene?: Group
  error?: string
}

const resourceCache = new Map<string, ModelPreloadEntry>()

export function getModelEntry(url: string): ModelPreloadEntry | undefined {
  return resourceCache.get(url)
}

export async function preloadAvatar3DModel(url: string): Promise<void> {
  const existing = resourceCache.get(url)
  if (existing?.status === 'ready') return
  if (existing?.status === 'loading') {
    await waitForReady(url)
    return
  }

  const entry: ModelPreloadEntry = { status: 'loading' }
  resourceCache.set(url, entry)

  try {
    const loader = new GLTFLoader()
    const gltf = await new Promise<{ scene: Group }>((resolve, reject) => {
      loader.load(url, resolve, undefined, reject)
    })
    entry.scene = gltf.scene
    entry.status = 'ready'
  } catch (err) {
    entry.status = 'error'
    entry.error = err instanceof Error ? err.message : String(err)
    throw err
  }
}

function waitForReady(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const check = (): void => {
      const e = resourceCache.get(url)
      if (!e || e.status === 'loading') {
        setTimeout(check, 16)
      } else if (e.status === 'ready') {
        resolve()
      } else {
        reject(new Error(e.error ?? `[avatar3d] failed to load ${url}`))
      }
    }
    check()
  })
}
