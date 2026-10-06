/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../src/runtime/runner-html'
import { SceneBuilder } from '../../../src/scene/compiled'
import type { SceneDoc } from '../../../src/scene/types'

describe('HTML element methods in action presentation', () => {
  let runner: HtmlPlayerRunner | undefined

  afterEach(() => {
    runner?.destroy()
    runner = undefined
    document.body.replaceChildren()
  })

  it('focuses on open and restores focus before applying closed accessibility attributes', async () => {
    const root = document.createElement('main')
    document.body.appendChild(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot(), {
      createdAt: '2026-10-05T00:00:00.000Z',
    }).build(createMenuFocusScene())
    expect(build.ok).toBe(true)
    if (!build.ok) return

    runner = new HtmlPlayerRunner({
      id: 'html-element-method-order',
      compiledScene: build.compiledScene,
      root,
      catalog,
      functions: build.functions,
    })
    expect(runner.init().ok).toBe(true)
    const toggle = root.querySelector<HTMLButtonElement>('[data-perso="toggle"]')
    const drawer = root.querySelector<HTMLElement>('[data-perso="drawer"]')
    const close = root.querySelector<HTMLButtonElement>('[data-perso="close"]')
    expect(toggle).not.toBeNull()
    expect(drawer).not.toBeNull()
    expect(close).not.toBeNull()

    const closeStateAtToggleFocus: Array<readonly [string | null, boolean]> = []
    const toggleFocusCount = { value: 0 }
    const focusOptions: FocusOptions[] = []
    const nativeCloseFocus = close?.focus.bind(close)
    if (close !== null) {
      close.focus = (options) => {
        if (options !== undefined) focusOptions.push(options)
        nativeCloseFocus?.(options)
      }
    }
    toggle?.addEventListener('focus', () => {
      toggleFocusCount.value += 1
      closeStateAtToggleFocus.push([
        drawer?.getAttribute('aria-hidden') ?? null,
        drawer?.hasAttribute('inert') ?? false,
      ])
    })

    await runner.player.emit({ name: 'menu:open', storyId: 'main' })
    expect(document.activeElement).toBe(close)
    expect(focusOptions).toEqual([{ preventScroll: true }])
    expect(drawer?.hasAttribute('aria-hidden')).toBe(false)
    expect(drawer?.hasAttribute('inert')).toBe(false)

    await runner.player.emit({ name: 'menu:blur', storyId: 'main' })
    expect(document.activeElement).toBe(document.body)

    await runner.player.emit({ name: 'menu:close', storyId: 'main' })
    expect(document.activeElement).toBe(toggle)
    expect(closeStateAtToggleFocus).toEqual([[null, false]])
    expect(drawer?.getAttribute('aria-hidden')).toBe('true')
    expect(drawer?.hasAttribute('inert')).toBe(true)

    runner.player.refresh()
    expect(toggleFocusCount.value).toBe(1)
  })

  it('does not call a method during seek or geometry reconstruction', () => {
    const root = document.createElement('main')
    document.body.appendChild(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot(), {
      createdAt: '2026-10-05T00:00:00.000Z',
    }).build(createSeekFocusScene())
    expect(build.ok).toBe(true)
    if (!build.ok) return

    runner = new HtmlPlayerRunner({
      id: 'html-element-method-seek',
      compiledScene: build.compiledScene,
      root,
      catalog,
      functions: build.functions,
    })
    expect(runner.init().ok).toBe(true)
    const other = root.querySelector<HTMLButtonElement>('[data-perso="other"]')
    const target = root.querySelector<HTMLButtonElement>('[data-perso="target"]')
    other?.focus()

    expect(runner.player.seek(100).ok).toBe(true)
    expect(document.activeElement).toBe(other)
    runner.player.refresh()
    expect(document.activeElement).toBe(other)
    expect(target).not.toBeNull()
  })
})

/** Builds a small scene whose attributes and focus actions exercise materializer order. */
function createMenuFocusScene(): SceneDoc<string> {
  return {
    id: 'html-element-method-order',
    stories: {
      main: {
        id: 'main',
        persos: [
          {
            id: 'toggle',
            type: 'tag',
            initial: { tag: 'button', content: 'Open', attr: { 'data-perso': 'toggle' }, move: '@root' },
            actions: { 'menu:close': { htmlElementMethod: ['focus'] } },
          },
          {
            id: 'drawer',
            type: 'tag',
            initial: {
              tag: 'aside',
              attr: { 'aria-hidden': 'true', inert: true, 'data-perso': 'drawer' },
              move: '@root',
            },
            actions: {
              'menu:open': { attr: { 'aria-hidden': false, inert: false } },
              'menu:close': { attr: { 'aria-hidden': 'true', inert: true } },
            },
          },
          {
            id: 'close',
            type: 'tag',
            initial: { tag: 'button', content: 'Close', attr: { 'data-perso': 'close' }, move: '@root' },
            actions: {
              'menu:open': { htmlElementMethod: ['focus', 'preventscroll'] },
              'menu:blur': { htmlElementMethod: ['blur'] },
            },
          },
        ],
      },
    },
  }
}

/** Builds a timed scene for checking the materializer's side-effect-free seek phase. */
function createSeekFocusScene(): SceneDoc<string> {
  return {
    id: 'html-element-method-seek',
    stories: {
      main: {
        id: 'main',
        eventimes: [{ name: 'focus:target', startAt: 100 }],
        persos: [
          {
            id: 'other',
            type: 'tag',
            initial: { tag: 'button', content: 'Other', attr: { 'data-perso': 'other' }, move: '@root' },
          },
          {
            id: 'target',
            type: 'tag',
            initial: { tag: 'button', content: 'Target', attr: { 'data-perso': 'target' }, move: '@root' },
            actions: { 'focus:target': { htmlElementMethod: ['focus'] } },
          },
        ],
      },
    },
  }
}
