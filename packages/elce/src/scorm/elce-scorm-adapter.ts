import { ScormSession } from '@codplay/sighty-scorm/session'
import type {
  PipwerksScormApi,
  ScormEvaluationUpdate,
  ScormInteraction,
  ScormReaderUpdate,
  ScormScore,
  ScormVersion,
} from '@codplay/sighty-scorm'
import type { EvaluationAnswer, EvaluationMachineState } from '../domain/evaluation/evaluation-machine-types'
import { applyEvaluationThreshold } from '../domain/evaluation/evaluation-machine'
import { decodeScormReaderState, encodeScormReaderState, initialScormReaderState } from './scorm-state-codec'
import type {
  ElceScormProgressSink,
  ScormEvaluationResult,
  ScormQuestionInteraction,
  ScormReaderState,
} from './scorm-types'

/** Configures Elcé state mapping for one shared SCORM session. */
export interface ElceScormAdapterOptions {
  readonly version: ScormVersion
  readonly monoSco?: boolean
  readonly evaluationChapterIds?: readonly string[]
  readonly chapterIds?: readonly string[]
  readonly chapterPageIds?: readonly (readonly string[])[]
  readonly questionPageIds?: readonly string[]
  readonly scoPageIds?: readonly string[]
  readonly scoEvaluationChapterId?: string
  readonly chapterScoIdentifiers?: Readonly<Record<string, string>>
  readonly getSessionTimeMs?: () => number | undefined
  readonly api?: PipwerksScormApi
  readonly onDiagnostic?: (message: string) => void
}

/** Translates Elcé reader and evaluation state into the shared SCORM model. */
export class ElceScormAdapter implements ElceScormProgressSink {
  private readonly session: ScormSession
  private readonly version: ScormVersion
  private readonly monoSco: boolean
  private readonly evaluationChapterIds: readonly string[]
  private readonly chapterIds: readonly string[]
  private readonly chapterPageIds: readonly (readonly string[])[]
  private readonly questionPageIds: ReadonlySet<string>
  private readonly scoPageIds: readonly string[]
  private readonly scoEvaluationChapterId: string | undefined
  private readonly chapterScoIdentifiers: Readonly<Record<string, string>>
  private readonly getSessionTimeMs: (() => number | undefined) | undefined
  private restoredState: ScormReaderState = initialScormReaderState()
  private evaluationThresholdOverride: number | undefined
  private initialized = false

  /** Creates an Elcé adapter around the reusable Sighty SCORM core. */
  public constructor(options: ElceScormAdapterOptions) {
    this.version = options.version
    this.monoSco = options.monoSco ?? false
    this.evaluationChapterIds = options.evaluationChapterIds ?? []
    this.chapterIds = options.chapterIds ?? []
    this.chapterPageIds = options.chapterPageIds ?? []
    this.questionPageIds = new Set(options.questionPageIds ?? [])
    this.scoPageIds = options.scoPageIds ?? []
    this.scoEvaluationChapterId = options.scoEvaluationChapterId
    this.chapterScoIdentifiers = options.chapterScoIdentifiers ?? {}
    this.getSessionTimeMs = options.getSessionTimeMs
    this.session = new ScormSession({
      version: options.version,
      api: options.api,
      onDiagnostic: options.onDiagnostic,
    })
  }

  /** Opens the shared session and restores a validated Elcé state record. */
  public async initialize(): Promise<ScormReaderState> {
    if (this.initialized) return this.restoredState
    this.initialized = true
    const restore = await this.session.initialize()
    this.evaluationThresholdOverride = restore.masteryScore === undefined
      ? undefined
      : restore.masteryScore / 100
    const savedState = decodeScormReaderState(restore.suspendData)
    const projectTestState = applyEvaluationThresholds(
      savedState?.projectTestState ?? initialScormReaderState().projectTestState,
      this.evaluationThresholdOverride,
    )
    this.restoredState = {
      ...(savedState ?? initialScormReaderState()),
      currentPageId: restore.location.length > 0 ? restore.location : savedState?.currentPageId ?? null,
      projectTestState,
    }
    return this.restoredState
  }

