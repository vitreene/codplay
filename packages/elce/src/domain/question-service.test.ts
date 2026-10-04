import { describe, expect, it } from 'vitest'
import { QUESTION_TYPE } from '../config/document-config'
import { ElceQuestionService } from './question-service'

describe('ElceQuestionService', () => {
  const service = new ElceQuestionService()

  it('creates editable true/false defaults and preserves their correctness when labels change', () => {
    const question = service.createDefault()
    const [yes, no] = question.answers
    if (yes === undefined || no === undefined) throw new Error('Le preset vrai/faux doit fournir les deux réponses.')
    const relabeled = service.setAnswerLabel(
      service.setAnswerLabel(question, yes.id, 'Exact'),
      no.id,
      'Inexact',
    )

    expect(question).toMatchObject({
      type: QUESTION_TYPE.TRUE_FALSE,
      answers: [
        { label: 'Oui', correct: true },
        { label: 'Non', correct: false },
      ],
    })
    expect(relabeled.answers.map(({ label, correct }) => ({ label, correct }))).toEqual([
      { label: 'Exact', correct: true },
      { label: 'Inexact', correct: false },
    ])
    expect(() => service.assertValid(question)).not.toThrow()
  })

  it('keeps exactly one correct answer for Choice', () => {
    const choice = service.changeType(service.createDefault(), QUESTION_TYPE.CHOICE)
    const [first, second] = choice.answers
    if (first === undefined || second === undefined) throw new Error('Le preset Choix doit contenir deux réponses.')

    const corrected = service.setAnswerCorrect(choice, second.id, true)
    expect(corrected.answers.map(({ correct }) => correct)).toEqual([false, true])
    expect(service.setAnswerCorrect(corrected, second.id, false)).toBe(corrected)
    expect(() => service.assertValid(corrected)).not.toThrow()
  })

  it('allows several correct answers but never an empty correct set for Multiple Choice', () => {
    const multiple = service.changeType(service.createDefault(), QUESTION_TYPE.MULTIPLE_CHOICE)
    const [first, second] = multiple.answers
    if (first === undefined || second === undefined) throw new Error('Le preset Choix doit contenir deux réponses.')

    const bothCorrect = service.setAnswerCorrect(multiple, second.id, true)
    expect(bothCorrect.answers.map(({ correct }) => correct)).toEqual([true, true])

    const oneCorrect = service.setAnswerCorrect(bothCorrect, first.id, false)
    expect(oneCorrect.answers.map(({ correct }) => correct)).toEqual([false, true])
    expect(service.setAnswerCorrect(oneCorrect, second.id, false)).toBe(oneCorrect)
    expect(() => service.assertValid(oneCorrect)).not.toThrow()

    const invalid = { ...oneCorrect, answers: oneCorrect.answers.map((answer) => ({ ...answer, correct: false })) }
    expect(() => service.assertValid(invalid)).toThrow('exige au moins une réponse juste')
  })

  it('promotes a remaining answer when deleting the only correct answer and supports reordering', () => {
    const multiple = service.changeType(service.createDefault(), QUESTION_TYPE.MULTIPLE_CHOICE)
    const [first, second] = multiple.answers
    if (first === undefined || second === undefined) throw new Error('Le preset Choix doit contenir deux réponses.')

    const withoutCorrect = service.removeAnswer(multiple, first.id)
    expect(withoutCorrect.answers).toEqual([{ ...second, correct: true }])
    expect(service.moveAnswer(multiple, second.id, 0).answers[0]?.id).toBe(second.id)
    expect(() => service.assertValid(withoutCorrect)).not.toThrow()
  })
})
