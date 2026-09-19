import { describe, expect, it, vi } from 'vitest'
import type { RiveFile, RiveRuntime } from '../src'

const { awaitInstance } = vi.hoisted(() => ({ awaitInstance: vi.fn() }))

vi.mock('@rive-app/canvas', () => ({
  RuntimeLoader: { awaitInstance },
}))

import {
  getRiveResource,
  preloadRiveResource,
} from '../src/rive/rive-preload'

describe('Rive V2 preload', () => {
  it('decodes one document through the shared preload strategy boundary', async () => {
    const file = {} as RiveFile
    const runtime = { load: vi.fn(async () => file) } as unknown as RiveRuntime
    awaitInstance.mockResolvedValue(runtime)
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new ArrayBuffer(8),
    })))

    await preloadRiveResource('/preload.riv', new AbortController().signal)

    expect(runtime.load).toHaveBeenCalledWith(expect.any(Uint8Array))
    expect(getRiveResource('/preload.riv')).toEqual({ runtime, file })
  })
})
