import { describe, expect, it, vi } from 'vitest'

import { DiagnosticCollector } from '../../../src/diagnostics'
import { RuntimeEngine } from '../../../src/runtime/engine'
import type { TickPayload, Ticker } from '../../../src/runtime/time'

describe('RuntimeEngine', () => {
  it('reports unavailable compiled capabilities', () => {
    const engine = new RuntimeEngine({ components: ['tag'], services: [], modules: [], resources: [] })
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })

    engine.validateRequirements({ components: ['tag', 'media'], services: ['style'], modules: [], resources: [] }, diagnostics)

    expect(diagnostics.report().errors.map((entry) => entry.code)).toEqual([
      'RUNTIME_COMPONENT_UNAVAILABLE',
      'RUNTIME_SERVICE_UNAVAILABLE',
    ])
  })

  it('advances registered instances in registration order from external time', () => {
    const engine = new RuntimeEngine({ components: [], services: [], modules: [], resources: [] })
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
    const engine = new RuntimeEngine({ components: [], services: [], modules: [], resources: [] })
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
})
