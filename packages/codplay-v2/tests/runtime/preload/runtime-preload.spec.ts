import { describe, expect, it, vi } from 'vitest'
import type { CompiledResourceManifest } from '../../../src/scene/compiled'
import {
  createRuntimePreload,
  createRuntimePreloadCache,
  mergeRuntimePreloadManifests,
} from '../../../src/runtime/preload'

function manifest(...urls: string[]): CompiledResourceManifest {
  return {
    entries: urls.map((url) => ({
      url,
      type: 'fixture',
      policy: { cache: 'default', priority: 'normal' },
    })),
  }
}

describe('RuntimePreload', () => {
  it('merges an array of manifests in declaration order and deduplicates by URL', () => {
    expect(mergeRuntimePreloadManifests([manifest('/a', '/b'), manifest('/b', '/c')]).entries.map((entry) => entry.url))
      .toEqual(['/a', '/b', '/c'])
    expect(mergeRuntimePreloadManifests([manifest('/a'), manifest('/a')]).entries).toHaveLength(1)
  })

  it('returns loaded resources in manifest order even when strategies resolve out of order', async () => {
    const preload = createRuntimePreload({
      strategies: {
        fixture: async (url) => {
          await new Promise<void>((resolve) => setTimeout(resolve, url === '/slow' ? 10 : 0))
        },
      },
    })

    const result = await preload.load({ manifest: manifest('/slow', '/fast') })

    expect(result).toMatchObject({ ok: true, data: { loaded: ['/slow', '/fast'], skipped: [] } })
  })

  it('returns metadata produced by the resource strategy', async () => {
    const preload = createRuntimePreload({
      strategies: {
        fixture: async () => ({ type: 'video', durationMs: 4_250 }),
      },
    })

    const result = await preload.load({ manifest: manifest('/movie.fixture') })

    expect(result).toMatchObject({
      ok: true,
      data: {
        metadata: {
          '/movie.fixture': { type: 'video', durationMs: 4_250 },
        },
      },
    })
  })

  it('shares one in-flight strategy and reports the second consumer as loaded', async () => {
    const cache = createRuntimePreloadCache()
    const load = vi.fn(async () => undefined)
    const first = createRuntimePreload({ cache, strategies: { fixture: load } })
    const second = createRuntimePreload({ cache, strategies: { fixture: load } })

    const [firstResult, secondResult] = await Promise.all([
      first.load({ manifest: manifest('/shared') }),
      second.load({ manifest: manifest('/shared') }),
    ])

    expect(firstResult).toMatchObject({ ok: true, data: { loaded: ['/shared'] } })
    expect(secondResult).toMatchObject({ ok: true, data: { loaded: ['/shared'] } })
    expect(load).toHaveBeenCalledTimes(1)
    expect(cache.get('/shared')).toMatchObject({ status: 'ready' })

    first.release(['/shared'])
    expect(cache.get('/shared')).toMatchObject({ status: 'ready' })
    second.release(['/shared'])
    expect(cache.get('/shared')).toBeUndefined()
  })

  it('warns in broadcast mode and blocks in author mode', async () => {
    const broadcast = createRuntimePreload({
      strategies: { fixture: async () => { throw new Error('network down') } },
    })
    const broadcastResult = await broadcast.load({ manifest: manifest('/broken') })
    expect(broadcastResult).toMatchObject({
      ok: true,
      data: { warnings: [{ details: { url: '/broken', error: 'network down' } }] },
    })

    const author = createRuntimePreload({
      strategies: { fixture: async () => { throw new Error('network down') } },
    })
    const authorResult = await author.load({
      manifest: manifest('/broken'),
      options: { mode: 'author' },
    })
    expect(authorResult).toMatchObject({
      ok: false,
      error: { code: 'RUNTIME_PRELOAD_RESOURCES_UNAVAILABLE' },
    })
  })
})
