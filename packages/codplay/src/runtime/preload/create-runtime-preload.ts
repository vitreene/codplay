import type { CompiledResource, CompiledResourceManifest } from '../../scene/compiled'
import { RuntimePreloadCache, createRuntimePreloadCache } from './preload-cache'
import {
  loadRuntimeAudio,
  loadRuntimeCss,
  loadRuntimeFont,
  loadRuntimeImage,
  loadRuntimeVideo,
  scopeRuntimeCssText,
  withRuntimePreloadTimeout,
} from './preload-strategies'
import type {
  RuntimePreloadApi,
  RuntimePreloadCacheApi,
  RuntimePreloadCssSetInput,
  RuntimePreloadLoadResult,
  RuntimePreloadManifestInput,
  RuntimePreloadMediaHandle,
  RuntimePreloadOptions,
  RuntimePreloadPreparedResource,
  RuntimePreloadResource,
  RuntimePreloadResourceMetadata,
  RuntimePreloadResult,
  RuntimePreloadState,
  RuntimePreloadStrategy,
  RuntimePreloadWarning,
} from './preload-types'

const DEFAULT_TIMEOUT_MS = 10_000

/** Normalizes one or several manifests while preserving first declaration order. */
export function mergeRuntimePreloadManifests(
  input: RuntimePreloadManifestInput,
): Readonly<{ entries: readonly CompiledResource[] }> {
  const manifests: readonly CompiledResourceManifest[] = Array.isArray(input) ? input : [input]
  const entries = new Map<string, CompiledResource>()
  for (const manifest of manifests) {
    for (const entry of manifest.entries) {
      if (!entries.has(entry.url)) entries.set(entry.url, entry)
    }
  }
  return { entries: [...entries.values()] }
}

