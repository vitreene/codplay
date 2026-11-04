/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay, type SceneDoc } from 'codplay'
import { RIVE_COMPONENTS } from '../src/rive'
import { registerRiveResource } from '../src/rive/rive-preload'
import { createViewModelFixture } from './rive/view-model-fixture'

/** Declares independent narrative commands, including a runtime event on its story. */
function createScene(
  reverse = false,
  blendSpeed = 0,
): SceneDoc<string> {
  const host = { id: 'avatar', type: 'rive', initial: { src: '/test-owned-view-model.riv', animations: [], move: '@root' }, actions: {} }
  const control = {
    id: 'control', type: 'rive-view-model',
    initial: {
      rel: { host: 'avatar' }, stateMachine: 'Machine', viewModel: 'Expression', instance: 'Exported pose',
      ...(blendSpeed === 0 ? {} : { blendSpeed }),
    },
    actions: {
      vowel: { values: { neutral: 0, vowel: 1, speaking: true } },
      turn: { values: { turn: 80 } },
      rest: { values: { vowel: 0, neutral: 1, speaking: false } },
      live: { values: { turn: 65 } },
      look: { values: { headX: 80 } },
    },
  }
  return {
    id: 'view-model-player-fixture',
    stories: {
      narration: {
        id: 'narration', initial: { move: '@root' }, listen: [{ on: 'live' }],
        persos: reverse ? [control, host] : [host, control],
        eventimes: [
          { name: 'vowel', startAt: 100 },
          { name: 'turn', startAt: 300 },
          { name: 'rest', startAt: 500 },
          { name: 'sequence:end', startAt: 1_000 },
        ],
      },
    },
  }
}

