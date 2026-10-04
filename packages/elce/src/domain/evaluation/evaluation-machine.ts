import { assign, initialTransition, setup, transition } from 'xstate'
import { ElceChapterEvaluation } from '../chapter-evaluation'
import { EVALUATION_RETRY_SCOPE } from './evaluation-machine-types'
import type {
  EvaluationMachineContext,
  EvaluationMachineEvent,
  EvaluationMachineInput,
  EvaluationMachineState,
  EvaluationMachineValue,
  EvaluationResult,
} from './evaluation-machine-types'

const chapterEvaluation = new ElceChapterEvaluation()

const evaluationStateMachine = setup({
  types: {
    context: {} as EvaluationMachineContext,
    events: {} as EvaluationMachineEvent,
    input: {} as EvaluationMachineInput,
  },
  guards: {
    hasQuestions: ({ context }) => context.questionIds.length > 0,
    canAnswerActiveQuestion: ({ context, event }) => {
      switch (event.type) {
        case 'QUESTION.ANSWERED':
          return context.activeQuestionIds.includes(event.answer.questionId)
        default:
          return false
      }
    },
    meetsThreshold: ({ context }) => evaluateResult(context).passed === true,
    canRetry: ({ context }) => context.settings.attemptLimit === null
      || context.attempt < context.settings.attemptLimit,
  },
  actions: {
    startFirstAttempt: assign(({ context }) => ({
      activeQuestionIds: context.questionIds,
      attempt: 1,
    })),
    recordAnswer: assign(({ context, event }) => {
      switch (event.type) {
        case 'QUESTION.ANSWERED':
          return {
            answers: { ...context.answers, [event.answer.questionId]: event.answer },
            result: null,
          }
        default:
          return {}
      }
    }),
    storeResult: assign(({ context }) => ({
      activeQuestionIds: [],
      result: evaluateResult(context),
    })),
    startRetry: assign(({ context }) => retryContext(context)),
    startSuccessReview: assign(({ context }) => ({ activeQuestionIds: context.questionIds })),
    finishSuccessReview: assign(() => ({ activeQuestionIds: [] })),
  },
}).createMachine({
  id: 'evaluation-session',
  context: ({ input }) => ({
    questionIds: input.questionIds,
    activeQuestionIds: [],
    settings: input.settings,
    attempt: 0,
    answers: {},
    result: null,
  }),
  initial: 'ready',
  states: {
    ready: {
      on: {
        START: { guard: 'hasQuestions', target: 'attempting', actions: 'startFirstAttempt' },
      },
    },
    attempting: {
      on: {
        'QUESTION.ANSWERED': { guard: 'canAnswerActiveQuestion', actions: 'recordAnswer' },
        COMPLETE: [
          { guard: 'meetsThreshold', target: 'success', actions: 'storeResult' },
          { target: 'failure', actions: 'storeResult' },
        ],
      },
    },
    success: {
      on: {
        'SUCCESS.REPLAY': { target: 'reviewing', actions: 'startSuccessReview' },
      },
    },
    failure: {
      on: {
        RETRY: { guard: 'canRetry', target: 'attempting', actions: 'startRetry' },
      },
    },
    reviewing: {
      on: {
        'REPLAY.COMPLETE': { target: 'success', actions: 'finishSuccessReview' },
      },
    },
  },
})

/** Owns portable Evaluation attempt, result, replay, and retry transitions. */
export class EvaluationMachine {
  private readonly input: EvaluationMachineInput

  /** Creates a machine configuration for one ordered set of Questions. */
  public constructor(input: EvaluationMachineInput) {
    this.input = input
  }

  /** Returns the plain initial state that a host runtime can persist. */
  public initialState(): EvaluationMachineState {
    const [snapshot] = initialTransition(evaluationStateMachine, this.input)
    return serializableState(snapshot.value, snapshot.context)
  }

  /** Applies one event and returns the next plain state without side effects. */
  public transition(state: EvaluationMachineState, event: EvaluationMachineEvent): EvaluationMachineState {
    const snapshot = evaluationStateMachine.resolveState({ value: state.value, context: state.context })
    const [nextSnapshot] = transition(evaluationStateMachine, snapshot, event)
    return serializableState(nextSnapshot.value, nextSnapshot.context)
  }

  /** Indicates whether the success replay may reveal selected and expected answers. */
  public shouldRevealAnswers(state: EvaluationMachineState): boolean {
    return state.value === 'reviewing'
  }
}

/** Converts an XState snapshot to the serializable state kept by a host runtime. */
function serializableState(value: unknown, context: EvaluationMachineContext): EvaluationMachineState {
  return { value: value as EvaluationMachineValue, context }
}

/** Scores all Questions, treating unanswered and incorrect answers as zero. */
function evaluateResult(context: EvaluationMachineContext): EvaluationResult {
  const questionResults = Object.fromEntries(context.questionIds.map((questionId) => {
    const answer = context.answers[questionId]
    return [
      questionId,
      answer !== undefined && answersMatch(answer.selectedAnswerIds, answer.expectedAnswerIds),
    ]
  }))
  return chapterEvaluation.evaluate(context.questionIds, questionResults, context.settings.threshold)
}

/** Compares answer sets without relying on their display order. */
function answersMatch(selectedAnswerIds: readonly string[], expectedAnswerIds: readonly string[]): boolean {
  return selectedAnswerIds.length === expectedAnswerIds.length
    && expectedAnswerIds.every((answerId) => selectedAnswerIds.includes(answerId))
}

/** Starts the next attempt using the configured question scope. */
function retryContext(context: EvaluationMachineContext): Partial<EvaluationMachineContext> {
  switch (context.settings.retryScope) {
    case EVALUATION_RETRY_SCOPE.ALL_QUESTIONS:
      return {
        activeQuestionIds: context.questionIds,
        attempt: context.attempt + 1,
        answers: {},
        result: null,
      }
    case EVALUATION_RETRY_SCOPE.INCORRECT_QUESTIONS: {
      const retainedAnswers = Object.fromEntries(
        Object.entries(context.answers).filter(([, answer]) => answersMatch(
          answer.selectedAnswerIds,
          answer.expectedAnswerIds,
        )),
      )
      return {
        activeQuestionIds: context.questionIds.filter((questionId) => retainedAnswers[questionId] === undefined),
        attempt: context.attempt + 1,
        answers: retainedAnswers,
        result: null,
      }
    }
  }
}
