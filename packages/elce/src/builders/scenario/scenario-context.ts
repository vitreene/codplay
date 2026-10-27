import type { ProjectTestState } from '../../domain/summary-profile/test-state-types'

/** Maps the persisted Elcé reader state onto the context consumed by Sighty actions. */
export function scenarioContextFromTestState(state: ProjectTestState): Readonly<Record<string, unknown>> {
  return {
    finishedPages: state.finishedPageIds,
    questionAnswers: state.questionAnswers,
    restorableQuestionPageIds: Object.keys(state.questionAnswers),
    questionResults: Object.fromEntries(Object.entries(state.questionAnswers).map(([pageId, answer]) => [pageId, answer.isCorrect])),
    evaluationStates: state.evaluationStates,
    profileEnabled: state.profileEnabled,
    profileSubmitted: state.profileSubmitted,
    profileValues: state.profileValues,
  }
}