/** Creates one external preload service around one shared cache. */
export function createRuntimePreload(options: Readonly<{
  cache?: RuntimePreloadCacheApi
  strategies?: Readonly<Record<string, RuntimePreloadStrategy>>
}> = {}): RuntimePreloadApi {
  const cache = options.cache ?? createRuntimePreloadCache()
  const owner = Symbol('codplay-preload-owner')
  const strategies = new Map<string, RuntimePreloadStrategy>(Object.entries(options.strategies ?? {}))
  const state: { status: RuntimePreloadState['status']; loadedCount: number; totalCount: number } = {
    status: 'idle',
    loadedCount: 0,
    totalCount: 0,
  }
  let currentOperation: { controller: AbortController; pendingUrls: Set<string> } | undefined
  const cssSlots = new Map<string, HTMLStyleElement>()

  /** Replaces one generated stylesheet in a stable scoped slot. */
  function setCssSlot(input: RuntimePreloadCssSetInput): void {
    validateCssSetInput(input)
    if (typeof globalThis.document === 'undefined') {
      throw new Error('Inline CSS preload requires a browser document.')
    }
    const head = globalThis.document.head
    if (head === null) throw new Error('Inline CSS preload requires a document head.')

    const existing = cssSlots.get(input.slot)
    const style = existing ?? globalThis.document.createElement('style')
    style.setAttribute('data-codplay-preload-css-slot', input.slot)
    style.textContent = scopeRuntimeCssText(input.cssText, input.container)
    if (style.parentNode === null) head.appendChild(style)
    cssSlots.set(input.slot, style)
  }

  /** Clears one generated stylesheet slot, or every slot owned by this service. */
  function clearCssSlots(slot?: string): void {
    const slots = slot === undefined ? [...cssSlots.keys()] : [slot]
    for (const currentSlot of slots) {
      const style = cssSlots.get(currentSlot)
      if (style === undefined) continue
      style.remove()
      cssSlots.delete(currentSlot)
    }
  }

  /** Loads one entry with its native or registered type strategy. */
  function loadEntry(
    entry: RuntimePreloadResource,
    timeoutMs: number,
    signal: AbortSignal,
    container: Element | null | undefined,
  ): Promise<RuntimePreloadLoadResult | undefined> {
    const builtin = entry.type === 'image'
      ? loadRuntimeImage(entry.url, signal)
      : entry.type === 'audio'
        ? loadRuntimeAudio(entry.url, signal)
        : entry.type === 'video'
          ? loadRuntimeVideo(entry.url, signal)
          : entry.type === 'font'
            ? loadRuntimeFont(entry.url, signal)
            : entry.type === 'css'
              ? loadRuntimeCss(entry.url, signal, container)
              : undefined
    if (builtin !== undefined) {
      return withRuntimePreloadTimeout(
        builtin as Promise<RuntimePreloadLoadResult | undefined>,
        timeoutMs,
      )
    }
    const strategy = strategies.get(entry.type)
    if (strategy === undefined) {
      return Promise.reject(new Error(`No preload strategy registered for resource type "${entry.type}"`))
    }
    return withRuntimePreloadTimeout(strategy(entry.url, signal), timeoutMs)
  }

  /** Cancels only this consumer's pending references. Shared work survives other owners. */
  function cancelCurrentOperation(): void {
    const operation = currentOperation
    if (operation === undefined) return
    operation.controller.abort()
    cache.release(owner, [...operation.pendingUrls])
    currentOperation = undefined
  }

  /** Loads all entries, sharing work with other preload consumers. */
  async function load(input: Readonly<{
    manifest: RuntimePreloadManifestInput
    options?: RuntimePreloadOptions
  }>): Promise<RuntimePreloadResult> {
    cancelCurrentOperation()
    const manifest = mergeRuntimePreloadManifests(input.manifest)
    const options = input.options ?? {}
    const mode = options.mode ?? 'broadcast'
    const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new Error('Preload timeout must be a finite positive number.')
    }

    const controller = new AbortController()
    const pendingUrls = new Set<string>()
    currentOperation = { controller, pendingUrls }
    state.status = 'loading'
    state.loadedCount = 0
    state.totalCount = manifest.entries.length
    const outcomes: Array<'loaded' | 'skipped' | undefined> = new Array(manifest.entries.length)
    const warnings: RuntimePreloadWarning[] = []
    const metadata: Record<string, RuntimePreloadResourceMetadata> = {}
    const media: Record<string, RuntimePreloadMediaHandle> = {}

    if (manifest.entries.length === 0) {
      state.status = 'ready'
      currentOperation = undefined
      return { ok: true, data: { loaded: [], skipped: [], metadata: {} } }
    }

    const results = await Promise.allSettled(manifest.entries.map(async (entry, index) => {
      let cached = cache.claim(entry.url, owner)
      if (cached?.status === 'ready') {
        outcomes[index] = 'skipped'
        if (cached.metadata !== undefined) metadata[entry.url] = cached.metadata
        if (cached.media !== undefined) media[entry.url] = cached.media
        state.loadedCount += 1
        return
      }
      if (cached?.status === 'loading') {
        pendingUrls.add(entry.url)
        try {
          const loaded = normalizePreloadResult(await cached.promise)
          if (loaded.metadata !== undefined) metadata[entry.url] = loaded.metadata
          if (loaded.media !== undefined) media[entry.url] = loaded.media
          outcomes[index] = 'loaded'
          state.loadedCount += 1
          return
        } catch (error) {
          cache.release(owner, [entry.url])
          throw error
        } finally {
          pendingUrls.delete(entry.url)
        }
      }

      if (cached?.status === 'error') {
        cache.release(owner, [entry.url])
        cached = undefined
      }

      const entryController = new AbortController()
      const promise = loadEntry(entry, timeoutMs, entryController.signal, options.container)
      const cacheEntry = cache.start(entry.url, owner, promise, entryController)
      pendingUrls.add(entry.url)
      try {
        const loaded = normalizePreloadResult(await promise)
        cache.markReady(entry.url, cacheEntry, loaded.metadata, loaded.media)
        if (loaded.metadata !== undefined) metadata[entry.url] = loaded.metadata
        if (loaded.media !== undefined) media[entry.url] = loaded.media
        pendingUrls.delete(entry.url)
        outcomes[index] = 'loaded'
        state.loadedCount += 1
      } catch (error) {
        pendingUrls.delete(entry.url)
        const message = error instanceof Error ? error.message : String(error)
        cache.markError(entry.url, cacheEntry, message)
        cache.release(owner, [entry.url])
        throw error
      }
    }))

    const wasCancelled = controller.signal.aborted || currentOperation?.controller !== controller
    if (wasCancelled) {
      state.status = 'idle'
      return {
        ok: false,
        error: { code: 'RUNTIME_PRELOAD_CANCELLED', message: 'Preload was cancelled.' },
      }
    }

    for (let index = 0; index < results.length; index += 1) {
      const result = results[index]
      if (result.status !== 'rejected') continue
      const entry = manifest.entries[index]
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason)
      if (isAbortError(result.reason)) continue
      warnings.push({
        code: 'RUNTIME_PRELOAD_RESOURCE_UNAVAILABLE',
        message: `Resource unavailable: ${entry.url}`,
        details: { url: entry.url, error: reason },
      })
    }

    currentOperation = undefined
    if (mode === 'author' && warnings.length > 0) {
      state.status = 'error'
      return {
        ok: false,
        error: {
          code: 'RUNTIME_PRELOAD_RESOURCES_UNAVAILABLE',
          message: `${warnings.length} resource(s) could not be loaded.`,
          details: warnings,
        },
      }
    }
    state.status = 'ready'
    const loaded = manifest.entries
      .filter((_, index) => outcomes[index] === 'loaded')
      .map((entry) => entry.url)
    const skipped = manifest.entries
      .filter((_, index) => outcomes[index] === 'skipped')
      .map((entry) => entry.url)
    return {
      ok: true,
      data: {
        loaded,
        skipped,
        metadata,
        media: Object.keys(media).length === 0 ? undefined : media,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
    }
  }

  return {
    css: {
      set: setCssSlot,
      clear: clearCssSlots,
    },
    get state(): RuntimePreloadState {
      return { ...state }
    },
    load,
    cancel(): void {
      cancelCurrentOperation()
      state.status = 'idle'
    },
    release(urls: readonly string[]): void {
      cache.release(owner, urls)
    },
    registerStrategy(type: string, strategy: RuntimePreloadStrategy): void {
      if (type.trim().length === 0) throw new Error('Preload strategy type must not be empty.')
      strategies.set(type, strategy)
    },
  }
}

