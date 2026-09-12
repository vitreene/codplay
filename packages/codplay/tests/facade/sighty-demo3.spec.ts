/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { createDemo3Controls, type Demo3Controls } from '../../../demos/src/sighty/demo3/page-controls'
import { SightyComposition } from '../../../demos/src/sighty/demo3/sighty-composition'
import { DEMO3_CONTENT_VALUES } from '../../../demos/src/sighty/demo3/messages'

/** Provides an immediately ready image for the reused scene A preload. */
class ImmediateImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  /** Completes the image preload after the source has been assigned. */
  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }
}

/** Lets the delegated DOM event and Sighty relay complete. */
function flushDemo3Relay(): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 100))
}

describe('Sighty data injection demo', () => {
  let composition: SightyComposition | undefined
  let controls: Demo3Controls | undefined

  afterEach(() => {
    controls?.destroy()
    controls = undefined
    composition?.destroy()
    composition = undefined
    document.head.querySelectorAll('style[data-codplay-preload-css-slot]').forEach((style) => style.remove())
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  })

  it('relays text payloads and injects colors through the regular Sighty path', async () => {
    vi.stubGlobal('Image', ImmediateImage)
    const stage = document.createElement('div')
    const externalControls = document.createElement('div')
    const logs: string[] = []
    document.body.append(stage, externalControls)
    composition = new SightyComposition({
      stage,
      onLog: (message) => logs.push(message),
    })

    await composition.initialize()

    expect(composition.runtime.getInstance('sceneA')?.telco.getProgress().durationMs).toBe(20_000)
    const title = stage.querySelector<HTMLElement>('.sighty-scene-a__title')
    const telco = stage.querySelector<HTMLElement>('.demo3-telco')
    if (title === null || telco === null) throw new Error('Demo 3 scene roots are missing.')
    const contentButtons = telco.querySelectorAll<HTMLButtonElement>('.demo3-telco__button')
    expect(contentButtons).toHaveLength(2)
    expect(title.textContent).toBe('Scène A')

    contentButtons[0]?.click()
    await flushDemo3Relay()
    expect(title.textContent).toBe(DEMO3_CONTENT_VALUES.first)
    expect(logs.some((message) => message.includes('message sighty-demo3:content:first → sceneA (content)'))).toBe(true)
    expect(logs.some((message) => message.includes('Sighty → sceneA : content injecté'))).toBe(true)

    contentButtons[1]?.click()
    await flushDemo3Relay()
    expect(title.textContent).toBe(DEMO3_CONTENT_VALUES.second)

    controls = createDemo3Controls({
      container: externalControls,
      injectTextColor: (colorName) => composition!.injectTextColor(colorName),
      onLog: (message) => logs.push(message),
    })
    const colorButtons = externalControls.querySelectorAll<HTMLButtonElement>('.demo3-page-controls__button')
    expect(colorButtons).toHaveLength(2)

    colorButtons[0]?.click()
    await flushDemo3Relay()
    const blueColor = title.style.color
    expect(blueColor).not.toBe('')

    colorButtons[1]?.click()
    await flushDemo3Relay()
    expect(title.style.color).not.toBe(blueColor)
    expect(logs.some((message) => message.includes('event sighty-demo3:color:blue → sceneA (color)'))).toBe(true)
    expect(logs.some((message) => message.includes('Sighty → sceneA : couleur coral'))).toBe(true)
  })
})
