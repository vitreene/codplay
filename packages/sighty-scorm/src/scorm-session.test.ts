import { describe, expect, it } from 'vitest'
import type { PipwerksScormApi } from './scorm-types'
import { ScormSession } from './scorm-session'

/** Provides deterministic CMI values and records shared-session operations. */
class FakePipwerksApi implements PipwerksScormApi {
  public version = ''
  public handleExitMode = true
  public readonly values = new Map<string, string>()
  public readonly writes: Array<Readonly<{ parameter: string; value: string }>> = []
  public readonly operations: string[] = []
  public readonly reads: string[] = []
  public saveCount = 0
  public quitCount = 0
  public connectionAllowed = true
  public writeAllowed = true

  /** Opens the in-memory LMS connection. */
  public init(): boolean {
    this.operations.push('initialize')
    return this.connectionAllowed
  }

  /** Reads CMI values and derives the standard interaction count. */
  public get(parameter: string): string {
    this.reads.push(parameter)
    if (parameter === 'cmi.interactions._count') {
      const indices = [...this.values.keys()].flatMap((key) => {
        const match = key.match(/^cmi\.interactions\.(\d+)\.id$/)
        return match === null ? [] : [Number(match[1])]
      })
      return String(indices.length === 0 ? 0 : Math.max(...indices) + 1)
    }
    return this.values.get(parameter) ?? ''
  }

  /** Writes a CMI value and records its operation order. */
  public set(parameter: string, value: string): boolean {
    if (!this.writeAllowed) return false
    this.values.set(parameter, value)
    this.writes.push({ parameter, value })
    this.operations.push(`set:${parameter}`)
    return true
  }

  /** Commits the in-memory CMI values. */
  public save(): boolean {
    this.saveCount += 1
    this.operations.push('commit')
    return true
  }

  /** Ends the in-memory LMS session. */
  public quit(): boolean {
    this.quitCount += 1
    this.operations.push('terminate')
    return true
  }
}

