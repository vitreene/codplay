/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { CodPlay } from '../../src'
import {
  createDemo1Composition,
  type Demo1Runtime,
  type Demo1Sighty,
} from '../../../demos/src/sighty/demo1/sighty-composition'
import { createDemo1Controls, type Demo1Controls } from '../../../demos/src/sighty/demo1/page-controls'
import { sceneA } from '../../../demos/src/sighty/demo1/scenes/scene-a'

/** Provides an immediately ready image for the preload boundary in jsdom. */
class ImmediateImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  /** Completes the image preload after the source has been assigned. */
  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }
}

describe('Sighty A/B demo composition', () => {
  let sighty: Demo1Sighty | undefined
  let runtime: Demo1Runtime | undefined
  let pageControls: Demo1Controls | undefined
  let codplay: CodPlay | undefined

  afterEach(() => {
    pageControls?.destroy()
    pageControls = undefined
    runtime?.destroy()
    runtime = undefined
    sighty = undefined
    codplay?.destroy()
    codplay = undefined
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  })

  it('mounts the declared A and B scenes and remounts A independently', async () => {
    vi.stubGlobal('Image', ImmediateImage)
    const stage = document.createElement('div')
    const controls = document.createElement('div')
    document.body.append(stage, controls)
    sighty = createDemo1Composition({
      stage,
      onLog: () => undefined,
    })
    runtime = sighty.runtime

    await runtime.initialize()
    pageControls = createDemo1Controls({
      container: controls,
      runtime,
      onLog: () => undefined,
    })
    const controlHeadings = Array.from(controls.querySelectorAll('h3')).map((heading) => heading.textContent)
    expect(controlHeadings).not.toContain('Instance layout-1')
    expect(controlHeadings).toEqual(expect.arrayContaining(['Instance scene-a-1', 'Instance scene-b-1']))
    await runtime.playAll()

    const authoringStyle = document.head.querySelector('style[data-codplay-preload-css-slot="sighty-demo-capsule-automation"]')
    expect(authoringStyle?.textContent).toContain('.ac-scene-root{')
    expect(authoringStyle?.textContent).not.toContain('ac-grid-card-1x1-manual')

    const childA = stage.querySelector<HTMLElement>('.sighty-scene-a')
    const childB = stage.querySelector<HTMLElement>('.sighty-scene-b')
    if (childA === null || childB === null) throw new Error('Sighty child scene roots are missing.')
    const slotA = childA.parentElement
    const slotB = childB.parentElement
    if (slotA === null || slotB === null) throw new Error('Sighty slot roots are missing.')
    const layoutRoot = stage.querySelector<HTMLElement>('.sighty-scene-layout')
    if (layoutRoot === null) throw new Error('Sighty A/B layout root is missing.')

    expect(layoutRoot.classList.contains('ac-scene-root')).toBe(true)
    expect(layoutRoot.children).toHaveLength(2)
    expect(slotA.parentNode).toBe(layoutRoot)
    expect(slotB.parentNode).toBe(layoutRoot)
    expect(childA.querySelector('.sighty-scene-a__image')).not.toBeNull()
    expect(childB.querySelector('.sighty-scene-b__number')?.textContent).toBe('1')
    expect(slotA.classList.contains('sighty-slot')).toBe(true)
    expect(slotB.classList.contains('sighty-slot')).toBe(true)
    expect(childA.classList.contains('ac-scene-root')).toBe(true)
    expect(childB.classList.contains('ac-scene-root')).toBe(true)
    expect(childA.parentNode).toBe(slotA)
    expect(childB.parentNode).toBe(slotB)
    expect(slotA.children).toHaveLength(1)
    expect(slotB.children).toHaveLength(1)

    const detachA = Array.from(controls.querySelectorAll('button')).find((button) => button.textContent === 'Démonter A')
    if (!(detachA instanceof HTMLButtonElement)) throw new Error('Sighty A detach control is missing.')
    detachA.click()
    expect(slotA.contains(childA)).toBe(false)
    expect(childB.parentNode).toBe(slotB)

    const remountA = Array.from(controls.querySelectorAll('button')).find((button) => button.textContent === 'Remonter A')
    if (!(remountA instanceof HTMLButtonElement)) throw new Error('Sighty A remount control is missing.')
    remountA.click()
    expect(childA.parentNode).toBe(slotA)
    expect(childB.parentNode).toBe(slotB)
  })

  it('runs the declared image scale from 1 to 1.2 over ten seconds', async () => {
    codplay = new CodPlay({ pauseOnDocumentHidden: false })
    const build = codplay.build({ scene: sceneA })
    if (!build.ok) throw new Error('Scene A did not compile for the scale assertion.')
    codplay.resources.register({
      loaded: ['/assets/35c8ec5a07fc.jpg'],
      skipped: [],
      metadata: { '/assets/35c8ec5a07fc.jpg': { type: 'image' } },
    })
    const root = document.createElement('div')
    document.body.append(root)
    const instance = codplay.instances.create({
      instanceId: 'scene-a-scale-test',
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
    })
    const image = root.querySelector<HTMLElement>('.sighty-scene-a__image')
    if (image === null) throw new Error('Scene A image root is missing.')

    expect(image.style.transform).toBe('scale(1)')
    await instance.telco.seek(5_000)
    expect(image.style.transform).toBe('scale(1.1)')
    await instance.telco.seek(10_000)
    expect(image.style.transform).toBe('scale(1.2)')
  })
})
