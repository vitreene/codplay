import { InstancedMesh, Matrix4, Scene, type Camera } from 'three'
import { describe, expect, it } from 'vitest'
import type { ComponentAnimation, ComponentServices, ComponentUpdateInput } from 'codplay'
import type { CompiledScene } from 'codplay/scene/compiled'
import { RuntimeCapabilityCatalog } from 'codplay/runtime/catalog'
import { RuntimeEngine } from 'codplay/runtime/engine'
import {
  THREE_CAMERA_DEFINITION,
  THREE_INSTANCED_GRID_DEFINITION,
  THREE_LIGHT_DEFINITION,
  THREEJS_CORE_COMPONENTS,
  THREEJS_CORE_ENGINE,
  THREE_LIBRARY,
} from '../src'

/** Supplies the empty service facade used by substrate-only test components. */
function emptyServices(): ComponentServices {
  return {
    declare: () => undefined,
    get: () => { throw new Error('No service is declared in this test.') },
    apply: () => undefined,
  }
}

describe('Three.js V2 integration', () => {
  it('declares generic core components separately from the specialized grid', () => {
    expect(THREE_LIBRARY.id).toBe('three')
    expect(THREEJS_CORE_COMPONENTS.map((definition) => definition.type)).toEqual([
      'three-scene-host',
      'three-camera',
      'three-light',
    ])
    expect(THREE_INSTANCED_GRID_DEFINITION.type).toBe('three-instanced-grid')
    expect(THREEJS_CORE_ENGINE.libraries?.register).toEqual([THREE_LIBRARY])
    expect(THREEJS_CORE_COMPONENTS.every((definition) => definition.libraries?.includes('three'))).toBe(true)
  })

  it('uses the engine-injected runtime when creating native geometry', async () => {
    const engine = await createPreparedEngine()
    const component = new THREE_INSTANCED_GRID_DEFINITION.component({
      services: emptyServices(),
      runtime: engine.getComponentRuntimeContext(),
      perso: { id: 'grid', storyId: 'main', initial: { gridSize: 2 } },
    } as never)
    const target = createTarget()
    const input = createGridUpdate(target, [])

    try {
      component.update(input)
      expect(target.scene.children).toHaveLength(1)
      expect(target.scene.children[0]).toBeInstanceOf(InstancedMesh)
      component.destroy()
      expect(target.scene.children).toHaveLength(0)
    } finally {
      engine.destroy()
    }
  })

  it('registers a reconstructible pulse from CodPlay absolute time', async () => {
    const engine = await createPreparedEngine()
    const component = new THREE_INSTANCED_GRID_DEFINITION.component({
      services: emptyServices(),
      runtime: engine.getComponentRuntimeContext(),
      perso: { id: 'grid', storyId: 'main', initial: { gridSize: 2 } },
    } as never)
    try {
      const target = createTarget()
      const animations: ComponentAnimation[] = []
      component.update(createGridUpdate(target, animations))
      expect(animations).toHaveLength(1)
      const first = animations[0]!.sample(0)
      const later = animations[0]!.sample(1_000)
      expect(first?.value).toBe(0)
      expect(later?.value).toBe(1_000)
      const mesh = target.scene.children[0] as InstancedMesh
      first?.apply()
      const firstRotationY = mesh.rotation.y
      const firstMatrix = new Matrix4()
      mesh.getMatrixAt(0, firstMatrix)
      later?.apply()
      const laterRotationY = mesh.rotation.y
      const laterMatrix = new Matrix4()
      mesh.getMatrixAt(0, laterMatrix)
      expect(laterRotationY).not.toBe(firstRotationY)
      expect(laterMatrix.elements).not.toEqual(firstMatrix.elements)

      later?.apply()
      const repeatedLaterMatrix = new Matrix4()
      mesh.getMatrixAt(0, repeatedLaterMatrix)
      expect(repeatedLaterMatrix.elements).toEqual(laterMatrix.elements)
      component.destroy()
    } finally {
      engine.destroy()
    }
  })

  it('applies camera position and light position/color updates', async () => {
    const engine = await createPreparedEngine()
    const cameraState: { current: Camera | null } = { current: null }
    const target = createTarget((camera) => {
      cameraState.current = camera
    })
    const cameraComponent = new THREE_CAMERA_DEFINITION.component({
      services: emptyServices(),
      runtime: engine.getComponentRuntimeContext(),
      perso: { id: 'camera', storyId: 'main', initial: { kind: 'perspective' } },
    } as never)
    const lightComponent = new THREE_LIGHT_DEFINITION.component({
      services: emptyServices(),
      runtime: engine.getComponentRuntimeContext(),
      perso: { id: 'light', storyId: 'main', initial: { kind: 'point' } },
    } as never)

    try {
      cameraComponent.update({
        state: { kind: 'perspective', position: [0, 0, 6], lookAt: [0, 0, 0] },
        timeMs: 0,
        target,
        activeActions: [],
      } as never)
      const initialCamera = cameraState.current
      if (initialCamera === null) throw new Error('The camera component did not publish a camera.')
      expect(initialCamera.position.toArray()).toEqual([0, 0, 6])
      expect(target.getCamera()).toBe(initialCamera)

      cameraComponent.update({
        state: { kind: 'perspective', position: [2, -1, 4], lookAt: [0, 0, 0] },
        timeMs: 4_000,
        target,
        activeActions: [],
      } as never)
      const updatedCamera = cameraState.current
      if (updatedCamera === null) throw new Error('The camera component removed its camera.')
      expect(updatedCamera.position.toArray()).toEqual([2, -1, 4])
      expect(target.getCamera()).toBe(updatedCamera)

      lightComponent.update({
        state: { kind: 'point', color: '#ff0000', position: [1, 2, 3], intensity: 2 },
        timeMs: 0,
        target,
        activeActions: [],
      } as never)
      const pointLight = target.scene.children[0] as unknown as {
        position: { toArray: () => number[] }
        color: { getHex: () => number }
      }
      expect(pointLight.position.toArray()).toEqual([1, 2, 3])
      expect(pointLight.color.getHex()).toBe(0xff0000)

      lightComponent.update({
        state: { kind: 'point', color: '#00ff00', position: [4, 5, 6], intensity: 2 },
        timeMs: 4_000,
        target,
        activeActions: [],
      } as never)
      expect(pointLight.position.toArray()).toEqual([4, 5, 6])
      expect(pointLight.color.getHex()).toBe(0x00ff00)
    } finally {
      cameraComponent.destroy()
      lightComponent.destroy()
      expect(target.getCamera()).toBeNull()
      engine.destroy()
    }
  })

})

