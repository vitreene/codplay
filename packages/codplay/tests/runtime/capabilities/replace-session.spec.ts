/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { HtmlPlayerRunner } from '../../../src/runtime/runner-html'
import * as replaceSession from '../../../src/runtime/runner-html/replace-presentation/session'
import { normalizeReplaceMediaCommand } from '../../../src/runtime/capabilities/replace-media'
import { resolveRequiredReplaceKeys } from '../../../src/runtime/capabilities/replace-session'
import { SceneBuilder } from '../../../src/scene/compiled'

/** Counts replace sessions opened by every HTML replace surface created after the call. */
function countReplaceSessions(): { readonly count: () => number } {
  let opened = 0
  const create = replaceSession.createHtmlReplacePresentationSurface
  vi.spyOn(replaceSession, 'createHtmlReplacePresentationSurface').mockImplementation((...args) => {
    const surface = create(...args)
    return {
      ...surface,
      begin: (...beginArgs) => {
        opened += 1
        return surface.begin(...beginArgs)
      },
    }
  })
  return { count: () => opened }
}

/** Builds one tag whose replace runs while an older tween leaves its action list. */
function buildTweenStopScene() {
  const catalog = createCoreRuntimeCatalog()
  const build = new SceneBuilder(catalog.validationSnapshot()).build({
    id: 'replace-session-tween-stop',
    stories: {
      main: {
        id: 'main',
        persos: [{
          id: 'label',
          type: 'tag',
          initial: { move: '@root', tag: 'p', content: 'A' },
          actions: {
            run: {
              duration: 1000,
              fn: (input: { progress: number }) => ({ style: { opacity: input.progress } }),
            },
            'tween:stop': {},
            swap: { content: 'B', replace: { transition: 'fade', duration: 600 } },
          },
        }],
        eventimes: [
          { name: 'run', startAt: 0 },
          { name: 'swap', startAt: 300 },
          { name: 'tween:stop', startAt: 500 },
        ],
      },
    },
    eventimes: [{ name: 'sequence:end', startAt: 2000 }],
  } as never)
  if (!build.ok) throw new Error('Replace session test scene must build.')
  return { catalog, build }
}

/** Builds one tag replaced at each listed time with a fade of the given duration. */
function buildSwapScene(startTimes: readonly number[], durationMs: number) {
  const catalog = createCoreRuntimeCatalog()
  const actions = Object.fromEntries(startTimes.map((_, index) => [
    `swap${index}`,
    { content: `T${index}`, replace: { transition: 'fade', duration: durationMs } },
  ]))
  const build = new SceneBuilder(catalog.validationSnapshot()).build({
    id: 'replace-session-swaps',
    stories: {
      main: {
        id: 'main',
        persos: [{ id: 'label', type: 'tag', initial: { move: '@root', tag: 'p', content: 'A' }, actions }],
        eventimes: startTimes.map((startAt, index) => ({ name: `swap${index}`, startAt })),
      },
    },
    eventimes: [{ name: 'sequence:end', startAt: 20_000 }],
  } as never)
  if (!build.ok) throw new Error('Replace swap test scene must build.')
  return { catalog, build }
}

/** Reads the opacity of every temporary replace view, in DOM order. */
function readReplaceViewOpacities(root: Element): readonly string[] {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-codplay-replace-view]'))
    .map((view) => view.style.opacity)
}

