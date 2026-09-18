/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
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

/** Selects one frame-specific animation root without confusing hidden contexts. */
function selectAnimationRoot(
  root: HTMLElement,
  selector: string,
  contextIndex: number,
): HTMLElement | null {
  return root.querySelector<HTMLElement>(
    `${selector}[data-animation-context="${contextIndex}"]:not([data-codplay-transient])`,
  )
}

describe('events V2 demo', () => {
  let codplay: CodPlay | undefined

  afterEach(() => {
    codplay?.destroy()
    codplay = undefined
    document.body.replaceChildren()
  })

  it('preloads every image source before creating the events instance', async () => {
    const root = document.createElement('main')
    document.body.append(root)
    codplay = new CodPlay({
      frameScheduler: createManualScheduler(),
      pauseOnDocumentHidden: false,
    })
    const build = codplay.build({ scene: createScene() })
    expect(build.ok).toBe(true)
    if (!build.ok) return

    const loadedSources: string[] = []
    const previousImage = globalThis.Image
    class ImmediateImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      set src(value: string) {
        loadedSources.push(value)
        queueMicrotask(() => this.onload?.())
      }
    }

    vi.stubGlobal('Image', ImmediateImage)
    try {
      const preload = await codplay.preload.load({
        manifest: build.compiledScene.resources,
        options: { mode: 'author' },
      })
      expect(preload.ok).toBe(true)
      if (!preload.ok) return
      expect(new Set(preload.data.loaded)).toEqual(new Set([
        '/assets/barrier/barriere.webp',
        '/assets/barrier/borne.webp',
        '/assets/barrier/feu-rouge-orange.webp',
        '/assets/barrier/feu-rouge-rouge.webp',
        '/assets/barrier/feu-rouge-vert.webp',
      ]))
      expect(new Set(loadedSources)).toEqual(new Set([
        '/assets/barrier/barriere.webp',
        '/assets/barrier/borne.webp',
        '/assets/barrier/feu-rouge-orange.webp',
        '/assets/barrier/feu-rouge-rouge.webp',
        '/assets/barrier/feu-rouge-vert.webp',
      ]))

      codplay.resources.register(preload.data)
      codplay.instances.create({
        instanceId: 'events-demo-preload-test',
        compiledScene: build.compiledScene,
        functions: build.functions,
        root,
      })
    } finally {
      vi.stubGlobal('Image', previousImage)
    }
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
    expect(selectAnimationRoot(root, '.events-barrier-arm', 1)?.style.opacity).toBe('1')
    expect(selectAnimationRoot(root, '.events-signal-image', 1)).toBeNull()
    await instance.telco.play()
    codplay.engine.advance(2_600)
    await flushDomEvent()
    expect(selectAnimationRoot(root, '.events-barrier-arm', 1)?.style.transform).toContain('rotate(0deg)')
    expect(root.querySelector<HTMLElement>('#events-frame-one-barrier-action-row .events-frame__message')?.style.opacity)
      .toBe('0')
    expect(root.querySelector<HTMLElement>('#events-frame-one-barrier-action-row .events-frame__arrow')?.style.opacity)
      .toBe('0')

    codplay.engine.advance(2_900)
    await flushDomEvent()
    expect(root.querySelector<HTMLElement>('#events-frame-one-barrier-action-row .events-frame__message')?.style.opacity)
      .toBe('1')
    expect(root.querySelector<HTMLElement>('#events-frame-one-barrier-action-row .events-frame__arrow')?.style.opacity)
      .toBe('1')
    expect(root.querySelector<HTMLElement>('#events-frame-one-barrier-action-row .events-frame__arrow')?.style.transform)
      .toContain('translateX(0px)')

    codplay.engine.advance(3_400)
    await flushDomEvent()
    codplay.engine.advance(4_900)
    await flushDomEvent()

    expect(trace.map((event) => event.name)).toContain('up')
    expect(selectAnimationRoot(root, '.events-barrier-arm', 1)?.style.transform).toContain('rotate(70deg)')
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
    expect(selectAnimationRoot(root, '.events-signal-image', 2)?.querySelector('img')?.getAttribute('src'))
      .toContain('feu-rouge-rouge.webp')
    expect(selectAnimationRoot(root, '.events-signal-image', 2)?.style.opacity).toBe('1')
    codplay.engine.advance(2_600)
    await flushDomEvent()

    expect(root.querySelector<HTMLElement>('.events-frame--visible')?.textContent).toContain('Un event se distribue')
    expect(root.querySelector<HTMLElement>('#events-frame-two-signal-action-row .events-frame__message')?.textContent)
      .toContain('perso feu')
    expect(root.querySelector<HTMLElement>('#events-frame-two-barrier-action-row .events-frame__message')?.textContent)
      .toContain('perso barrière')
    expect(selectAnimationRoot(root, '.events-signal-image', 2)?.querySelector('img')?.getAttribute('src'))
      .toContain('feu-rouge-rouge.webp')

    codplay.engine.advance(3_400)
    await flushDomEvent()

    expect(selectAnimationRoot(root, '.events-signal-image', 2)?.querySelector('img')?.getAttribute('src'))
      .toContain('feu-rouge-vert.webp')

    codplay.engine.advance(3_700)
    await flushDomEvent()
    expect(selectAnimationRoot(root, '.events-signal-image', 2)?.style.opacity).toBe('1')
  })

  it('keeps pending animation events on their own frame context', async () => {
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
      instanceId: 'events-demo-animation-context-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })
    codplay.engine.advance(0)
    await instance.events.emit(EVENTS_INITIAL_EVENTS[0]!.eventime, EVENTS_INITIAL_EVENTS[0]!.target)
    await instance.telco.play()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    await flushDomEvent()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    await flushDomEvent()

    codplay.engine.advance(2_000)
    await flushDomEvent()

    expect(root.querySelector<HTMLElement>('.events-frame--visible')?.textContent)
      .toContain('Les boutons émettent les events')
    expect(selectAnimationRoot(root, '.events-barrier-arm', 3)?.style.transform).toContain('rotate(0deg)')
    expect(selectAnimationRoot(root, '.events-signal-image', 3)?.querySelector('img')?.getAttribute('src'))
      .toContain('feu-rouge-rouge.webp')
  })

  it('does not apply a previous activation after returning to its frame', async () => {
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
      instanceId: 'events-demo-reentry-isolation-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })
    codplay.engine.advance(0)
    await instance.events.emit(EVENTS_INITIAL_EVENTS[0]!.eventime, EVENTS_INITIAL_EVENTS[0]!.target)
    await instance.telco.play()

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
    await flushDomEvent()
    codplay.engine.advance(500)
    await flushDomEvent()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }))
    await flushDomEvent()

    codplay.engine.advance(1_700)
    await flushDomEvent()

    expect(root.querySelector<HTMLElement>('.events-frame--visible')?.textContent)
      .toContain('Un event est émis')
    expect(selectAnimationRoot(root, '.events-barrier-arm', 1)?.style.transform).toContain('rotate(0deg)')
  })

  it('resets the animation context when returning to the first frame', async () => {
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
    codplay.engine.advance(3_400)
    await flushDomEvent()
    expect(selectAnimationRoot(root, '.events-signal-image', 2)?.querySelector('img')?.getAttribute('src'))
      .toContain('feu-rouge-vert.webp')

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowLeft' }))
    await flushDomEvent()
    expect(selectAnimationRoot(root, '.events-signal-image', 1)).toBeNull()
    expect(selectAnimationRoot(root, '.events-barrier-arm', 1)?.style.transform).toContain('rotate(0deg)')
  })

  it('synchronizes the fourth frame red signal with the lowered barrier', async () => {
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
    const trace: Array<{ name: string; timeMs: number }> = []
    instance.diagnostic.onTrace((event) => trace.push({ name: event.name, timeMs: event.timeMs }))
    codplay.engine.advance(0)
    await instance.events.emit(EVENTS_INITIAL_EVENTS[0]!.eventime, EVENTS_INITIAL_EVENTS[0]!.target)
    await instance.telco.play()

    for (let index = 0; index < 3; index += 1) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight' }))
      await flushDomEvent()
    }

    expect(Array.from(root.querySelectorAll<HTMLButtonElement>('.events-frame--visible .events-frame__button'))
      .map((button) => button.textContent)).toEqual(['Baisser', 'Lever'])
    expect(selectAnimationRoot(root, '.events-barrier-arm', 4)?.style.transform).toContain('rotate(70deg)')
    expect(selectAnimationRoot(root, '.events-signal-image', 4)?.querySelector('img')?.getAttribute('src'))
      .toContain('feu-rouge-vert.webp')

    const button = root.querySelector<HTMLButtonElement>('.events-frame--visible .events-frame__button--down')
    expect(button).not.toBeNull()
    if (button === null) return
    button.click()
    await flushDomEvent()
    codplay.engine.advance(0)
    await flushDomEvent()

    expect(selectAnimationRoot(root, '.events-signal-image', 4)?.querySelector('img')?.getAttribute('src'))
      .toContain('feu-rouge-orange.webp')
    expect(selectAnimationRoot(root, '.events-barrier-arm', 4)?.style.transform).toContain('rotate(70deg)')
    codplay.engine.advance(300)
    await flushDomEvent()
    expect(trace.find((event) => event.name === 'down4')).toBeDefined()
    codplay.engine.advance(500)
    await flushDomEvent()
    expect(selectAnimationRoot(root, '.events-signal-image', 4)?.querySelector('img')?.getAttribute('src'))
      .toContain('feu-rouge-orange.webp')
    expect(selectAnimationRoot(root, '.events-barrier-arm', 4)?.style.transform).not.toContain('rotate(70deg)')
    codplay.engine.advance(1_800)
    await flushDomEvent()
    expect(selectAnimationRoot(root, '.events-signal-image', 4)?.querySelector('img')?.getAttribute('src'))
      .toContain('feu-rouge-rouge.webp')
    const downTrace = trace.find((event) => event.name === 'down4')
    const redTrace = trace.find((event) => event.name === 'red4')
    expect(downTrace).toBeDefined()
    expect(redTrace).toBeDefined()
    expect(downTrace?.timeMs).toBe(300)
    expect(redTrace?.timeMs).toBe(1_800)
    expect(selectAnimationRoot(root, '.events-barrier-arm', 4)?.style.transform).not.toContain('rotate(0deg)')

    codplay.engine.advance(2_100)
    await flushDomEvent()
    expect(selectAnimationRoot(root, '.events-barrier-arm', 4)?.style.transform).not.toContain('rotate(0deg)')
    codplay.engine.advance(2_400)
    await flushDomEvent()
    expect(selectAnimationRoot(root, '.events-barrier-arm', 4)?.style.transform).toContain('rotate(0deg)')

    await instance.telco.seek(0)
    expect(selectAnimationRoot(root, '.events-signal-image', 4)?.querySelector('img')?.getAttribute('src'))
      .toContain('feu-rouge-orange.webp')
    expect(selectAnimationRoot(root, '.events-barrier-arm', 4)?.style.transform).toContain('rotate(70deg)')
    await instance.telco.seek(1_000)
    expect(selectAnimationRoot(root, '.events-signal-image', 4)?.querySelector('img')?.getAttribute('src'))
      .toContain('feu-rouge-orange.webp')
    await instance.telco.seek(1_800)
    expect(selectAnimationRoot(root, '.events-signal-image', 4)?.querySelector('img')?.getAttribute('src'))
      .toContain('feu-rouge-rouge.webp')
    expect(selectAnimationRoot(root, '.events-barrier-arm', 4)?.style.transform).not.toContain('rotate(0deg)')
    await instance.telco.seek(2_400)
    expect(selectAnimationRoot(root, '.events-barrier-arm', 4)?.style.transform).toContain('rotate(0deg)')
  })
})