describe('Rive ViewModel through the CodPlay player', () => {
  const owners: CodPlay[] = []
  afterEach(() => {
    owners.forEach((owner) => owner.destroy())
    owners.length = 0
    document.body.replaceChildren()
  })

  /** Prepares the real engine and HTML runner with a test-owned native library. */
  async function createPlayer(
    reverse = false,
    blendSpeed = 0,
  ) {
    const fixture = createViewModelFixture()
    const owner = new CodPlay({
      frameScheduler: { request: () => 1, cancel() {} }, pauseOnDocumentHidden: false,
      engine: {
        idle: false,
        components: { register: RIVE_COMPONENTS },
        libraries: { register: [{ id: 'rive', origin: 'foreign', load: async () => fixture.runtime }] },
      },
    })
    owners.push(owner)
    const build = owner.build({ scene: JSON.parse(JSON.stringify(createScene(reverse, blendSpeed))) })
    if (!build.ok) throw new Error(build.diagnostics.errors.map((issue) => issue.message).join('\n'))
    registerRiveResource('/test-owned-view-model.riv', { runtime: fixture.runtime, file: fixture.file })
    owner.resources.register({ loaded: ['/test-owned-view-model.riv'], skipped: [], metadata: {} })
    await owner.engine.prepareScene(build.compiledScene)
    const root = document.createElement('div')
    document.body.append(root)
    const instance = owner.instances.create({ instanceId: 'view-model-player', compiledScene: build.compiledScene, functions: build.functions, root })
    return { ...fixture, owner, instance, root }
  }

  it.each([false, true])('restores the commands due at T regardless of prior seeks (reverse order %s)', async (reverse) => {
    const player = await createPlayer(reverse)
    const readFrame = () => player.artboards.findLast((artboard) => !artboard.deleted)?.drawn
    expect(readFrame()).toEqual({ neutral: 1, vowel: 0, turn: 12, headX: 50, speaking: false })
    await player.instance.telco.seek(400)
    const due = { neutral: 0, vowel: 1, turn: 80, headX: 50, speaking: true }
    expect(readFrame()).toEqual(due)
    const snapshot = player.instance.snapshot.get()?.states.find((state) => state.target.persoId === 'control')
    expect(snapshot?.state.values).toEqual({ neutral: 0, vowel: 1, turn: 80, speaking: true })
    await player.instance.telco.seek(700)
    expect(readFrame()).toEqual({ neutral: 1, vowel: 0, turn: 80, headX: 50, speaking: false })
    await player.instance.telco.seek(400)
    expect(readFrame()).toEqual(due)
    await player.instance.telco.seek(0)
    expect(readFrame()).toEqual({ neutral: 1, vowel: 0, turn: 12, headX: 50, speaking: false })
    await player.instance.telco.seek(100)
    expect(readFrame()).toEqual({ neutral: 0, vowel: 1, turn: 12, headX: 50, speaking: true })
    await player.instance.telco.seek(400)
    expect(readFrame()).toEqual(due)
    await player.instance.telco.reset()
    expect(readFrame()).toEqual({ neutral: 1, vowel: 0, turn: 12, headX: 50, speaking: false })
    player.owner.destroy()
    expect(player.instances.every((instance) => instance.deleted)).toBe(true)
    expect(player.machines.every((machine) => machine.deleted)).toBe(true)
    expect(player.root.querySelector('canvas')).toBeNull()
  })

  it('presents runtime commands through the ordinary event journal and isolates another player', async () => {
    const first = await createPlayer()
    const second = await createPlayer()
    await first.instance.telco.seek(200)
    await first.instance.events.emit({ name: 'live' }, { scope: 'story', storyId: 'narration' })
    expect(first.artboards.findLast((artboard) => !artboard.deleted)?.drawn.turn).toBe(65)
    expect(second.artboards.findLast((artboard) => !artboard.deleted)?.drawn.turn).toBe(12)
    await first.instance.telco.pause()
    await first.instance.telco.seek(0)
    expect(first.artboards.findLast((artboard) => !artboard.deleted)?.drawn.turn).toBe(12)
    await first.instance.telco.seek(200)
    expect(first.artboards.findLast((artboard) => !artboard.deleted)?.drawn.turn).toBe(65)
  })

  it('plays, pauses and replays narrative values through the shared clock', async () => {
    const player = await createPlayer()
    const readFrame = () => player.artboards.findLast((artboard) => !artboard.deleted)?.drawn
    player.owner.engine.advance(0)
    await player.instance.telco.play()
    player.owner.engine.advance(0)
    player.owner.engine.advance(400)
    expect(readFrame()).toEqual({ neutral: 0, vowel: 1, turn: 80, headX: 50, speaking: true })
    await player.instance.telco.pause()
    player.owner.engine.advance(700)
    expect(player.instance.snapshot.get()?.timeMs).toBe(400)
    await player.instance.telco.reset()
    expect(readFrame()).toEqual({ neutral: 1, vowel: 0, turn: 12, headX: 50, speaking: false })
    await player.instance.telco.play()
    player.owner.engine.advance(700)
    player.owner.engine.advance(1_100)
    expect(readFrame()).toEqual({ neutral: 0, vowel: 1, turn: 80, headX: 50, speaking: true })
  })

  it('reconstructs mouth and head interpolation identically after a backward Seek', async () => {
    const player = await createPlayer(false, 18)
    const readFrame = () => player.artboards.findLast((artboard) => !artboard.deleted)?.drawn
    await player.instance.telco.seek(100)
    await player.instance.events.emit({ name: 'look' }, { scope: 'story', storyId: 'narration' })
    await player.instance.telco.seek(150)

    const mouthProgress = 1 - Math.exp(-18 * 0.05)
    expect(readFrame()?.vowel).toBeCloseTo(mouthProgress)
    expect(readFrame()?.headX).toBeCloseTo(50 + 30 * mouthProgress)
    expect(readFrame()?.speaking).toBe(true)

    await player.instance.telco.seek(0)
    expect(readFrame()?.headX).toBe(50)
    await player.instance.telco.seek(150)
    expect(readFrame()?.vowel).toBeCloseTo(mouthProgress)
    expect(readFrame()?.headX).toBeCloseTo(50 + 30 * mouthProgress)
  })

  it('rejects invalid authored patches at the component validation boundary', () => {
    const owner = new CodPlay({ engine: { components: { register: RIVE_COMPONENTS } } })
    owners.push(owner)
    const scene = createScene()
    const story = scene.stories!.narration!
    const result = owner.build({ scene: { ...scene, stories: { narration: {
      ...story,
      persos: story.persos.map((perso) => perso.id === 'control'
        ? { ...perso, actions: { ...perso.actions, invalid: { values: { turn: 'invalid' } } } }
        : perso),
    } } } })
    expect(result.diagnostics.errors.some((issue) => issue.code === 'AUTHOR_RIVE_INPUT_VALUE_INVALID')).toBe(true)
  })

  it('rejects a negative ViewModel blend speed at build time', () => {
    const owner = new CodPlay({ engine: { components: { register: RIVE_COMPONENTS } } })
    owners.push(owner)
    const scene = createScene()
    const story = scene.stories!.narration!
    const result = owner.build({ scene: { ...scene, stories: { narration: {
      ...story,
      persos: story.persos.map((perso) => perso.id === 'control'
        ? { ...perso, initial: { ...perso.initial, blendSpeed: -1 } }
        : perso),
    } } } })
    expect(result.diagnostics.errors.some((issue) => issue.code === 'AUTHOR_RIVE_BLEND_SPEED_INVALID')).toBe(true)
  })

})
