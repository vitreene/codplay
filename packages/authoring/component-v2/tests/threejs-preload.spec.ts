/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { AnimationClip, Group, Scene } from 'three'
import * as THREE from 'three'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import type { ComponentAnimation, ComponentInput } from 'codplay'
import { AvatarComponent } from '../src/avatar/components/avatar-component'
import type { AvatarInitial } from '../src/avatar/avatar-types'

import {
  getThreeFbxResource,
  getThreeGlbResource,
  THREE_PRELOAD_STRATEGIES,
} from '../src/threejs/core/threejs-preload'

/** Creates a complete, tiny glTF document owned by this test. */
function createGltfBytes(): Uint8Array<ArrayBuffer> {
  const document = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ name: 'TestRoot' }],
  }
  return new TextEncoder().encode(JSON.stringify(document))
}

describe('Three.js preload', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('makes a GLB resource available only after Three.js has decoded it', async () => {
    const bytes = createGltfBytes()
    const fetchMock = vi.fn(async () => new Response(bytes, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const strategy = THREE_PRELOAD_STRATEGIES['three-glb']
    expect(strategy).toBeDefined()
    await strategy!('https://codplay.test/avatar-preload.glb', new AbortController().signal)

    expect(fetchMock).toHaveBeenCalledOnce()
    const resource = getThreeGlbResource('https://codplay.test/avatar-preload.glb')
    expect(resource.scene.getObjectByName('TestRoot')).toBeDefined()
    expect(resource.animations).toEqual([])
  })

  it('initializes two private Avatars before their first presentation at 0 ms', async () => {
    const src = 'https://codplay.test/two-avatars.glb'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(createGltfBytes(), { status: 200 })))
    await THREE_PRELOAD_STRATEGIES['three-glb']!(src, new AbortController().signal)

    /** Creates one component with the same decoded preload source. */
    function createAvatar(id: string): AvatarComponent {
      const input: ComponentInput<AvatarInitial> = {
        services: {
          declare: () => undefined,
          get: () => { throw new Error('No service is used by Avatar.') },
          apply: () => undefined,
        },
        runtime: { getLibrary: <Runtime>() => THREE as unknown as Runtime },
        perso: { id, storyId: 'test-story', initial: { src } },
      }
      return new AvatarComponent(input)
    }

    const first = createAvatar('first')
    const second = createAvatar('second')
    const firstScene = new Scene()
    const secondScene = new Scene()
    let firstAnimation: ComponentAnimation | undefined
    let secondAnimation: ComponentAnimation | undefined
    first.initialize()
    second.initialize()
    first.update({
      state: { src },
      timeMs: 0,
      target: { scene: firstScene, getCamera: () => null },
      registerAnimation: (animation) => { firstAnimation = animation },
    })
    second.update({
      state: { src },
      timeMs: 0,
      target: { scene: secondScene, getCamera: () => null },
      registerAnimation: (animation) => { secondAnimation = animation },
    })

    expect(firstScene.children).toHaveLength(1)
    expect(secondScene.children).toHaveLength(1)
    expect(firstScene.children[0]).not.toBe(secondScene.children[0])
    firstAnimation?.sample(0)?.apply()
    secondAnimation?.sample(0)?.apply()
    expect(firstScene.getObjectByName('TestRoot')).toBeDefined()
    expect(secondScene.getObjectByName('TestRoot')).toBeDefined()

    first.destroy()
    expect(firstScene.children).toHaveLength(0)
    expect(secondScene.children).toHaveLength(1)
    second.destroy()
  })

  it('decodes FBX animation resources inside the same preload barrier', async () => {
    const bytes = new Uint8Array([0x46, 0x42, 0x58])
    const fetchMock = vi.fn(async () => new Response(bytes, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const root = new Group()
    const clip = new AnimationClip('walk', 1, [])
    root.animations.push(clip)
    const parse = vi.spyOn(FBXLoader.prototype, 'parse').mockReturnValue(root)

    await THREE_PRELOAD_STRATEGIES['three-fbx']!(
      'https://codplay.test/hero-walk.fbx',
      new AbortController().signal,
    )

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(parse).toHaveBeenCalledOnce()
    expect(getThreeFbxResource('https://codplay.test/hero-walk.fbx').animations).toEqual([clip])
  })

  it('rejects a malformed GLB during preload instead of leaving initialization pending', async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const src = 'https://codplay.test/invalid-avatar.glb'

    await expect(THREE_PRELOAD_STRATEGIES['three-glb']!(
      src,
      new AbortController().signal,
    )).rejects.toThrow()
    expect(() => getThreeGlbResource(src)).toThrow('was not preloaded')
  })

  it('aborts the Three.js file request when the preload signal is aborted', async () => {
    const fetchMock = vi.fn(async () => new Promise<Response>(() => undefined))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    const loading = THREE_PRELOAD_STRATEGIES['three-glb']!(
      'https://codplay.test/avatar-abort.glb', controller.signal,
    )

    controller.abort()

    await expect(loading).rejects.toMatchObject({ name: 'AbortError' })
  })
})
