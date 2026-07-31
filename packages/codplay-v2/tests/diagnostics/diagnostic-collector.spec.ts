import { describe, expect, it, vi } from 'vitest'

import { DiagnosticCollector } from '../../src/diagnostics'

describe('DiagnosticCollector', () => {
  it('groups warnings and errors in a structured report', () => {
    const output = vi.fn()
    const collector = new DiagnosticCollector({ output })

    collector.warning('AUTHOR_EXAMPLE', 'Example warning')
    collector.error('AUTHOR_EXAMPLE_ERROR', 'Example error')

    expect(collector.report()).toEqual({
      all: [
        { severity: 'warning', code: 'AUTHOR_EXAMPLE', message: 'Example warning', details: undefined },
        { severity: 'error', code: 'AUTHOR_EXAMPLE_ERROR', message: 'Example error', details: undefined },
      ],
      warnings: [
        { severity: 'warning', code: 'AUTHOR_EXAMPLE', message: 'Example warning', details: undefined },
      ],
      errors: [
        { severity: 'error', code: 'AUTHOR_EXAMPLE_ERROR', message: 'Example error', details: undefined },
      ],
    })
    expect(collector.hasErrors()).toBe(true)
    expect(output).toHaveBeenCalledTimes(2)
  })

  it('deduplicates diagnostics by code and stable references', () => {
    const collector = new DiagnosticCollector()
    const details = { refs: { sceneId: 'scene-a', persoId: 'perso-a' } }

    expect(collector.warning('AUTHOR_EXAMPLE', 'First message', details)).not.toBeNull()
    expect(collector.warning('AUTHOR_EXAMPLE', 'Repeated message', details)).toBeNull()
    expect(collector.warning('AUTHOR_EXAMPLE', 'Other perso', {
      refs: { sceneId: 'scene-a', persoId: 'perso-b' },
    })).not.toBeNull()

    expect(collector.report().all).toHaveLength(2)
  })

  it('supports an explicit key and can be reset', () => {
    const collector = new DiagnosticCollector()

    collector.error('RUNTIME_EXAMPLE', 'First', undefined, 'event-1')
    expect(collector.error('RUNTIME_EXAMPLE', 'Repeated', undefined, 'event-1')).toBeNull()
    expect(collector.error('RUNTIME_EXAMPLE', 'Second', undefined, 'event-2')).not.toBeNull()

    collector.clear()

    expect(collector.report()).toEqual({ all: [], warnings: [], errors: [] })
    expect(collector.hasErrors()).toBe(false)
  })

  it('can retain repeated entries when deduplication is disabled', () => {
    const output = vi.fn()
    const collector = new DiagnosticCollector({ deduplicate: false, output })

    collector.warning('RUNTIME_EXAMPLE', 'Repeated')
    collector.warning('RUNTIME_EXAMPLE', 'Repeated')

    expect(collector.report().warnings).toHaveLength(2)
    expect(output).toHaveBeenCalledTimes(2)
  })

  it('uses console.log as the default output', () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => undefined)

    new DiagnosticCollector().warning('AUTHOR_EXAMPLE', 'Displayed warning')

    expect(consoleLog).toHaveBeenCalledWith('[warning] AUTHOR_EXAMPLE: Displayed warning')
    consoleLog.mockRestore()
  })
})
