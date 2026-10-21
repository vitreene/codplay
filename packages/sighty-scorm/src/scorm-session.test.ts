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
    ['1.2', '1.2', 'cmi.core.lesson_location', 'cmi.core.exit'],
    ['2004v3', '2004', 'cmi.location', 'cmi.exit'],
    ['2004v4', '2004', 'cmi.location', 'cmi.exit'],
  ] as const)('handles opaque reader state for %s', async (version, apiVersion, locationElement, exitElement) => {
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
    expect(api.values.get(exitElement)).toBe('suspend')
    expect(api.handleExitMode).toBe(false)
    expect(api.saveCount).toBe(2)
    expect(api.quitCount).toBe(1)
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
        correctResponse: 'option-a',
        learnerResponse: 'option-b',
        result: 'incorrect',
      }],
    })

    expect(api.values.get('cmi.success_status')).toBe('failed')
    expect(api.values.get('cmi.score.raw')).toBe('60')
    expect(api.values.get('cmi.score.scaled')).toBe('0.6')
    expect(api.values.get('cmi.objectives.0.success_status')).toBe('passed')
    expect(api.values.get('cmi.objectives.0.score.raw')).toBe('90')
    expect(api.values.get('cmi.interactions.0.id')).toBe('question-1')
    expect(api.values.get('cmi.interactions.0.correct_responses.0.pattern')).toBe('option-a')
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
