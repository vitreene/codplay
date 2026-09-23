import { describe, expect, it } from 'vitest'
import { Object3D } from 'three'
import { createBoneMorphBinding } from '../src/avatar/morph/bone-morph-binding'

function createBone(name: string, rotation = { x: 0, y: 0, z: 0 }): Object3D {
  const bone = new Object3D()
  bone.name = name
  bone.rotation.set(rotation.x, rotation.y, rotation.z)
  return bone
}

describe('Avatar bone morph binding', () => {
  it('contributes values without writing the captured bones directly', () => {
    const head = createBone('Head', { x: 0.2, y: -0.1, z: 0.05 })
    const neck = createBone('Neck', { x: -0.3, y: 0.4, z: 0 })
    const spine = createBone('Spine', { x: 0, y: 0.1, z: -0.2 })
    const spine1 = createBone('Spine1', { x: 0.1, y: 0, z: 0.2 })
    spine1.scale.set(2, 3, 4)
    const hips = createBone('Hips', { x: -0.1, y: 0, z: 0 })
    const bones = new Map([
      [head.name, head],
      [neck.name, neck],
      [spine.name, spine],
      [spine1.name, spine1],
      [hips.name, hips],
    ])

    const binding = createBoneMorphBinding(bones)
    binding('headRotateX', 0.5)
    binding('bodyRotateY', 0.4)
    binding('chestInhale', 1)
    const delta = binding.getDelta()

    expect(delta.get(head)?.rotation).toMatchObject({ x: 0.5, y: 0.4 })
    expect(delta.get(neck)?.rotation).toBeUndefined()
    expect(delta.get(spine1)?.rotation).toMatchObject({ y: 0.2 })
    expect(delta.get(spine)?.rotation).toMatchObject({ y: 0.2 })
    expect(delta.get(hips)?.rotation).toMatchObject({ y: 0.1 })
    expect(delta.get(spine1)?.scale).toEqual({ x: 1.05, y: 1.025, z: 1.15 })
    expect(delta.get(neck)?.scale).toEqual({
      x: 1 / 1.05,
      y: 1 / 1.025,
      z: 1 / 1.15,
    })
    expect(head.rotation.x).toBeCloseTo(0.2)
    expect(spine1.scale.x).toBeCloseTo(2)
  })

  it('ignores bone morphs that the loaded model does not provide', () => {
    const binding = createBoneMorphBinding(new Map())

    expect(() => binding('handFistLeft', 1)).not.toThrow()
    expect(() => binding('chestInhale', 1)).not.toThrow()
    expect(binding.getDelta()).toEqual(new Map())
  })
})
