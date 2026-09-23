import { describe, expect, it } from 'vitest'
import {
  AnimationClip,
  Bone,
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  QuaternionKeyframeTrack,
  VectorKeyframeTrack,
} from 'three'
import { createAvatarAnimationPlayer } from '../src/avatar/motion/avatar-animation-player'
import {
  AvatarPoseComposer,
  captureBonePose,
  createHipFeetBalanceDelta,
} from '../src/avatar/pose/avatar-pose'
import { normalizeClip } from '../src/avatar/model/animation-loader'

describe('Avatar animation player', () => {
  it('samples a native clip without retaining the mixer write on the skeleton', () => {
    const { root, hips } = createAvatarRoot(2)
    const player = createAvatarAnimationPlayer(root)
    player.register('walk', createWalkClip(), 'animation')
    player.set({ name: 'walk', startAt: 1_000, speed: 1, loop: false })

    const sample = player.sampleAt(1_500)

    expect(sample?.transforms.get(hips)?.position?.y).toBeCloseTo(2.5)
    expect(hips.position.y).toBeCloseTo(2)
  })

  it('keeps a selected clip inactive before its absolute start', () => {
    const { root, hips } = createAvatarRoot(2)
    const player = createAvatarAnimationPlayer(root)
    player.register('walk', createWalkClip(), 'animation')
    player.set({ name: 'walk', startAt: 1_000, speed: 1, loop: true })

    expect(player.sampleAt(500)).toBeNull()
    expect(hips.position.y).toBeCloseTo(2)
  })

  it('enters an animation from the semantic pose with the native transition', () => {
    const { root, hips } = createAvatarRoot(2)
    const player = createAvatarAnimationPlayer(root)
    const composer = new AvatarPoseComposer(new Map([[hips.name, hips]]))
    player.register('walk', createWalkClip(), 'animation')
    player.set({ name: 'walk', startAt: 0, speed: 1, loop: true })

    const semantic = captureBonePose(new Map([[hips.name, hips]]))
    const entry = player.sampleAt(0)
    composer.apply(composer.compose(semantic, entry, []))

    expect(entry?.entryProgress).toBeCloseTo(0)
    expect(hips.position.y).toBeCloseTo(2)
    expect(player.sampleAt(1_000)?.entryProgress).toBeUndefined()
  })

  it('hands a looping animation back after its active duration, after one full round', () => {
    const { root } = createAvatarRoot(2)
    const player = createAvatarAnimationPlayer(root)
    player.register('walk', createWalkClip(), 'animation')
    player.set({ name: 'walk', startAt: 0, speed: 1, loop: true, durationMs: 500 })

    expect(player.sampleAt(750)?.releaseProgress).toBeUndefined()
    expect(player.sampleAt(1_000)?.releaseProgress).toBe(0)
    expect(player.sampleAt(1_400)?.releaseProgress).toBe(1)
  })

  it('hands a pose resource back after its active duration', () => {
    const { root } = createAvatarRoot(2)
    const player = createAvatarAnimationPlayer(root)
    player.register('rest', createWalkClip(), 'pose')
    player.set({ name: 'rest', startAt: 0, speed: 1, durationMs: 500 })

    expect(player.sampleAt(500)?.releaseProgress).toBe(0)
    expect(player.sampleAt(900)?.releaseProgress).toBe(1)
  })

  it('returns a non-looping clip to the semantic pose at its natural end', () => {
    const { root } = createAvatarRoot(2)
    const player = createAvatarAnimationPlayer(root)
    player.register('walk', createWalkClip(), 'animation')
    player.set({ name: 'walk', startAt: 0, speed: 1, loop: false })

    expect(player.sampleAt(1_000)?.releaseProgress).toBe(0)
    expect(player.sampleAt(1_400)?.releaseProgress).toBe(1)
  })

  it('captures Euler rotation tracks from FBX-style clips for the composer', () => {
    const { root, hips } = createAvatarRoot()
    const player = createAvatarAnimationPlayer(root)
    const source = new AnimationClip('turn', 1, [
      new VectorKeyframeTrack('Hips.rotation', [0, 1], [0, 0, 0, 0.4, 0, 0]),
    ])
    player.register('turn', normalizeClip(source, 'fbx', 1), 'animation')
    player.set({ name: 'turn', startAt: 0, speed: 1, loop: false })

    const transform = player.sampleAt(1_000)?.transforms.get(hips)

    expect(transform?.quaternion?.x).toBeCloseTo(Math.sin(0.2))
    expect(transform?.quaternion?.w).toBeCloseTo(Math.cos(0.2))
    expect(hips.rotation.x).toBeCloseTo(0)
  })

  it('reconstructs the same clip sample after seek preparation', () => {
    const { root, hips } = createAvatarRoot(2)
    const player = createAvatarAnimationPlayer(root)
    player.register('walk', createWalkClip(), 'animation')
    player.set({ name: 'walk', startAt: 0, speed: 1, loop: true })

    const played = player.sampleAt(750)
    player.prepareSeek()
    player.set({ name: 'walk', startAt: 0, speed: 1, loop: true })
    const seeked = player.sampleAt(750)

    expect(played?.transforms.get(hips)?.position?.y).toBeCloseTo(2.75)
    expect(seeked).toEqual(played)
  })

  it('anchors the next motion to the translation already composed by the previous motion', () => {
    const { root, hips } = createAvatarRoot()
    const player = createAvatarAnimationPlayer(root)
    const walk = createWalkClip()
    const step = new AnimationClip('step', 1, [
      new VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 2, 0]),
    ])
    player.register('walk', walk, 'animation')
    player.register('step', step, 'animation')
    player.set({ name: 'walk', startAt: 0, speed: 1, loop: false })

    const walkSample = player.sampleAt(500)
    hips.position.y = walkSample?.transforms.get(hips)?.position?.y ?? 0
    player.set({ name: 'step', startAt: 1_000, speed: 1, loop: false })

    expect(player.sampleAt(1_000)?.transforms.get(hips)?.position?.y).toBeCloseTo(0.5)
    expect(player.sampleAt(1_500)?.transforms.get(hips)?.position?.y).toBeCloseTo(1.5)
  })

  it('hands a clip pose to the current semantic pose while holding the reached translation', () => {
    const { root, hips } = createAvatarRoot(2)
    const player = createAvatarAnimationPlayer(root)
    const composer = new AvatarPoseComposer(new Map([[hips.name, hips]]))
    player.register('walk', createWalkClip(true), 'animation')
    player.set({ name: 'walk', startAt: 0, speed: 1, loop: false, releaseAt: 500, transitionMs: 400 })

    hips.rotation.y = 0.1
    const semantic = captureBonePose(new Map([[hips.name, hips]]))
    const boundary = player.sampleAt(500)
    composer.apply(composer.compose(semantic, boundary ?? null, []))
    expect(hips.position.y).toBeCloseTo(2.5)
    expect(hips.rotation.y).toBeCloseTo(0.4)

    const midpoint = player.sampleAt(700)
    composer.apply(composer.compose(semantic, midpoint ?? null, []))
    expect(hips.position.y).toBeCloseTo(2.125)
    expect(hips.rotation.y).toBeCloseTo(0.175)

    const completed = player.sampleAt(1_000)
    composer.apply(composer.compose(semantic, completed ?? null, []))
    expect(hips.position.y).toBeCloseTo(2)
    expect(hips.rotation.y).toBeCloseTo(0.1)
  })

  it('produces the same release layer for Play and Seek at one absolute date', () => {
    const first = createReleaseSample(700, false)
    const replayed = createReleaseSample(700, true)

    expect(replayed?.releaseProgress).toBeCloseTo(first?.releaseProgress ?? 0)
    expect(replayed?.transforms.values().next().value).toEqual(first?.transforms.values().next().value)
  })

  it('moves an arrival clip through its presentation offset without translating Hips twice', () => {
    const { root, hips } = createAvatarRoot()
    const player = createAvatarAnimationPlayer(root)
    player.register('walk-in', createArrivalClip(), 'animation', 'arrival')
    player.set({ name: 'walk-in', startAt: 0, speed: 1, loop: true })

    const start = player.sampleAt(0)
    const middle = player.sampleAt(500)
    const arrival = player.sampleAt(1_000)

    expect(start?.rootMotionOffset).toEqual({ x: 0, y: 0, z: -2 })
    expect(middle?.rootMotionOffset).toEqual({ x: 0, y: 0, z: -1 })
    expect(arrival?.rootMotionOffset).toEqual({ x: 0, y: 0, z: 0 })
    expect(middle?.transforms.get(hips)?.position?.z).toBeCloseTo(0)
    expect(arrival?.releaseProgress).toBe(0)
  })

  it('keeps the position reached by an interrupted arrival animation', () => {
    const { root } = createAvatarRoot()
    const player = createAvatarAnimationPlayer(root)
    player.register('walk-in', createArrivalClip(), 'animation', 'arrival')
    player.set({ name: 'walk-in', startAt: 0, speed: 1, releaseAt: 500, transitionMs: 400 })

    const boundary = player.sampleAt(500)
    const afterRelease = player.sampleAt(1_000)

    expect(boundary?.rootMotionOffset).toEqual({ x: 0, y: 0, z: -1 })
    expect(afterRelease?.rootMotionOffset).toEqual({ x: 0, y: 0, z: -1 })
    expect(afterRelease?.releaseProgress).toBe(1)
  })

  it('uses scene-selected arrival easing and transition duration', () => {
    const { root } = createAvatarRoot()
    const player = createAvatarAnimationPlayer(root)
    player.register('walk-in', createArrivalClip(), 'animation', {
      type: 'arrival',
      easing: 'ease-out',
      transitionMs: 800,
    })
    player.set({ name: 'walk-in', startAt: 0, speed: 1 })

    const middle = player.sampleAt(500)
    const halfTransition = player.sampleAt(1_400)
    const completed = player.sampleAt(1_800)

    expect(middle?.rootMotionOffset).toEqual({ x: 0, y: 0, z: -0.5 })
    expect(halfTransition?.releaseProgress).toBeCloseTo(0.75)
    expect(completed?.releaseProgress).toBe(1)
  })

  it('reconstructs an arrival offset identically after seek preparation', () => {
    const first = createArrivalSample(750, false)
    const replayed = createArrivalSample(750, true)

    expect(replayed?.rootMotionOffset).toEqual(first?.rootMotionOffset)
    expect(replayed?.transforms.values().next().value).toEqual(first?.transforms.values().next().value)
  })

  it('computes the TH hip-feet balance from the current composed skeleton', () => {
    const root = new Group()
    const hips = new Bone()
    hips.name = 'Hips'
    hips.position.set(0, 2, 0)
    root.add(hips)

    const leftToe = new Bone()
    leftToe.name = 'LeftToeBase'
    leftToe.position.set(0.2, -2, 0.3)
    hips.add(leftToe)

    const rightToe = new Bone()
    rightToe.name = 'RightToeBase'
    rightToe.position.set(-0.6, 0, 0.7)
    hips.add(rightToe)

    const floor = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial())
    floor.position.y = 0
    root.add(floor)
    root.updateMatrixWorld(true)

    const delta = createHipFeetBalanceDelta(root, new Map([
      ['Hips', hips],
      ['LeftToeBase', leftToe],
      ['RightToeBase', rightToe],
    ]))
    const position = delta.get(hips)?.position

    expect(position?.x).toBeCloseTo(0.1)
    expect(position?.y).toBeCloseTo(0.5)
    expect(position?.z).toBeCloseTo(-0.5)
  })
})

