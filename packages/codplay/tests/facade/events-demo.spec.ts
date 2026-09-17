/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay, type CodPlayFrameScheduler } from '../../src'
import { EVENTS_INITIAL_EVENTS, createScene } from '../../../demos/src/v2/demos/events/main'

/** Creates a scheduler that leaves frame advancement under test control. */
function createManualScheduler(): CodPlayFrameScheduler {
  return {
    request: () => 1,
    cancel: () => undefined,
  }
}

/** Registers the local barrier and signal resources for the runtime fixture. */
function registerEventsResources(codplay: CodPlay): void {
  codplay.resources.register({
    loaded: [
      '/assets/barrier/barriere.webp',
      '/assets/barrier/borne.webp',
      '/assets/barrier/feu-rouge-orange.webp',
      '/assets/barrier/feu-rouge-rouge.webp',
      '/assets/barrier/feu-rouge-vert.webp',
    ],
    skipped: [],
    metadata: {
      '/assets/barrier/barriere.webp': { type: 'image' },
      '/assets/barrier/borne.webp': { type: 'image' },
      '/assets/barrier/feu-rouge-orange.webp': { type: 'image' },
      '/assets/barrier/feu-rouge-rouge.webp': { type: 'image' },
      '/assets/barrier/feu-rouge-vert.webp': { type: 'image' },
    },
  })
}

/** Lets the delegated DOM event source and its straps finish dispatching. */
async function flushDomEvent(): Promise<void> {
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0))
}

describe('events V2 demo', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('runs the scheduled up event through the barrier action story', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    registerEventsResources(codplay)
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return
    expect(new Set(build.compiledScene.resources.entries.map((entry) => entry.url))).toEqual(new Set([
      '/assets/barrier/barriere.webp',
      '/assets/barrier/borne.webp',
      '/assets/barrier/feu-rouge-orange.webp',
      '/assets/barrier/feu-rouge-rouge.webp',
      '/assets/barrier/feu-rouge-vert.webp',
    ]))
    const instance = codplay.instances.create({
      instanceId: 'events-demo-barrier-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })
    const trace: Array<{ name: string; storyId?: string; visibility?: string; timeMs: number }> = []
    instance.diagnostic.onTrace((event) => trace.push({ name: event.name, storyId: event.storyId, visibility: event.visibility, timeMs: event.timeMs }))

    codplay.engine.advance(0)
    await instance.events.emit(EVENTS_INITIAL_EVENTS[0]!.eventime, EVENTS_INITIAL_EVENTS[0]!.target)
    await instance.telco.play()
    codplay.engine.advance(3_000)
    await flushDomEvent()

    expect(trace.map((event) => event.name)).toContain('up')
    expect(root.querySelector<HTMLElement>('.events-barrier-arm')?.style.transform).toContain('rotate(70deg)')
  })

  it('distributes the second frame up event to the barrier and the signal', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    registerEventsResources(codplay)
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return

    const instance = codplay.instances.create({
      instanceId: 'events-demo-distribution-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })
    codplay.engine.advance(0)
    await instance.events.emit(EVENTS_INITIAL_EVENTS[0]!.eventime, EVENTS_INITIAL_EVENTS[0]!.target)
    await instance.telco.play()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    await flushDomEvent()
    expect(root.querySelector<HTMLElement>('.events-signal-image img')?.getAttribute('src')).toContain('feu-rouge-vert.webp')
    expect(root.querySelector<HTMLElement>('.events-signal-image')?.style.opacity).toBe('1')
    codplay.engine.advance(2_000)
    await flushDomEvent()

    expect(root.querySelector<HTMLElement>('.events-frame--visible')?.textContent).toContain('Un event se distribue')
    expect(root.querySelector<HTMLElement>('.events-signal-image img')?.getAttribute('src')).toContain('feu-rouge-rouge.webp')
    expect(root.querySelector<HTMLElement>('.events-signal-image')?.style.opacity).toBe('1')
  })

  it('resets both reusable animations when returning to the first frame', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    registerEventsResources(codplay)
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return

    const instance = codplay.instances.create({
      instanceId: 'events-demo-navigation-reset-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })
    codplay.engine.advance(0)
    await instance.events.emit(EVENTS_INITIAL_EVENTS[0]!.eventime, EVENTS_INITIAL_EVENTS[0]!.target)
    await instance.telco.play()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    await flushDomEvent()
    codplay.engine.advance(2_000)
    await flushDomEvent()
    expect(root.querySelector<HTMLElement>('.events-signal-image img')?.getAttribute('src')).toContain('feu-rouge-rouge.webp')

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }))
    await flushDomEvent()
    expect(root.querySelector<HTMLElement>('.events-signal-image img')?.getAttribute('src')).toContain('feu-rouge-vert.webp')
    expect(root.querySelector<HTMLElement>('.events-signal-image')?.style.opacity).toBe('0')
    expect(root.querySelector<HTMLElement>('.events-barrier-arm')?.style.transform).toContain('rotate(0deg)')
  })

  it('delays the fourth frame signal transition by one second after a button event', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    registerEventsResources(codplay)
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return

    const instance = codplay.instances.create({
      instanceId: 'events-demo-delay-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })
    codplay.engine.advance(0)
    await instance.events.emit(EVENTS_INITIAL_EVENTS[0]!.eventime, EVENTS_INITIAL_EVENTS[0]!.target)
    await instance.telco.play()

    for (let index = 0; index < 3; index += 1) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
      await flushDomEvent()
    }

    const button = root.querySelector<HTMLButtonElement>('.events-frame--visible .events-frame__button--up')
    expect(button).not.toBeNull()
    if (button === null) return
    button.click()
    await flushDomEvent()
    codplay.engine.advance(0)
    await flushDomEvent()

    expect(root.querySelector<HTMLElement>('.events-signal-image img')?.getAttribute('src')).toContain('feu-rouge-orange.webp')
    codplay.engine.advance(1_000)
    await flushDomEvent()
    expect(root.querySelector<HTMLElement>('.events-signal-image img')?.getAttribute('src')).toContain('feu-rouge-rouge.webp')

    await instance.telco.seek(0)
    expect(root.querySelector<HTMLElement>('.events-signal-image img')?.getAttribute('src')).toContain('feu-rouge-orange.webp')
    await instance.telco.seek(1_000)
    expect(root.querySelector<HTMLElement>('.events-signal-image img')?.getAttribute('src')).toContain('feu-rouge-rouge.webp')
  })
})
