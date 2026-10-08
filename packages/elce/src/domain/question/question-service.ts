import { QUESTION_TYPE, QUESTION_TYPE_CONFIG } from '../../config/document-config'
import { createStableId } from '../document/document-model'
import type { QuestionAnswer, QuestionContent, QuestionType } from './question-types'

/** Owns Question defaults and answer editing rules independently of the view. */
export class ElceQuestionService {
  /** Creates one complete editable Question payload with its configured defaults. */
  public createDefault(): QuestionContent {
    return {
      mediaId: null,
      type: QUESTION_TYPE.TRUE_FALSE,
      title: '',
      prompt: '',
      answers: QUESTION_TYPE_CONFIG[QUESTION_TYPE.TRUE_FALSE].defaultAnswers.map((answer) => ({
        ...answer,
        id: createStableId('answer'),
      })),
    }
  }

  /** Changes the question type while keeping its authored title, prompt, and media owner. */
  public changeType(question: QuestionContent, type: QuestionType): QuestionContent {
    if (question.type === type) return question
    return {
      ...question,
      type,
      answers: this.defaultAnswersFor(type),
    }
  }

  /** Updates the optional card title without changing the response set. */
  public setTitle(question: QuestionContent, title: string): QuestionContent {
    return { ...question, title }
  }

  /** Updates the required question prompt. */
  public setPrompt(question: QuestionContent, prompt: string): QuestionContent {
    return { ...question, prompt }
  }

  /** Updates one answer label while keeping its identity and correctness. */
  public setAnswerLabel(question: QuestionContent, answerId: string, label: string): QuestionContent {
    return this.replaceAnswer(question, answerId, (answer) => ({ ...answer, label }))
  }

  /** Marks an answer correct while preserving the type's correct-answer count rule. */
  public setAnswerCorrect(question: QuestionContent, answerId: string, correct: boolean): QuestionContent {
    const answer = question.answers.find((candidate) => candidate.id === answerId)
    if (answer === undefined || answer.correct === correct) return question

    switch (question.type) {
      case QUESTION_TYPE.TRUE_FALSE:
      case QUESTION_TYPE.CHOICE:
        if (!correct) return question
        return {
          ...question,
          answers: question.answers.map((candidate) => ({
            ...candidate,
            correct: candidate.id === answerId,
          })),
        }
      case QUESTION_TYPE.MULTIPLE_CHOICE: {
        if (!correct && question.answers.filter((candidate) => candidate.correct).length === 1) return question
        return {
          ...question,
          answers: question.answers.map((candidate) => candidate.id === answerId
            ? { ...candidate, correct }
            : candidate),
        }
      }
    }
  }

  /** Adds an editable response and leaves one valid correct answer in the set. */
  public addAnswer(question: QuestionContent): QuestionContent {
    if (!QUESTION_TYPE_CONFIG[question.type].editableAnswers) return question
    return {
      ...question,
      answers: [...question.answers, {
        id: createStableId('answer'),
        label: '',
        correct: false,
      }],
    }
  }

  /** Removes an answer and promotes the first remaining answer if required. */
  public removeAnswer(question: QuestionContent, answerId: string): QuestionContent {
    if (!QUESTION_TYPE_CONFIG[question.type].editableAnswers || question.answers.length <= 1) return question
    const removed = question.answers.find((answer) => answer.id === answerId)
    if (removed === undefined) return question
    const answers = question.answers.filter((answer) => answer.id !== answerId)
    if (removed.correct && !answers.some((answer) => answer.correct)) {
      return { ...question, answers: answers.map((answer, index) => index === 0 ? { ...answer, correct: true } : answer) }
    }
    return { ...question, answers }
  }

  /** Reorders one response before the response at the requested index. */
  public moveAnswer(question: QuestionContent, answerId: string, index: number): QuestionContent {
    const sourceIndex = question.answers.findIndex((answer) => answer.id === answerId)
    if (sourceIndex < 0) return question
    const answers = [...question.answers]
    const [answer] = answers.splice(sourceIndex, 1)
    if (answer === undefined) return question
    answers.splice(Math.max(0, Math.min(index, answers.length)), 0, answer)
    return { ...question, answers }
  }

  /** Checks the stored response invariants before a Question command is applied. */
  public assertValid(question: QuestionContent): void {
    if (new Set(question.answers.map((answer) => answer.id)).size !== question.answers.length) {
      throw new Error('Les réponses d’une Question doivent avoir des identifiants uniques.')
    }
    if (question.answers.length === 0) throw new Error('Une Question doit contenir au moins une réponse.')
    const correctCount = question.answers.filter((answer) => answer.correct).length
    switch (question.type) {
      case QUESTION_TYPE.TRUE_FALSE:
        if (question.answers.length !== 2 || correctCount !== 1) {
          throw new Error('Une Question vrai/faux contient deux réponses et une seule réponse juste.')
        }
        return
      case QUESTION_TYPE.CHOICE:
        if (correctCount !== 1) throw new Error('Une Question à choix contient une seule réponse juste.')
        return
      case QUESTION_TYPE.MULTIPLE_CHOICE:
        if (correctCount < 1) throw new Error('Une Question à choix multiple exige au moins une réponse juste.')
        return
    }
  }

  private defaultAnswersFor(type: QuestionType): readonly QuestionAnswer[] {
    return QUESTION_TYPE_CONFIG[type].defaultAnswers.map((answer) => ({ ...answer, id: createStableId('answer') }))
  }

  private replaceAnswer(
    question: QuestionContent,
    answerId: string,
    update: (answer: QuestionAnswer) => QuestionAnswer,
  ): QuestionContent {
    return {
      ...question,
      answers: question.answers.map((answer) => answer.id === answerId ? update(answer) : answer),
    }
  }
}
