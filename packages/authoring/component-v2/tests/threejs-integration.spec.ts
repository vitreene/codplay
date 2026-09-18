import { InstancedMesh, Matrix4, Scene } from 'three'
import { describe, expect, it } from 'vitest'
import type { ComponentAnimation, ComponentServices, ComponentUpdateInput } from 'codplay'
import { createThreejsIntegration } from '../src'

/** Supplies the empty service facade used by substrate-only test components. */
function emptyServices(): ComponentServices {
  return {
    declare: () => undefined,
    get: () => { throw new Error('No service is declared in this test.') },
    apply: () => undefined,
  }
}

describe('Three.js V2 integration', () => {
  it('exposes one engine library and four related component definitions', () => {
    const integration = createThreejsIntegration()

    expect(integration.library.id).toBe('three')
    expect(integration.components.map((definition) => definition.type)).toEqual([
      'three-scene-host',
      'three-camera',
      'three-light',
      'three-instanced-grid',
    ])
    expect(integration.components.every((definition) => definition.libraries?.includes('three'))).toBe(true)
    expect(integration.engine.libraries?.register).toEqual([integration.library])
  })

  it('does not create native geometry before engine library preparation', async () => {
    const integration = createThreejsIntegration()
    const definition = integration.components.find((candidate) => candidate.type === 'three-instanced-grid')!
    const component = new definition.component({
      services: emptyServices(),
      perso: { id: 'grid', storyId: 'main', initial: { gridSize: 2 } },
    } as never)
    const target = createTarget()
    const input = createGridUpdate(target, [])

    expect(() => component.update(input)).toThrow('Three.js has not been prepared')
    await integration.library.load()
    component.update(input)
    expect(target.scene.children).toHaveLength(1)
    expect(target.scene.children[0]).toBeInstanceOf(InstancedMesh)
    component.destroy()
    expect(target.scene.children).toHaveLength(0)
    integration.library.release?.()
  })

  it('registers a reconstructible pulse from CodPlay absolute time', async () => {
    const integration = createThreejsIntegration()
    const definition = integration.components.find((candidate) => candidate.type === 'three-instanced-grid')!
    const component = new definition.component({
      services: emptyServices(),
      perso: { id: 'grid', storyId: 'main', initial: { gridSize: 2 } },
    } as never)
    await integration.library.load()
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
    integration.library.release?.()
  })
})

/** Builds the opaque scene target consumed by the feature component. */
function createTarget(): {
  scene: Scene
  renderer: never
  setCamera: () => void
  resize: () => void
  render: () => void
} {
  return {
    scene: new Scene(),
    renderer: {} as never,
    setCamera: () => undefined,
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
