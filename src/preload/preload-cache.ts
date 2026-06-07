import type { PreloadCacheEntry } from './preload-types'

const cache = new Map<string, PreloadCacheEntry>()

export function getEntry(url: string): PreloadCacheEntry | undefined {
  return cache.get(url)
}

export function setEntry(url: string, entry: PreloadCacheEntry): void {
  cache.set(url, entry)
}

export function releaseEntries(urls: string[]): void {
  for (const url of urls) {
    cache.delete(url)
  }
}

export function clearCache(): void {
  cache.clear()
}
