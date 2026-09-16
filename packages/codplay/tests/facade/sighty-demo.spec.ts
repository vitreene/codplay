/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { CodPlay } from '../../src'
import {
  createDemo1Composition,
  type Demo1Runtime,
  type Demo1Sighty,
} from '../../../demos/src/sighty/demo1/sighty-composition'
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
  let codplay: CodPlay | undefined

  afterEach(() => {
    runtime?.destroy()
    runtime = undefined
    sighty = undefined
    codplay?.destroy()
    codplay = undefined
    vi.unstubAllGlobals()
    document.body.replaceChildren()
  })

  it('mounts the declared A and B scenes through Sighty', async () => {
    vi.stubGlobal('Image', ImmediateImage)
    const stage = document.createElement('div')
    document.body.append(stage)
    sighty = createDemo1Composition({
      stage,
      onLog: () => undefined,
    })
    runtime = sighty.runtime

    await runtime.initialize()
    const sceneAInstance = runtime.getInstance('sceneA')
    const sceneBInstance = runtime.getInstance('sceneB')
    if (sceneAInstance === undefined || sceneBInstance === undefined) {
      throw new Error('Sighty demo 1 scene instances are missing.')
    }
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
    expect(layoutRoot.id).toBe('sighty-layout-root')
    expect(layoutRoot.children).toHaveLength(2)
    expect(layoutRoot.querySelectorAll('[data-part]')).toHaveLength(0)
    expect(Array.from(layoutRoot.childNodes).filter((node) => node.nodeType === 8)).toHaveLength(2)
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
