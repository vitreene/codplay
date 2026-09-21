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
  it('applies values relative to the captured rest pose', () => {
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

    const applyBoneMorph = createBoneMorphBinding(bones)
    applyBoneMorph('headRotateX', 0.5)
    applyBoneMorph('bodyRotateY', 0.4)

    expect(head.rotation.x).toBeCloseTo(0.7)
    expect(neck.rotation.x).toBeCloseTo(-0.15)
    expect(head.rotation.y).toBeCloseTo(0.3)
    expect(spine1.rotation.y).toBeCloseTo(0.2)
    expect(spine.rotation.y).toBeCloseTo(0.3)
    expect(hips.rotation.y).toBeCloseTo(0.1)

    applyBoneMorph('chestInhale', 1)
    expect(spine1.scale.x).toBeCloseTo(2.04)
    expect(spine1.scale.y).toBeCloseTo(3)
    expect(spine1.scale.z).toBeCloseTo(4.08)
  })

  it('ignores bone morphs that the loaded model does not provide', () => {
    const applyBoneMorph = createBoneMorphBinding(new Map())

    expect(() => applyBoneMorph('handFistLeft', 1)).not.toThrow()
    expect(() => applyBoneMorph('chestInhale', 1)).not.toThrow()
  })
})
