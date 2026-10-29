import { describe, expect, it } from 'vitest'
import { INITIAL_PROJECT_TEST_STATE } from '../domain/summary-profile/test-state-types'
import { decodeScormReaderState, encodeScormReaderState, initialScormReaderState, suspendDataLimit } from './scorm-state-codec'

describe('SCORM reader state codec', () => {
  it('round-trips the current page, progress, profile, answers, and evaluation attempts', () => {
    const state = {
      schemaVersion: 1 as const,
      currentPageId: 'page-b',
      projectTestState: {
        ...INITIAL_PROJECT_TEST_STATE,
        finishedPageIds: ['page-a'],
        profileSubmitted: true,
        profileValues: { role: 'reader' },
        questionAnswers: {
          'page-a': {
            answerIds: ['choice-a', 'choice-b'],
            selectedAnswerIds: ['choice-a'],
            expectedAnswerIds: ['choice-a'],
            isCorrect: true,
          },
        },
        evaluationStates: {
          'chapter-evaluation': {
            value: 'failure' as const,
            context: {
              questionIds: ['page-a'],
              activeQuestionIds: ['page-a'],
              settings: { threshold: 0.8, attemptLimit: 3, retryScope: 'all-questions' as const },
              attempt: 2,
              answers: {
                'page-a': {
                  questionId: 'page-a',
                  answerIds: ['choice-a', 'choice-b'],
                  selectedAnswerIds: ['choice-a'],
                  expectedAnswerIds: ['choice-a'],
                  questionType: 'multiple-choice' as const,
                  answerLabels: ['Choix A', 'Choix B'],
                  description: 'Question de test',
                  latencyMs: 7_250,
                  timestampMs: 1_760_000_000_000,
                },
              },
              result: { questionCount: 1, correctCount: 0, score: 0, passed: false },
            },
          },
        },
      },
    }

    expect(decodeScormReaderState(encodeScormReaderState(state, '2004v4'))).toEqual(state)
  })

  it('accepts earlier answer states without interaction metadata', () => {
    const state = {
      schemaVersion: 1 as const,
      currentPageId: 'page-a',
      projectTestState: {
        ...INITIAL_PROJECT_TEST_STATE,
        evaluationStates: {
          chapter: {
            value: 'attempting' as const,
            context: {
              questionIds: ['page-a'],
              activeQuestionIds: ['page-a'],
              settings: { threshold: 0.8, attemptLimit: 3, retryScope: 'all-questions' as const },
              attempt: 1,
              answers: {
                'page-a': {
                  questionId: 'page-a',
                  answerIds: ['answer-a'],
                  selectedAnswerIds: ['answer-a'],
                  expectedAnswerIds: ['answer-a'],
                },
              },
              result: null,
            },
          },
        },
      },
    }

    expect(decodeScormReaderState(encodeScormReaderState(state, '2004v4'))).toEqual(state)
  })

  it('rejects invalid JSON, unsupported schema versions, and incomplete reader states', () => {
    expect(decodeScormReaderState('{')).toBeUndefined()
    expect(decodeScormReaderState(JSON.stringify({ schemaVersion: 2 }))).toBeUndefined()
    expect(decodeScormReaderState(JSON.stringify({ schemaVersion: 1, currentPageId: 'page-a' }))).toBeUndefined()
    expect(decodeScormReaderState(JSON.stringify({
      schemaVersion: 1,
      currentPageId: 'page-a',
      projectTestState: {
        ...INITIAL_PROJECT_TEST_STATE,
        evaluationStates: { chapter: { value: 'attempting' } },
      },
    }))).toBeUndefined()
  })

  it('uses edition-specific suspend-data limits and fails instead of truncating', () => {
    expect(suspendDataLimit('1.2')).toBe(4096)
    expect(suspendDataLimit('2004v3')).toBe(64000)
    const largeState = {
      ...initialScormReaderState(),
      projectTestState: { ...INITIAL_PROJECT_TEST_STATE, profileValues: { value: 'x'.repeat(5000) } },
    }

    expect(() => encodeScormReaderState(largeState, '1.2')).toThrow(RangeError)
    expect(encodeScormReaderState(largeState, '2004v4').length).toBeGreaterThan(4096)
  })
})
