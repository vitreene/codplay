// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'

import { FormComponent } from '../../src/runtime/components'
import { CORE_SERVICES, createComponentServices } from '../../src/runtime/components/lib/component-services'
import { createComponentModules } from '../../src/runtime/components/lib/component-modules'
import { PlayerFacade } from '../../src/player/create-player'
import type { ItemDoc } from '../../src/runtime/types'
import type { SceneDoc } from '../../src/player/types'

/**
 * Creates one generic form item used by the component test.
 */
function createFormItemFixture(): ItemDoc {
  return {
    id: 'story-main__form',
    name: 'form',
    storyId: 'story-main',
    type: 'form',
    initial: {
      questionIndex: 2,
      title: 'Question',
      hint: 'Answer the question',
      validateLabel: 'Valider',
      nextLabel: 'Suivant',
      resultMessage: 'Correct',
      canValidate: false,
      showResult: false,
      showNext: false
    },
    actions: {
      'story-main__form': null
    }
  }
}

/**
 * Creates one simple scene fixture that mounts one generic form component.
 */
function createFormSceneFixture(): SceneDoc {
  return {
    id: 'scene-form',
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        entries: ['story-main__form'],
        initial: undefined,
        persos: [createFormItemFixture()],
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
 * Creates one standalone form component instance for direct rendering checks.
 */
function createStandaloneFormComponent(emitRuntimeEvent = vi.fn()) {
  const services = createComponentServices(new Map(Object.entries(CORE_SERVICES)))
  const modules = createComponentModules()

  return new FormComponent({
    perso: createFormItemFixture(),
    createElementOptions: {
      emitRuntimeEvent,
      getCurrentTimelineMs: () => 0
    },
    report: vi.fn(),
    services,
    modules
  })
}

describe('V1 - form runtime', () => {
  it('renders a generic form shell and updates its visible state', () => {
    const component = createStandaloneFormComponent()

    component._init()

    const root = component.node as HTMLFormElement | null
    const title = (component as unknown as { getPart: (partId: string) => unknown | null }).getPart('title') as HTMLElement | null
    const hint = (component as unknown as { getPart: (partId: string) => unknown | null }).getPart('hint') as HTMLElement | null
    const validate = (component as unknown as { getPart: (partId: string) => unknown | null }).getPart('validate') as HTMLButtonElement | null
    const next = (component as unknown as { getPart: (partId: string) => unknown | null }).getPart('next') as HTMLButtonElement | null
    const result = (component as unknown as { getPart: (partId: string) => unknown | null }).getPart('result') as HTMLElement | null

    expect(root).not.toBeNull()
    expect(root?.tagName.toLowerCase()).toBe('form')
    expect(root?.id).toBe('story-main__form')
    expect(root?.className).toContain('form--idle')
    expect(title?.textContent).toBe('Question')
    expect(hint?.textContent).toBe('Answer the question')
    expect(validate?.textContent).toBe('Valider')
    expect(validate?.disabled).toBe(true)
    expect(next?.textContent).toBe('Suivant')
    expect(next?.hidden).toBe(true)
    expect(result?.textContent).toBe('')
    expect(result?.hidden).toBe(true)

    component.update({
      persoId: 'story-main__form',
      eventId: 'evt-1',
      eventSeq: 1,
      action: {
        questionIndex: 2,
        title: 'Question',
        hint: 'Answer the question',
        validateLabel: 'Valider',
        nextLabel: 'Suivant',
        resultMessage: 'Correct',
        canValidate: true,
        showResult: true,
        showNext: true
      }
    })

    expect(root?.className).toContain('form--show-next')
    expect(root?.className).toContain('form--show-result')
    expect(validate?.disabled).toBe(false)
    expect(next?.hidden).toBe(false)
    expect(result?.textContent).toBe('Correct')
    expect(result?.hidden).toBe(false)
  })

  it('collects native form state and emits live change and submit events', () => {
    const emitRuntimeEvent = vi.fn()
    const component = createStandaloneFormComponent(emitRuntimeEvent)

    component._init()

    const root = component.node as HTMLFormElement | null
    const answers = (component as unknown as { getPart: (partId: string) => unknown | null }).getPart('answers') as HTMLElement | null
    const validate = (component as unknown as { getPart: (partId: string) => unknown | null }).getPart('validate') as HTMLButtonElement | null

    expect(root).not.toBeNull()
    expect(answers).not.toBeNull()

    const answerField = document.createElement('input')
    answerField.type = 'text'
    answerField.name = 'answer'
    answerField.value = 'blue'
    answers?.appendChild(answerField)

    answerField.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))

    expect(validate?.disabled).toBe(false)
    expect(emitRuntimeEvent).toHaveBeenCalledWith(expect.objectContaining({ name: 'native:form:change' }))
    expect(emitRuntimeEvent.mock.calls[0]?.[0]?.data).toMatchObject({
      questionIndex: 2,
      selectedAnswerIds: [],
      values: {
        answer: 'blue'
      }
    })

    root?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    expect(emitRuntimeEvent).toHaveBeenCalledWith(expect.objectContaining({ name: 'native:form:submit' }))
  })

  it('mounts the built-in form component through the player bootstrap', async () => {
    const player = new PlayerFacade()

    expect(await player.init(createFormSceneFixture())).toEqual({ ok: true })

    const root = player.getRuntimeRegistry().getNodeById('story-main__form') as HTMLFormElement | null
    const validate = root?.querySelector('button[type="submit"]') as HTMLButtonElement | null
    const next = root?.querySelector('button[type="button"]') as HTMLButtonElement | null

    expect(root).not.toBeNull()
    expect(root?.tagName.toLowerCase()).toBe('form')
    expect(root?.id).toBe('story-main__form')
    expect(validate?.textContent).toBe('Valider')
    expect(next?.textContent).toBe('Suivant')
  })
})