/** Prepares Three.js through the same engine boundary used by a player. */
async function createPreparedEngine(): Promise<RuntimeEngine> {
  const catalog = new RuntimeCapabilityCatalog()
  catalog.registerLibrary(THREE_LIBRARY)
  const engine = new RuntimeEngine(catalog)
  const scene = {
    requirements: {
      components: [],
      services: [],
      modules: [],
      resources: [],
      libraries: ['three'],
    },
  } as unknown as CompiledScene
  await engine.prepareScene(scene)
  return engine
}

/** Builds the opaque scene target consumed by the feature component. */
function createTarget(setCamera: (camera: Camera | null) => void = () => undefined): {
	scene: Scene
	renderer: never
	getCamera: () => Camera | null
	setCamera: (camera: Camera | null) => void
	resize: () => void
	render: () => void
} {
	let currentCamera: Camera | null = null
	return {
		scene: new Scene(),
		renderer: {} as never,
		getCamera: () => currentCamera,
		setCamera: (camera) => {
			currentCamera = camera
			setCamera(camera)
		},
		resize: () => undefined,
		render: () => undefined,
	}
}

/** Builds one grid update with an active animation occurrence. */
function createGridUpdate(
  target: ReturnType<typeof createTarget>,
  animations: ComponentAnimation[],
): ComponentUpdateInput<Record<string, unknown>> {
  return {
    state: { gridSize: 2, animate: true },
    timeMs: 0,
    target,
    activeActions: [{
      name: 'start',
      startAt: 0,
      elapsedMs: 0,
      action: { animate: true },
    }],
    registerAnimation: (animation) => animations.push(animation),
  }
}
