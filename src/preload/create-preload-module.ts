import type { ResourceManifestEntry } from '../builder/types'
import type { ApiResult, ApiWarning } from '../builder/types'
import type { PreloadApi, PreloadOptions, PreloadResult, PreloadState } from './preload-types'
import { getEntry, setEntry, releaseEntries } from './preload-cache'
import { loadAudio, loadCss, loadFont, loadImage, loadVideo } from './preload-strategies'

const DEFAULT_TIMEOUT_MS = 10000

function loadByType(entry: ResourceManifestEntry, timeoutMs: number, signal: AbortSignal): Promise<void> {
  switch (entry.type) {
    case 'image': return loadImage(entry.url, timeoutMs, signal)
    case 'audio': return loadAudio(entry.url, timeoutMs, signal)
    case 'video': return loadVideo(entry.url, timeoutMs, signal)
    case 'font': return loadFont(entry.url, undefined, timeoutMs, signal)
    case 'css': return loadCss(entry.url, timeoutMs, signal)
  }
}

export function createPreloadModule(): PreloadApi {
  const state: PreloadState = { status: 'idle', loadedCount: 0, totalCount: 0 }
  let currentController: AbortController | null = null

  async function load({ manifest, options = {} }: {
    manifest: Parameters<PreloadApi['load']>[0]['manifest']
    options?: PreloadOptions
  }): Promise<ApiResult<PreloadResult>> {
    const { mode = 'broadcast', timeout = DEFAULT_TIMEOUT_MS } = options

    if (currentController) currentController.abort()
    currentController = new AbortController()
    const { signal } = currentController

    const entries = manifest.entries
    state.status = 'loading'
    state.loadedCount = 0
    state.totalCount = entries.length

    const loaded: string[] = []
    const skipped: string[] = []
    const warnings: ApiWarning[] = []

    if (entries.length === 0) {
      state.status = 'ready'
      return { ok: true, data: { loaded, skipped } }
    }

    const results = await Promise.allSettled(
      entries.map(async (entry) => {
        const cached = getEntry(entry.url)

        if (cached?.status === 'ready') {
          skipped.push(entry.url)
          state.loadedCount++
          return
        }

        if (cached?.status === 'loading') {
          await cached.promise
          loaded.push(entry.url)
          state.loadedCount++
          return
        }

        const loadPromise = loadByType(entry, timeout, signal)
        setEntry(entry.url, { url: entry.url, status: 'loading', promise: loadPromise })

        try {
          await loadPromise
          setEntry(entry.url, { url: entry.url, status: 'ready', promise: Promise.resolve() })
          loaded.push(entry.url)
          state.loadedCount++
        } catch (err: unknown) {
          setEntry(entry.url, {
            url: entry.url,
            status: 'error',
            promise: Promise.resolve(),
            error: err instanceof Error ? err.message : String(err)
          })
          throw err
        }
      })
    )

    if (signal.aborted) {
      state.status = 'error'
      return { ok: false, error: { code: 'PRELOAD_CANCELLED', message: 'Preload was cancelled' } }
    }

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === 'rejected') {
        const isAborted = result.reason instanceof DOMException && result.reason.name === 'AbortError'
        if (isAborted) continue
        const url = entries[i].url
        warnings.push({
          code: 'PRELOAD_RESOURCE_UNAVAILABLE',
          message: `Resource unavailable: ${url}`,
          details: { url, error: result.reason instanceof Error ? result.reason.message : String(result.reason) }
        })
      }
    }

    if (mode === 'author' && warnings.length > 0) {
      state.status = 'error'
      return {
        ok: false,
        error: {
          code: 'PRELOAD_RESOURCES_UNAVAILABLE',
          message: `${warnings.length} resource(s) could not be loaded`,
          details: warnings.map((w) => w.details)
        }
      }
    }

    state.status = 'ready'
    return {
      ok: true,
      data: {
        loaded,
        skipped,
        warnings: warnings.length > 0 ? warnings : undefined
      }
    }
  }

  return {
    get state(): PreloadState {
      return state
    },
    load,
    cancel() {
      if (currentController) {
        currentController.abort()
        currentController = null
      }
      state.status = 'idle'
    },
    release(urls: string[]) {
      releaseEntries(urls)
    }
  }
}
