/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CodPlayEventime } from 'codplay'
import { SightyComposition } from '../../../demos/src/sighty/demo4/sighty-composition'
import {
  DEMO4_NAVIGATION_INTENTS,
  DEMO4_SCENARIO_EVENTS,
} from '../../../demos/src/sighty/demo4/messages'

/** Provides an immediately ready image for the reused scene A preload. */
class ImmediateImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  /** Completes the image preload after the source has been assigned. */
  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }
}

/** Lets the public event relay and the runtime route queue complete. */
function flushDemo4Relay(): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 100))
}

describe('Sighty graph navigation demo', () => {
  let composition: SightyComposition | undefined

  afterEach(() => {
    composition?.destroy()
    composition = undefined
    document.head.querySelectorAll('style[data-codplay-preload-css-slot]').forEach((style) => style.remove())
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  })

  it('routes menu, directions and sequence end through the authored Sighty graph', async () => {
    vi.stubGlobal('Image', ImmediateImage)
    const stage = document.createElement('div')
    const logs: string[] = []
    document.body.append(stage)
    composition = new SightyComposition({
      stage,
      onLog: (message) => logs.push(message),
    })

    await composition.initialize()

    expect(stage.querySelector('#demo4-layout-root')).not.toBeNull()
    expect(stage.querySelector('#demo4-layout-carousel')).not.toBeNull()
    expect(stage.querySelector('#demo4-layout-menu-item')).not.toBeNull()
    expect(stage.querySelector('#demo4-layout-chapter-item')).not.toBeNull()
    expect(stage.querySelector('#demo4-layout-menu-telco')).toBeNull()
    const menuItem = stage.querySelector<HTMLElement>('#demo4-layout-menu-item')
    if (menuItem === null) throw new Error('Demo 4 menu item is missing.')
    expect(menuItem.children).toHaveLength(1)
    expect(menuItem.firstElementChild?.classList.contains('demo2-slot')).toBe(true)
    expect(stage.querySelector('.demo4-layout__carousel-item--active')).not.toBeNull()
    expect(stage.querySelector('.demo4-layout__carousel-item--inactive')).not.toBeNull()

    const menuButton = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--a')
    if (menuButton === null) throw new Error('Demo 4 menu controls are missing.')

    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-menu')
    expect(composition.runtime.getMountedSceneKey('slot-telco')).toBeUndefined()

    menuButton.click()
    await flushDemo4Relay()
    const nextButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--next')
    const previousButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--previous')
    const progress = stage.querySelector<HTMLInputElement>('#demo4-telco-progress-control')
    if (nextButton === null || previousButton === null || progress === null) {
      throw new Error('Demo 4 chapter controls are missing.')
    }
    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-a')
    expect(composition.runtime.getMountedSceneKey('slot-telco')).toBe('scene-telco')
    expect(stage.querySelector('.sighty-scene-a')).not.toBeNull()
    const chapterItem = stage.querySelector<HTMLElement>('#demo4-layout-chapter-item')
    if (chapterItem === null) throw new Error('Demo 4 chapter item is missing.')
    expect(chapterItem.children).toHaveLength(2)
    expect(Array.from(chapterItem.children).every((child) => child.classList.contains('demo2-slot'))).toBe(true)
    expect(stage.querySelector('.demo4-layout__carousel-item--leaving')).not.toBeNull()
    expect(nextButton.disabled).toBe(false)
    expect(previousButton.disabled).toBe(false)

    const sceneB = composition.runtime.getInstance('scene-b')
    if (sceneB === undefined) throw new Error('Scene B instance is missing.')
    await sceneB.telco.play()
    await new Promise((resolve) => globalThis.setTimeout(resolve, 120))
    await sceneB.telco.pause()
    expect(sceneB.telco.getProgress().timelineMs).toBeGreaterThan(0)

    nextButton.click()
    await flushDemo4Relay()
    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-b')
    expect(stage.querySelector('.sighty-scene-b')).not.toBeNull()
    const transitionSnapshots = Array.from(stage.querySelectorAll<HTMLElement>('[data-codplay-transient]'))
    expect(transitionSnapshots).toHaveLength(1)
    expect(transitionSnapshots[0]?.textContent).toContain('Scène A')
    expect(sceneB.telco.getProgress().timelineMs).toBeLessThan(1_000)

    previousButton.click()
    await flushDemo4Relay()
    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-a')

    nextButton.click()
    await flushDemo4Relay()
    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-b')

    nextButton.click()
    await flushDemo4Relay()
    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-c')
    expect(stage.querySelector('.demo4-scene-c')).not.toBeNull()

    const sceneC = composition.runtime.getInstance('scene-c')
    if (sceneC === undefined) throw new Error('Scene C instance is missing.')
    const endEvent: CodPlayEventime = {
      name: DEMO4_SCENARIO_EVENTS.sequenceEnd,
      visibility: 'public',
    }
    await sceneC.events.emit(endEvent, { scope: 'story', storyId: 'main' })
    await flushDemo4Relay()
    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-menu')
    expect(stage.querySelector('.demo4-menu')).not.toBeNull()
    expect(stage.querySelector('.demo4-telco')).toBeNull()
    expect(logs.some((message) => message.includes('Sighty → scene-c'))).toBe(true)
    expect(logs.some((message) => message.includes('Sighty → scene-menu'))).toBe(true)
  })

  it('relays the scene telco range to the selected scene only', async () => {
    vi.stubGlobal('Image', ImmediateImage)
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new SightyComposition({ stage, onLog: () => undefined })
    await composition.initialize()

    const menuButton = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--a')
    if (menuButton === null) throw new Error('Demo 4 menu controls are missing.')
    menuButton.click()
    await flushDemo4Relay()
    const progress = stage.querySelector<HTMLInputElement>('#demo4-telco-progress-control')
    if (progress === null) throw new Error('Demo 4 progress control is missing in chapter.')

    const sceneA = composition.runtime.getInstance('scene-a')
    if (sceneA === undefined) throw new Error('Scene A instance is missing.')
    await sceneA.telco.pause()
    progress.value = '3000'
    progress.dispatchEvent(new Event('input', { bubbles: true }))
    await flushDemo4Relay()

    expect(sceneA.telco.getProgress().timelineMs).toBe(3000)
    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-a')
  })

  it('keeps progress projections on the scene selected by the active view', async () => {
    vi.stubGlobal('Image', ImmediateImage)
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new SightyComposition({ stage, onLog: () => undefined })
    await composition.initialize()

    const menuButtonA = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--a')
    if (menuButtonA === null) throw new Error('Demo 4 menu control A is missing.')
    menuButtonA.click()
    await flushDemo4Relay()

    const nextButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--next')
    const progress = stage.querySelector<HTMLInputElement>('#demo4-telco-progress-control')
    if (nextButton === null || progress === null) {
      throw new Error('Demo 4 chapter controls are missing.')
    }
    const sceneA = composition.runtime.getInstance('scene-a')
    const sceneB = composition.runtime.getInstance('scene-b')
    if (sceneA === undefined || sceneB === undefined) {
      throw new Error('Demo 4 content scene instances are missing.')
    }

    await sceneA.telco.pause()
    await sceneA.telco.seek(2_400)
    await flushDemo4Relay()
    expect(Number(progress.value)).toBe(2_400)

    nextButton.click()
    await flushDemo4Relay()
    await sceneB.telco.pause()
    await sceneB.telco.seek(500)
    await flushDemo4Relay()
    expect(Number(progress.value)).toBe(500)

    await sceneA.telco.seek(8_000)
    await flushDemo4Relay()
    expect(Number(progress.value)).toBe(500)
  })

  it('keeps one outgoing presentation when scene changes are queued during a fade', async () => {
    vi.stubGlobal('Image', ImmediateImage)
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new SightyComposition({ stage, onLog: () => undefined })
    await composition.initialize()

    const menuButton = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--a')
    if (menuButton === null) throw new Error('Demo 4 menu control A is missing.')
    menuButton.click()
    await flushDemo4Relay()

    const nextButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--next')
    if (nextButton === null) throw new Error('Demo 4 next control is missing.')
    nextButton.click()
    nextButton.click()
    await flushDemo4Relay()

    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-c')
    const snapshots = Array.from(stage.querySelectorAll<HTMLElement>('[data-codplay-transient]'))
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0]?.textContent).toContain('SCÈNE B')
  })

  it('controls the selected scene and cascades both list boundaries to the menu', async () => {
    vi.stubGlobal('Image', ImmediateImage)
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new SightyComposition({ stage, onLog: () => undefined })
    await composition.initialize()

    const menuButton = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--a')
    if (menuButton === null) throw new Error('Demo 4 menu controls are missing.')
    menuButton.click()
    await flushDemo4Relay()

    const controls = stage.querySelector<HTMLDivElement>('#demo4-telco-controls')
    const previousButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--previous')
    const nextButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--next')
    const toggleButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--toggle')
    const rewindButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--rewind')
    if (controls === null
      || previousButton === null
      || nextButton === null
      || toggleButton === null
      || rewindButton === null) {
      throw new Error('Demo 4 scene telco controls are incomplete.')
    }
    expect(previousButton.parentElement).toBe(controls)
    expect(nextButton.parentElement).toBe(controls)
    expect(toggleButton.parentElement).toBe(controls)
    expect(rewindButton.parentElement).toBe(controls)
    expect(controls.querySelectorAll('button')).toHaveLength(4)

    const sceneA = composition.runtime.getInstance('scene-a')
    if (sceneA === undefined) throw new Error('Scene A instance is missing.')
    expect(toggleButton.textContent).toBe('⏸')
    toggleButton.click()
    await flushDemo4Relay()
    expect(sceneA.telco.getState().status).toBe('paused')
    expect(toggleButton.textContent).toBe('▶')
    expect(toggleButton.getAttribute('aria-label')).toBe('Lire la scène')

    await sceneA.telco.seek(2_500)
    rewindButton.click()
    await flushDemo4Relay()
    expect(sceneA.telco.getProgress().timelineMs).toBe(0)
    expect(toggleButton.textContent).toBe('▶')

    toggleButton.click()
    await flushDemo4Relay()
    expect(sceneA.telco.getState().status).toBe('playing')
    expect(toggleButton.textContent).toBe('⏸')
    toggleButton.click()
    await flushDemo4Relay()
    expect(sceneA.telco.getState().status).toBe('paused')
    expect(toggleButton.textContent).toBe('▶')

    previousButton.click()
    await flushDemo4Relay()
    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-menu')
    expect(composition.runtime.getMountedSceneKey('slot-telco')).toBeUndefined()
  })

  it('returns to the menu when next crosses the last chapter scene', async () => {
    vi.stubGlobal('Image', ImmediateImage)
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new SightyComposition({ stage, onLog: () => undefined })
    await composition.initialize()

    const menuButton = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--c')
    if (menuButton === null) throw new Error('Demo 4 menu controls are missing.')
    menuButton.click()
    await flushDemo4Relay()

    const nextButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--next')
    if (nextButton === null) throw new Error('Demo 4 next control is missing.')
    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-c')
    nextButton.click()
    await flushDemo4Relay()
    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-menu')
    expect(composition.runtime.getMountedSceneKey('slot-telco')).toBeUndefined()
  })

  it('keeps the scene telco event source active after leaving and re-entering the chapter', async () => {
    vi.stubGlobal('Image', ImmediateImage)
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new SightyComposition({ stage, onLog: () => undefined })
    await composition.initialize()

    const menuButtonB = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--b')
    if (menuButtonB === null) throw new Error('Demo 4 menu control B is missing.')
    menuButtonB.click()
    await flushDemo4Relay()

    const nextButton = (): HTMLButtonElement => {
      const button = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--next')
      if (button === null) throw new Error('Demo 4 next control is missing.')
      return button
    }
    nextButton().click()
    await flushDemo4Relay()
    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-c')

    nextButton().click()
    await flushDemo4Relay()
    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-menu')
    expect(composition.runtime.getMountedSceneKey('slot-telco')).toBeUndefined()

    const menuButtonA = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--a')
    if (menuButtonA === null) throw new Error('Demo 4 menu control A is missing after re-entry.')
    menuButtonA.click()
    await flushDemo4Relay()
    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-a')

    const telco = composition.runtime.getInstance('scene-telco')
    if (telco === undefined) throw new Error('Demo 4 scene telco instance is missing.')
    const receivedEvents: string[] = []
    const unsubscribe = telco.events.onEvent((event) => receivedEvents.push(event.name))
    nextButton().click()
    await flushDemo4Relay()
    unsubscribe()

    expect(receivedEvents).toContain(DEMO4_NAVIGATION_INTENTS.next)
    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-b')
  })

  it('enables the chapter telco immediately after resetting a stale timeline', async () => {
    vi.stubGlobal('Image', ImmediateImage)
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new SightyComposition({ stage, onLog: () => undefined })
    await composition.initialize()

    const telco = composition.runtime.getInstance('scene-telco')
    if (telco === undefined) throw new Error('Demo 4 scene telco instance is missing.')
    await telco.telco.seek(3_000)

    const menuButtonA = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--a')
    if (menuButtonA === null) throw new Error('Demo 4 menu control A is missing.')
    menuButtonA.click()
    await flushDemo4Relay()

    const nextButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--next')
    if (nextButton === null) throw new Error('Demo 4 next control is missing after activation.')
    expect(nextButton.disabled).toBe(false)
    expect(telco.telco.getProgress().timelineMs).toBeLessThan(1_000)
  })
})