  /** Returns the LMS mastery score as the runtime's normalized Evaluation threshold. */
  public getEvaluationThresholdOverride(): number | undefined {
    return this.evaluationThresholdOverride
  }

  /** Saves the current Elcé state through the shared session API. */
  public async saveReaderState(
    state: ScormReaderState['projectTestState'],
    currentPageId?: string,
  ): Promise<void> {
    const nextState = this.createReaderState(state, currentPageId)
    await this.session.saveReaderState(this.toReaderUpdate(nextState))
    this.restoredState = nextState
  }

  /** Saves one non-evaluation Question response and its immediate LMS interaction. */
  public async recordQuestionInteraction(
    state: ScormReaderState['projectTestState'],
    currentPageId: string,
    answer: ScormQuestionInteraction,
  ): Promise<void> {
    const nextState = this.createReaderState(state, currentPageId)
    await this.session.recordInteraction(this.toReaderUpdate(nextState), toScormInteraction(currentPageId, answer))
    this.restoredState = nextState
  }

  /** Maps an Elcé evaluation result to standard LMS status, score, and interactions. */
  public async recordEvaluationResult(
    state: ScormReaderState['projectTestState'],
    currentPageId: string,
    result: ScormEvaluationResult,
  ): Promise<void> {
    const evaluation = result.evaluationState
    const evaluationResult = evaluation.context.result
    if (evaluationResult?.passed === null || evaluationResult?.passed === undefined) return

    const nextState = this.createReaderState(state, currentPageId)
    if (evaluationResult.score === null) {
      await this.session.saveReaderState(this.toReaderUpdate(nextState))
      this.restoredState = nextState
      return
    }
    const score = evaluationResult.score
    const overallResult = this.monoSco
      ? this.toOverallResult(nextState, result.chapterId, score, evaluationResult.passed)
      : undefined
    const update: ScormEvaluationUpdate = {
      reader: this.toReaderUpdate(nextState),
      status: overallResult?.status ?? (evaluationResult.passed ? 'passed' : 'failed'),
      score: overallResult?.score ?? toScormScore(score),
      ...(this.monoSco && this.version !== '1.2'
        ? { objective: { id: `obj_${result.chapterId}`, status: evaluationResult.passed ? 'passed' as const : 'failed' as const, score: toScormScore(score) } }
        : {}),
      interactions: toScormInteractions(evaluation),
    }
    await this.session.recordEvaluationResult(update)
    this.restoredState = nextState
  }

  /** Saves the latest Elcé record and closes the shared LMS session. */
  public async close(): Promise<void> {
    await this.session.close(this.toReaderUpdate(this.restoredState))
  }

  /** Navigates to the chapter's manifest SCO through the shared CMI session. */
  public async navigateToChapter(chapterId: string): Promise<boolean> {
    const identifier = this.chapterScoIdentifiers[chapterId]
    if (identifier === undefined) return false
    return this.session.navigateToSco(identifier)
  }

  /** Creates a versioned Elcé reader state from an admitted page update. */
  private createReaderState(
    projectTestState: ScormReaderState['projectTestState'],
    currentPageId?: string,
  ): ScormReaderState {
    return {
      schemaVersion: 1,
      currentPageId: currentPageId ?? this.restoredState.currentPageId,
      projectTestState,
    }
  }

  /** Encodes Elcé state and adds completion for this SCO or course progress for mono-SCO. */
  private toReaderUpdate(state: ScormReaderState): ScormReaderUpdate {
    const shouldWriteProgress = (this.monoSco && this.chapterPageIds.some((pageIds) => pageIds.length > 0))
      || (!this.monoSco && this.scoPageIds.length > 0)
    const progress = shouldWriteProgress
      ? this.toProgressUpdate(state.projectTestState, this.scoPageIds, state.currentPageId)
      : undefined
    const projectTestState = this.version === '1.2'
      ? withoutQuestionInteractionMetadata(state.projectTestState)
      : state.projectTestState
    const sessionTimeMs = this.getSessionTimeMs?.()
    return {
      location: state.currentPageId,
      suspendData: encodeScormReaderState({ ...state, projectTestState }, this.version),
      ...(sessionTimeMs === undefined || !Number.isFinite(sessionTimeMs) || sessionTimeMs < 0 ? {} : { sessionTimeMs }),
      ...(progress === undefined ? {} : { progress }),
    }
  }

