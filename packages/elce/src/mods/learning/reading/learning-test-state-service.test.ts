import { describe, expect, it } from 'vitest'
import { createQuestionBdcCommand, applyDocumentCommand } from '../../../domain/commands/document-commands'
import { learningDocumentService } from '../document/learning-document-service'
import { LearningDocument } from '../document/learning-document'
import { learningTestStateService } from './learning-test-state-service'
import { INITIAL_PROJECT_TEST_STATE } from './learning-test-state-types'

describe('project test-state reconciliation', () => {
  it('keeps saved answers after copy edits and clears only answers invalidated by choices or correction', () => {
    const source = applyDocumentCommand(
      learningDocumentService.createInitialDocument(),
      createQuestionBdcCommand('bdc-question-test', 'page-a', 1),
    )
    const questionBdc = source.bdcs.find((bdc) => bdc.id === 'bdc-question-test')
    if (questionBdc?.question == null) throw new Error('Question fixture is missing.')
    const answerIds = questionBdc.question.answers.map((answer) => answer.id)
    const expectedAnswerIds = questionBdc.question.answers.filter((answer) => answer.correct).map((answer) => answer.id)
    const selectedAnswerIds = [...expectedAnswerIds]
    const state = {
      ...INITIAL_PROJECT_TEST_STATE,
      profileSubmitted: true,
      questionAnswers: {
        'page-a': { answerIds, selectedAnswerIds, expectedAnswerIds, isCorrect: true },
      },
    }

    const relabeled = new LearningDocument({
      ...source.data,
      bdcs: source.bdcs.map((bdc) => bdc.id !== questionBdc.id ? bdc : {
        ...bdc,
        question: {
          ...questionBdc.question!,
          title: 'Nouveau titre',
          answers: questionBdc.question!.answers.map((answer) => ({ ...answer, label: `Autre ${answer.label}` })),
        },
      }),
    })
    expect(learningTestStateService.reconcileProjectTestState(relabeled, state).questionAnswers).toEqual(state.questionAnswers)

    const corrected = new LearningDocument({
      ...relabeled.data,
      bdcs: relabeled.bdcs.map((bdc) => bdc.id !== questionBdc.id ? bdc : {
        ...bdc,
        question: {
          ...bdc.question!,
          answers: bdc.question!.answers.map((answer, index) => ({ ...answer, correct: index === 1 })),
        },
      }),
    })
    const reconciled = learningTestStateService.reconcileProjectTestState(corrected, state)
    expect(reconciled.questionAnswers).toEqual({})
    expect(reconciled.profileSubmitted).toBe(true)
  })
})
