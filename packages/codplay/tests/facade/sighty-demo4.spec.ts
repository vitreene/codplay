/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CodPlayEventime } from 'codplay'
import { SightyComposition } from '../../../demos/src/sighty/demo4/sighty-composition'
import {
  DEMO4_NAVIGATION_INTENTS,
  DEMO4_SCENARIO_EVENTS,
} from '../../../demos/src/sighty/demo4/messages'
import {
  createLayoutCarouselItem,
  createMenuCarouselSlot,
  DEMO4_LAYOUT_CAROUSEL,
  DEMO4_LAYOUT_CAROUSEL_EVENTS,
  DEMO4_LAYOUT_ITEM_IDS,
} from '../../../demos/src/sighty/demo4/carousel'

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

  it('declares the menu return as a bottom-to-top carousel entry', () => {
    const menuItem = createMenuCarouselSlot()
    const menuArtifact = DEMO4_LAYOUT_CAROUSEL.children.find(
      (child) => child.id === DEMO4_LAYOUT_ITEM_IDS.menu,
    )
    const menuEnter = menuItem.actions?.[DEMO4_LAYOUT_CAROUSEL_EVENTS[DEMO4_LAYOUT_ITEM_IDS.menu].enter]

    expect(menuArtifact?.events.intro?.ref).toBe('swipe-down')
    expect(menuEnter).toMatchObject({
      style: {
        x: '0%',
        y: { from: '100%', to: '0%' },
      },
    })
    expect((menuItem.initial as { tag?: string } | undefined)?.tag).toBe('section')
    expect(menuItem.initial?.attr).toMatchObject({ id: 'demo4-layout-menu-item' })

    const chapterItem = createLayoutCarouselItem(
      DEMO4_LAYOUT_ITEM_IDS.chapter,
      '<section id="demo4-layout-test-chapter"></section>',
    )
    const chapterLeave = chapterItem.actions?.[
      DEMO4_LAYOUT_CAROUSEL_EVENTS[DEMO4_LAYOUT_ITEM_IDS.chapter].leave
    ]
    expect(chapterLeave).toMatchObject({
      style: {
        opacity: { from: 1, to: 0 },
      },
    })
    expect(chapterLeave).not.toMatchObject({ style: { x: expect.anything() } })
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
    expect(stage.querySelector('#demo4-layout-root')?.classList.contains('demo4-layout-carousel')).toBe(true)
    expect(stage.querySelector('#demo4-layout-menu-item')).not.toBeNull()
    expect(stage.querySelector('#demo4-layout-chapter-item')).not.toBeNull()
    expect(stage.querySelector('#demo4-layout-menu-telco')).toBeNull()
    const menuItem = stage.querySelector<HTMLElement>('#demo4-layout-menu-item')
    if (menuItem === null) throw new Error('Demo 4 menu item is missing.')
    expect(menuItem.children).toHaveLength(1)
    expect(menuItem.firstElementChild?.classList.contains('ac-scene-root')).toBe(true)
    expect(stage.querySelector('.demo4-layout__carousel-item--active')).not.toBeNull()
    expect(stage.querySelector('.demo4-layout__carousel-item--inactive')).not.toBeNull()

    const menuButton = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--a')
    if (menuButton === null) throw new Error('Demo 4 menu controls are missing.')

    expect(composition.runtime.getMountedSceneKey('slot-menu')).toBe('scene-menu')
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

    nextButton.click()
    await flushDemo4Relay()
    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-b')
    expect(stage.querySelector('.sighty-scene-b')).not.toBeNull()
    const sceneB = composition.runtime.getInstance('scene-b')
    if (sceneB === undefined) throw new Error('Scene B instance is missing.')
    await sceneB.telco.pause()
    await sceneB.telco.seek(1_200)
    expect(sceneB.telco.getProgress().timelineMs).toBeGreaterThan(1_000)
    const transitionSnapshots = Array.from(stage.querySelectorAll<HTMLElement>('[data-codplay-transient]'))
    expect(transitionSnapshots).toHaveLength(2)
    expect(transitionSnapshots[0]?.textContent).toContain('Scène A')
    expect(transitionSnapshots[1]?.textContent).toContain('SCÈNE B')

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
    expect(composition.runtime.getMountedSceneKey('slot-menu')).toBe('scene-menu')
    expect(stage.querySelector('.demo4-menu')).not.toBeNull()
    const chapterItemAfterReturn = stage.querySelector<HTMLElement>('#demo4-layout-chapter-item')
    expect(chapterItemAfterReturn?.querySelector('.demo4-scene-c')).not.toBeNull()
    expect(chapterItemAfterReturn?.querySelector('.demo4-telco')).not.toBeNull()
    expect(chapterItemAfterReturn?.classList.contains('demo4-layout__carousel-item--leaving')).toBe(true)
    expect(logs.some((message) => message.includes('Sighty → scene-c'))).toBe(true)
  })

  it('relays the scene telco range to the selected scene only', async () => {
    vi.stubGlobal('Image', ImmediateImage)
    const stage = document.createElement('div')
    document.body.append(stage)
    const logs: string[] = []
    composition = new SightyComposition({ stage, onLog: (message) => logs.push(message) })
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
    await sceneA.telco.seek(2_400)
    await flushDemo4Relay()
    expect(Number(progress.value)).toBe(2_400)

    await sceneA.telco.play()
    await new Promise((resolve) => globalThis.setTimeout(resolve, 120))
    expect(Number(progress.value)).toBeGreaterThan(2_400)
    await sceneA.telco.pause()

    progress.value = '3000'
    progress.dispatchEvent(new Event('input', { bubbles: true }))
    await flushDemo4Relay()

    expect(sceneA.telco.getProgress().timelineMs).toBe(3000)
    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-a')

    const nextButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--next')
    if (nextButton === null) throw new Error('Demo 4 next control is missing.')
    nextButton.click()
    await flushDemo4Relay()
    const sceneB = composition.runtime.getInstance('scene-b')
    if (sceneB === undefined) throw new Error('Scene B instance is missing.')
    await sceneB.telco.pause()
    await sceneB.telco.seek(500)
    await flushDemo4Relay()
    expect(Number(progress.value)).toBe(500)

    await sceneA.telco.seek(8_000)
    await flushDemo4Relay()
    expect(Number(progress.value)).toBe(500)
  })

  it('opens a new chapter scene directly after a menu return', async () => {
    vi.stubGlobal('Image', ImmediateImage)
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new SightyComposition({ stage, onLog: () => undefined })
    await composition.initialize()

    const menuButtonA = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--a')
    if (menuButtonA === null) throw new Error('Demo 4 menu control A is missing.')
    menuButtonA.click()
    await flushDemo4Relay()

    const previousButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--previous')
    if (previousButton === null) throw new Error('Demo 4 previous control is missing.')
    previousButton.click()
    await flushDemo4Relay()
    expect(composition.runtime.getMountedSceneKey('slot-menu')).toBe('scene-menu')

    const menuButtonB = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--b')
    if (menuButtonB === null) throw new Error('Demo 4 menu control B is missing.')
    menuButtonB.click()
    await flushDemo4Relay()

    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-b')
    expect(stage.querySelector('.sighty-scene-b')).not.toBeNull()
    expect(stage.querySelector('.sighty-scene-a')).toBeNull()
    expect(stage.querySelectorAll('[data-codplay-transient]')).toHaveLength(0)
  })

  it('rejects a rapid second navigation while keeping the two presentation copies', async () => {
    vi.stubGlobal('Image', ImmediateImage)
    const stage = document.createElement('div')
    document.body.append(stage)
    const errors: string[] = []
    composition = new SightyComposition({
      stage,
      onLog: (message, level) => {
        if (level === 'error') errors.push(message)
      },
    })
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

    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-b')
    const snapshots = Array.from(stage.querySelectorAll<HTMLElement>('[data-codplay-transient]'))
    expect(snapshots).toHaveLength(2)
    expect(snapshots[0]?.textContent).toContain('Scène A')
    expect(snapshots[1]?.textContent).toContain('SCÈNE B')
    expect(errors).toEqual([])
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
    expect(composition.runtime.getMountedSceneKey('slot-menu')).toBe('scene-menu')
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
    expect(composition.runtime.getMountedSceneKey('slot-menu')).toBe('scene-menu')
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
    expect(composition.runtime.getMountedSceneKey('slot-menu')).toBe('scene-menu')
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

  it('resets a reused content scene whenever it is entered', async () => {
    vi.stubGlobal('Image', ImmediateImage)
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new SightyComposition({ stage, onLog: () => undefined })
    await composition.initialize()

    const menuButtonA = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--a')
    if (menuButtonA === null) throw new Error('Demo 4 menu control A is missing.')
    menuButtonA.click()
    await flushDemo4Relay()

    const sceneA = composition.runtime.getInstance('scene-a')
    if (sceneA === undefined) throw new Error('Scene A instance is missing.')
    await sceneA.telco.pause()
    await sceneA.telco.seek(3_000)
    await flushDemo4Relay()

    const nextButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--next')
    if (nextButton === null) throw new Error('Demo 4 next control is missing.')
    nextButton.click()
    await flushDemo4Relay()
    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-b')

    const previousButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--previous')
    if (previousButton === null) throw new Error('Demo 4 previous control is missing.')
    previousButton.click()
    await flushDemo4Relay()

    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-a')
    const resetSceneA = composition.runtime.getInstance('scene-a')
    expect(resetSceneA).toBeDefined()
    expect(resetSceneA).toBe(sceneA)
    expect(resetSceneA?.telco.getProgress().timelineMs).toBeLessThan(1_000)
    expect(resetSceneA?.telco.getState().status).toBe('playing')
  })

  it('keeps the telco usable after sequence:end and resets it on the next access', async () => {
    vi.stubGlobal('Image', ImmediateImage)
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new SightyComposition({ stage, onLog: () => undefined })
    await composition.initialize()

    const menuButtonA = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--a')
    if (menuButtonA === null) throw new Error('Demo 4 menu control A is missing.')
    menuButtonA.click()
    await flushDemo4Relay()

    const sceneA = composition.runtime.getInstance('scene-a')
    if (sceneA === undefined) throw new Error('Scene A instance is missing.')
    await sceneA.events.emit(
      { name: DEMO4_SCENARIO_EVENTS.sequenceEnd, startAt: 100, visibility: 'public' },
      { scope: 'story', storyId: 'main' },
    )
    await new Promise((resolve) => globalThis.setTimeout(resolve, 200))
    await flushDemo4Relay()

    const previousButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--previous')
    const nextButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--next')
    const toggleButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--toggle')
    const progress = stage.querySelector<HTMLInputElement>('#demo4-telco-progress-control')
    if (previousButton === null || nextButton === null || toggleButton === null || progress === null) {
      throw new Error('Demo 4 chapter controls are incomplete after sequence:end.')
    }
    expect(sceneA.telco.getState().sequenceEnded).toBe(true)
    expect(previousButton.disabled).toBe(false)
    expect(nextButton.disabled).toBe(false)
    expect(toggleButton.disabled).toBe(false)
    expect(progress.disabled).toBe(false)

    previousButton.click()
    await flushDemo4Relay()
    const menuButtonAgain = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--a')
    if (menuButtonAgain === null) throw new Error('Demo 4 menu control A is missing after sequence:end.')
    menuButtonAgain.click()
    await flushDemo4Relay()

    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-a')
    const resetSceneA = composition.runtime.getInstance('scene-a')
    expect(resetSceneA).toBeDefined()
    expect(resetSceneA).toBe(sceneA)
    expect(resetSceneA?.telco.getState().sequenceEnded).toBe(false)
    expect(resetSceneA?.telco.getProgress().timelineMs).toBeLessThan(1_000)
    const activeToggleButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--toggle')
    const activeProgress = stage.querySelector<HTMLInputElement>('#demo4-telco-progress-control')
    if (activeToggleButton === null || activeProgress === null) {
      throw new Error('Demo 4 chapter controls are missing after reset.')
    }
    expect(activeToggleButton.disabled).toBe(false)
    expect(activeProgress.disabled).toBe(false)
  })

  it('enables the chapter telco immediately after resetting a stale timeline', async () => {
    vi.stubGlobal('Image', ImmediateImage)
    const stage = document.createElement('div')
    document.body.append(stage)
    composition = new SightyComposition({ stage, onLog: () => undefined })
    await composition.initialize()

    const menuButtonA = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--a')
    if (menuButtonA === null) throw new Error('Demo 4 menu control A is missing.')
    menuButtonA.click()
    await flushDemo4Relay()

    const telco = composition.runtime.getInstance('scene-telco')
    if (telco === undefined) throw new Error('Demo 4 scene telco instance is missing.')
    await telco.telco.pause()
    await telco.telco.seek(3_000)
    await telco.telco.play()

    const previousButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--previous')
    if (previousButton === null) throw new Error('Demo 4 previous control is missing.')
    previousButton.click()
    await flushDemo4Relay()

    const menuButtonAgain = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--a')
    if (menuButtonAgain === null) throw new Error('Demo 4 menu control A is missing after leaving chapter.')
    menuButtonAgain.click()
    await flushDemo4Relay()

    const nextButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--next')
    if (nextButton === null) throw new Error('Demo 4 next control is missing after activation.')
    expect(nextButton.disabled).toBe(false)
    const resetTelco = composition.runtime.getInstance('scene-telco')
    expect(resetTelco).toBeDefined()
    expect(resetTelco).toBe(telco)
    expect(resetTelco?.telco.getProgress().timelineMs).toBeLessThan(1_000)
  })

  it('does not replay a hidden telco disable event after chapter re-entry', async () => {
    vi.stubGlobal('Image', ImmediateImage)
    const stage = document.createElement('div')
    document.body.append(stage)
    const logs: string[] = []
    composition = new SightyComposition({ stage, onLog: (message) => logs.push(message) })
    await composition.initialize()

    const menuButtonA = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--a')
    if (menuButtonA === null) throw new Error('Demo 4 menu control A is missing.')
    menuButtonA.click()
    await flushDemo4Relay()

    const telco = composition.runtime.getInstance('scene-telco')
    if (telco === undefined) throw new Error('Demo 4 scene telco instance is missing.')
    await telco.telco.seek(5_000)
    await telco.telco.play()
    await flushDemo4Relay()

    const getNextButton = (): HTMLButtonElement => {
      const button = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--next')
      if (button === null) throw new Error('Demo 4 next control is missing.')
      return button
    }
    expect(getNextButton().disabled).toBe(false)
    getNextButton().click()
    await flushDemo4Relay()
    if (composition.runtime.getMountedSceneKey('slot-scene') !== 'scene-b') {
      throw new Error(`Demo 4 did not navigate after delayed telco seek. events=${logs.join('|')}`)
    }
    getNextButton().click()
    await flushDemo4Relay()
    expect(composition.runtime.getMountedSceneKey('slot-scene')).toBe('scene-c')

    const sceneC = composition.runtime.getInstance('scene-c')
    if (sceneC === undefined) throw new Error('Scene C instance is missing.')
    await sceneC.events.emit(
      { name: DEMO4_SCENARIO_EVENTS.sequenceEnd, visibility: 'public' },
      { scope: 'story', storyId: 'main' },
    )
    await flushDemo4Relay()

    const menuButtonAgain = stage.querySelector<HTMLButtonElement>('.demo4-menu__button--a')
    if (menuButtonAgain === null) throw new Error('Demo 4 menu control A is missing after exit.')
    menuButtonAgain.click()
    await flushDemo4Relay()

    const nextButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--next')
    const activePreviousButton = stage.querySelector<HTMLButtonElement>('.demo4-telco__button--previous')
    if (nextButton === null || activePreviousButton === null) {
      throw new Error('Demo 4 chapter navigation controls are missing after re-entry.')
    }
    expect(nextButton.disabled).toBe(false)
    expect(activePreviousButton.disabled).toBe(false)

    await new Promise((resolve) => globalThis.setTimeout(resolve, 5_200))

    expect(nextButton.disabled).toBe(false)
    expect(activePreviousButton.disabled).toBe(false)
  }, 10_000)
})
