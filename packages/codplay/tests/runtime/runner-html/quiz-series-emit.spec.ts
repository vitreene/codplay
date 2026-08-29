/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../src/runtime/runner-html'
import { SceneBuilder } from '../../../src/scene/compiled'
import { createScene } from '../../../../demos/src/v2/demos/quiz-series/main'

describe('quiz-series Perso.emit integration', () => {
  let runner: HtmlPlayerRunner | undefined

  afterEach(() => {
    runner?.destroy()
    runner = undefined
    document.body.replaceChildren()
  })

  it('routes the real input change through the V2 runner and enables validation', async () => {
    const root = document.createElement('main')
    document.body.appendChild(root)
    const catalog = createCoreRuntimeCatalog()
    const diagnostics: Array<{ code: string; message: string }> = []
    const build = new SceneBuilder(catalog.validationSnapshot(), {
      createdAt: '2026-08-28T00:00:00.000Z',
    }).build(createScene())
    expect(build.ok).toBe(true)
    if (!build.ok) return

    runner = new HtmlPlayerRunner({
      id: 'quiz-series-emit-test',
      compiledScene: build.compiledScene,
      root,
      rootTargets: [{ id: 'root-host', storyId: 'main' }],
      catalog,
      functions: build.functions,
      ticker: {
        start: () => undefined,
        stop: () => undefined,
        isRunning: () => false,
      },
      onEmitDiagnostic: (diagnostic) => diagnostics.push({ code: diagnostic.code, message: diagnostic.message }),
    })
    expect(runner.init().ok).toBe(true)

    const input = root.querySelector('input')
    const label = input?.closest('label')
    const validate = root.querySelector('button')
    expect(input).not.toBeNull()
    expect(label).not.toBeNull()
    expect(validate).not.toBeNull()
    expect(validate?.disabled).toBe(true)

    const nextBeforeInteraction = [...root.querySelectorAll('button')].find((button) => button.textContent === 'Suivant')
    expect(nextBeforeInteraction).not.toBeUndefined()
    const nextTextNode = nextBeforeInteraction?.firstChild
    const nextMutations: MutationRecord[] = []
    const nextObserver = new MutationObserver((records) => nextMutations.push(...records))
    if (nextBeforeInteraction !== undefined) nextObserver.observe(nextBeforeInteraction, { childList: true })

    runner.play()
    label?.click()
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))

    expect(validate?.disabled).toBe(false)
    const selection = runner.player.trackJournal.getAllEvents().find((event) => event.name === 'quiz-series-q0:answer:select')
    expect(selection).toMatchObject({
      data: {
        answerId: input?.value,
        value: input?.value,
      },
      context: {
        source: 'dom',
        userEvent: 'change',
        persoId: 'quiz-question-1__answer-vrai',
      },
    })
    expect(selection?.data).not.toHaveProperty('self')

    validate?.click()
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))

    expect(validate?.disabled).toBe(true)
    expect(runner.player.trackJournal.getAllEvents().some((event) => event.name === 'quiz-series-q0:resolved')).toBe(true)
    expect(runner.player.resolveSceneAt(runner.player.getCurrentTimeMs()).sceneState).toMatchObject({
      answeredCount: 1,
      correctCount: 1,
    })
    expect(root.querySelector('.quiz-series-progress span')?.textContent).toBe('1 / 3')

    const next = [...root.querySelectorAll('button')].find((button) => button.textContent === 'Suivant')
    expect(next).not.toBeUndefined()
    expect(next?.hidden).toBe(false)

    next?.click()
    await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
    runner.advance(0)
    runner.advance(400)

    expect(runner.player.trackJournal.getAllEvents().some((event) => event.name === 'quiz:question:next')).toBe(true)
    expect(runner.player.trackJournal.getAllEvents().some((event) => event.name === 'quiz:question:0:hide')).toBe(true)
    expect(runner.player.trackJournal.getAllEvents().some((event) => event.name === 'quiz:question:1:show')).toBe(true)
    const panels = [...root.querySelectorAll<HTMLElement>('.quiz-series-question-panel')]
    expect(panels[0]?.style.transform).toContain('translateX(-100%)')
    expect(panels[1]?.style.transform).toContain('translateX(0%)')
    expect(diagnostics).toEqual([])
    nextObserver.disconnect()
    expect(nextBeforeInteraction?.firstChild).toBe(nextTextNode)
    expect(nextMutations).toHaveLength(0)
  })
})
