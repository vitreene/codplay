/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  getThreeBinaryResource,
  THREE_PRELOAD_STRATEGIES,
} from '../src/threejs/core/threejs-preload'

describe('Three.js preload', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads GLB bytes through Three.js FileLoader and makes them available to the component', async () => {
    const bytes = new Uint8Array([0x67, 0x6c, 0x54, 0x46])
    const fetchMock = vi.fn(async () => new Response(bytes, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const strategy = THREE_PRELOAD_STRATEGIES['three-glb']
    expect(strategy).toBeDefined()
    await strategy!('https://codplay.test/avatar-preload.glb', new AbortController().signal)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(new Uint8Array(getThreeBinaryResource('https://codplay.test/avatar-preload.glb'))).toEqual(bytes)
  })

  it('uses the same Three.js binary boundary for FBX animation resources', async () => {
    const bytes = new Uint8Array([0x46, 0x42, 0x58])
    const fetchMock = vi.fn(async () => new Response(bytes, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const strategy = THREE_PRELOAD_STRATEGIES['three-fbx']
    expect(strategy).toBeDefined()
    await strategy!('https://codplay.test/hero-walk.fbx', new AbortController().signal)

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(new Uint8Array(getThreeBinaryResource('https://codplay.test/hero-walk.fbx'))).toEqual(bytes)
  })

  it('aborts the Three.js file request when the preload signal is aborted', async () => {
    const fetchMock = vi.fn(async () => new Promise<Response>(() => undefined))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    const loading = THREE_PRELOAD_STRATEGIES['three-glb']!('https://codplay.test/avatar-abort.glb', controller.signal)

    controller.abort()

    await expect(loading).rejects.toMatchObject({ name: 'AbortError' })
  })
})
