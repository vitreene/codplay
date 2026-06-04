// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'

import { BuilderFacade } from '../../src/builder/create-builder'
import { createQuizQuestionScene, quizQuestionStraps, type ResolvedQuizQuestion } from '../../src/demos/scenes'
import { Player } from '../../src/player'

/**
 * Creates one resolved single-choice quiz question fixture.
 */
function createQuestionFixture(): ResolvedQuizQuestion {
  return {
    index: 1,
    type: 'single',
    prompt: 'Which answer is correct?',
    answers: [
      { id: 'a', label: 'Alpha', isCorrect: true },
      { id: 'b', label: 'Beta', isCorrect: false }
    ],
    labels: {
      validate: 'Valider',
      next: 'Suivant',
      correct: 'Correct',
      incorrect: 'Incorrect',
      multipleHint: 'Plusieurs reponses possibles'
    }
  }
}

/**
 * Creates one reusable strap harness for the quiz question scene.
 */
function createStrapHarness() {
  return {
    planned: {
      wait: vi.fn(),
      delay: vi.fn(),
      repeat: vi.fn(),
      loop: vi.fn(),
      stagger: vi.fn()
    },
    live: {
      wait: vi.fn(),
      delay: vi.fn(),
      repeat: vi.fn(),
      loop: vi.fn(),
      stagger: vi.fn()
    }
  }
}

