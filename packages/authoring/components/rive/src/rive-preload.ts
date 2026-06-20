import { RuntimeLoader } from '@rive-app/canvas'
import type { RiveRuntime, RiveResourceEntry } from './rive-context'

// Singleton: WASM library is loaded once per session.
let runtimePromise: Promise<RiveRuntime> | null = null

export function getRiveRuntime(): Promise<RiveRuntime> {
  if (!runtimePromise) {
    runtimePromise = RuntimeLoader.awaitInstance() as unknown as Promise<RiveRuntime>
  }
  return runtimePromise
}

// Per-URL cache: one entry per .riv file URL.
const resourceCache = new Map<string, RiveResourceEntry>()

export function getRiveEntry(url: string): RiveResourceEntry | undefined {
  return resourceCache.get(url)
}

export async function preloadRiveResource(url: string): Promise<void> {
  const existing = resourceCache.get(url)
  if (existing?.status === 'ready') return
  if (existing?.status === 'loading') {
    await waitForReady(url)
    return
  }

  const entry: RiveResourceEntry = { status: 'loading' }
  resourceCache.set(url, entry)

  try {
    const runtime = await getRiveRuntime()
    const bytes = await fetch(url).then((r) => {
      if (!r.ok) throw new Error(`[rive] HTTP ${r.status} for ${url}`)
      return r.arrayBuffer()
    })
    const file = await runtime.load(new Uint8Array(bytes))
    entry.runtime = runtime
    entry.file = file
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
        reject(new Error(e.error ?? `[rive] failed to load ${url}`))
      }
    }
    check()
  })
}
