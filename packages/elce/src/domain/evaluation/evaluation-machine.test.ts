import { describe, expect, it } from 'vitest'
import { EVALUATION_RETRY_SCOPE } from './evaluation-machine-types'
import type {
  EvaluationAnswer,
  EvaluationMachineState,
  EvaluationSettings,
} from './evaluation-machine-types'
import { EvaluationMachine } from './evaluation-machine'

describe('EvaluationMachine', () => {
  it('retries only incorrect Questions after failure without revealing answers', () => {
    const machine = new EvaluationMachine({
      questionIds: ['q1', 'q2', 'q3'],
      settings: settings({ retryScope: EVALUATION_RETRY_SCOPE.INCORRECT_QUESTIONS }),
    })
    let state = machine.transition(machine.initialState(), { type: 'START' })
    state = answer(machine, state, 'q1', ['a'], ['a'])
    state = answer(machine, state, 'q2', ['x'], ['b'])
    state = answer(machine, state, 'q3', ['y'], ['c'])
    state = machine.transition(state, { type: 'COMPLETE' })

    expect(state.value).toBe('failure')
    expect(state.context.result?.passed).toBe(false)
    expect(machine.shouldRevealAnswers(state)).toBe(false)

    const retry = machine.transition(state, { type: 'RETRY' })

    expect(retry.value).toBe('attempting')
    expect(retry.context.activeQuestionIds).toEqual(['q2', 'q3'])
    expect(retry.context.attempt).toBe(2)
    expect(retry.context.answers).toEqual({
      q1: { questionId: 'q1', selectedAnswerIds: ['a'], expectedAnswerIds: ['a'] },
    })
    expect(retry.context.result).toBeNull()
    expect(machine.shouldRevealAnswers(retry)).toBe(false)

    state = answer(machine, retry, 'q2', ['b'], ['b'])
    state = answer(machine, state, 'q3', ['c'], ['c'])
    state = machine.transition(state, { type: 'COMPLETE' })

    expect(state.value).toBe('success')
    expect(state.context.result).toEqual({ questionCount: 3, correctCount: 3, score: 1, passed: true })
  })

  it('retries all Questions when that scope is configured', () => {
    const machine = new EvaluationMachine({
      questionIds: ['q1', 'q2'],
      settings: settings({ retryScope: EVALUATION_RETRY_SCOPE.ALL_QUESTIONS }),
    })
    let state = machine.transition(machine.initialState(), { type: 'START' })
    state = answer(machine, state, 'q1', ['a'], ['a'])
    state = answer(machine, state, 'q2', ['x'], ['b'])
    state = machine.transition(state, { type: 'COMPLETE' })

    const retry = machine.transition(state, { type: 'RETRY' })

    expect(retry.context.activeQuestionIds).toEqual(['q1', 'q2'])
    expect(retry.context.answers).toEqual({})
  })

  it('makes all questions and their answers available only on a successful replay', () => {
    const machine = new EvaluationMachine({
      questionIds: ['q1', 'q2'],
      settings: settings(),
    })
    let state = machine.transition(machine.initialState(), { type: 'START' })
    state = answer(machine, state, 'q1', ['a'], ['a'])
    state = answer(machine, state, 'q2', ['b'], ['b'])
    state = machine.transition(state, { type: 'COMPLETE' })

    expect(state.value).toBe('success')
    expect(state.context.activeQuestionIds).toEqual([])
    expect(machine.shouldRevealAnswers(state)).toBe(false)

    state = machine.transition(state, { type: 'SUCCESS.REPLAY' })

    expect(state.value).toBe('reviewing')
    expect(state.context.activeQuestionIds).toEqual(['q1', 'q2'])
    expect(state.context.answers).toEqual({
      q1: { questionId: 'q1', selectedAnswerIds: ['a'], expectedAnswerIds: ['a'] },
      q2: { questionId: 'q2', selectedAnswerIds: ['b'], expectedAnswerIds: ['b'] },
    })
    expect(machine.shouldRevealAnswers(state)).toBe(true)

    state = machine.transition(state, { type: 'REPLAY.COMPLETE' })

    expect(state.value).toBe('success')
    expect(state.context.activeQuestionIds).toEqual([])
    expect(machine.shouldRevealAnswers(state)).toBe(false)
  })

  it('does not allow the successful replay action to reveal answers after failure', () => {
    const machine = new EvaluationMachine({
      questionIds: ['q1'],
      settings: settings(),
    })
    let state = machine.transition(machine.initialState(), { type: 'START' })
    state = answer(machine, state, 'q1', ['x'], ['a'])
    state = machine.transition(state, { type: 'COMPLETE' })

    const replay = machine.transition(state, { type: 'SUCCESS.REPLAY' })

    expect(replay.value).toBe('failure')
    expect(machine.shouldRevealAnswers(replay)).toBe(false)
  })

  it('keeps a failed Evaluation closed when its configured attempt limit is reached', () => {
    const machine = new EvaluationMachine({
      questionIds: ['q1'],
      settings: settings({ attemptLimit: 1 }),
    })
    let state = machine.transition(machine.initialState(), { type: 'START' })
    state = answer(machine, state, 'q1', ['x'], ['a'])
    state = machine.transition(state, { type: 'COMPLETE' })

    const retry = machine.transition(state, { type: 'RETRY' })

    expect(retry.value).toBe('failure')
    expect(retry.context.attempt).toBe(1)
  })

  it('continues from a JSON-serializable state', () => {
    const machine = new EvaluationMachine({
      questionIds: ['q1'],
      settings: settings(),
    })
    const initial = machine.transition(machine.initialState(), { type: 'START' })
    const restored = JSON.parse(JSON.stringify(initial)) as EvaluationMachineState

    const next = answer(machine, restored, 'q1', ['a'], ['a'])

    expect(next.value).toBe('attempting')
    expect(next.context.answers.q1.selectedAnswerIds).toEqual(['a'])
  })
})

/** Creates the Evaluation defaults used by these transition tests. */
function settings(overrides: Partial<EvaluationSettings> = {}): EvaluationSettings {
  return {
    threshold: 0.8,
    attemptLimit: null,
    retryScope: EVALUATION_RETRY_SCOPE.ALL_QUESTIONS,
    ...overrides,
  }
}

/** Sends one validated answer through the Evaluation machine. */
function answer(
  machine: EvaluationMachine,
  state: ReturnType<EvaluationMachine['initialState']>,
  questionId: string,
  selectedAnswerIds: readonly string[],
  expectedAnswerIds: readonly string[],
) {
  const value: EvaluationAnswer = { questionId, selectedAnswerIds, expectedAnswerIds }
  return machine.transition(state, { type: 'QUESTION.ANSWERED', answer: value })
}
