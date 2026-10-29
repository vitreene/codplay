import type { ProfilePropertyId, ProfileValue } from './summary-profile-types'
import type { EvaluationMachineState } from '../evaluation/evaluation-machine-types'

export interface TestAnswerState {
  readonly answerIds: readonly string[]
  readonly selectedAnswerIds: readonly string[]
  readonly expectedAnswerIds: readonly string[]
  readonly isCorrect: boolean
}

/** Stores the author preview independently from the editorial document. */
export interface ProjectTestState {
  readonly schemaVersion: 1
  readonly profileEnabled: boolean
  readonly profileSubmitted: boolean
  readonly profileValues: Readonly<Record<ProfilePropertyId, ProfileValue>>
  readonly finishedPageIds: readonly string[]
  readonly questionAnswers: Readonly<Record<string, TestAnswerState>>
  readonly evaluationStates: Readonly<Record<string, EvaluationMachineState>>
}

export const INITIAL_PROJECT_TEST_STATE: ProjectTestState = {
  schemaVersion: 1,
  profileEnabled: true,
  profileSubmitted: false,
  profileValues: {},
  finishedPageIds: [],
  questionAnswers: {},
  evaluationStates: {},
}

export interface VersionedProjectTestState {
  readonly state: ProjectTestState
  readonly revision: number
}
