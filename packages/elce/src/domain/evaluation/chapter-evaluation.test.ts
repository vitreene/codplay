import { describe, expect, it } from 'vitest'
import { DEFAULT_EVALUATION_THRESHOLD } from '../../config/document-config'
import { ElceChapterEvaluation } from './chapter-evaluation'

describe('ElceChapterEvaluation', () => {
  const evaluation = new ElceChapterEvaluation()

  it('passes four correct answers out of five at the configured threshold', () => {
    const results = evaluation.evaluate(
      ['a', 'b', 'c', 'd', 'e'],
      { a: true, b: true, c: true, d: true, e: false },
    )

    expect(DEFAULT_EVALUATION_THRESHOLD).toBe(0.8)
    expect(results).toEqual({ questionCount: 5, correctCount: 4, score: 0.8, passed: true })
  })

  it('fails three correct answers out of five and counts unanswered questions as incorrect', () => {
    expect(evaluation.evaluate(
      ['a', 'b', 'c', 'd', 'e'],
      { a: true, b: true, c: true, d: false },
    )).toEqual({ questionCount: 5, correctCount: 3, score: 0.6, passed: false })
  })

  it('does not assign a score to an Evaluation chapter with no Questions', () => {
    expect(evaluation.evaluate([], {})).toEqual({
      questionCount: 0,
      correctCount: 0,
      score: null,
      passed: null,
    })
  })
})
