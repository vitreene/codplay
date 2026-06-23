import { describe, expect, it } from 'vitest'
import { createAvatarEngine } from '../src/avatar-engine'

/**
 * Registers bone + blend morphs manually with synthetic targets — no GLB load,
 * no real Three.js Object3D needed, since registerBoneMorphs/registerBlendMorph
 * only need a callback and plain influence arrays respectively.
 */
function setupEngine() {
  const engine = createAvatarEngine()
  const boneValues: Record<string, number> = {}
  engine.morphEngine.registerBoneMorphs((name, value) => {
    boneValues[name] = value
  })
  const leftInfluences = [0]
  const rightInfluences = [0]
  engine.morphEngine.registerBlendMorph('eyeBlinkLeft', { influences: leftInfluences, index: 0 })
  engine.morphEngine.registerBlendMorph('eyeBlinkRight', { influences: rightInfluences, index: 0 })
  return { engine, boneValues, leftInfluences, rightInfluences }
}

describe('AvatarEngine.commitSeek(timelineMs) — resyncs idle animation fns to the seek target', () => {
  it('evaluates the headDrift fn at the seek target, not at 0', () => {
    const { engine, boneValues } = setupEngine()
    const elapsedSeen: number[] = []
    engine.setHeadDriftFn(({ elapsed }) => {
      elapsedSeen.push(elapsed)
      return { headRotateX: elapsed / 10000 } // kept within the engine's [-1, 1] clamp range
    })

    engine.commitSeek(2500)

    expect(elapsedSeen).toContain(2500)
    expect(boneValues.headRotateX).toBeCloseTo(0.25, 5)
  })

  it('evaluates the blink fn at the seek target and applies eyesClosed via the alias', () => {
    const { engine, leftInfluences, rightInfluences } = setupEngine()
    engine.setBlinkScheduleFn(({ elapsed }) => ({ eyesClosed: elapsed === 1200 ? 0.6 : 0 }))

    engine.commitSeek(1200)

    expect(leftInfluences[0]).toBeCloseTo(0.6, 5)
    expect(rightInfluences[0]).toBeCloseTo(0.6, 5)
  })

  it('does not fire the breath trigger fn during the seek itself', () => {
    const { engine } = setupEngine()
    let calledDuringSeek = false
    engine.setBreathTriggerFn(() => {
      calledDuringSeek = true
      return { triggerBreath: true }
    })

    engine.commitSeek(8000)

    expect(calledDuringSeek).toBe(false)
  })

  it('resyncs the breath elapsed counter so the next animate() tick continues from the seek target', () => {
    const { engine } = setupEngine()
    const elapsedSeen: number[] = []
    engine.setBreathTriggerFn(({ elapsed }) => {
      elapsedSeen.push(elapsed)
      return null
    })

    engine.commitSeek(8000)
    engine.animate(16)

    expect(elapsedSeen).toContain(8016)
  })

  it('does nothing and does not throw when no idle fn was registered', () => {
    const { engine } = setupEngine()
    expect(() => engine.commitSeek(4000)).not.toThrow()
  })
})
