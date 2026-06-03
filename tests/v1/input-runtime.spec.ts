// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'

import { InputComponent } from '../../src/runtime/components'
import { CORE_SERVICES, createComponentServices } from '../../src/runtime/components/lib/component-services'
import { createComponentModules } from '../../src/runtime/components/lib/component-modules'
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
      id: 'story-main__answer-control',
      inputType: 'text',
      name: 'answer',
      value: 'hello',
      label: 'Answer',
      hint: 'Type one value',
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
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        entries: ['story-main__answer'],
        initial: undefined,
        persos: [createInputItemFixture()],
        straps: undefined,
        listen: []
      }
    },
    init(scene, options) {
      options.mount(scene.rootStories[0])
    },
    tracks: {}
  }
}

/**
 * Creates one standalone input component instance for direct rendering checks.
 */
function createStandaloneInputComponent(): InputComponent {
  const services = createComponentServices(new Map(Object.entries(CORE_SERVICES)))
  const modules = createComponentModules()
  const report = vi.fn()

  return new InputComponent({
    perso: createInputItemFixture(),
    createElementOptions: undefined,
    report,
    services,
    modules
  })
}

describe('V1 - input runtime', () => {
  it('renders a generic field with feedback parts and accepts post-correction state', () => {
    const component = createStandaloneInputComponent()

    component._init()

    const root = component.node as HTMLLabelElement | null
    const control = root?.querySelector('input') as HTMLInputElement | null
    const label = (component as unknown as { getPart: (partId: string) => unknown | null }).getPart('label') as HTMLElement | null
    const hint = (component as unknown as { getPart: (partId: string) => unknown | null }).getPart('hint') as HTMLElement | null
    const selectionIcon = (component as unknown as { getPart: (partId: string) => unknown | null }).getPart('selection-icon') as HTMLElement | null
    const correctionIcon = (component as unknown as { getPart: (partId: string) => unknown | null }).getPart('correction-icon') as HTMLElement | null

    expect(root).not.toBeNull()
    expect(control).not.toBeNull()
    expect(root?.id).toBe('story-main__answer')
    expect(root?.className).toContain('input--idle')
    expect(control?.type).toBe('text')
    expect(control?.id).toBe('story-main__answer-control')
    expect(control?.name).toBe('answer')
    expect(control?.value).toBe('hello')
    expect(control?.className).toContain('input__control--idle')
    expect(label?.textContent).toBe('Answer')
    expect(hint?.textContent).toBe('Type one value')
    expect(selectionIcon?.className).toContain('is-idle')
    expect(correctionIcon?.className).toContain('is-idle')

    component.update({
      persoId: 'story-main__answer',
      eventId: 'evt-1',
      eventSeq: 1,
      action: {
        id: 'story-main__answer-control',
        inputType: 'checkbox',
        name: 'answer',
        value: 'hello',
        label: 'Answer',
        hint: 'Type one value',
        checked: true,
        disabled: true,
        visualState: 'revealed-correct'
      }
    })

    expect(root?.id).toBe('story-main__answer')
    expect(root?.className).toContain('input--revealed-correct')
    expect(root?.className).toContain('input--selected')
    expect(root?.className).toContain('input--disabled')
    expect(control?.type).toBe('checkbox')
    expect(control?.id).toBe('story-main__answer-control')
    expect(control?.checked).toBe(true)
    expect(control?.disabled).toBe(true)
    expect(control?.className).toContain('input__control--revealed-correct')
    expect(control?.className).toContain('is-selected')
    expect(control?.className).toContain('is-disabled')
    expect(correctionIcon?.className).toContain('is-correct')
  })

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