describe('replace session identity', () => {
  let runner: HtmlPlayerRunner | undefined

  afterEach(() => {
    runner?.destroy()
    runner = undefined
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  /** Creates one initialized runner on a fresh root. */
  function createRunner(
    id: string,
    scene: ReturnType<typeof buildTweenStopScene> = buildTweenStopScene(),
  ): Readonly<{ runner: HtmlPlayerRunner; root: HTMLElement }> {
    const { catalog, build } = scene
    const root = document.createElement('main')
    document.body.appendChild(root)
    const created = new HtmlPlayerRunner({
      id,
      compiledScene: build.compiledScene,
      functions: build.functions,
      root,
      catalog,
    })
    expect(created.init().ok).toBe(true)
    runner = created
    return { runner: created, root }
  }

  it('keeps one session when an older tween leaves the action list during Play', () => {
    const sessions = countReplaceSessions()
    const { runner: player, root } = createRunner('replace-session-play')

    player.player.play()
    for (let timeMs = 0; timeMs <= 550; timeMs += 50) player.advance(timeMs)

    expect(sessions.count()).toBe(1)
    expect(readReplaceViewOpacities(root)).toHaveLength(2)
  })

  it('reconstructs the Play composition with one session on a direct Seek', () => {
    const playSessions = countReplaceSessions()
    const played = createRunner('replace-session-play-reference')
    played.runner.player.play()
    for (let timeMs = 0; timeMs <= 550; timeMs += 50) played.runner.advance(timeMs)
    const playOpacities = readReplaceViewOpacities(played.root)
    played.runner.destroy()
    runner = undefined
    document.body.replaceChildren()
    vi.restoreAllMocks()

    const seekSessions = countReplaceSessions()
    const sought = createRunner('replace-session-seek')
    expect(sought.runner.seek(550).ok).toBe(true)

    expect(playSessions.count()).toBe(1)
    expect(seekSessions.count()).toBe(1)
    expect(readReplaceViewOpacities(sought.root)).toEqual(playOpacities)
  })

  it('opens no session on Seek for replacements finished before the target', () => {
    const sessions = countReplaceSessions()
    const startTimes = Array.from({ length: 10 }, (_, index) => 1_000 * (index + 1))
    const { runner: player } = createRunner('replace-session-finished', buildSwapScene(startTimes, 200))

    expect(player.seek(10_500).ok).toBe(true)
    expect(sessions.count()).toBe(0)
    expect(player.seek(5_100).ok).toBe(true)
    expect(sessions.count()).toBe(1)
  })

  it('reconstructs an interruption chain with the same sessions and composition as Play', () => {
    const playSessions = countReplaceSessions()
    const scene = buildSwapScene([100, 150, 175], 100)
    const played = createRunner('replace-session-chain-play', scene)
    played.runner.player.play()
    for (const timeMs of [0, 100, 150, 175, 190]) played.runner.advance(timeMs)
    const playOpacities = readReplaceViewOpacities(played.root)
    played.runner.destroy()
    runner = undefined
    document.body.replaceChildren()
    vi.restoreAllMocks()

    const seekSessions = countReplaceSessions()
    const sought = createRunner('replace-session-chain-seek', buildSwapScene([100, 150, 175], 100))
    expect(sought.runner.seek(190).ok).toBe(true)

    expect(playSessions.count()).toBe(3)
    expect(seekSessions.count()).toBe(3)
    expect(playOpacities.length).toBeGreaterThan(0)
    expect(readReplaceViewOpacities(sought.root)).toEqual(playOpacities)
  })
})

describe('replace seek requirements', () => {
  it('keeps the running occurrence and the chain it interrupted', () => {
    const occurrences = [
      { key: 'a', startAt: 0, maxEndAt: 100 },
      { key: 'b', startAt: 200, maxEndAt: 400 },
      { key: 'c', startAt: 300, maxEndAt: 500 },
      { key: 'd', startAt: 450, maxEndAt: 700 },
    ]
    expect([...resolveRequiredReplaceKeys(occurrences, 600)]).toEqual(['d', 'c', 'b'])
    expect([...resolveRequiredReplaceKeys(occurrences, 700)]).toEqual([])
    expect([...resolveRequiredReplaceKeys(occurrences.slice(0, 1), 150)]).toEqual([])
  })
})

describe('replace build and runtime agreement', () => {
  /** Builds one image swap with the given replace declaration. */
  function buildImageSwap(replace: unknown) {
    return new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot()).build({
      id: 'replace-build-runtime-agreement',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'image',
            type: 'img',
            initial: { move: '@root', src: '/a.png' },
            actions: { swap: { src: '/b.png', replace } },
          }],
          eventimes: [{ name: 'swap', startAt: 10 }],
        },
      },
    } as never)
  }

  it.each([
    { transition: 'curtain', stagger: 100 },
    { transition: 'stack', direction: 'left' },
    { transition: 'wipe', cellX: 4 },
  ])('plays %j as a whole-view transition and ignores its inert grid settings', (replace) => {
    expect(buildImageSwap(replace).ok).toBe(true)
    const command = normalizeReplaceMediaCommand(replace)
    expect(command?.profile).toMatchObject({ transition: replace.transition })
    expect(command?.profile).not.toHaveProperty('split')
    expect(command?.profile).not.toHaveProperty('cellX')
  })

  it('refuses at build time a media replace the runtime cannot present', () => {
    const build = buildImageSwap({ transition: 'burn', split: 'cells' })
    expect(build.ok).toBe(false)
    if (build.ok) return
    expect(build.diagnostics.errors.map((diagnostic) => diagnostic.code)).toContain('AUTHOR_MEDIA_REPLACE_INVALID')
  })
})

describe('fade mask options', () => {
  it.each([
    { transition: 'fade', split: 'cells', cellX: 4, shape: 'star' },
    { transition: 'fade', split: 'cells', staggerPattern: 'row-wave', cellSize: 0 },
  ])('accepts and ignores the mask options of a media fade %j', (replace) => {
    const build = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot()).build({
      id: 'replace-fade-mask-options',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'image',
            type: 'img',
            initial: { move: '@root', src: '/a.png' },
            actions: { swap: { src: '/b.png', replace } },
          }],
          eventimes: [{ name: 'swap', startAt: 10 }],
        },
      },
    } as never)
    expect(build.ok).toBe(true)
    const command = normalizeReplaceMediaCommand(replace)
    expect(command?.profile).toMatchObject({ transition: 'fade' })
    expect(command?.profile).not.toHaveProperty('split')
    expect(command?.profile).not.toHaveProperty('shape')
  })
})
