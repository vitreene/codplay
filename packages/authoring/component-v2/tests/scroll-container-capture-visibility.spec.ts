import type { CompiledScene } from 'codplay/scene/compiled'
import type { HtmlSourceAdapterContext } from 'codplay/runtime/runner-html'
import { afterEach, expect, it, vi } from 'vitest'
import { createScrollContainerSourceAdapter } from '../src/scroll-container/scroll-container-source-adapter'

class TestElement {
  readonly ownerDocument = {}
  readonly scrollTop = 25
  readonly scrollHeight = 200
  readonly clientHeight = 100
  readonly addEventListener = vi.fn()
  readonly removeEventListener = vi.fn()

  /** Supplies the geometry required by the shared measurable element guard. */
  getBoundingClientRect(): DOMRect {
    return {} as DOMRect
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it.each([
  { visibility: undefined, expectedStoryId: 'story', expectedVisibility: undefined },
  { visibility: 'story', expectedStoryId: 'story', expectedVisibility: 'story' },
  { visibility: 'scene', expectedStoryId: undefined, expectedVisibility: 'scene' },
  { visibility: 'public', expectedStoryId: undefined, expectedVisibility: 'public' },
] as const)(
  'routes a scroll capture start with visibility $visibility',
  async ({ visibility, expectedStoryId, expectedVisibility }) => {
    vi.stubGlobal('Element', TestElement)
    const element = new TestElement()
    const event = {
      name: 'scroll:start',
      ...(visibility === undefined ? {} : { visibility }),
    }
    const compiledScene = {
      scene: {
        id: 'scene',
        stories: {
          story: {
            persos: [{
              id: 'viewport',
              type: 'scroll-container',
              initial: { values: { progress: { axis: 'block' } } },
              emit: { scroll: { event, capture: {} } },
            }],
          },
        },
      },
    } as unknown as CompiledScene
    const solvedScene = {
      persos: { 'story:viewport': { placement: { mounted: true } } },
    }
    const emit = vi.fn(async (_input: unknown) => ({ ok: true, events: [], issues: [] }))
    const context = {
      compiledScene,
      getSolvedScene: () => solvedScene,
      getLifecycleState: () => 'playing',
      getCurrentTimeMs: () => 12,
      resolvePersoElement: () => element as unknown as Element,
      commands: {
        emit,
        beginCompiledCapture: () => ({ ok: true }),
        trackCapture: () => ({ ok: true }),
        endCapture: vi.fn(),
        cancelCapture: vi.fn(() => ({ ok: true })),
        setLiveActions: vi.fn(),
      },
      reportDiagnostic: vi.fn(),
    } as unknown as HtmlSourceAdapterContext
    const adapter = createScrollContainerSourceAdapter(context)

    adapter.attach()
    adapter.onScenePresented?.(solvedScene as never)
    await Promise.resolve()
    await Promise.resolve()

    const emittedEvent = emit.mock.calls[0]?.[0] as Record<string, unknown> | undefined
    expect(emittedEvent).toMatchObject({
      name: 'scroll:start',
      applyAtMs: 12,
      ...(expectedStoryId === undefined ? {} : { storyId: expectedStoryId }),
      ...(expectedVisibility === undefined ? {} : { visibility: expectedVisibility }),
    })
    if (expectedStoryId === undefined) expect(emittedEvent).not.toHaveProperty('storyId')
    if (expectedVisibility === undefined) expect(emittedEvent).not.toHaveProperty('visibility')
    adapter.destroy()
  },
)
