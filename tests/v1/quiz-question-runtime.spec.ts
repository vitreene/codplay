// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'

import { BuilderFacade } from '../../src/builder/create-builder'
import { createQuizQuestionScene, quizQuestionStraps, type ResolvedQuizQuestion } from '../../src/demos/scenes'
import { Player } from '../../src/player'
import { PlayerFacade } from '../../src/player/create-player'

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
  it('resolves a correct answer into the expected quiz events', async () => {
    const question = createQuestionFixture()

    const result = await quizQuestionStraps['quiz-question-submit']({
      event: {
        name: 'native:form:submit',
        data: {
          questionIndex: question.index,
          values: { answer: 'a' },
          selectedAnswerIds: ['a'],
          canValidate: true
        }
      },
      state: { question },
      meta: { originEventName: 'native:form:submit' },
      context: {
        api: { getPersoIdAt: vi.fn() },
        planned: createStrapHarness().planned,
        live: createStrapHarness().live
      }
    })

    expect(result).toEqual({
      events: [
        {
          name: 'quiz:question:answered',
          data: {
            questionIndex: 1,
            selectedAnswerIds: ['a'],
            correctAnswerIds: ['a'],
            isCorrect: true,
            values: { answer: 'a' }
          }
        },
        {
          name: 'quiz:question:resolved',
          data: {
            questionIndex: 1,
            selectedAnswerIds: ['a'],
            correctAnswerIds: ['a'],
            isCorrect: true,
            values: { answer: 'a' }
          }
        },
        {
          name: 'quiz:question:resolved:correct',
          data: {
            questionIndex: 1,
            selectedAnswerIds: ['a'],
            correctAnswerIds: ['a'],
            isCorrect: true,
            values: { answer: 'a' }
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

    const result = await quizQuestionStraps['quiz-question-submit']({
      event: {
        name: 'native:form:submit',
        data: {
          questionIndex: question.index,
          values: { answer: 'b' },
          selectedAnswerIds: ['b'],
          canValidate: true
        }
      },
      state: { question },
      meta: { originEventName: 'native:form:submit' },
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

  it('renders the question form and updates it from native form events', async () => {
    const player = new PlayerFacade()
    const question = createQuestionFixture()

    expect(await player.init(createQuizQuestionScene(question))).toEqual({ ok: true })
    expect(await player.play()).toEqual({ ok: true, data: undefined })

    const registry = player.getRuntimeRegistry()
    const panel = registry.getNodeById('quiz-question-panel') as HTMLDivElement | null
    const form = registry.getNodeById('quiz-question-form') as HTMLFormElement | null
    const formComponent = registry.getComponentById('quiz-question-form') as unknown as {
      getPart: (partId: string) => unknown | null
    }
    const title = formComponent.getPart('title') as HTMLElement | null
    const hint = formComponent.getPart('hint') as HTMLElement | null
    const answers = formComponent.getPart('answers') as HTMLElement | null
    const validate = form?.querySelector('button[type="submit"]') as HTMLButtonElement | null
    const firstAnswer = registry.getNodeById('quiz-question-1__answer-a') as HTMLLabelElement | null
    const firstAnswerControl = firstAnswer?.querySelector('input') as HTMLInputElement | null
    const result = registry.getNodeById('quiz-question-result') as HTMLElement | null
    const next = registry.getNodeById('quiz-question-next') as HTMLButtonElement | null

    expect(panel).not.toBeNull()
    expect(form).not.toBeNull()
    expect(form?.className).toContain('form--idle')
    expect(title?.textContent).toBe('Which answer is correct?')
    expect(hint?.textContent).toBe('')
    expect(validate?.textContent).toBe('Valider')
    expect(validate?.disabled).toBe(true)
    expect(next?.textContent).toBe('Suivant')
    expect(next?.hidden).toBe(true)
    expect(result?.textContent).toBe('')
    expect(result?.hidden).toBe(true)
    expect(panel?.children[0]?.id).toBe('quiz-question-form')
    expect(panel?.children[1]?.id).toBe('quiz-question-result')
    expect(panel?.children[2]?.id).toBe('quiz-question-next')
    expect(firstAnswer?.id).toBe('quiz-question-1__answer-a')
    expect(firstAnswer?.parentNode).toBe(answers)
    expect(firstAnswerControl?.type).toBe('radio')
    expect(firstAnswerControl?.name).toBe('quiz-question-1-answer')

    if (firstAnswerControl !== null) {
      firstAnswerControl.checked = true
      firstAnswerControl.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }))
    }

    expect(validate?.disabled).toBe(false)
  })

  it('replays the validated state on seek', async () => {
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
        name: 'native:form:submit',
        scopeStoryId: 'quiz-question-story',
        ms: 200,
        data: {
          questionIndex: 1,
          values: { answer: 'b' },
          selectedAnswerIds: ['b'],
          canValidate: true
        }
      })
    ).toEqual({ ok: true, data: undefined })

    expect(await player.seek({ timelineMs: 250 })).toEqual({ ok: true, data: undefined })

    await new Promise((resolve) => setTimeout(resolve, 0))

    let registry = player.getRuntimeRegistry()
    let form = registry.getNodeById('quiz-question-form') as HTMLFormElement | null
    let validate = form?.querySelector('button[type="submit"]') as HTMLButtonElement | null
    let next = registry.getNodeById('quiz-question-next') as HTMLButtonElement | null
    let result = registry.getNodeById('quiz-question-result') as HTMLElement | null
    let correctAnswer = registry.getNodeById('quiz-question-1__answer-a') as HTMLLabelElement | null
    let wrongAnswer = registry.getNodeById('quiz-question-1__answer-b') as HTMLLabelElement | null
    let correctControl = correctAnswer?.querySelector('input') as HTMLInputElement | null
    let wrongControl = wrongAnswer?.querySelector('input') as HTMLInputElement | null
    expect(validate?.disabled).toBe(true)
    expect(next?.hidden).toBe(false)
    expect(result?.textContent).toBe('Incorrect')
    expect(result?.hidden).toBe(false)
    expect(correctAnswer?.className).toContain('input--revealed-missed-correct')
    expect(wrongAnswer?.className).toContain('input--revealed-incorrect')
    expect(correctControl?.disabled).toBe(true)
    expect(wrongControl?.disabled).toBe(true)
    expect(wrongControl?.checked).toBe(true)

    expect(await player.seek({ timelineMs: 100 })).toEqual({ ok: true, data: undefined })

    await new Promise((resolve) => setTimeout(resolve, 0))

    registry = player.getRuntimeRegistry()
    form = registry.getNodeById('quiz-question-form') as HTMLFormElement | null
    validate = form?.querySelector('button[type="submit"]') as HTMLButtonElement | null
    next = registry.getNodeById('quiz-question-next') as HTMLButtonElement | null
    result = registry.getNodeById('quiz-question-result') as HTMLElement | null
    expect(validate?.disabled).toBe(true)
    expect(next?.hidden).toBe(true)
    expect(result?.textContent).toBe('')
    expect(result?.hidden).toBe(true)

    expect(await player.seek({ timelineMs: 250 })).toEqual({ ok: true, data: undefined })

    await new Promise((resolve) => setTimeout(resolve, 0))

    registry = player.getRuntimeRegistry()
    form = registry.getNodeById('quiz-question-form') as HTMLFormElement | null
    validate = form?.querySelector('button[type="submit"]') as HTMLButtonElement | null
    next = registry.getNodeById('quiz-question-next') as HTMLButtonElement | null
    result = registry.getNodeById('quiz-question-result') as HTMLElement | null
    correctAnswer = registry.getNodeById('quiz-question-1__answer-a') as HTMLLabelElement | null
    wrongAnswer = registry.getNodeById('quiz-question-1__answer-b') as HTMLLabelElement | null
    correctControl = correctAnswer?.querySelector('input') as HTMLInputElement | null
    wrongControl = wrongAnswer?.querySelector('input') as HTMLInputElement | null
    expect(validate?.disabled).toBe(true)
    expect(next?.hidden).toBe(false)
    expect(result?.textContent).toBe('Incorrect')
    expect(result?.hidden).toBe(false)
    expect(correctAnswer?.className).toContain('input--revealed-missed-correct')
    expect(wrongAnswer?.className).toContain('input--revealed-incorrect')
    expect(correctControl?.disabled).toBe(true)
    expect(wrongControl?.disabled).toBe(true)
    expect(wrongControl?.checked).toBe(true)
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
        name: 'native:form:submit',
        scopeStoryId: 'quiz-question-story',
        ms: 200,
        data: {
          questionIndex: 1,
          values: { answer: 'b' },
          selectedAnswerIds: ['b'],
          canValidate: true
        }
      })
    ).toEqual({ ok: true, data: undefined })

    const readSnapshot = () => {
      const registry = player.getRuntimeRegistry()
      const form = registry.getNodeById('quiz-question-form') as HTMLFormElement | null
      const validate = form?.querySelector('button[type="submit"]') as HTMLButtonElement | null
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
