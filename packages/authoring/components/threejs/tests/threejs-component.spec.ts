import 'animejs/adapters/three'

import { getInstances } from 'animejs/adapters/three'
import { BoxGeometry, InstancedMesh, Mesh, MeshLambertMaterial, PointLight } from 'three'
import { describe, expect, it } from 'vitest'
import { normalizeThreejsSetDescriptors } from '../src/threejs-animation-utils.js'
import { applyThreejsValues } from '../src/threejs-value-applier.js'

describe('normalizeThreejsSetDescriptors', () => {
  it('keeps only well-formed ref/value descriptors', () => {
    expect(normalizeThreejsSetDescriptors([
      { ref: 'mesh', values: { rotateY: 120 } },
      { ref: '', values: { rotateX: 12 } },
      { ref: 'light', values: null as unknown as Record<string, unknown> },
    ])).toEqual([
      { ref: 'mesh', values: { rotateY: 120 } },
    ])
  })
})

describe('applyThreejsValues', () => {
  it('applies direct scalar values on Three.js targets', () => {
    const pointLight = new PointLight(0xffffff, 8, 20, 0.4)
    applyThreejsValues(pointLight, { intensity: 12 })
    expect(pointLight.intensity).toBe(12)
  })

  it('maps rotate and scale shorthands to Three.js transform channels', () => {
    const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshLambertMaterial())
    applyThreejsValues(mesh, {
      rotateY: 90,
      scale: 2,
      x: 4,
    })

    expect(mesh.rotation.y).toBeCloseTo(Math.PI / 2, 6)
    expect(mesh.scale.x).toBe(2)
    expect(mesh.scale.y).toBe(2)
    expect(mesh.scale.z).toBe(2)
    expect(mesh.position.x).toBe(4)
  })

  it('applies per-index function values on instanced mesh proxies', () => {
    const mesh = new InstancedMesh(
      new BoxGeometry(1, 1, 1),
      new MeshLambertMaterial(),
      4,
    )
    const instances = getInstances(mesh)
    applyThreejsValues(instances, {
      x: (_target: unknown, index: number) => index * 10,
      y: (_target: unknown, index: number) => index * -5,
    })

    expect(instances[0].x).toBe(0)
    expect(instances[1].x).toBe(10)
    expect(instances[2].y).toBe(-10)
    expect(instances[3].y).toBe(-15)
  })
})
