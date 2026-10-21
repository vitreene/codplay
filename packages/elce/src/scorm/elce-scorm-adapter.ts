import { ScormSession } from '@codplay/sighty-scorm'
import type {
  PipwerksScormApi,
  ScormChoiceInteraction,
  ScormEvaluationUpdate,
  ScormReaderUpdate,
  ScormScore,
  ScormVersion,
} from '@codplay/sighty-scorm'
import type { EvaluationMachineState } from '../domain/evaluation/evaluation-machine-types'
import { decodeScormReaderState, encodeScormReaderState, initialScormReaderState } from './scorm-state-codec'
import type { ElceScormProgressSink, ScormEvaluationResult, ScormReaderState } from './scorm-types'

/** Configures Elcé state mapping for one shared SCORM session. */
export interface ElceScormAdapterOptions {
  readonly version: ScormVersion
  readonly monoSco?: boolean
  readonly evaluationChapterIds?: readonly string[]
  readonly chapterPageIds?: readonly (readonly string[])[]
  readonly api?: PipwerksScormApi
  readonly onDiagnostic?: (message: string) => void
}

/** Translates Elcé reader and evaluation state into the shared SCORM model. */
export class ElceScormAdapter implements ElceScormProgressSink {
  private readonly session: ScormSession
  private readonly version: ScormVersion
  private readonly monoSco: boolean
  private readonly evaluationChapterIds: readonly string[]
  private readonly chapterPageIds: readonly (readonly string[])[]
  private restoredState: ScormReaderState = initialScormReaderState()
  private initialized = false

  /** Creates an Elcé adapter around the reusable Sighty SCORM core. */
  public constructor(options: ElceScormAdapterOptions) {
    this.version = options.version
    this.monoSco = options.monoSco ?? false
    this.evaluationChapterIds = options.evaluationChapterIds ?? []
    this.chapterPageIds = options.chapterPageIds ?? []
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
    const savedState = decodeScormReaderState(restore.suspendData)
    this.restoredState = {
      ...(savedState ?? initialScormReaderState()),
      currentPageId: restore.location.length > 0 ? restore.location : savedState?.currentPageId ?? null,
      projectTestState: savedState?.projectTestState ?? initialScormReaderState().projectTestState,
    }
    return this.restoredState
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
      interactions: toChoiceInteractions(result.chapterId, evaluation),
    }
    await this.session.recordEvaluationResult(update)
    this.restoredState = nextState
  }

  /** Saves the latest Elcé record and closes the shared LMS session. */
  public async close(): Promise<void> {
    await this.session.close(this.toReaderUpdate(this.restoredState))
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

  /** Encodes Elcé state and adds optional 2004 mono-SCO progress values. */
  private toReaderUpdate(state: ScormReaderState): ScormReaderUpdate {
    const progress = this.monoSco && this.version !== '1.2'
      ? this.toProgressUpdate(state.projectTestState.finishedPageIds)
      : undefined
    return {
      location: state.currentPageId,
      suspendData: encodeScormReaderState(state, this.version),
      ...(progress === undefined ? {} : { progress }),
    }
  }

  /** Maps finished Elcé pages to chapter-based SCORM 2004 progress. */
  private toProgressUpdate(finishedPageIds: readonly string[]): ScormReaderUpdate['progress'] {
    const chapters = this.chapterPageIds.filter((pageIds) => pageIds.length > 0)
    if (chapters.length === 0) return undefined
    const finishedPages = new Set(finishedPageIds)
    const completedCount = chapters.filter((pageIds) => pageIds.every((pageId) => finishedPages.has(pageId))).length
    return {
      measure: Math.round((completedCount / chapters.length) * 100) / 100,
      completionStatus: completedCount === chapters.length ? 'completed' : 'incomplete',
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

/** Maps one Elcé evaluation machine to portable SCORM choice interactions. */
function toChoiceInteractions(
  chapterId: string,
  state: EvaluationMachineState,
): readonly ScormChoiceInteraction[] {
  return Object.values(state.context.answers).map((answer) => ({
    id: `${chapterId}:${answer.questionId}`,
    correctResponse: answer.expectedAnswerIds.join('[,]'),
    learnerResponse: answer.selectedAnswerIds.join('[,]'),
    result: sameIds(answer.selectedAnswerIds, answer.expectedAnswerIds) ? 'correct' : 'incorrect',
  }))
}

/** Compares answer identifiers without depending on their presentation order. */
function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((id) => right.includes(id))
}