  /** Maps finished Elcé pages to course or current-SCO completion. */
  private toProgressUpdate(
    projectTestState: ScormReaderState['projectTestState'],
    scoPageIds: readonly string[],
    currentPageId: string | null,
  ): ScormReaderUpdate['progress'] {
    const finishedPages = new Set(projectTestState.finishedPageIds)
    const isPageComplete = (pageId: string): boolean => finishedPages.has(pageId)
      && (!this.questionPageIds.has(pageId) || Object.hasOwn(projectTestState.questionAnswers, pageId))
    const chapters = this.monoSco ? this.chapterPageIds.filter((pageIds) => pageIds.length > 0) : []
    if (this.monoSco && chapters.length === 0) return undefined
    if (!this.monoSco && scoPageIds.length === 0) return undefined
    const completedCount = chapters.filter((pageIds) => pageIds.every(isPageComplete)).length
    const currentChapterIndex = this.monoSco
      ? this.chapterPageIds.findIndex((pageIds) => pageIds.includes(currentPageId ?? ''))
      : -1
    const currentPages = this.monoSco ? this.chapterPageIds[currentChapterIndex] : scoPageIds
    const currentPageIndex = currentPages?.indexOf(currentPageId ?? '') ?? -1
    const currentChapterComplete = currentPages !== undefined
      && currentPages.length > 0
      && currentPages.every(isPageComplete)
    const chapterCompleted = this.monoSco
      ? completedCount === chapters.length
      : currentPageIndex === scoPageIds.length - 1 && currentChapterComplete
    const measure = this.monoSco
      ? Math.round((completedCount / chapters.length) * 100) / 100
      : Math.round(((currentPageIndex + 1) / scoPageIds.length) * 100) / 100
    const reachedChapterEnd = currentPageIndex === (currentPages?.length ?? 0) - 1 && currentChapterComplete
    const completionStatus = reachedChapterEnd
      ? this.monoSco ? chapterCompleted ? 'completed' : 'incomplete' : 'completed'
      : undefined
    const evaluationResult = this.scoEvaluationChapterId === undefined
      ? undefined
      : projectTestState.evaluationStates[this.scoEvaluationChapterId]?.context.result
    const objectives = this.version === '1.2' || !this.monoSco || currentChapterIndex < 0
      ? undefined
      : (() => {
          const chapterId = this.chapterIds[currentChapterIndex]
          const pageIds = this.chapterPageIds[currentChapterIndex]
          if (chapterId === undefined || pageIds === undefined) return undefined
          const pageIndex = pageIds.indexOf(currentPageId ?? '')
          const objectiveMeasure = Math.round(((pageIndex + 1) / pageIds.length) * 100) / 100
          return [{
            id: `obj_${chapterId}`,
            measure: currentChapterComplete ? 1 : objectiveMeasure,
            ...(currentChapterComplete ? { completionStatus: 'completed' as const } : {}),
          }]
        })()
    return {
      measure,
      ...(completionStatus === undefined ? {} : { completionStatus }),
      ...(objectives === undefined ? {} : { objectives }),
      ...(completionStatus === 'completed' && evaluationResult?.passed != null
        ? { successStatus: evaluationResult.passed ? 'passed' as const : 'failed' as const }
        : {}),
    }
  }

  /** Aggregates a mono-SCO outcome using all Elcé evaluation chapters. */
  private toOverallResult(
    state: ScormReaderState,
    chapterId: string,
    currentScore: number,
    currentPassed: boolean,
  ): Readonly<{ score: ScormScore; status: 'passed' | 'failed' }> {
    const chapterIds = this.evaluationChapterIds.length > 0 ? this.evaluationChapterIds : [chapterId]
    const results = chapterIds.map((id) => id === chapterId
      ? { score: currentScore, passed: currentPassed }
      : state.projectTestState.evaluationStates[id]?.context.result)
    const totalScore = results.reduce((total, result) => total + (result?.score ?? 0), 0)
    return {
      score: toScormScore(totalScore / chapterIds.length),
      status: results.some((result) => result?.passed === false) ? 'failed' : 'passed',
    }
  }
}

