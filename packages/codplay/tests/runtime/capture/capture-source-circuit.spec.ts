import { describe, expect, it, vi } from 'vitest'
import { RuntimeCaptureSourceCircuit } from '../../../src/runtime/capture'
import type { RuntimeCaptureSourcePlayerPort } from '../../../src/runtime/capture'
import type { CompiledScene } from '../../../src/scene/compiled'

/** Creates a compiled scene with one capture rule for the selected source. */
function compiledScene(
  source: string,
  visibility?: 'story' | 'scene' | 'public',
): CompiledScene {
  return {
    schemaVersion: 'codplay.v2.scene.v1',
    createdAt: '2026-09-26T00:00:00.000Z',
    scene: {
      id: 'capture-source-scene',
      listen: [],
      tracks: {},
      stories: {
        story: {
          id: 'story',
          listen: [],
          persos: [{
            id: 'viewport',
            type: 'scroll-container',
            initial: { tag: 'section' },
            actions: {},
            emit: {
              [source]: {
                event: { name: 'scroll:start', ...(visibility === undefined ? {} : { visibility }) },
                capture: {},
              },
            },
          }],
        },
      },
    },
    resources: { entries: [] },
    rootNodeIds: [],
    requirements: { components: [], services: [], modules: [], resources: [] },
    actionTargetIndex: {},
  }
}

/** Creates a player facade with only the operations owned by the circuit. */
function createPlayer(overrides: Readonly<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    getCurrentTimeMs: vi.fn(() => 32),
    emit: vi.fn(async () => ({ ok: true, events: [], straps: [], issues: [] })),
    beginCompiledCapture: vi.fn(() => ({ ok: true, captureState: {} })),
    trackCapture: vi.fn(() => ({ ok: true, captureState: {}, sampleCount: 1 })),
    endCapture: vi.fn(async () => ({ ok: true, events: [], samples: [], captureState: {}, warnings: [], dispatchResults: [] })),
    cancelCapture: vi.fn(() => ({ ok: true })),
    ...overrides,
  }
}

/** Creates the capture circuit against the supplied scene and facade. */
function createCircuit(
  player: Record<string, unknown>,
  scene: CompiledScene,
): RuntimeCaptureSourceCircuit {
  return new RuntimeCaptureSourceCircuit({
    compiledScene: scene,
    player: player as unknown as RuntimeCaptureSourcePlayerPort,
  })
}

describe('RuntimeCaptureSourceCircuit', () => {
  it.each([
    { visibility: undefined, expected: { storyId: 'story' } },
    { visibility: 'story', expected: { storyId: 'story', visibility: 'story' } },
    { visibility: 'scene', expected: { visibility: 'scene' } },
    { visibility: 'public', expected: { visibility: 'public' } },
  ] as const)('resolves the scroll start event with visibility $visibility', async ({ visibility, expected }) => {
    const player = createPlayer()
    const circuit = createCircuit(player, compiledScene('scroll', visibility))

    const sessions = circuit.open({ storyId: 'story', persoId: 'viewport', source: 'scroll' })
    await Promise.resolve()

    expect(sessions).toHaveLength(1)
    expect(player.emit).toHaveBeenCalledWith(expect.objectContaining({
      name: 'scroll:start',
      applyAtMs: 32,
      ...expected,
    }))
    expect(player.beginCompiledCapture).toHaveBeenCalledWith(expect.objectContaining({
      storyId: 'story',
      declaration: {},
    }))
    sessions[0]?.cancel()
  })

  it('selects only the compiled rule belonging to the requested perso and source', async () => {
    const player = createPlayer()
    const scene = compiledScene('scroll')
    const circuit = createCircuit(player, scene)

    expect(circuit.hasRules({ storyId: 'story', persoId: 'viewport', source: 'scroll' })).toBe(true)
    expect(circuit.hasRules({ storyId: 'story', persoId: 'other', source: 'scroll' })).toBe(false)
    expect(circuit.open({ storyId: 'story', persoId: 'viewport', source: 'observe' })).toEqual([])
    expect(circuit.resolveIdentity('story:viewport')).toEqual({ storyId: 'story', persoId: 'viewport' })
    expect(player.emit).not.toHaveBeenCalled()
  })

  it('tracks queued samples in order before closing when start is asynchronous', async () => {
    let releaseStart: ((result: Readonly<{ ok: true; events: never[]; straps: never[]; issues: never[] }>) => void) | undefined
    const player = createPlayer({
      emit: vi.fn(() => new Promise((resolve) => { releaseStart = resolve })),
    })
    const circuit = createCircuit(player, compiledScene('scroll'))
    const session = circuit.open({ storyId: 'story', persoId: 'viewport', source: 'scroll' })[0]

    session?.track({ progress: 0.25 })
    session?.track({ progress: 0.75 })
    const ending = session?.end({ source: 'scroll', eventType: 'scrollend' })
    expect(player.trackCapture).not.toHaveBeenCalled()
    releaseStart?.({ ok: true, events: [], straps: [], issues: [] })
    await ending

    expect(player.trackCapture).toHaveBeenNthCalledWith(1, expect.any(String), { progress: 0.25 })
    expect(player.trackCapture).toHaveBeenNthCalledWith(2, expect.any(String), { progress: 0.75 })
    expect(player.endCapture).toHaveBeenCalledTimes(1)
  })

  it('cancels all pending sessions before they can open after suspension', async () => {
    let releaseStart: ((result: Readonly<{ ok: true; events: never[]; straps: never[]; issues: never[] }>) => void) | undefined
    const player = createPlayer({
      emit: vi.fn(() => new Promise((resolve) => { releaseStart = resolve })),
    })
    const circuit = createCircuit(player, compiledScene('scroll'))
    const sessions = circuit.open({ storyId: 'story', persoId: 'viewport', source: 'scroll' })

    circuit.suspend()
    releaseStart?.({ ok: true, events: [], straps: [], issues: [] })
    await Promise.resolve()

    expect(player.beginCompiledCapture).not.toHaveBeenCalled()
    expect(circuit.open({ storyId: 'story', persoId: 'viewport', source: 'scroll' })).toEqual([])
    expect(sessions).toHaveLength(1)
  })
})
