/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'

import { SightyComposition } from '../../../demos/src/sighty/demo2/sighty-composition'

/** Lets the delegated DOM emit and the Sighty message queue complete. */
function flushMessageRelay(): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, 100))
}

describe('Sighty scene B command demo', () => {
  let composition: SightyComposition | undefined

  afterEach(() => {
    composition?.destroy()
    composition = undefined
    document.head.querySelectorAll('style[data-codplay-preload-css-slot]').forEach((style) => style.remove())
    document.body.replaceChildren()
  })

  it('relays real command-scene messages to scene B through Sighty', async () => {
    const stage = document.createElement('div')
    const logs: string[] = []
    document.body.append(stage)
    composition = new SightyComposition({
      stage,
      onLog: (message) => logs.push(message),
    })

    await composition.initialize()

    const sceneB = stage.querySelector<HTMLElement>('.sighty-scene-b')
    const telco = stage.querySelector<HTMLElement>('.demo2-telco')
    if (sceneB === null || telco === null) {
      throw new Error('Demo 2 scene roots are missing.')
    }
    const sceneBNumber = sceneB.querySelector<HTMLElement>('.sighty-scene-b__number')
    if (sceneBNumber === null) throw new Error('Demo 2 scene B number is missing.')
    const sceneBSlot = sceneB.parentElement
    const telcoSlot = telco.parentElement
    if (sceneBSlot === null || telcoSlot === null) throw new Error('Demo 2 slot roots are missing.')
    const playButton = telco.querySelector<HTMLButtonElement>('.demo2-telco__button--play')
    const pauseButton = telco.querySelector<HTMLButtonElement>('.demo2-telco__button--pause')
    const replayButton = telco.querySelector<HTMLButtonElement>('.demo2-telco__button--replay')
    if (playButton === null || pauseButton === null || replayButton === null) {
      throw new Error('Demo 2 telco buttons are missing.')
    }

    expect(sceneBSlot.classList.contains('demo2-slot')).toBe(true)
    expect(telcoSlot.classList.contains('demo2-slot')).toBe(true)
    expect(sceneBSlot.parentElement?.classList.contains('demo2-layout__scene')).toBe(true)
    expect(telcoSlot.parentElement?.classList.contains('demo2-layout__telco')).toBe(true)
    expect(sceneBNumber.textContent).toBe('1')

    pauseButton.click()
    await flushMessageRelay()
    expect(logs.some((message) => message.includes('message sighty-demo2:intent:pause → sceneB (pause)'))).toBe(true)
    expect(logs.some((message) => message.includes('Sighty → sceneB : telco.pause'))).toBe(true)

    playButton.click()
    await flushMessageRelay()
    expect(logs.some((message) => message.includes('sighty-demo2:intent:play'))).toBe(true)
    expect(logs.some((message) => message.includes('message sighty-demo2:intent:play → sceneB (play)'))).toBe(true)
    expect(logs.some((message) => message.includes('Sighty → sceneB : telco.play'))).toBe(true)

    replayButton.click()
    await flushMessageRelay()
    expect(logs.some((message) => message.includes('message sighty-demo2:intent:replay → sceneB (replay)'))).toBe(true)
    expect(logs.some((message) => message.includes('Sighty → sceneB : telco.rewind'))).toBe(true)
    expect(sceneBNumber.textContent).toBe('1')

    const styleSlot = 'sighty-demo2-scene-root'
    expect(document.head.querySelector(`style[data-codplay-preload-css-slot="${styleSlot}"]`)).not.toBeNull()
    composition.destroy()
    composition = undefined
    stage.replaceChildren()
    expect(stage.children).toHaveLength(0)
    expect(document.head.querySelector(`style[data-codplay-preload-css-slot="${styleSlot}"]`)).toBeNull()
  })
})