/** Converts Elcé's normalized score to all SCORM score fields. */
function toScormScore(score: number): ScormScore {
  return { raw: Math.round(score * 100), min: 0, max: 100, scaled: score }
}

/** Maps one Elcé evaluation machine to portable SCORM interactions. */
function toScormInteractions(state: EvaluationMachineState): readonly ScormInteraction[] {
  return Object.values(state.context.answers).map((answer) => toScormInteraction(answer.questionId, {
    questionType: answer.questionType ?? 'choice',
    answerIds: answer.answerIds,
    answerLabels: answer.answerLabels ?? [],
    selectedAnswerIds: answer.selectedAnswerIds,
    expectedAnswerIds: answer.expectedAnswerIds,
    description: answer.description ?? '',
    isCorrect: sameIds(answer.selectedAnswerIds, answer.expectedAnswerIds),
    ...(answer.timestampMs === undefined ? {} : { timestampMs: answer.timestampMs }),
    ...(answer.latencyMs === undefined ? {} : { latencyMs: answer.latencyMs }),
  }))
}

/** Maps one answered Elcé Question to the response syntax used by the reference. */
function toScormInteraction(pageId: string, answer: ScormQuestionInteraction): ScormInteraction {
  return {
    id: `${pageId}_0`,
    type: answer.questionType === 'true-false' ? 'true-false' : 'choice',
    description: toScormDescription(answer),
    correctResponse: toScormResponse(answer, answer.expectedAnswerIds),
    learnerResponse: toScormResponse(answer, answer.selectedAnswerIds),
    ...(answer.timestampMs === undefined ? {} : { timestampMs: answer.timestampMs }),
    ...(answer.latencyMs === undefined ? {} : { latencyMs: answer.latencyMs }),
    weighting: 0,
    result: answer.isCorrect ? 'correct' : 'incorrect',
  }
}

/** Adds the authored response list to the question text as the reference does. */
function toScormDescription(answer: ScormQuestionInteraction): string {
  const responses = answer.answerLabels.map((label, index) => `\n${index + 1}. ${label}`).join('')
  return `${answer.description}${responses}`
}

/** Converts answer identifiers to labels or one-based choice positions. */
function toScormResponse(answer: ScormQuestionInteraction, responseIds: readonly string[]): string {
  const selectedIds = new Set(responseIds)
  return answer.answerIds.flatMap((id, index) => {
    if (!selectedIds.has(id)) return []
    if (answer.questionType === 'true-false') return [answer.answerLabels[index] ?? id]
    return [String(index + 1)]
  }).join('[,]')
}

/** Omits interaction-only metadata from 1.2 suspend data, which has no CMI interactions. */
function withoutQuestionInteractionMetadata(state: ScormReaderState['projectTestState']): ScormReaderState['projectTestState'] {
  const evaluationStates = Object.fromEntries(Object.entries(state.evaluationStates).map(([chapterId, evaluation]) => [
    chapterId,
    {
      ...evaluation,
      context: {
        ...evaluation.context,
        answers: Object.fromEntries(Object.entries(evaluation.context.answers).map(([questionId, answer]) => [
          questionId,
          Object.fromEntries(Object.entries(answer).filter(([key]) => ![
            'questionType', 'answerLabels', 'description', 'latencyMs', 'timestampMs',
          ].includes(key))) as EvaluationAnswer,
        ])),
      },
    },
  ]))
  return { ...state, evaluationStates }
}

/** Applies the current LMS mastery threshold to all restored chapter evaluations. */
function applyEvaluationThresholds(
  state: ScormReaderState['projectTestState'],
  threshold: number | undefined,
): ScormReaderState['projectTestState'] {
  if (threshold === undefined) return state
  return {
    ...state,
    evaluationStates: Object.fromEntries(Object.entries(state.evaluationStates).map(([chapterId, evaluation]) => [
      chapterId,
      applyEvaluationThreshold(evaluation, threshold),
    ])),
  }
}

/** Compares answer identifiers without depending on their presentation order. */
function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id) => right.includes(id))
}
