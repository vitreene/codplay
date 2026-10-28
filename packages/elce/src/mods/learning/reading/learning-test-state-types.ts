import type { ProfilePropertyId, ProfileValue } from '../profile/domain/learning-profile-types'
import type { EvaluationMachineState } from '../evaluation/domain/learning-evaluation-machine-types'
import type { QuestionAnswerState } from '../../../resources/bdcs/question/domain/question-types'

/** Stores the author preview independently from the editorial document. */
export interface ProjectTestState {
  readonly schemaVersion: 1
  readonly profileEnabled: boolean
  readonly profileSubmitted: boolean
  readonly profileValues: Readonly<Record<ProfilePropertyId, ProfileValue>>
  readonly finishedPageIds: readonly string[]
  readonly questionAnswers: Readonly<Record<string, QuestionAnswerState>>
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
