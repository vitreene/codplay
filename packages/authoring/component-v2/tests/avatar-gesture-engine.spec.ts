import { describe, expect, it } from 'vitest'
import { Object3D } from 'three'
import { GestureEngine } from '../src/avatar/gesture/gesture-engine'

describe('Avatar gesture engine', () => {
  it('eases toward the selected body pose', () => {
    const hips = new Object3D()
    hips.name = 'Hips'
    const engine = new GestureEngine(new Map([[hips.name, hips]]))

    expect(engine.setBodyPose('neutral')).toBe(true)
    engine.update(100)

    expect(hips.rotation.x).toBeGreaterThan(0)
    expect(hips.rotation.x).toBeLessThan(0.025)
  })
})
