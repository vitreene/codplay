/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'
import { CodPlay } from 'codplay'
import {
  createRiveTalkingAvatarStory,
  type RiveTalkingAvatarStoryOptions,
} from '../rive-talking-avatar'
import { RIVE_ENGINE, type RiveInputValues } from '@codplay/component-v2/rive/core'

/** Supplies independent authored data for the reusable factory. */
function createOptions(id: string): RiveTalkingAvatarStoryOptions {
  return {
    id,
    profile: {
      document: { src: '/fixture-avatar.riv', artboard: 'Portrait' },
      viewModel: {
        stateMachine: 'Expression machine',
        viewModel: 'Expression',
        instance: 'Initial expression',
        blendSpeed: 12,
        values: { rest: 1, vowel: 0, isTalking: false },
      },
    },
    voice: { src: '/fixture-voice.mp3', durationMs: 1_800 },
    frames: [
      { startAt: 100, values: { rest: 0, vowel: 1 } },
      { startAt: 900, values: { rest: 1, vowel: 0 } },
    ],
    captions: { cues: [{ text: 'Example', startAt: 100, endAt: 900 }] },
    frame: { move: '@root', style: { width: '28cqw', left: '64cqw' } },
  }
}

describe('reusable Rive avatar story', () => {
  it('compiles two identities through the existing builder and resource circuit', () => {
    const first = createRiveTalkingAvatarStory(createOptions('first'))
    const second = createRiveTalkingAvatarStory(createOptions('second'))
    const owner = new CodPlay({ engine: RIVE_ENGINE })
    const result = owner.build({ scene: JSON.parse(JSON.stringify({
      id: 'two-avatar-stories',
      stories: { first, second },
      eventimes: [{ name: 'sequence:end', startAt: 1_800 }],
    })) })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
    expect(result.compiledScene.resources.entries.map(({ url, type }) => ({ url, type })))
      .toEqual(expect.arrayContaining([
        { url: '/fixture-avatar.riv', type: 'rive' },
        { url: '/fixture-voice.mp3', type: 'audio' },
      ]))
    expect(result.compiledScene.resources.entries).toHaveLength(2)
    expect(result.compiledScene.actionTargetIndex['first:values'])
      .toEqual([{ storyId: 'first', persoId: 'first:values' }])
    expect(result.compiledScene.actionTargetIndex['second:values'])
      .toEqual([{ storyId: 'second', persoId: 'second:values' }])
    expect(first.persos.map(({ id }) => id).filter(id => second.persos.some(perso => perso.id === id)))
      .toEqual([])
    owner.destroy()
  })

  it('keeps the provided timing, master voice and caller-owned sequence end', () => {
    const story = createRiveTalkingAvatarStory(createOptions('speaker'))

    expect(story.persos.find(({ type }) => type === 'media')?.initial)
      .toMatchObject({ src: '/fixture-voice.mp3', sync: 'master', move: 'speaker-stage' })
    const viewModel = story.persos.find(({ type }) => type === 'rive-view-model')
    expect(viewModel?.initial)
      .toMatchObject({ rel: { host: 'speaker-avatar' }, blendSpeed: 12, values: { isTalking: false } })
    expect(viewModel?.actions).toMatchObject({
      'speaker:is-talking-start': { values: { isTalking: true } },
      'speaker:is-talking-end': { values: { isTalking: false } },
    })
    expect(story.eventimes).toContainEqual({
      name: 'speaker:values', startAt: 100, data: { values: { rest: 0, vowel: 1 } },
    })
    expect(story.eventimes).toContainEqual({
      name: 'speaker:caption', startAt: 900, data: { content: '' },
    })
    expect(story.eventimes).toContainEqual({ name: 'speaker:is-talking-start', startAt: 0 })
    expect(story.eventimes).toContainEqual({ name: 'speaker:is-talking-end', startAt: 1_800 })
    expect(story.eventimes?.some(({ name }) => name === 'sequence:end' || name === 'scene:end'))
      .toBe(false)
    expect(story.persos[0]?.initial?.style).toMatchObject({ width: '28cqw', left: '64cqw' })
  })

  it('constructs fresh event data without changing the supplied profile or tracks', () => {
    const options = createOptions('speaker')
    const original = JSON.stringify(options)
    const first = createRiveTalkingAvatarStory(options)
    const second = createRiveTalkingAvatarStory(options)

    expect(JSON.stringify(options)).toBe(original)
    expect(first).toEqual(second)
    const valueEvent = first.eventimes?.find(({ name }) => name === 'speaker:values')
    const frameData = valueEvent?.data as { values: RiveInputValues }
    expect(frameData.values).not.toBe(options.frames[0]?.values)
    expect(first.eventimes).not.toBe(second.eventimes)
  })

  it('uses the canonical isTalking value and supports a story without captions', () => {
    const options = createOptions('quiet')
    const story = createRiveTalkingAvatarStory({
      ...options,
      captions: undefined,
    })

    expect(story.persos.map(({ id }) => id)).not.toContain('quiet:caption')
    expect(story.eventimes).toContainEqual({ name: 'quiet:is-talking-start', startAt: 0 })
    expect(story.eventimes).toContainEqual({ name: 'quiet:is-talking-end', startAt: 1_800 })
    expect(story.persos.find(({ type }) => type === 'rive')?.initial?.animations).toEqual([])
  })
})
