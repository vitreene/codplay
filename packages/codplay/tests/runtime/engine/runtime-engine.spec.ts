import { describe, expect, it, vi } from 'vitest'

import { DiagnosticCollector } from '../../../src/diagnostics'
import { RuntimeCapabilityCatalog } from '../../../src/runtime/catalog'
import { RuntimeEngine } from '../../../src/runtime/engine'
import { TagComponent } from '../../../src/runtime/components'
import type { TickPayload, Ticker } from '../../../src/runtime/time'

describe('RuntimeEngine', () => {
  it('reports unavailable compiled capabilities', () => {
    const catalog = new RuntimeCapabilityCatalog()
    catalog.registerComponent({
      type: 'tag',
      component: TagComponent,
      modules: [],
      validateInitial: () => undefined,
    })
    const engine = new RuntimeEngine(catalog)
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })

    engine.validateRequirements({ components: ['tag', 'media'], services: ['style'], modules: [], resources: [] }, diagnostics)

    expect(diagnostics.report().errors.map((entry) => entry.code)).toEqual([
      'RUNTIME_COMPONENT_UNAVAILABLE',
      'RUNTIME_SERVICE_UNAVAILABLE',
    ])
  })

  it('advances registered instances in registration order from external time', () => {
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const frames: string[] = []

    engine.registerInstance('first', (frame) => frames.push(`first:${frame.deltaMs}`))
    engine.registerInstance('second', (frame) => frames.push(`second:${frame.deltaMs}`))
    engine.advance(100)
    engine.advance(140)

    expect(frames).toEqual(['first:0', 'second:0', 'first:40', 'second:40'])
  })

  it('routes ticker payloads without recomputing their measured delta', () => {
    let emit: ((payload: TickPayload) => void) | undefined
    let running = false
    const ticker: Ticker = {
      start(onTick) {
        running = true
        emit = onTick
      },
      stop() {
        running = false
        emit = undefined
      },
      isRunning: () => running,
    }
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const frames: Array<{ deltaMs: number; marginMs: number }> = []
    engine.registerInstance('player', (frame) => frames.push({ deltaMs: frame.deltaMs, marginMs: frame.marginMs }))

    engine.start(ticker)
    emit?.({ prevMs: 0, nowMs: 16, deltaMs: 16, marginMs: 4 })
    emit?.({ prevMs: 16, nowMs: 32, deltaMs: 16, marginMs: 4 })

    expect(frames).toEqual([{ deltaMs: 16, marginMs: 4 }, { deltaMs: 16, marginMs: 4 }])
    expect(engine.isRunning()).toBe(true)
    engine.stop()
    expect(engine.isRunning()).toBe(false)
  })

  it('does not propagate external frames after stop until the external clock resumes', () => {
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const frames: number[] = []
    engine.registerInstance('player', (frame) => frames.push(frame.nowMs))

    engine.advance(100)
    engine.stop()
    engine.advance(200)
    expect(frames).toEqual([100])

    engine.start()
    engine.advance(300)
    expect(frames).toEqual([100, 300])
  })

  it('seeks a selected group through validate, prepare, commit, and present phases', () => {
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const phases: string[] = []

    for (const instanceId of ['first', 'second']) {
      engine.registerInstance(
        instanceId,
        () => undefined,
        {
          validateSeek: (timeMs) => phases.push(`${instanceId}:validate:${timeMs}`),
          prepareSeek: () => phases.push(`${instanceId}:prepare`),
          commitSeek: (timeMs) => phases.push(`${instanceId}:commit:${timeMs}`),
          presentSeek: () => phases.push(`${instanceId}:present`),
          rollbackSeek: () => phases.push(`${instanceId}:rollback`),
        },
      )
    }

    engine.seek([
      { instanceId: 'first', timeMs: 3000 },
      { instanceId: 'second', timeMs: 2000 },
    ])

    expect(phases).toEqual([
      'first:validate:3000',
      'second:validate:2000',
      'first:prepare',
      'second:prepare',
      'first:commit:3000',
      'second:commit:2000',
      'first:present',
      'second:present',
    ])
  })

  it('does not prepare a group when one target cannot be validated', () => {
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const phases: string[] = []

    engine.registerInstance('first', () => undefined, {
      validateSeek: () => phases.push('first:validate'),
      abortSeek: () => phases.push('first:abort'),
      prepareSeek: () => phases.push('first:prepare'),
      commitSeek: () => phases.push('first:commit'),
      presentSeek: () => phases.push('first:present'),
      rollbackSeek: () => phases.push('first:rollback'),
    })
    engine.registerInstance('second', () => undefined, {
      validateSeek: () => {
        phases.push('second:validate')
        throw new Error('not seekable')
      },
      prepareSeek: () => phases.push('second:prepare'),
      commitSeek: () => phases.push('second:commit'),
      presentSeek: () => phases.push('second:present'),
      rollbackSeek: () => phases.push('second:rollback'),
    })

    expect(() =>
      engine.seek([
        { instanceId: 'first', timeMs: 3000 },
        { instanceId: 'second', timeMs: 2000 },
      ]),
    ).toThrow('not seekable')
    expect(phases).toEqual(['first:validate', 'second:validate', 'first:abort'])
  })

  it('rolls back every target when commit fails after preparation', () => {
    const engine = new RuntimeEngine(new RuntimeCapabilityCatalog())
    const phases: string[] = []

    engine.registerInstance('first', () => undefined, {
      validateSeek: () => phases.push('first:validate'),
      prepareSeek: () => phases.push('first:prepare'),
      commitSeek: () => phases.push('first:commit'),
      presentSeek: () => phases.push('first:present'),
      rollbackSeek: () => phases.push('first:rollback'),
    })
    engine.registerInstance('second', () => undefined, {
      validateSeek: () => phases.push('second:validate'),
      prepareSeek: () => phases.push('second:prepare'),
      commitSeek: () => {
        phases.push('second:commit')
        throw new Error('commit failed')
      },
      presentSeek: () => phases.push('second:present'),
      rollbackSeek: () => phases.push('second:rollback'),
    })

    expect(() => engine.seek([
      { instanceId: 'first', timeMs: 3000 },
      { instanceId: 'second', timeMs: 2000 },
    ])).toThrow('commit failed')
    expect(phases).toEqual([
      'first:validate',
      'second:validate',
      'first:prepare',
      'second:prepare',
      'first:commit',
      'second:commit',
      'second:rollback',
      'first:rollback',
    ])
  })
})
