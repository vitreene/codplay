import { describe, expect, it } from 'vitest'
import type { PipwerksScormApi } from '@codplay/sighty-scorm'
import { ScormSession } from '@codplay/sighty-scorm/session'
import type { QuizHuntSavedGameState } from '../persistence/quiz-hunt-game-state-persistence'
import { QuizHuntScormAdapter } from './quiz-hunt-scorm-adapter'

class FakePipwerksApi implements PipwerksScormApi {
  public version = ''
  public readonly values = new Map<string, string>()

  /** Opens the fake LMS connection. */
  public init(): boolean { return true }

  /** Reads one stored fake CMI value. */
  public get(parameter: string): string { return this.values.get(parameter) ?? '' }

  /** Stores one fake CMI value. */
  public set(parameter: string, value: string): boolean {
    this.values.set(parameter, value)
    return true
  }

  /** Accepts one fake LMS commit. */
  public save(): boolean { return true }

  /** Closes the fake LMS connection. */
  public quit(): boolean { return true }
}

describe('Quiz Hunt SCORM adapter', () => {
  it('restores versioned run data and writes one verdict without a numeric score', async () => {
    const api = new FakePipwerksApi()
    const session = new ScormSession({ version: '2004v4', api })
    const adapter = new QuizHuntScormAdapter(session, 'quiz-hunt-document', await session.initialize())
    const savedGameState: QuizHuntSavedGameState = {
      seed: 21,
      savedAt: 1_800_000_000_000,
      state: {
        trialStatus: { 'trial-red': 'success' },
        basket: { red: 'trial-red' },
        timerRemainingMs: 12_000,
        outcome: 'success',
      },
    }

    await adapter.saveGameState('quiz-hunt-document', savedGameState)

    const suspendData = JSON.parse(api.values.get('cmi.suspend_data') ?? '{}') as Readonly<{
      schemaVersion: number
      documentId: string
      savedGameState: QuizHuntSavedGameState
    }>
    expect(suspendData).toEqual({
      schemaVersion: 1,
      documentId: 'quiz-hunt-document',
      savedGameState,
    })
    expect(api.values.get('cmi.completion_status')).toBe('completed')
    expect(api.values.get('cmi.success_status')).toBe('passed')
    expect(api.values.has('cmi.score.raw')).toBe(false)

    const resumedSession = new ScormSession({ version: '2004v4', api })
    const resumed = new QuizHuntScormAdapter(resumedSession, 'quiz-hunt-document', await resumedSession.initialize())
    await expect(resumed.readGameState('quiz-hunt-document')).resolves.toEqual(savedGameState)
    expect(api.values.get('cmi.completion_status')).toBe('completed')
    expect(api.values.get('cmi.success_status')).toBe('passed')
  })

  it('clears the saved run and resets the LMS verdict when restarting', async () => {
    const api = new FakePipwerksApi()
    const session = new ScormSession({ version: '1.2', api })
    const adapter = new QuizHuntScormAdapter(session, 'quiz-hunt-document', await session.initialize())
    await adapter.saveGameState('quiz-hunt-document', {
      seed: 21,
      savedAt: 1_800_000_000_000,
      state: { outcome: 'failure' },
    })

    await adapter.clearGameState('quiz-hunt-document')

    expect(await adapter.readGameState('quiz-hunt-document')).toBeNull()
    expect(api.values.get('cmi.core.lesson_status')).toBe('incomplete')
    expect(api.values.get('cmi.core.lesson_location')).toBe('')
    expect(JSON.parse(api.values.get('cmi.suspend_data') ?? '{}')).toMatchObject({
      schemaVersion: 1,
      savedGameState: null,
    })
    expect(api.values.has('cmi.core.score.raw')).toBe(false)
  })
})
