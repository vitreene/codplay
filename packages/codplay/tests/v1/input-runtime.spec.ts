// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import type { ItemDoc } from '../../src/runtime/types'
import { PlayerFacade } from '../../src/player/create-player'
import type { SceneDoc } from '../../src/player/types'

/**
 * Creates one generic input item used by the component test.
 */
function createInputItemFixture(): ItemDoc {
  return {
    id: 'story-main__answer',
    name: 'answer',
    storyId: 'story-main',
    type: 'input',
    initial: {
      move: '@root',
      id: 'story-main__answer-control',
      inputType: 'text',
      name: 'answer',
      value: 'hello',
      label: 'Answer',
      hint: 'Type one value',
      selectionIcon: {
        content: ''
      },
      correctionIcon: {
        content: '',
        correctContent: '+',
        incorrectContent: '-',
        missedCorrectContent: '+'
      },
      visualState: 'idle'
    },
    actions: {
      'story-main__answer': null
    }
  }
}

/**
 * Creates one simple scene fixture that mounts one generic input component.
 */
function createInputSceneFixture(): SceneDoc {
  return {
    id: 'scene-input',
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        initial: { move: '@root' },
        persos: [createInputItemFixture()],
        straps: undefined,
        listen: []
      }
    },
    tracks: {}
  }
}

describe('V1 - input runtime', () => {
  it('mounts the built-in input component through the player bootstrap', async () => {
    const player = new PlayerFacade()

    expect(await player.init(createInputSceneFixture())).toEqual({ ok: true })

    const root = player.getRuntimeRegistry().getNodeById('story-main__answer') as HTMLLabelElement | null
    const control = root?.querySelector('input') as HTMLInputElement | null

    expect(root).not.toBeNull()
    expect(root?.tagName.toLowerCase()).toBe('label')
    expect(root?.id).toBe('story-main__answer')
    expect(control?.type).toBe('text')
    expect(control?.id).toBe('story-main__answer-control')
    expect(control?.name).toBe('answer')
    expect(control?.value).toBe('hello')
  })
})