/** Validates the public input before mutating the stylesheet slot registry. */
function validateCssSetInput(input: RuntimePreloadCssSetInput): void {
  if (typeof input !== 'object' || input === null) throw new Error('Inline CSS preload input must be an object.')
  if (typeof input.slot !== 'string' || input.slot.trim() === '') throw new Error('Inline CSS preload slot must not be empty.')
  if (typeof input.cssText !== 'string') throw new Error('Inline CSS preload cssText must be a string.')
  if (!isElement(input.container)) throw new Error('Inline CSS preload container must be an Element.')
}

/** Detects a DOM Element without relying on the caller's realm constructor. */
function isElement(value: unknown): value is Element {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { nodeType?: unknown; setAttribute?: unknown }
  return candidate.nodeType === 1 && typeof candidate.setAttribute === 'function'
}

/** Converts legacy metadata results and prepared native resources to one shape. */
function normalizePreloadResult(
  result: RuntimePreloadLoadResult | undefined,
): Readonly<{ metadata?: RuntimePreloadResourceMetadata; media?: RuntimePreloadMediaHandle }> {
  if (result === undefined) return {}
  if (isPreparedResource(result)) return result
  return { metadata: result }
}

/** Identifies the extended result returned by native media strategies. */
function isPreparedResource(
  result: RuntimePreloadLoadResult,
): result is RuntimePreloadPreparedResource {
  return typeof result === 'object'
    && result !== null
    && 'media' in result
    && typeof result.media === 'object'
    && result.media !== null
    && typeof result.media.take === 'function'
}

/** Identifies browser abort failures without depending on DOMException. */
function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

/** Creates the default cache explicitly for callers that want to share it. */
export { RuntimePreloadCache }
