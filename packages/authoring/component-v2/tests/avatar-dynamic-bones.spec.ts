import { describe, expect, it } from 'vitest'
import { Bone, Group } from 'three'
import { AvatarDynamicBones } from '../src/avatar/model/dynamic-bones'

describe('Avatar DynamicBones adaptation', () => {
  it('returns a point displacement after the parent moves', () => {
    const { root, parent, bone } = createChain()
    const dynamic = new AvatarDynamicBones(root, new Map([
      ['Cloth', bone],
    ]), [{
      bone: 'Cloth',
      type: 'point',
      stiffness: 1,
      damping: 0,
    }])

    dynamic.update(16)
    parent.position.x = 1
    dynamic.update(16)

    const delta = dynamic.getDelta().get(bone)
    expect(delta?.position).toBeDefined()
    expect(Math.abs(delta?.position?.x ?? 0)).toBeGreaterThan(0)

    dynamic.reset()
    expect(dynamic.getDelta().size).toBe(0)
  })

  it('returns an additive rotation on the parent for a link bone', () => {
    const { root, parent, bone } = createChain()
    const dynamic = new AvatarDynamicBones(root, new Map([
      ['Cloth', bone],
    ]), [{
      bone: 'Cloth',
      type: 'link',
      stiffness: 1,
      damping: 0,
      limits: [[-0.2, 0.2], null, [-0.2, 0.2], null],
    }])

    dynamic.update(16)
    parent.position.z = 1
    dynamic.update(16)

    const delta = dynamic.getDelta().get(parent)
    expect(delta?.rotation).toBeDefined()
    expect(Math.abs(delta?.rotation?.x ?? 0) + Math.abs(delta?.rotation?.z ?? 0)).toBeGreaterThan(0)
  })
})

/** Builds a self-contained parent/child bone chain. */
function createChain(): { root: Group; parent: Bone; bone: Bone } {
  const root = new Group()
  const parent = new Bone()
  parent.name = 'Parent'
  const bone = new Bone()
  bone.name = 'Cloth'
  bone.position.y = 1
  parent.add(bone)
  root.add(parent)
  root.updateMatrixWorld(true)
  return { root, parent, bone }
}