describe('V1 - quiz question runtime', () => {
  it('updates selection and resolves a correct answer through straps', async () => {
    const question = createQuestionFixture()

    const selectResult = await quizQuestionStraps['quiz-question-select']({
      event: {
        name: 'quiz:question:answer:select',
        data: {
          answerId: 'a'
        }
      },
      state: { question, selectedAnswerIds: [], retryCount: 0 },
      meta: { originEventName: 'quiz:question:answer:select' },
      context: {
        api: { getPersoIdAt: vi.fn() },
        planned: createStrapHarness().planned,
        live: createStrapHarness().live
      }
    })

    expect(selectResult).toEqual({
      update: {
        selectedAnswerIds: ['a'],
        resolved: undefined,
        retryCount: 0
      },
      events: [
        {
          name: 'quiz:question:selection:available',
          data: {
            selectedAnswerIds: ['a']
          }
        },
        {
          name: 'quiz:question:answer:a:selected'
        },
        {
          name: 'quiz:question:answer:b:idle'
        }
      ]
    })

    const result = await quizQuestionStraps['quiz-question-submit']({
      event: {
        name: 'quiz:question:validate'
      },
      state: { question, selectedAnswerIds: ['a'], retryCount: 0 },
      meta: { originEventName: 'quiz:question:validate' },
      context: {
        api: { getPersoIdAt: vi.fn() },
        planned: createStrapHarness().planned,
        live: createStrapHarness().live
      }
    })

    expect(result).toEqual({
      update: {
        selectedAnswerIds: ['a'],
        revealed: {
          questionIndex: 1,
          selectedAnswerIds: ['a'],
          correctAnswerIds: ['a'],
          isCorrect: true
        },
        resolved: {
          questionIndex: 1,
          selectedAnswerIds: ['a'],
          correctAnswerIds: ['a'],
          isCorrect: true
        },
        disabled: true,
        retryCount: 0
      },
      events: [
        {
          name: 'quiz:question:answered',
          data: {
            questionIndex: 1,
            selectedAnswerIds: ['a'],
            correctAnswerIds: ['a'],
            isCorrect: true
          }
        },
        {
          name: 'quiz:question:resolved',
          data: {
            questionIndex: 1,
            selectedAnswerIds: ['a'],
            correctAnswerIds: ['a'],
            isCorrect: true,
            showCorrection: true,
            disableAnswers: true
          }
        },
        {
          name: 'quiz:question:resolved:correct',
          data: {
            questionIndex: 1,
            selectedAnswerIds: ['a'],
            correctAnswerIds: ['a'],
            isCorrect: true
          }
        },
        {
          name: 'quiz:question:answer:a:revealed-correct'
        },
        {
          name: 'quiz:question:answer:b:locked'
        }
      ]
    })
  })

  it('resolves an incorrect answer into the expected quiz events', async () => {
    const question = createQuestionFixture()

    const selectResult = await quizQuestionStraps['quiz-question-select']({
      event: {
        name: 'quiz:question:answer:select',
        data: {
          answerId: 'b'
        }
      },
      state: { question, selectedAnswerIds: [], retryCount: 0 },
      meta: { originEventName: 'quiz:question:answer:select' },
      context: {
        api: { getPersoIdAt: vi.fn() },
        planned: createStrapHarness().planned,
        live: createStrapHarness().live
      }
    })

    expect(selectResult).toMatchObject({
      events: [
        expect.objectContaining({
          name: 'quiz:question:selection:available',
          data: {
            selectedAnswerIds: ['b']
          }
        }),
        expect.objectContaining({ name: 'quiz:question:answer:a:idle' }),
        expect.objectContaining({ name: 'quiz:question:answer:b:selected' })
      ]
    })

    const result = await quizQuestionStraps['quiz-question-submit']({
      event: {
        name: 'quiz:question:validate'
      },
      state: { question, selectedAnswerIds: ['b'], retryCount: 0 },
      meta: { originEventName: 'quiz:question:validate' },
      context: {
        api: { getPersoIdAt: vi.fn() },
        planned: createStrapHarness().planned,
        live: createStrapHarness().live
      }
    })

    expect(result).toMatchObject({
      events: [
        expect.objectContaining({ name: 'quiz:question:answered' }),
        expect.objectContaining({ name: 'quiz:question:resolved' }),
        expect.objectContaining({ name: 'quiz:question:resolved:incorrect' }),
        expect.objectContaining({ name: 'quiz:question:answer:a:revealed-missed-correct' }),
        expect.objectContaining({ name: 'quiz:question:answer:b:revealed-incorrect' })
      ]
    })
  })

  it('renders the question scene without form and updates it from selection events', async () => {
    const question = createQuestionFixture()

    const builder = new BuilderFacade()
    const compileResult = builder.compile({ scene: createQuizQuestionScene(question) })

    expect(compileResult.ok).toBe(true)
    if (!compileResult.ok) {
      return
    }

    const player = new Player()
    const replayTraces: string[] = []
    const unsubscribeTrace = player.onTrace((row) => {
      if (row.eventName === 'player:apply-materialized-event' || row.eventName === 'player:seek:replay:event') {
        replayTraces.push(`${row.eventName}:${String((row.payload as Record<string, unknown> | undefined)?.eventName ?? '')}`)
      }
    })
    expect(
      await player.init({
        mountTarget: document.createElement('div'),
        compiledScene: compileResult.data.compiledScene,
        resourceManifest: compileResult.data.resourceManifest,
        strapCollection: quizQuestionStraps
      })
    ).toEqual({ ok: true, data: undefined })
    expect(await player.play()).toEqual({ ok: true, data: undefined })

    const registry = player.getRuntimeRegistry()
    const panel = registry.getNodeById('quiz-question-panel') as HTMLFieldSetElement | null
    const title = registry.getNodeById('quiz-question-title') as HTMLElement | null
    const hint = registry.getNodeById('quiz-question-hint') as HTMLElement | null
    const titleOutlet = registry.getNodeById('quiz-question:title') as HTMLElement | null
    const hintOutlet = registry.getNodeById('quiz-question:hint') as HTMLElement | null
    const answersOutlet = registry.getNodeById('quiz-question:answers') as HTMLElement | null
    const controlsOutlet = registry.getNodeById('quiz-question:controls') as HTMLElement | null
    const resultOutlet = registry.getNodeById('quiz-question:result') as HTMLElement | null
    const nextOutlet = registry.getNodeById('quiz-question:next') as HTMLElement | null
    const validate = registry.getNodeById('quiz-question-validate') as HTMLButtonElement | null
    const firstAnswer = registry.getNodeById('quiz-question-1__answer-a') as HTMLLabelElement | null
    const secondAnswer = registry.getNodeById('quiz-question-1__answer-b') as HTMLLabelElement | null
    const firstSelectionIcon = registry.getNodeById('quiz-question-1__answer-a__selection-icon') as HTMLElement | null
    const secondSelectionIcon = registry.getNodeById('quiz-question-1__answer-b__selection-icon') as HTMLElement | null
    const firstCorrectionIcon = registry.getNodeById('quiz-question-1__answer-a__correction-icon') as HTMLElement | null
    const secondCorrectionIcon = registry.getNodeById('quiz-question-1__answer-b__correction-icon') as HTMLElement | null
    const firstAnswerControl = firstAnswer?.querySelector('input') as HTMLInputElement | null
    const secondAnswerControl = secondAnswer?.querySelector('input') as HTMLInputElement | null
    const result = registry.getNodeById('quiz-question-result') as HTMLElement | null
    const next = registry.getNodeById('quiz-question-next') as HTMLButtonElement | null

    expect(panel).not.toBeNull()
    expect(title?.textContent).toBe('Which answer is correct?')
    expect(hint?.textContent).toBe('')
    expect(panel?.disabled).toBe(false)
    expect(validate?.textContent).toBe('Valider')
    expect(validate?.disabled).toBe(true)
    expect(next?.textContent).toBe('Suivant')
    expect(next?.hidden).toBe(true)
    expect(result?.textContent).toBe('')
    expect(result?.hidden).toBe(true)
    expect(panel?.children[0]).toBe(titleOutlet)
    expect(panel?.children[1]).toBe(hintOutlet)
    expect(panel?.children[2]).toBe(answersOutlet)
    expect(panel?.children[3]).toBe(controlsOutlet)
    expect(panel?.children[4]).toBe(resultOutlet)
    expect(panel?.children[5]).toBe(nextOutlet)
    expect(titleOutlet?.parentNode).toBe(panel)
    expect(hintOutlet?.parentNode).toBe(panel)
    expect(firstAnswer?.parentNode).toBe(answersOutlet)
    expect(result?.parentNode).toBe(resultOutlet)
    expect(firstAnswerControl?.type).toBe('radio')
    expect(firstAnswerControl?.name).toBe('quiz-question-1-answer')
    expect(validate?.parentNode).toBe(controlsOutlet)
    expect(next?.parentNode).toBe(nextOutlet)
    expect(firstSelectionIcon?.parentNode?.parentNode).toBe(firstAnswer)
    expect(secondSelectionIcon?.parentNode?.parentNode).toBe(secondAnswer)
    expect(firstCorrectionIcon?.parentNode?.parentNode).toBe(firstAnswer)
    expect(secondCorrectionIcon?.parentNode?.parentNode).toBe(secondAnswer)

    await player.emit({
      name: 'quiz:question:answer:select',
      scopeStoryId: 'quiz-question-story',
      ms: 0,
      data: {
        answerId: 'b'
      }
    })

    await player.emit({
      name: 'quiz:question:validate',
      scopeStoryId: 'quiz-question-story',
      ms: 0
    })

    await new Promise((resolve) => setTimeout(resolve, 0))

    const refreshedRegistry = player.getRuntimeRegistry()
    const refreshedFirstAnswer = refreshedRegistry.getNodeById('quiz-question-1__answer-a') as HTMLLabelElement | null
    const refreshedSecondAnswer = refreshedRegistry.getNodeById('quiz-question-1__answer-b') as HTMLLabelElement | null
    const refreshedFirstSelectionIcon = refreshedRegistry.getNodeById('quiz-question-1__answer-a__selection-icon') as HTMLElement | null
    const refreshedSecondSelectionIcon = refreshedRegistry.getNodeById('quiz-question-1__answer-b__selection-icon') as HTMLElement | null
    const refreshedFirstCorrectionIcon = refreshedRegistry.getNodeById('quiz-question-1__answer-a__correction-icon') as HTMLElement | null
    const refreshedSecondCorrectionIcon = refreshedRegistry.getNodeById('quiz-question-1__answer-b__correction-icon') as HTMLElement | null
    const refreshedFirstAnswerControl = refreshedFirstAnswer?.querySelector('input') as HTMLInputElement | null
    const refreshedSecondAnswerControl = refreshedSecondAnswer?.querySelector('input') as HTMLInputElement | null
    const refreshedResult = refreshedRegistry.getNodeById('quiz-question-result') as HTMLElement | null
    const refreshedNext = refreshedRegistry.getNodeById('quiz-question-next') as HTMLButtonElement | null
    const refreshedFieldset = refreshedRegistry.getNodeById('quiz-question-panel') as HTMLFieldSetElement | null
    const refreshedAnswersOutlet = refreshedRegistry.getNodeById('quiz-question:answers') as HTMLElement | null
    const refreshedControlsOutlet = refreshedRegistry.getNodeById('quiz-question:controls') as HTMLElement | null
    const refreshedResultOutlet = refreshedRegistry.getNodeById('quiz-question:result') as HTMLElement | null
    const refreshedNextOutlet = refreshedRegistry.getNodeById('quiz-question:next') as HTMLElement | null

    expect(refreshedResult).not.toBeNull()
    expect(refreshedNext).not.toBeNull()
    expect(refreshedFirstAnswer).not.toBeNull()
    expect(refreshedSecondAnswer).not.toBeNull()
    expect(refreshedFirstAnswer?.className).toContain('input--revealed-missed-correct')
    expect(refreshedSecondAnswer?.className).toContain('input--revealed-incorrect')
    expect(refreshedFirstSelectionIcon?.textContent).toBe('')
    expect(refreshedSecondSelectionIcon?.textContent).toBe('•')
    expect(refreshedFirstCorrectionIcon?.textContent).toBe('+')
    expect(refreshedSecondCorrectionIcon?.textContent).toBe('-')
    expect(refreshedFirstAnswerControl?.checked).toBe(false)
    expect(refreshedSecondAnswerControl?.checked).toBe(true)
    expect(refreshedFieldset?.disabled).toBe(true)
    expect(refreshedFirstAnswer?.parentNode).toBe(refreshedAnswersOutlet)
    expect(refreshedSecondAnswer?.parentNode).toBe(refreshedAnswersOutlet)
    expect(refreshedResult?.parentNode).toBe(refreshedResultOutlet)
    expect(refreshedNext?.parentNode).toBe(refreshedNextOutlet)
    expect(refreshedRegistry.getNodeById('quiz-question-validate')?.parentNode).toBe(refreshedControlsOutlet)
  })

  it('replays the validated state on seek', async () => {
    const builder = new BuilderFacade()
    const compileResult = builder.compile({ scene: createQuizQuestionScene(createQuestionFixture()) })
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const replayTraces: string[] = []

    expect(compileResult.ok).toBe(true)
    if (!compileResult.ok) {
      return
    }

    const player = new Player()
    expect(
      await player.init({
        mountTarget: document.createElement('div'),
        compiledScene: compileResult.data.compiledScene,
        resourceManifest: compileResult.data.resourceManifest,
        strapCollection: quizQuestionStraps
      })
    ).toEqual({ ok: true, data: undefined })

    const unsubscribeTrace = player.onTrace((row) => {
      if (row.eventName === 'player:seek:replay:event') {
        replayTraces.push(`${row.eventName}:${String((row.payload as Record<string, unknown> | undefined)?.eventName ?? '')}`)
      }
    })

    expect(await player.play()).toEqual({ ok: true, data: undefined })

    expect(
      await player.emit({
        name: 'quiz:question:answer:select',
        scopeStoryId: 'quiz-question-story',
        ms: 100,
        data: {
          answerId: 'b'
        }
      })
    ).toEqual({ ok: true, data: undefined })

    expect(
      await player.emit({
        name: 'quiz:question:validate',
        scopeStoryId: 'quiz-question-story',
        ms: 200
      })
    ).toEqual({ ok: true, data: undefined })

    expect(consoleSpy).toHaveBeenCalledWith(
      '[quiz-question-aggregate]',
      expect.objectContaining({
        answeredCount: 1,
        correctCount: 0,
        lastQuestionIndex: 1,
        lastResult: false
      })
    )

    expect(await player.seek({ timelineMs: 250 })).toEqual({ ok: true, data: undefined })
    expect(replayTraces).toContain('player:seek:replay:event:runtime:state:update')
    expect(replayTraces).toContain('player:seek:replay:event:quiz:question:validate')
    expect(replayTraces.indexOf('player:seek:replay:event:runtime:state:update')).toBeLessThan(
      replayTraces.indexOf('player:seek:replay:event:quiz:question:validate')
    )

    await new Promise((resolve) => setTimeout(resolve, 0))

    let registry = player.getRuntimeRegistry()
    let validate = registry.getNodeById('quiz-question-validate') as HTMLButtonElement | null
    let next = registry.getNodeById('quiz-question-next') as HTMLButtonElement | null
    let result = registry.getNodeById('quiz-question-result') as HTMLElement | null
    let fieldset = registry.getNodeById('quiz-question-panel') as HTMLFieldSetElement | null
    let correctAnswer = registry.getNodeById('quiz-question-1__answer-a') as HTMLLabelElement | null
    let wrongAnswer = registry.getNodeById('quiz-question-1__answer-b') as HTMLLabelElement | null
    let correctControl = correctAnswer?.querySelector('input') as HTMLInputElement | null
    let wrongControl = wrongAnswer?.querySelector('input') as HTMLInputElement | null

    expect(validate?.disabled).toBe(true)
    expect(next?.hidden).toBe(false)
    expect(result?.textContent).toBe('Incorrect')
    expect(result?.hidden).toBe(false)
    expect(fieldset?.disabled).toBe(true)
    expect(correctAnswer?.className).toContain('input--revealed-missed-correct')
    expect(wrongAnswer?.className).toContain('input--revealed-incorrect')
    expect(correctControl?.checked).toBe(false)
    expect(wrongControl?.checked).toBe(true)

    consoleSpy.mockRestore()
    expect(await player.seek({ timelineMs: 100 })).toEqual({ ok: true, data: undefined })

    await new Promise((resolve) => setTimeout(resolve, 0))

    registry = player.getRuntimeRegistry()
    validate = registry.getNodeById('quiz-question-validate') as HTMLButtonElement | null
    next = registry.getNodeById('quiz-question-next') as HTMLButtonElement | null
    result = registry.getNodeById('quiz-question-result') as HTMLElement | null
    fieldset = registry.getNodeById('quiz-question-panel') as HTMLFieldSetElement | null
    correctAnswer = registry.getNodeById('quiz-question-1__answer-a') as HTMLLabelElement | null
    wrongAnswer = registry.getNodeById('quiz-question-1__answer-b') as HTMLLabelElement | null
    correctControl = correctAnswer?.querySelector('input') as HTMLInputElement | null
    wrongControl = wrongAnswer?.querySelector('input') as HTMLInputElement | null

    expect(validate?.disabled).toBe(false)
    expect(next?.hidden).toBe(true)
    expect(result?.textContent).toBe('')
    expect(result?.hidden).toBe(true)
    expect(fieldset?.disabled).toBe(false)
    expect(correctControl?.checked).toBe(false)
    expect(wrongControl?.checked).toBe(true)

    unsubscribeTrace()

    expect(await player.seek({ timelineMs: 250 })).toEqual({ ok: true, data: undefined })

    await new Promise((resolve) => setTimeout(resolve, 0))

    registry = player.getRuntimeRegistry()
    validate = registry.getNodeById('quiz-question-validate') as HTMLButtonElement | null
    next = registry.getNodeById('quiz-question-next') as HTMLButtonElement | null
    result = registry.getNodeById('quiz-question-result') as HTMLElement | null
    fieldset = registry.getNodeById('quiz-question-panel') as HTMLFieldSetElement | null
    correctAnswer = registry.getNodeById('quiz-question-1__answer-a') as HTMLLabelElement | null
    wrongAnswer = registry.getNodeById('quiz-question-1__answer-b') as HTMLLabelElement | null
    correctControl = correctAnswer?.querySelector('input') as HTMLInputElement | null
    wrongControl = wrongAnswer?.querySelector('input') as HTMLInputElement | null

    expect(validate?.disabled).toBe(true)
    expect(next?.hidden).toBe(false)
    expect(result?.textContent).toBe('Incorrect')
    expect(result?.hidden).toBe(false)
    expect(fieldset?.disabled).toBe(true)
    expect(correctAnswer?.className).toContain('input--revealed-missed-correct')
    expect(wrongAnswer?.className).toContain('input--revealed-incorrect')
    expect(correctControl?.checked).toBe(false)
    expect(wrongControl?.checked).toBe(true)
    unsubscribeTrace()
  })

  it('observes the validation boundary at 199 200 201ms', async () => {
    const builder = new BuilderFacade()
    const compileResult = builder.compile({ scene: createQuizQuestionScene(createQuestionFixture()) })

    expect(compileResult.ok).toBe(true)
    if (!compileResult.ok) {
      return
    }

    const player = new Player()
    expect(
      await player.init({
        mountTarget: document.createElement('div'),
        compiledScene: compileResult.data.compiledScene,
        resourceManifest: compileResult.data.resourceManifest,
        strapCollection: quizQuestionStraps
      })
    ).toEqual({ ok: true, data: undefined })

    expect(await player.play()).toEqual({ ok: true, data: undefined })

    expect(
      await player.emit({
        name: 'quiz:question:answer:select',
        scopeStoryId: 'quiz-question-story',
        ms: 190,
        data: {
          answerId: 'b'
        }
      })
    ).toEqual({ ok: true, data: undefined })

    expect(
      await player.emit({
        name: 'quiz:question:validate',
        scopeStoryId: 'quiz-question-story',
        ms: 200
      })
    ).toEqual({ ok: true, data: undefined })

    const readSnapshot = () => {
      const registry = player.getRuntimeRegistry()
      const validate = registry.getNodeById('quiz-question-validate') as HTMLButtonElement | null
      const next = registry.getNodeById('quiz-question-next') as HTMLButtonElement | null
      const result = registry.getNodeById('quiz-question-result') as HTMLElement | null

      return {
        validateDisabled: validate?.disabled ?? null,
        nextHidden: next?.hidden ?? null,
        resultText: result?.textContent ?? null,
        resultHidden: result?.hidden ?? null
      }
    }

    expect(await player.seek({ timelineMs: 199 })).toEqual({ ok: true, data: undefined })
    await new Promise((resolve) => setTimeout(resolve, 0))
    const snapshot199 = readSnapshot()

    expect(await player.seek({ timelineMs: 200 })).toEqual({ ok: true, data: undefined })
    await new Promise((resolve) => setTimeout(resolve, 0))
    const snapshot200 = readSnapshot()

    expect(await player.seek({ timelineMs: 201 })).toEqual({ ok: true, data: undefined })
    await new Promise((resolve) => setTimeout(resolve, 0))
    const snapshot201 = readSnapshot()

    expect(snapshot199.resultHidden).toBe(true)
    expect(snapshot200.resultHidden).toBe(false)
    expect(snapshot201.resultHidden).toBe(false)
  })
})
