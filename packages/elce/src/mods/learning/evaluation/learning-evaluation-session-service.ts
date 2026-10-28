import { DEFAULT_EVALUATION_SETTINGS, DEFAULT_EVALUATION_THRESHOLD } from './learning-evaluation-config'
import type { EvaluationAnswer, EvaluationMachineState } from './domain/learning-evaluation-machine-types'
import { applyEvaluationThreshold, EvaluationMachine } from './domain/learning-evaluation-machine'
import { ElceChapterEvaluation } from './domain/learning-chapter-evaluation'
import type { ElceRuntimeChapter, ElceRuntimeData } from '../reading/learning-scenario-types'
import { learningTestStateService } from '../reading/learning-test-state-service'

const chapterEvaluation = new ElceChapterEvaluation()

/** Owns Evaluation session setup, answer recording, and result calculation. */
export class LearningEvaluationSessionService {
  /** Selects the ordered Question pages belonging to an Evaluation chapter. */
  public evaluationQuestionPageIds(runtime: ElceRuntimeData, chapter: ElceRuntimeChapter): readonly string[] {
    return chapter.pageIds.filter((pageId) => runtime.questionBdcByPage[pageId] !== undefined)
  }

  /** Builds a portable machine using authored chapter settings and an optional LMS override. */
  public createEvaluationMachine(
    chapter: ElceRuntimeChapter,
    questionIds: readonly string[],
    evaluationThresholdOverride?: number,
  ): EvaluationMachine {
    return new EvaluationMachine({
      questionIds,
      settings: {
        threshold: evaluationThresholdOverride ?? chapter.evaluationThreshold ?? DEFAULT_EVALUATION_THRESHOLD,
        attemptLimit: chapter.evaluationAttemptLimit ?? DEFAULT_EVALUATION_SETTINGS.attemptLimit,
        retryScope: chapter.evaluationRetryScope ?? DEFAULT_EVALUATION_SETTINGS.retryScope,
      },
    })
  }

  /** Records one validated answer in the chapter's existing portable machine. */
  public recordEvaluationAnswer(
    runtime: ElceRuntimeData,
    chapter: ElceRuntimeChapter,
    pageId: string,
    payload: Readonly<{ answerIds?: unknown; selectedAnswerIds?: unknown; expectedAnswerIds?: unknown }>,
    previousState: EvaluationMachineState | undefined,
    interaction: Pick<EvaluationAnswer, 'questionType' | 'answerLabels' | 'description' | 'latencyMs' | 'timestampMs'> | undefined,
    evaluationThresholdOverride?: number,
  ): EvaluationMachineState | undefined {
    const answerIds = learningTestStateService.readStringIds(payload.answerIds)
    const selectedAnswerIds = learningTestStateService.readStringIds(payload.selectedAnswerIds)
    const expectedAnswerIds = learningTestStateService.readStringIds(payload.expectedAnswerIds)
    if (answerIds === undefined || selectedAnswerIds === undefined || expectedAnswerIds === undefined) return previousState
    const questionIds = this.evaluationQuestionPageIds(runtime, chapter)
    if (questionIds.length === 0) return previousState
    const machine = this.createEvaluationMachine(chapter, questionIds, evaluationThresholdOverride)
    let state = previousState === undefined
      ? machine.initialState()
      : applyEvaluationThreshold(previousState, evaluationThresholdOverride)
    if (state.value === 'ready') state = machine.transition(state, { type: 'START' })
    return machine.transition(state, {
      type: 'QUESTION.ANSWERED',
      answer: {
        questionId: pageId,
        answerIds,
        selectedAnswerIds,
        expectedAnswerIds,
        ...(interaction === undefined ? {} : {
          questionType: interaction.questionType,
          answerLabels: interaction.answerLabels,
          description: interaction.description,
          ...(interaction.latencyMs === undefined ? {} : { latencyMs: interaction.latencyMs }),
          ...(interaction.timestampMs === undefined ? {} : { timestampMs: interaction.timestampMs }),
        }),
      },
    })
  }

  /** Scores one chapter against the same Elcé threshold rules as its machine. */
  public evaluateChapter(
    questionPageIds: readonly string[],
    questionResults: Readonly<Record<string, boolean>>,
    threshold: number = DEFAULT_EVALUATION_THRESHOLD,
  ) {
    return chapterEvaluation.evaluate(questionPageIds, questionResults, threshold)
  }

  /** Applies an LMS threshold to the persisted Evaluation machine state. */
  public applyThreshold(state: EvaluationMachineState, threshold: number | undefined): EvaluationMachineState {
    return applyEvaluationThreshold(state, threshold)
  }
}

export const learningEvaluationSessionService = new LearningEvaluationSessionService()
