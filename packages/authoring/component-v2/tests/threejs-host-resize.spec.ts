/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Color, PerspectiveCamera, Scene } from 'three'
import type { ComponentAnimation } from 'codplay'
import { ThreeSceneHostComponent } from '../src/threejs/core/host/three-scene-host-component'

describe('Three.js host resize', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('repaints at the same logical time through the commit after either resize observer order', () => {
    let width = 720
    let height = 480
    let resizeCallback: ResizeObserverCallback | undefined
    let painted = false
    const sizes: number[][] = []
    const renders: number[][] = []
    const canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'clientWidth', { get: () => width })
    Object.defineProperty(canvas, 'clientHeight', { get: () => height })

    class FakeResizeObserver {
      /** Retains the native callback so the test can choose delivery order. */
      constructor(callback: ResizeObserverCallback) { resizeCallback = callback }
      /** Accepts the observed canvas without starting a browser observer. */
      observe(): void {}
      /** Releases the observer with the host. */
      disconnect(): void {}
    }

    class FakeRenderer {
      /** Accepts the canvas owned by the host. */
      constructor(_options: { canvas: HTMLCanvasElement }) {}
      /** Uses the same test pixel ratio for every native resize. */
      setPixelRatio(): void {}
      /** A native resize clears the drawing buffer until the next render. */
      setSize(nextWidth: number, nextHeight: number): void {
        sizes.push([nextWidth, nextHeight])
        painted = false
      }
      /** Records the image presented by CodPlay's commit. */
      render(_scene: Scene, camera: PerspectiveCamera): void {
        renders.push([camera.aspect, width / height])
        painted = true
      }
      /** Releases the renderer with the host. */
      dispose(): void {}
    }

    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    const component = new ThreeSceneHostComponent({
      services: { declare: () => undefined, get: () => { throw new Error('No service') }, apply: () => undefined },
      runtime: { getLibrary: () => ({ WebGLRenderer: FakeRenderer, Scene, Color }) },
      perso: { id: 'host', storyId: 'main', initial: { width, height } },
    } as never)
    component._materialize(canvas, [])
    component.initialize()
    const camera = new PerspectiveCamera()
    component.getSceneTarget()?.setCamera(camera)
    const animations: ComponentAnimation[] = []
    component.update({
      state: {}, timeMs: 1_000,
      registerAnimation: (animation: ComponentAnimation) => animations.push(animation),
    } as never)
    const commit = animations[0]!
    const initial = commit.sample(1_000)!
    initial.apply()
    expect(painted).toBe(true)

    width = 360
    height = 480
    const afterRootResize = commit.sample(1_000)!
    expect(afterRootResize.value).not.toEqual(initial.value)
    afterRootResize.apply()
    expect(camera.aspect).toBeCloseTo(0.75)
    expect(sizes.at(-1)).toEqual([360, 480])
    expect(painted).toBe(true)

    resizeCallback?.([{ contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver)
    expect(sizes).toHaveLength(2)
    expect(painted).toBe(true)

    width = 400
    resizeCallback?.([{ contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver)
    expect(painted).toBe(false)
    const afterCanvasResize = commit.sample(1_000)!
    afterCanvasResize.apply()
    expect(camera.aspect).toBeCloseTo(400 / 480)
    expect(painted).toBe(true)
    expect(renders).toHaveLength(3)
    expect(renders.every(([aspect, expected]) => Math.abs(aspect! - expected!) < 1e-9)).toBe(true)

    component.destroy()
  })
})
