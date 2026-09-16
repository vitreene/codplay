/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { SightyComposition } from '../../../demos/src/sighty/demo2/sighty-composition'

/** Lets the delegated DOM emit and the Sighty coordinator complete. */
function flushSightyEvent(): Promise<void> {
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

  it('executes the declared command-scene coupling through Sighty', async () => {
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
    const sceneBInstance = composition.runtime.getInstance('sceneB')
    if (sceneBInstance === undefined) throw new Error('Demo 2 scene B instance is missing.')
    const rewind = vi.spyOn(sceneBInstance.telco, 'rewind')
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
    await flushSightyEvent()
    expect(logs.some((message) => message.includes('event sighty-demo2:intent:pause → Sighty'))).toBe(true)
    expect(sceneBInstance.telco.getState().status).toBe('paused')

    playButton.click()
    await flushSightyEvent()
    expect(logs.some((message) => message.includes('event sighty-demo2:intent:play → Sighty'))).toBe(true)
    expect(sceneBInstance.telco.getState().status).toBe('playing')

    replayButton.click()
    await flushSightyEvent()
    expect(logs.some((message) => message.includes('event sighty-demo2:intent:replay → Sighty'))).toBe(true)
    expect(sceneBInstance.telco.getState().status).toBe('playing')
    expect(rewind).toHaveBeenCalled()
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