/** Creates one self-contained skeleton fixture with an optional initial root height. */
function createAvatarRoot(initialY = 0): { root: Group; hips: Bone } {
  const root = new Group()
  const hips = new Bone()
  hips.name = 'Hips'
  hips.position.y = initialY
  root.add(hips)
  return { root, hips }
}

/** Creates one native clip fixture with translation and an optional hip rotation. */
function createWalkClip(includeRotation = false): AnimationClip {
  const tracks = [
    new VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 1, 0]),
  ]
  if (includeRotation) {
    tracks.push(new QuaternionKeyframeTrack(
      'Hips.quaternion',
      [0, 1],
      [0, 0, 0, 1, 0, Math.sin(0.4), 0, Math.cos(0.4)],
    ))
  }
  return new AnimationClip('walk', 1, tracks)
}

/** Creates a clip whose Hips track advances two units along its local forward axis. */
function createArrivalClip(): AnimationClip {
  return new AnimationClip('walk-in', 1, [
    new VectorKeyframeTrack('Hips.position', [0, 1], [0, 0, 0, 0, 0, 2]),
  ])
}

/** Builds one release layer through either normal playback or seek preparation. */
function createReleaseSample(timeMs: number, seek: boolean) {
  const { root } = createAvatarRoot(2)
  const player = createAvatarAnimationPlayer(root)
  player.register('walk', createWalkClip(true), 'animation')
  player.set({ name: 'walk', startAt: 0, speed: 1, loop: false, releaseAt: 500, transitionMs: 400 })
  if (seek) {
    player.prepareSeek()
    player.set({ name: 'walk', startAt: 0, speed: 1, loop: false, releaseAt: 500, transitionMs: 400 })
  }
  return player.sampleAt(timeMs)
}

/** Samples an arrival clip by direct playback or reconstructed seek. */
function createArrivalSample(timeMs: number, seek: boolean) {
  const { root } = createAvatarRoot()
  const player = createAvatarAnimationPlayer(root)
  player.register('walk-in', createArrivalClip(), 'animation', 'arrival')
  player.set({ name: 'walk-in', startAt: 0, speed: 1 })
  if (seek) {
    player.prepareSeek()
    player.set({ name: 'walk-in', startAt: 0, speed: 1 })
  }
  return player.sampleAt(timeMs)
}
