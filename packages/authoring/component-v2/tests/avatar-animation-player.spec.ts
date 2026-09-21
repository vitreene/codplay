import { describe, expect, it } from 'vitest'
import {
  AnimationClip,
  Bone,
  Group,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
} from 'three'
import { createAvatarAnimationPlayer } from '../src/avatar/motion/avatar-animation-player'

describe('Avatar animation player', () => {
  it('samples from the current position and keeps it on release', () => {
    const root = new Group()
    const hips = new Bone()
    hips.name = 'Hips'
    hips.position.y = 2
    root.add(hips)
    const clip = new AnimationClip('walk', 1, [
      new VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 1, 0]),
    ])
    const player = createAvatarAnimationPlayer(root)

    player.register('walk', clip, 'animation')
    expect(player.get('walk')).toBe('animation')
    player.set({ name: 'walk', startAt: 1_000, speed: 1, loop: false })
    player.applyAt(1_500)
    expect(hips.position.y).toBeCloseTo(2.5)

    player.set(null)
    player.applyAt(2_500)
    expect(hips.position.y).toBeCloseTo(2.5)
  })

  it('reconstructs the same clip position after seek preparation', () => {
    const root = new Group()
    const hips = new Bone()
    hips.name = 'Hips'
    hips.position.y = 2
    root.add(hips)
    const clip = new AnimationClip('walk', 1, [
      new VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 1, 0]),
    ])
    const player = createAvatarAnimationPlayer(root)

    player.register('walk', clip, 'animation')
    player.set({ name: 'walk', startAt: 0, speed: 1, loop: true })
    player.applyAt(750)
    expect(hips.position.y).toBeCloseTo(2.75)
    player.prepareSeek()
    expect(hips.position.y).toBeCloseTo(2)
    player.applyAt(250)
    expect(hips.position.y).toBeCloseTo(2.25)
  })

  it('rebuilds the native action when loop mode changes', () => {
    const root = new Group()
    const hips = new Bone()
    hips.name = 'Hips'
    root.add(hips)
    const clip = new AnimationClip('walk', 1, [
      new VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 1, 0]),
    ])
    const player = createAvatarAnimationPlayer(root)

    player.register('walk', clip, 'animation')
    player.set({ name: 'walk', startAt: 0, speed: 1, loop: true })
    player.applyAt(1_250)
    expect(hips.position.y).toBeCloseTo(0.25)

    player.set({ name: 'walk', startAt: 0, speed: 1, loop: false })
    player.applyAt(1_250)
    expect(hips.position.y).toBeCloseTo(1.25)
  })

  it('anchors a new motion to the position left by the previous one', () => {
    const root = new Group()
    const hips = new Bone()
    hips.name = 'Hips'
    root.add(hips)
    const walk = new AnimationClip('walk', 1, [
      new VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 1, 0]),
    ])
    const step = new AnimationClip('step', 1, [
      new VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 2, 0]),
    ])
    const player = createAvatarAnimationPlayer(root)

    player.register('walk', walk, 'animation')
    player.register('step', step, 'animation')
    player.set({ name: 'walk', startAt: 0, speed: 1, loop: false })
    player.applyAt(500)
    expect(hips.position.y).toBeCloseTo(0.5)

    player.set({ name: 'step', startAt: 1_000, speed: 1, loop: false })
    player.applyAt(1_000)
    expect(hips.position.y).toBeCloseTo(0.5)
    player.applyAt(1_500)
    expect(hips.position.y).toBeCloseTo(1.5)
  })

  it('hands the full clip pose to the semantic Avatar pose with ease-out', () => {
    const root = new Group()
    const hips = new Bone()
    hips.name = 'Hips'
    hips.position.y = 2
    root.add(hips)
    const clip = new AnimationClip('walk', 1, [
      new VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 1, 0]),
      new QuaternionKeyframeTrack('Hips.quaternion', [0, 1], [0, 0, 0, 1, 0, Math.sin(0.4), 0, Math.cos(0.4)]),
    ])
    const player = createAvatarAnimationPlayer(root)

    player.register('walk', clip, 'animation')
    player.set({ name: 'walk', startAt: 0, speed: 1, loop: false })
    player.applyAt(500)
    expect(hips.position.y).toBeCloseTo(2.5)

    // This is the semantic destination that the idle component would have
    // applied before the animation player writes its transition frame.
    hips.rotation.y = 0.1
    player.set({ name: 'walk', startAt: 0, speed: 1, loop: false, releaseAt: 500, transitionMs: 400 })
    player.applyAt(500)
    expect(hips.position.y).toBeCloseTo(2.5)
    expect(hips.rotation.y).toBeCloseTo(0.4)

    player.applyAt(700)
    expect(hips.rotation.y).toBeCloseTo(0.1375)

    hips.rotation.y = 0.1
    player.applyAt(1_000)
    expect(hips.position.y).toBeCloseTo(2.5)
    expect(hips.rotation.y).toBeCloseTo(0.1)
  })

  it('keeps playing the source clip before its release boundary', () => {
    const root = new Group()
    const hips = new Bone()
    hips.name = 'Hips'
    root.add(hips)
    const clip = new AnimationClip('walk', 1, [
      new VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 1, 0]),
    ])
    const player = createAvatarAnimationPlayer(root)

    player.register('walk', clip, 'animation')
    player.set({ name: 'walk', startAt: 0, speed: 1, loop: false, releaseAt: 500 })
    player.applyAt(250)

    expect(hips.position.y).toBeCloseTo(0.25)
  })

  it('reconstructs the same release pose after seek', () => {
    const root = new Group()
    const hips = new Bone()
    hips.name = 'Hips'
    hips.position.y = 2
    root.add(hips)
    const clip = new AnimationClip('walk', 1, [
      new VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 1, 0]),
      new QuaternionKeyframeTrack('Hips.quaternion', [0, 1], [0, 0, 0, 1, 0, Math.sin(0.4), 0, Math.cos(0.4)]),
    ])
    const player = createAvatarAnimationPlayer(root)

    player.register('walk', clip, 'animation')
    hips.rotation.y = 0.1
    player.set({ name: 'walk', startAt: 0, speed: 1, loop: false, releaseAt: 500, transitionMs: 400 })
    player.prepareSeek()
    player.applyAt(500)
    expect(hips.position.y).toBeCloseTo(2.5)
    expect(hips.rotation.y).toBeCloseTo(0.4)

    player.applyAt(700)
    expect(hips.rotation.y).toBeCloseTo(0.1375)
  })
})
