import { describe, expect, it } from 'vitest'
import { Object3D, PerspectiveCamera } from 'three'
import { createAvatarEngine } from '../src/avatar-engine'
import { GestureEngine } from '../src/gesture-engine'
import { GazeService } from '../src/gaze-service'

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

describe('GazeService', () => {
  it('compensates eye look in head-local space when the head is rotated', () => {
    const { engine } = setupEngine()
    const eyeLookOutLeft = [0]
    const eyeLookInRight = [0]
    engine.morphEngine.registerBlendMorph('eyeLookOutLeft', { influences: eyeLookOutLeft, index: 0 })
    engine.morphEngine.registerBlendMorph('eyeLookInRight', { influences: eyeLookInRight, index: 0 })
    engine.morphEngine.registerBlendMorph('eyeLookInLeft', { influences: [0], index: 0 })
    engine.morphEngine.registerBlendMorph('eyeLookOutRight', { influences: [0], index: 0 })
    engine.morphEngine.registerBlendMorph('eyeLookUpLeft', { influences: [0], index: 0 })
    engine.morphEngine.registerBlendMorph('eyeLookUpRight', { influences: [0], index: 0 })
    engine.morphEngine.registerBlendMorph('eyeLookDownLeft', { influences: [0], index: 0 })
    engine.morphEngine.registerBlendMorph('eyeLookDownRight', { influences: [0], index: 0 })

    const head = new Object3D()
    const leftEye = new Object3D()
    const rightEye = new Object3D()
    leftEye.position.set(-0.03, 0, 0)
    rightEye.position.set(0.03, 0, 0)
    head.add(leftEye, rightEye)
    head.rotation.y = 0.5
    const camera = new PerspectiveCamera()
    camera.position.set(0, 0, 2)

    const gaze = new GazeService(engine.morphEngine, leftEye, rightEye, head, camera)
    gaze.setEnabled(true)
    gaze.computeAndApply()

    expect(Math.abs(head.rotation.y)).toBeLessThan(0.3)
    expect(eyeLookOutLeft[0] + eyeLookInRight[0]).toBeGreaterThanOrEqual(0)
  })

  it('distributes user attention across neck and head instead of forcing only the head bone', () => {
    const { engine } = setupEngine()
    for (const name of [
      'eyeLookOutLeft', 'eyeLookInRight', 'eyeLookInLeft', 'eyeLookOutRight',
      'eyeLookUpLeft', 'eyeLookUpRight', 'eyeLookDownLeft', 'eyeLookDownRight',
    ]) {
      engine.morphEngine.registerBlendMorph(name, { influences: [0], index: 0 })
    }

    const neck = new Object3D()
    neck.name = 'Neck'
    const neck1 = new Object3D()
    neck1.name = 'Neck1'
    const neck2 = new Object3D()
    neck2.name = 'Neck2'
    const head = new Object3D()
    head.name = 'Head'
    const leftEye = new Object3D()
    const rightEye = new Object3D()
    leftEye.position.set(-0.03, 0, 0)
    rightEye.position.set(0.03, 0, 0)
    neck.add(neck1)
    neck1.add(neck2)
    neck2.add(head)
    head.add(leftEye, rightEye)
    head.rotation.y = 0.5
    const camera = new PerspectiveCamera()
    camera.position.set(0, 0, 2)

    const gaze = new GazeService(engine.morphEngine, leftEye, rightEye, head, camera, [neck, neck1, neck2])
    gaze.setEnabled(true)
    gaze.computeAndApply()

    expect(neck.rotation.y).not.toBe(0)
    expect(neck1.rotation.y).not.toBe(0)
    expect(neck2.rotation.y).not.toBe(0)
    expect(Math.abs(head.rotation.y)).toBeLessThan(0.4)
  })
})

describe('GestureEngine body poses', () => {
  it('releases gestures back to the active TH body pose instead of model rest', () => {
    const leftShoulder = new Object3D()
    leftShoulder.name = 'LeftShoulder'
    const engine = new GestureEngine(new Map([['LeftShoulder', leftShoulder]]))

    expect(engine.setBodyPose('side')).toBe(true)
    engine.snapToBodyPose()
    expect(leftShoulder.rotation.z).toBeCloseTo(-1.77, 5)

    engine.applyGesture('thumbup', { random: () => 0.5 })
    engine.snapToTargets()
    expect(leftShoulder.rotation.z).not.toBeCloseTo(-1.77, 5)

    engine.resetPose()
    engine.snapToBodyPose()
    expect(leftShoulder.rotation.z).toBeCloseTo(-1.77, 5)
  })

  it('snapToRest clears the body pose and returns to the captured model rest', () => {
    const leftShoulder = new Object3D()
    leftShoulder.name = 'LeftShoulder'
    const engine = new GestureEngine(new Map([['LeftShoulder', leftShoulder]]))

    engine.setBodyPose('side')
    engine.snapToBodyPose()
    engine.snapToRest()

    expect(leftShoulder.rotation.x).toBe(0)
    expect(leftShoulder.rotation.y).toBe(0)
    expect(leftShoulder.rotation.z).toBe(0)
  })
})
