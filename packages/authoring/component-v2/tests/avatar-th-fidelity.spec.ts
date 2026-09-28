import { describe, expect, it } from 'vitest'
import { BufferGeometry, Float32BufferAttribute, Object3D } from 'three'
import { MorphEngine } from '../src/avatar/morph/morph-engine'
import { addMixedMorphTarget } from '../src/avatar/model/model-loader'
import { GESTURE_TEMPLATES } from '../src/avatar/gesture/gesture-definitions'

describe('TalkingHead morph fidelity', () => {
  it('uses the native acceleration classes for eyelids, eyes and ordinary morphs', () => {
    const engine = new MorphEngine()
    engine.registerBoneMorphs(() => undefined)
    engine.registerBlendMorph('eyeBlinkLeft', { influences: [0], index: 0 })
    engine.registerBlendMorph('eyeLookUpLeft', { influences: [0], index: 0 })
    engine.registerBlendMorph('viseme_aa', { influences: [0], index: 0 })
    engine.registerBlendMorph('headRotateX', { influences: [0], index: 0 })

    expect(engine.morphs.get('eyeBlinkLeft')?.acc).toBeCloseTo(0.1 / 1000)
    expect(engine.morphs.get('eyeLookUpLeft')?.acc).toBeCloseTo(0.1 / 1000)
    expect(engine.morphs.get('viseme_aa')?.acc).toBeCloseTo(0.01 / 1000)
    expect(engine.morphs.get('headRotateX')?.acc).toBeCloseTo(0.01 / 1000)
  })

  it('builds mixed morphs from prefixed source names', () => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute([
      0, 0, 0,
      0, 0, 0,
    ], 3))
    geometry.morphAttributes.position = [
      new Float32BufferAttribute([
        1, 0, 0,
        0, 1, 0,
      ], 3),
      new Float32BufferAttribute([
        0, 0, 1,
        1, 1, 0,
      ], 3),
    ]
    const mesh = Object.assign(new Object3D(), {
      geometry,
      morphTargetDictionary: {
        Wolf3D_Head_jawOpen: 0,
        Wolf3D_Head_mouthSmileLeft: 1,
      },
      morphTargetInfluences: [0, 0],
    }) as Parameters<typeof addMixedMorphTarget>[0]

    const index = addMixedMorphTarget(
      mesh,
      'mouthOpen',
      { jawOpen: 0.5 },
      'Wolf3D_Head_',
    )

    expect(index).toBe(2)
    expect((mesh.morphTargetDictionary as Record<string, number>).mouthOpen).toBe(2)
    expect(mesh.morphTargetInfluences).toHaveLength(3)
    expect(geometry.morphAttributes.position?.[2]?.getX(0)).toBeCloseTo(0.5)
  })

  it('keeps the authored eyelid baseline available to the native eyelid limiter', () => {
    const influence = [0]
    const engine = new MorphEngine({ eyeBlinkLeft: 0.2 })
    engine.registerBlendMorph('eyeBlinkLeft', { influences: influence, index: 0 })
    engine.registerBlendMorph('eyeLookDownLeft', { influences: [0], index: 0 })
    engine.registerBlendMorph('eyeLookDownRight', { influences: [0], index: 0 })
    engine.registerBlendMorph('browDownLeft', { influences: [0], index: 0 })

    engine.snapSystem('eyesLookDown', 1)
    engine.snapFixed('eyeBlinkLeft', 0)

    expect(influence[0]).toBeCloseTo(0.1)
  })

  it('eases fixed head targets during playback and reapplies the eased value', () => {
    const values: number[] = []
    const engine = new MorphEngine()
    engine.registerBoneMorphs((name, value) => {
      if (name === 'headRotateX') values.push(value)
    })

    engine.setFixed('headRotateX', 0.5)
    engine.update(16)
    const eased = values.at(-1) ?? 0
    engine.reapplyFixed()

    expect(eased).toBeGreaterThan(0)
    expect(eased).toBeLessThan(0.5)
    expect(values.at(-1)).toBe(eased)

    engine.snapAll()
    expect(values.at(-1)).toBe(0.5)
  })

  it('keeps a released head gesture easing while the mood samples a new ambient value', () => {
    const engine = new MorphEngine()
    engine.registerBoneMorphs(() => undefined)
    engine.snapAmbient('headRotateX', -0.1)
    engine.setFixed('headRotateX', 0.5)
    engine.update(200)
    const gestureValue = engine.getValue('headRotateX')

    engine.setFixed('headRotateX', null)
    engine.update(16)
    const releaseValue = engine.getValue('headRotateX')
    engine.snapAmbient('headRotateX', -0.08)
    const nextAmbientValue = engine.getValue('headRotateX')

    expect(gestureValue).toBeGreaterThan(0)
    expect(Math.abs(releaseValue - gestureValue)).toBeLessThan(0.05)
    expect(nextAmbientValue).toBeCloseTo(releaseValue)
    engine.update(16)
    expect(engine.getValue('headRotateX')).toBeLessThan(releaseValue)
  })

  it('keeps a released body gesture easing when an unchanged system constraint is sampled', () => {
    const engine = new MorphEngine()
    engine.registerBoneMorphs(() => undefined)
    engine.snapAmbient('bodyRotateX', 0.03)
    engine.setFixed('bodyRotateX', 0.25)
    engine.update(1_000)

    engine.setFixed('bodyRotateX', null)
    engine.update(16)
    const releaseValue = engine.getValue('bodyRotateX')
    engine.snapSystem('bodyRotateX', null)

    expect(releaseValue).toBeGreaterThan(0.05)
    expect(engine.getValue('bodyRotateX')).toBeCloseTo(releaseValue)
    engine.update(16)
    expect(engine.getValue('bodyRotateX')).toBeLessThan(releaseValue)
    engine.snapSystem('bodyRotateX', 0.1)
    expect(engine.getValue('bodyRotateX')).toBe(0.1)
  })

  it('snaps a sampled mood baseline while preserving a fixed morph owner', () => {
    const influence = [0]
    const engine = new MorphEngine()
    engine.registerBlendMorph('mouthSmileLeft', { influences: influence, index: 0 })

    engine.snapFixed('mouthSmileLeft', 0.5)
    engine.snapBaseline('mouthSmileLeft', 0.2)
    expect(influence[0]).toBe(0.5)
    expect(engine.getBaseline('mouthSmileLeft')).toBe(0.2)

    engine.snapFixed('mouthSmileLeft', null)
    expect(influence[0]).toBe(0.2)

    engine.snapSystem('mouthSmileLeft', 0.7)
    engine.snapBaseline('mouthSmileLeft', 0.3)
    expect(influence[0]).toBe(0.7)
    engine.snapSystem('mouthSmileLeft', null)
    expect(influence[0]).toBe(0.3)
  })

  it('keeps the complete native shrug head variation', () => {
    expect(GESTURE_TEMPLATES.shrug['Neck.rotation']?.x).toEqual([-0.3, 0.3, 1, 2])
    expect(GESTURE_TEMPLATES.shrug['Neck.rotation']?.y).toEqual([-0.3, 0.3, 1, 2])
    expect(GESTURE_TEMPLATES.shrug['Head.rotation']?.x).toEqual([-0.3, 0.3])
  })
})
