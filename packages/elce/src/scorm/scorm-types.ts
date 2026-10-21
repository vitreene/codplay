import type { EvaluationMachineState } from '../domain/evaluation/evaluation-machine-types'
import type { ProjectTestState } from '../domain/summary-profile/test-state-types'

export type { ScormVersion } from '@codplay/sighty-scorm'

/** Names the optional application adapter supplied through Sighty's runtime context. */
export const ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY = 'elceScormProgressSink'

/** Describes the Elcé reader data restored from one SCO session. */
export interface ScormReaderState {
  readonly schemaVersion: 1
  readonly currentPageId: string | null
  readonly projectTestState: ProjectTestState
}

/** Carries one validated chapter result to the LMS session. */
export interface ScormEvaluationResult {
  readonly chapterId: string
  readonly evaluationState: EvaluationMachineState
}

/** Defines the narrow operations Sighty page actions may request from SCORM. */
export interface ElceScormProgressSink {
  saveReaderState(state: ProjectTestState, currentPageId?: string): Promise<void>
  recordEvaluationResult(
    state: ProjectTestState,
    currentPageId: string,
    result: ScormEvaluationResult,
  ): Promise<void>
}
