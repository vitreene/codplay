/**
 * GLB preload — fetch only, cached by URL as raw bytes, shared across instances.
 *
 * The per-URL cache holds the raw .glb ArrayBuffer, never a parsed scene.
 * Each instance re-parses those bytes via GLTFLoader.parse in model-loader.ts at
 * init() time, yielding a fresh, independent scene with the model's original
 * single-skeleton topology — exactly like the previous per-instance
 * GLTFLoader.load(url) flow. (A shared parsed scene cloned via SkeletonUtils
 * splits the one skeleton into one-per-SkinnedMesh, which breaks retarget's
 * per-skeleton origin offset — hence bytes + re-parse, not parse + clone.)
 */
export type ModelPreloadEntry = {
  status: 'loading' | 'ready' | 'error'
  buffer?: ArrayBuffer
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
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status} loading ${url}`)
    entry.buffer = await res.arrayBuffer()
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
