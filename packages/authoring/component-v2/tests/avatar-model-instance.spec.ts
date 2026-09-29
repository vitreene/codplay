import { describe, expect, it } from 'vitest'
import {
  Bone,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  MeshBasicMaterial,
  Skeleton,
  SkinnedMesh,
  Uint16BufferAttribute,
} from 'three'
import { cloneModelScene } from '../src/avatar/model/clone-model-scene'
import { buildModelInstance } from '../src/avatar/model/model-loader'
import { MorphEngine } from '../src/avatar/morph/morph-engine'

/** Builds one small skinned model shared by the tests, without demo assets. */
function createSourceModel(): Group {
  const source = new Group()
  const head = new Bone()
  head.name = 'Head'
  source.add(head)
  const skeleton = new Skeleton([head], [new Matrix4()])
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([0, 0, 0], 3))
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute([0, 0, 0, 0], 4))
  geometry.setAttribute('skinWeight', new Float32BufferAttribute([1, 0, 0, 0], 4))
  const smile = new Float32BufferAttribute([0.1, 0, 0], 3)
  smile.name = 'mouthSmileLeft'
  geometry.morphAttributes.position = [smile]
  const material = new MeshBasicMaterial()

  for (const name of ['Face', 'Teeth']) {
    const mesh = new SkinnedMesh(geometry, material)
    mesh.name = name
    mesh.bind(skeleton)
    source.add(mesh)
  }
  return source
}

describe('Avatar model instantiation', () => {
  it('preserves a shared skeleton within each clone and isolates instances', () => {
    const source = createSourceModel()
    const first = cloneModelScene(source)
    const second = cloneModelScene(source)
    const sourceFace = source.getObjectByName('Face') as SkinnedMesh
    const firstFace = first.getObjectByName('Face') as SkinnedMesh
    const firstTeeth = first.getObjectByName('Teeth') as SkinnedMesh
    const secondFace = second.getObjectByName('Face') as SkinnedMesh

    expect(firstFace.skeleton).toBe(firstTeeth.skeleton)
    expect(firstFace.skeleton).not.toBe(sourceFace.skeleton)
    expect(firstFace.skeleton).not.toBe(secondFace.skeleton)
    expect(firstFace.skeleton.bones[0]).toBe(first.getObjectByName('Head'))
    expect(secondFace.skeleton.bones[0]).toBe(second.getObjectByName('Head'))
    expect(firstFace.geometry).not.toBe(firstTeeth.geometry)
    expect(firstFace.geometry).not.toBe(sourceFace.geometry)
    expect(firstFace.geometry).not.toBe(secondFace.geometry)
    expect(firstFace.material).not.toBe(sourceFace.material)
    expect(firstFace.material).not.toBe(secondFace.material)

    firstFace.skeleton.bones[0]!.rotation.x = 0.4
    firstFace.morphTargetInfluences![0] = 0.8
    expect(secondFace.skeleton.bones[0]!.rotation.x).toBeCloseTo(0)
    expect(secondFace.morphTargetInfluences![0]).toBe(0)
    expect(sourceFace.morphTargetInfluences![0]).toBe(0)
  })

  it('adds TalkingHead mixed morphs only to a private model instance', () => {
    const source = createSourceModel()
    const prepared = { format: 'glb' as const, scene: source, animations: [] }
    const first = buildModelInstance(prepared, new MorphEngine())
    const second = buildModelInstance(prepared, new MorphEngine())
    const sourceFace = source.getObjectByName('Face') as SkinnedMesh
    const firstFace = first.scene.getObjectByName('Face') as SkinnedMesh
    const firstTeeth = first.scene.getObjectByName('Teeth') as SkinnedMesh
    const secondFace = second.scene.getObjectByName('Face') as SkinnedMesh

    expect(first.boneMap.get('Head')).toBe(first.scene.getObjectByName('Head'))
    expect(firstFace.morphTargetDictionary).toHaveProperty('mouthSmileLeft')
    expect(firstFace.morphTargetDictionary).toHaveProperty('mouthSmile')
    expect(firstTeeth.morphTargetDictionary).toHaveProperty('mouthSmile')
    expect(firstFace.geometry).not.toBe(firstTeeth.geometry)
    expect(firstFace.geometry).not.toBe(sourceFace.geometry)
    expect(secondFace.geometry).not.toBe(firstFace.geometry)
    expect(sourceFace.geometry.morphAttributes.position).toHaveLength(1)
  })
})
