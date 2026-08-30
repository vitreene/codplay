import type {
  RuntimePreloadCacheApi,
  RuntimePreloadCacheEntry,
  RuntimePreloadLoadResult,
  RuntimePreloadMediaHandle,
  RuntimePreloadResourceMetadata,
} from './preload-types'

type CacheRecord = {
  entry: RuntimePreloadCacheEntry
  owners: Set<symbol>
  controller: AbortController
}

/**
 * Owns the shared resource cache for preload consumers.
 *
 * Ownership is tracked per `RuntimePreload` instance so that one consumer
 * cannot evict a resource still used by another consumer.
 */
export class RuntimePreloadCache implements RuntimePreloadCacheApi {
  private readonly entries = new Map<string, CacheRecord>()

  /** Returns one cache entry without acquiring a reference. */
  get(url: string): RuntimePreloadCacheEntry | undefined {
    return this.entries.get(url)?.entry
  }

  /** Acquires one reference for an owner and returns the existing entry. */
  claim(url: string, owner: symbol): RuntimePreloadCacheEntry | undefined {
    const record = this.entries.get(url)
    if (record === undefined) return undefined
    record.owners.add(owner)
    return record.entry
  }

  /** Registers one in-flight entry and acquires it for its owner. */
  start(
    url: string,
    owner: symbol,
    promise: Promise<RuntimePreloadLoadResult | undefined>,
    controller: AbortController,
  ): RuntimePreloadCacheEntry {
    const entry: RuntimePreloadCacheEntry = { url, status: 'loading', promise }
    this.entries.set(url, { entry, owners: new Set([owner]), controller })
    return entry
  }

  /** Marks one still-current entry as ready. */
  markReady(
    url: string,
    entry: RuntimePreloadCacheEntry,
    metadata?: RuntimePreloadResourceMetadata,
    media?: RuntimePreloadMediaHandle,
  ): void {
    const record = this.entries.get(url)
    if (record?.entry !== entry) return
    const result = media === undefined ? metadata : { metadata, media }
    record.entry = { url, status: 'ready', promise: Promise.resolve(result), metadata, media }
  }

  /** Marks one still-current entry as failed. */
  markError(url: string, entry: RuntimePreloadCacheEntry, error: string): void {
    const record = this.entries.get(url)
    if (record?.entry !== entry) return
    record.entry = { url, status: 'error', promise: Promise.resolve(), error }
  }

  /** Releases one owner's references and evicts unowned entries. */
  release(owner: symbol, urls: readonly string[]): void {
    for (const url of urls) {
      const record = this.entries.get(url)
      if (record === undefined) continue
      record.owners.delete(owner)
      if (record.owners.size > 0) continue
      if (record.entry.status === 'loading') record.controller.abort()
      record.entry.media?.release()
      this.entries.delete(url)
    }
  }
}

/** Creates one empty shared cache for an engine or an external orchestrator. */
export function createRuntimePreloadCache(): RuntimePreloadCache {
  return new RuntimePreloadCache()
}
