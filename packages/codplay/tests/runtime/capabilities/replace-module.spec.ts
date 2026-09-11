/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../src/runtime/runner-html'
import { SceneBuilder } from '../../../src/scene/compiled'

describe('V2 shared replace module', () => {
  let runner: HtmlPlayerRunner | undefined

  afterEach(() => {
    runner?.destroy()
    runner = undefined
    document.body.replaceChildren()
  })

  it('runs the simple fade hooks for slot and ignores split', () => {
    const root = document.createElement('main')
    document.body.appendChild(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot(), {
      createdAt: '2026-09-11T00:00:00.000Z',
    }).build({
      id: 'replace-slot-runtime',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'host',
            name: 'body',
            type: 'slot',
            initial: { move: '@root', content: { source: 'foreign-a' } },
            actions: {
              swap: {
                content: { source: 'foreign-b' },
                replace: { transition: 'fade', duration: 100, split: 'cells' },
              },
            },
          }],
          eventimes: [{ name: 'swap', startAt: 100 }],
        },
      },
      eventimes: [{ name: 'sequence:end', startAt: 1000 }],
    })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    expect(build.compiledScene.requirements.modules).toEqual(['replace'])

    runner = new HtmlPlayerRunner({
      id: 'replace-slot-player',
      compiledScene: build.compiledScene,
      root,
      catalog,
    })
    expect(runner.init().ok).toBe(true)

    const host = runner.getPersoNode('main:host') as HTMLDivElement
    const foreignA = document.createElement('section')
    foreignA.textContent = 'A'
    const foreignB = document.createElement('section')
    foreignB.textContent = 'B'
    runner.getComponentSurface('main:host', 'foreignContent')?.attach([foreignA])

    runner.player.play()
    runner.advance(0)
    runner.advance(100)

    const snapshots = (): HTMLElement[] => Array.from(root.children)
      .filter((child): child is HTMLElement => child.getAttribute('data-codplay-transient') !== null)
    expect(snapshots()).toHaveLength(1)
    const snapshot = snapshots()[0]
    expect(snapshot?.id).toBe('')
    expect(snapshot?.textContent).toBe('A')

    runner.getComponentSurface('main:host', 'foreignContent')?.attach([foreignB])
    expect(host.children).toHaveLength(1)
    expect(host.firstElementChild).toBe(foreignB)
    expect(foreignA.parentNode).toBeNull()

    runner.advance(150)
    expect(snapshots()[0]?.style.opacity).toBe('0.5')
    expect(host.style.opacity).toBe('0.5')

    runner.advance(200)
    expect(snapshots()).toHaveLength(0)
    expect(host.style.opacity).toBe('')
    expect(host.style.visibility).toBe('')
    expect(foreignB.parentNode).toBe(host)
  })

  it('cancels the previous session on interruption and does not replay it on seek', () => {
    const root = document.createElement('main')
    document.body.appendChild(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'replace-slot-interruption',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'host',
            name: 'body',
            type: 'slot',
            initial: { move: '@root', content: { source: 'foreign-a' } },
            actions: {
              first: {
                content: { source: 'foreign-b' },
                replace: { transition: 'fade', duration: 100 },
              },
              second: {
                content: { source: 'foreign-c' },
                replace: { transition: 'fade', duration: 100 },
              },
            },
          }],
          eventimes: [
            { name: 'first', startAt: 100 },
            { name: 'second', startAt: 150 },
          ],
        },
      },
      eventimes: [{ name: 'sequence:end', startAt: 1000 }],
    })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    runner = new HtmlPlayerRunner({
      id: 'replace-slot-interruption-player',
      compiledScene: build.compiledScene,
      root,
      catalog,
    })
    expect(runner.init().ok).toBe(true)

    const host = runner.getPersoNode('main:host') as HTMLDivElement
    const foreignB = document.createElement('section')
    foreignB.textContent = 'B'
    const foreignC = document.createElement('section')
    foreignC.textContent = 'C'
    const snapshots = (): HTMLElement[] => Array.from(root.children)
      .filter((child): child is HTMLElement => child.getAttribute('data-codplay-transient') !== null)
    runner.getComponentSurface('main:host', 'foreignContent')?.attach([foreignB])

    runner.player.play()
    runner.advance(0)
    runner.advance(100)
    expect(snapshots()).toHaveLength(1)
    runner.advance(150)
    expect(snapshots()).toHaveLength(1)
    expect(snapshots()[0]?.textContent).toBe('B')

    runner.getComponentSurface('main:host', 'foreignContent')?.attach([foreignC])
    expect(host.firstElementChild).toBe(foreignC)
    expect(runner.seek(50).ok).toBe(true)
    expect(snapshots()).toHaveLength(0)

    expect(runner.seek(175).ok).toBe(true)
    expect(snapshots()).toHaveLength(0)
  })

  it('reuses the same fade path for an image component', () => {
    const root = document.createElement('main')
    document.body.appendChild(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot(), {
      createdAt: '2026-09-11T00:00:00.000Z',
    }).build({
      id: 'replace-image-runtime',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'image',
            type: 'img',
            initial: { move: '@root', src: '/image-a.png' },
            actions: {
              swap: {
                src: '/image-b.png',
                replace: { transition: 'fade', duration: 100 },
              },
            },
          }],
          eventimes: [{ name: 'swap', startAt: 100 }],
        },
      },
      eventimes: [{ name: 'sequence:end', startAt: 1000 }],
    })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    expect(build.compiledScene.requirements.modules).toEqual(['replace'])

    runner = new HtmlPlayerRunner({
      id: 'replace-image-player',
      compiledScene: build.compiledScene,
      root,
      catalog,
      resources: ['/image-a.png', '/image-b.png'],
    })
    expect(runner.init().ok).toBe(true)

    const host = runner.getPersoNode('main:image') as HTMLDivElement
    const snapshots = (): HTMLElement[] => Array.from(root.children)
      .filter((child): child is HTMLElement => child.getAttribute('data-codplay-transient') !== null)

    runner.player.play()
    runner.advance(0)
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/image-a.png')

    runner.advance(100)
    expect(snapshots()).toHaveLength(1)
    expect(snapshots()[0]?.querySelector('img')?.getAttribute('src')).toBe('/image-a.png')
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/image-b.png')

    runner.advance(150)
    expect(snapshots()[0]?.style.opacity).toBe('0.5')
    expect(host.style.opacity).toBe('0.5')

    runner.advance(200)
    expect(snapshots()).toHaveLength(0)
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/image-b.png')
  })
})
