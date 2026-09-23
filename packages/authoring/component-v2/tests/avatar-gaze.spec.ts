import { describe, expect, it } from 'vitest'
import { Bone, Group, PerspectiveCamera } from 'three'
import { GazeService } from '../src/avatar/gaze/gaze-service'
import { MorphEngine } from '../src/avatar/morph/morph-engine'

describe('Avatar gaze adaptation', () => {
  it('keeps the TalkingHead look-ahead available without a camera', () => {
    const root = new Group()
    const head = new Bone()
    head.name = 'Head'
    const leftEye = new Bone()
    leftEye.name = 'LeftEye'
    leftEye.position.set(-0.03, 0, 0.12)
    const rightEye = new Bone()
    rightEye.name = 'RightEye'
    rightEye.position.set(0.03, 0, 0.12)
    head.add(leftEye, rightEye)
    root.add(head)

    const morphs = new MorphEngine()
    morphs.registerBoneMorphs(() => undefined)
    const gaze = new GazeService(morphs, leftEye, rightEye, head, null)
    gaze.setTarget('ahead')
    gaze.setEnabled(true)

    const correction = gaze.sample()

    expect(correction.get(head)?.rotation?.x).not.toBe(0)
    expect(correction.get(head)?.rotation?.y).not.toBe(0)
  })

  it('interpolates camera contact over the requested absolute duration', () => {
    const root = new Group()
    const head = new Bone()
    head.name = 'Head'
    const leftEye = new Bone()
    leftEye.name = 'LeftEye'
    leftEye.position.set(-0.03, 0, 0.12)
    const rightEye = new Bone()
    rightEye.name = 'RightEye'
    rightEye.position.set(0.03, 0, 0.12)
    head.add(leftEye, rightEye)
    root.add(head)

    const camera = new PerspectiveCamera()
    camera.position.set(0.2, 0, 1)
    root.add(camera)

    const morphs = new MorphEngine()
    morphs.registerBoneMorphs(() => undefined)
    const gaze = new GazeService(morphs, leftEye, rightEye, head, camera)
    gaze.setTarget('ahead')
    gaze.setEnabled(true)

    const start = gaze.sample(0).get(head)?.rotation?.y ?? 0
    gaze.setTarget('camera', { startAt: 0, durationMs: 1_000 })
    const middle = gaze.sample(500).get(head)?.rotation?.y ?? 0
    const end = gaze.sample(1_000).get(head)?.rotation?.y ?? 0

    expect(Math.abs(middle)).toBeGreaterThan(Math.abs(start))
    expect(Math.abs(middle)).toBeLessThan(Math.abs(end))
  })

  it('reproduces the finite native look-ahead template on the absolute clock', () => {
    const head = new Bone()
    head.name = 'Head'
    const leftEye = new Bone()
    leftEye.name = 'LeftEye'
    leftEye.position.set(-0.03, 0, 0.12)
    const rightEye = new Bone()
    rightEye.name = 'RightEye'
    rightEye.position.set(0.03, 0, 0.12)
    head.add(leftEye, rightEye)

    const morphs = new MorphEngine()
    morphs.registerBoneMorphs(() => undefined)
    for (const name of ['browInnerUp', 'mouthLeft', 'mouthRight']) {
      morphs.registerBlendMorph(name, { influences: [0], index: 0 })
    }
    const gaze = new GazeService(morphs, leftEye, rightEye, head, null)
    gaze.setTarget('ahead')
    gaze.setEnabled(true)
    gaze.setLookAhead({ startAt: 0, durationMs: 500, seed: 41 })

    expect(gaze.sample(750)).toEqual(new Map())
    expect(Math.abs(morphs.getValue('bodyRotateX'))).toBeGreaterThan(0)
    expect(morphs.getValue('browInnerUp')).toBeGreaterThan(0)

    gaze.sample(1_300)
    expect(morphs.getValue('bodyRotateX')).toBe(0)
    expect(gaze.sample(1_300).get(head)?.rotation?.x).not.toBe(0)
  })
})
