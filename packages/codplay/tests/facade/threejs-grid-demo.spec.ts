/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import * as Three from 'three'
import { CodPlay, type RuntimeLibraryDefinition } from '../../src'
import { materializeScene, resolveScene } from '../../src/runtime/player/pipeline'
import { THREE_INSTANCED_GRID_DEFINITION, THREEJS_CORE_ENGINE } from '../../../authoring/component-v2/src'
import { createScene } from '../../../demos/src/v2/demos/threejs-grid/main'

/** Verifies the real demo build and logical TweenAction path without mounting WebGL. */
describe('Three.js grid V2 demo', () => {
  it('resolves camera and light changes from the demo actions', () => {
    const codplay = new CodPlay({
      engine: {
        ...THREEJS_CORE_ENGINE,
        components: {
          register: [
            ...(THREEJS_CORE_ENGINE.components?.register ?? []),
            THREE_INSTANCED_GRID_DEFINITION,
          ],
        },
        idle: false,
      },
      pauseOnDocumentHidden: false,
    })

    try {
      const build = codplay.build({ scene: createScene() })
      expect(build.ok).toBe(true)
      if (!build.ok) return

      const initial = resolveScene(materializeScene(build.compiledScene, 0), build.functions)
      const receding = resolveScene(materializeScene(build.compiledScene, 3_500), build.functions)
      const middle = resolveScene(materializeScene(build.compiledScene, 4_000), build.functions)
      const advancing = resolveScene(materializeScene(build.compiledScene, 7_000), build.functions)
      const initialCamera = initial.persos['main:camera']?.state.position as readonly number[]
      const recedingCamera = receding.persos['main:camera']?.state.position as readonly number[]
      const advancingCamera = advancing.persos['main:camera']?.state.position as readonly number[]

      expect(initialCamera).toEqual([0, 0, 6])
      expect(recedingCamera).toEqual([0, 0, 8.5])
      expect(advancingCamera).toEqual([0, 0, 6])
      expect(middle.persos['main:ambient-light']?.state.color).toBe('#8020c0')
      expect(middle.persos['main:point-light']?.state.color).toBe('#edbaa5')
      const middlePointPosition = middle.persos['main:point-light']?.state.position as readonly number[]
      expect(middlePointPosition[0]).toBeCloseTo(-3)
      expect(middlePointPosition[1]).toBeCloseTo(3)
      expect(middlePointPosition[2]).toBeCloseTo(6)
    } finally {
      codplay.destroy()
    }
  })

  it('passes the changing camera state through the runtime render commit', async () => {
    const renderedCameraPositions: number[][] = []
    class TestWebGLRenderer {
      readonly domElement: HTMLCanvasElement

      constructor(options: Readonly<{ canvas: HTMLCanvasElement }>) {
        this.domElement = options.canvas
      }

      setPixelRatio(_value: number): void {}

      setSize(width: number, height: number): void {
        this.domElement.width = width
        this.domElement.height = height
      }

      render(_scene: Three.Scene, camera: Three.Camera): void {
        renderedCameraPositions.push(camera.position.toArray())
      }

      dispose(): void {}
    }

    const testLibrary: RuntimeLibraryDefinition = {
      id: 'three',
      origin: 'foreign',
      load: () => ({ ...Three, WebGLRenderer: TestWebGLRenderer }),
    }
    const codplay = new CodPlay({
      engine: {
        ...THREEJS_CORE_ENGINE,
        libraries: { register: [testLibrary] },
        components: {
          register: [
            ...(THREEJS_CORE_ENGINE.components?.register ?? []),
            THREE_INSTANCED_GRID_DEFINITION,
          ],
        },
        idle: false,
      },
      pauseOnDocumentHidden: false,
    })
    const root = document.createElement('main')
    document.body.append(root)

    try {
      const build = codplay.build({ scene: createScene() })
      expect(build.ok).toBe(true)
      if (!build.ok) return
      await codplay.engine.prepareScene(build.compiledScene)
      const instance = codplay.instances.create({
        instanceId: 'threejs-grid-demo-render-test',
        compiledScene: build.compiledScene,
        functions: build.functions,
        root,
      })

      codplay.engine.advance(0)
      await instance.telco.play()
      codplay.engine.advance(3_500)
      expect(renderedCameraPositions.at(-1)).toEqual([0, 0, 8.5])
      codplay.engine.advance(7_000)

      expect(renderedCameraPositions[0]).toEqual([0, 0, 6])
      expect(renderedCameraPositions.at(-1)).toEqual([0, 0, 6])
    } finally {
      codplay.destroy()
      document.body.replaceChildren()
    }
  })
})
