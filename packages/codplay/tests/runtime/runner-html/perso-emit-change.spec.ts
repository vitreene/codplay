/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../src/runtime/runner-html'
import { SceneBuilder } from '../../../src/scene/compiled'
import type { SceneDoc } from '../../../src/scene/types'

/** Declares one input perso whose DOM `change` emits an event carrying its own value. */
function createChangeEmitScene(): SceneDoc<string> {
  return {
    id: 'perso-emit-change-scene',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'answer',
          type: 'input',
          initial: {
            move: '@root',
            inputType: 'radio',
            name: 'choice',
            value: 'vrai',
            label: 'Vrai',
            hint: '',
            checked: false,
            disabled: false,
            visualState: 'idle',
          },
          actions: {},
          emit: { change: { event: { name: 'answer:select', data: { answerId: 'vrai' } } } },
        }],
        eventimes: [],
      },
    },
  }
}

describe('Perso.emit change on an input', () => {
  let runner: HtmlPlayerRunner | undefined

  afterEach(() => {
    runner?.destroy()
    runner = undefined
    document.body.replaceChildren()
  })

  it('journals the authored data with the input value and the DOM context', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot(), { createdAt: '2026-11-27T00:00:00.000Z' })
      .build(createChangeEmitScene())
    expect(build.ok).toBe(true)
    if (!build.ok) return
    runner = new HtmlPlayerRunner({
      id: 'perso-emit-change-test',
      compiledScene: build.compiledScene,
      root,
      catalog,
      functions: build.functions,
      ticker: { start: () => undefined, stop: () => undefined, isRunning: () => false },
    })
    expect(runner.init().ok).toBe(true)
    runner.play()

    const input = root.querySelector('input')!
    input.click()
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))

    const selection = runner.player.trackJournal.getAllEvents().find((event) => event.name === 'answer:select')
    expect(selection).toMatchObject({
      data: { answerId: 'vrai', value: 'vrai' },
      context: { source: 'dom', userEvent: 'change', persoId: 'answer' },
    })
    expect(selection?.data).not.toHaveProperty('self')
  })
})