describe('shared SCORM session', () => {
  it.each([
    ['1.2', '1.2', 'cmi.core.lesson_location'],
    ['2004v3', '2004', 'cmi.location'],
    ['2004v4', '2004', 'cmi.location'],
  ] as const)('handles opaque reader state for %s', async (version, apiVersion, locationElement) => {
    const api = new FakePipwerksApi()
    api.values.set(locationElement, 'saved-page')
    api.values.set('cmi.suspend_data', '{"project":"owned-by-host"}')
    const session = new ScormSession({ version, api })

    const restored = await session.initialize()
    await session.saveReaderState({ location: 'next-page', suspendData: '{"attempt":2}' })
    await session.close({ location: 'next-page', suspendData: '{"attempt":2}' })

    expect(restored).toEqual({
      location: 'saved-page',
      suspendData: '{"project":"owned-by-host"}',
      mode: '',
    })
    expect(api.version).toBe(apiVersion)
    expect(api.values.get(locationElement)).toBe('next-page')
    expect(api.values.get('cmi.suspend_data')).toBe('{"attempt":2}')
    expect(api.writes.some((write) => write.parameter === 'cmi.exit' || write.parameter === 'cmi.core.exit')).toBe(false)
    expect(api.handleExitMode).toBe(false)
    expect(api.saveCount).toBe(2)
    expect(api.quitCount).toBe(1)
  })

  it.each([
    ['1.2', 'cmi.student_data.mastery_score', '75', 75],
    ['2004v3', 'cmi.scaled_passing_score', '0.65', 65],
    ['2004v4', 'cmi.scaled_passing_score', '0.8', 80],
  ] as const)('reads the LMS mastery score for %s', async (version, element, value, expected) => {
    const api = new FakePipwerksApi()
    api.values.set(element, value)
    const session = new ScormSession({ version, api })

    await expect(session.initialize()).resolves.toMatchObject({ masteryScore: expected })
    expect(api.reads).toContain(element)
  })

  it.each([
    ['1.2', 'cmi.student_data.mastery_score', '0'],
    ['1.2', 'cmi.student_data.mastery_score', ''],
    ['2004v4', 'cmi.scaled_passing_score', '0'],
    ['2004v4', 'cmi.scaled_passing_score', ''],
  ] as const)('ignores a missing or zero LMS mastery score for %s', async (version, element, value) => {
    const api = new FakePipwerksApi()
    api.values.set(element, value)
    const session = new ScormSession({ version, api })

    await expect(session.initialize()).resolves.not.toHaveProperty('masteryScore')
  })

  it.each([
    ['1.2', 'cmi.core.session_time', '0000:02:05.99'],
    ['2004v4', 'cmi.session_time', 'PT0000H02M05S'],
  ] as const)('writes the SCO clock in the reference format for %s', async (version, element, expected) => {
    const api = new FakePipwerksApi()
    const session = new ScormSession({ version, api })
    await session.initialize()

    await session.saveReaderState({ location: 'page-a', suspendData: '{}', sessionTimeMs: 125_990 })

    expect(api.values.get(element)).toBe(expected)
  })

  it('requests a valid LMS choice and commits then terminates the SCO', async () => {
    const api = new FakePipwerksApi()
    api.values.set('adl.nav.request_valid.choice.{target=ITEM-next}', 'true')
    const session = new ScormSession({ version: '2004v4', api })
    await session.initialize()

    await expect(session.navigateToSco('ITEM-next')).resolves.toBe(true)
    expect(api.reads).toContain('adl.nav.request_valid.choice.{target=ITEM-next}')
    expect(api.values.get('adl.nav.request')).toBe('{target=ITEM-next}choice')
    expect(api.operations.slice(-3)).toEqual(['set:adl.nav.request', 'commit', 'terminate'])
    expect(api.writes.some((write) => write.parameter === 'cmi.exit')).toBe(false)
    await session.close()
    expect(api.quitCount).toBe(1)
  })

  it('keeps the session connected when the LMS rejects a SCO choice request', async () => {
    const api = new FakePipwerksApi()
    api.writeAllowed = false
    const session = new ScormSession({ version: '2004v4', api })
    await session.initialize()

    await expect(session.navigateToSco('ITEM-next')).resolves.toBe(false)
    expect(api.quitCount).toBe(0)
  })

  it('maps a generic result, objective, and choice interaction to SCORM 2004', async () => {
    const api = new FakePipwerksApi()
    api.values.set('cmi.objectives._count', '1')
    api.values.set('cmi.objectives.0.id', 'objective-1')
    const session = new ScormSession({ version: '2004v4', api })
    await session.initialize()

    await session.recordEvaluationResult({
      reader: { location: 'result-page', suspendData: '{"answers":["a"]}' },
      status: 'failed',
      score: { raw: 60, min: 0, max: 100, scaled: 0.6 },
      objective: {
        id: 'objective-1',
        status: 'passed',
        score: { raw: 90, min: 0, max: 100, scaled: 0.9 },
      },
      interactions: [{
        id: 'question-1',
        description: 'Question de test',
        correctResponse: 'option-a',
        learnerResponse: 'option-b',
        timestampMs: new Date(2026, 9, 21, 12, 34, 56, 789).getTime(),
        latencyMs: 125_999,
        weighting: 0,
        result: 'incorrect',
      }],
    })

    expect(api.values.get('cmi.success_status')).toBe('failed')
    expect(api.values.get('cmi.score.raw')).toBe('60')
    expect(api.values.get('cmi.score.scaled')).toBe('0.6')
    expect(api.values.get('cmi.objectives.0.success_status')).toBe('passed')
    expect(api.values.get('cmi.objectives.0.score.raw')).toBe('90')
    expect(api.values.get('cmi.interactions.0.id')).toBe('question-1')
    expect(api.values.get('cmi.interactions.0.type')).toBe('choice')
    expect(api.values.get('cmi.interactions.0.description')).toBe('Question de test')
    expect(api.values.get('cmi.interactions.0.correct_responses.0.pattern')).toBe('option-a')
    expect(api.values.get('cmi.interactions.0.learner_response')).toBe('option-b')
    expect(api.values.get('cmi.interactions.0.timestamp')).toBe('2026-10-21T12:34:56.78Z')
    expect(api.values.get('cmi.interactions.0.latency')).toBe('PT2M5S')
    expect(api.values.get('cmi.interactions.0.weighting')).toBe('0')
    expect(api.values.get('cmi.interactions.0.result')).toBe('incorrect')
    expect(api.saveCount).toBe(1)
  })

  it('keeps the SCORM 2004 completion status supplied with progress', async () => {
    const api = new FakePipwerksApi()
    const session = new ScormSession({ version: '2004v3', api })
    await session.initialize()

    await session.recordEvaluationResult({
      reader: {
        location: 'result-page',
        suspendData: '{}',
        progress: { measure: 0.5, completionStatus: 'incomplete' },
      },
      status: 'passed',
      score: { raw: 80, min: 0, max: 100, scaled: 0.8 },
      interactions: [],
    })

    expect(api.values.get('cmi.progress_measure')).toBe('0.5')
    expect(api.values.get('cmi.completion_status')).toBe('incomplete')
  })

  it('writes page progress and declared objective progress without inventing completion status', async () => {
    const api = new FakePipwerksApi()
    api.values.set('cmi.objectives._count', '1')
    api.values.set('cmi.objectives.0.id', 'obj_chapter-a')
    const session = new ScormSession({ version: '2004v4', api })
    await session.initialize()

    await session.saveReaderState({
      location: 'chapter-a-page-1',
      suspendData: '{}',
      progress: {
        measure: 0,
        objectives: [{ id: 'obj_chapter-a', measure: 0.25 }],
      },
    })

    expect(api.values.get('cmi.progress_measure')).toBe('0')
    expect(api.values.has('cmi.completion_status')).toBe(false)
    expect(api.values.get('cmi.objectives.0.progress_measure')).toBe('0.25')
    expect(api.values.has('cmi.objectives.0.completion_status')).toBe(false)
  })

  it('does not write an incomplete 1.2 lesson status during ordinary page progress', async () => {
    const api = new FakePipwerksApi()
    const session = new ScormSession({ version: '1.2', api })
    await session.initialize()

    await session.saveReaderState({
      location: 'chapter-a-page-1',
      suspendData: '{}',
      progress: { measure: 0.25 },
    })

    expect(api.values.has('cmi.core.lesson_status')).toBe(false)
  })

  it('writes a 1.2 chapter completion to lesson_status without 2004 fields', async () => {
    const api = new FakePipwerksApi()
    const session = new ScormSession({ version: '1.2', api })
    await session.initialize()

    await session.saveReaderState({
      location: 'chapter-a-last-page',
      suspendData: '{}',
      progress: { measure: 1, completionStatus: 'completed' },
    })

    expect(api.values.get('cmi.core.lesson_status')).toBe('completed')
    expect(api.values.has('cmi.progress_measure')).toBe(false)
    expect(api.values.has('cmi.completion_status')).toBe(false)
  })

  it('commits one immediate interaction with its reader state for SCORM 2004', async () => {
    const api = new FakePipwerksApi()
    const session = new ScormSession({ version: '2004v4', api })
    await session.initialize()

    await session.recordInteraction(
      { location: 'question-page', suspendData: '{"answers":1}' },
      {
        id: 'question-page_0',
        type: 'true-false',
        description: 'Question immédiate',
        correctResponse: 'Oui',
        learnerResponse: 'Oui',
        timestampMs: new Date(2026, 9, 21, 12, 34, 56, 789).getTime(),
        latencyMs: 8_999,
        weighting: 0,
        result: 'correct',
      },
    )

    expect(api.values.get('cmi.location')).toBe('question-page')
    expect(api.values.get('cmi.suspend_data')).toBe('{"answers":1}')
    expect(api.values.get('cmi.interactions.0.id')).toBe('question-page_0')
    expect(api.values.get('cmi.interactions.0.type')).toBe('true-false')
    expect(api.values.get('cmi.interactions.0.correct_responses.0.pattern')).toBe('Oui')
    expect(api.values.get('cmi.interactions.0.learner_response')).toBe('Oui')
    expect(api.values.get('cmi.interactions.0.timestamp')).toBe('2026-10-21T12:34:56.78Z')
    expect(api.values.get('cmi.interactions.0.latency')).toBe('PT0M8S')
    expect(api.saveCount).toBe(1)
  })

  it('writes evaluation results but no interactions for SCORM 1.2', async () => {
    const api = new FakePipwerksApi()
    const session = new ScormSession({ version: '1.2', api })
    await session.initialize()

    await session.recordEvaluationResult({
      reader: { location: 'result-page', suspendData: '{}' },
      status: 'failed',
      score: { raw: 60, min: 0, max: 100, scaled: 0.6 },
      interactions: [{
        id: 'question-1',
        description: 'Question de test',
        correctResponse: 'option-a',
        learnerResponse: 'option-b',
        timestampMs: 1_760_000_000_000,
        latencyMs: 8_000,
        weighting: 0,
        result: 'incorrect',
      }],
    })
    await session.recordInteraction(
      { location: 'question-page', suspendData: '{}' },
      {
        id: 'question-page_0',
        type: 'true-false',
        correctResponse: 'Oui',
        learnerResponse: 'Oui',
        result: 'correct',
      },
    )

    expect(api.values.get('cmi.core.lesson_status')).toBe('failed')
    expect(api.values.get('cmi.core.score.raw')).toBe('60')
    expect(api.writes.some(({ parameter }) => parameter.startsWith('cmi.interactions.'))).toBe(false)
  })

  it('does not write data in browse mode and still terminates the session', async () => {
    const api = new FakePipwerksApi()
    api.values.set('cmi.mode', 'browse')
    const session = new ScormSession({ version: '2004v4', api })
    await session.initialize()

    await session.saveReaderState({ location: 'page-a', suspendData: '{}' })
    await session.close()

    expect(api.writes).toHaveLength(0)
    expect(api.quitCount).toBe(1)
  })

  it('rejects suspend data beyond the edition limit before writing it', async () => {
    const api = new FakePipwerksApi()
    const session = new ScormSession({ version: '1.2', api })
    await session.initialize()

    await expect(session.saveReaderState({ location: null, suspendData: 'x'.repeat(4097) }))
      .rejects.toThrow('limite SCORM 1.2')
    expect(api.values.has('cmi.suspend_data')).toBe(false)
  })

  it('surfaces a failed LMS write to the caller', async () => {
    const api = new FakePipwerksApi()
    const session = new ScormSession({ version: '1.2', api })
    await session.initialize()
    api.writeAllowed = false

    await expect(session.saveReaderState({ location: 'page-a', suspendData: '{}' }))
      .rejects.toThrow('Échec SCORM')
  })
})
