/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import replacePresetCatalog from '../../../src/runtime/capabilities/replace-presets/replace-preset-catalog.json'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import {
  assertReplacePresetChoiceCoverage,
  computeReplaceStaggerDelays,
  computeReplaceStaggerTiming,
  normalizeReplacePresetCommand,
  REPLACE_PRESET_CHOICES,
  REPLACE_MEDIA_SPLITS,
  REPLACE_SLOT_TRANSITIONS,
  REPLACE_TEXT_SPLITS,
} from '../../../src/runtime/capabilities/replace-presets'
import { normalizeReplaceMediaCommand } from '../../../src/runtime/capabilities/replace-media'
import {
  prepareMotionTrajectories,
  resolveMotionTrajectory,
} from '../../../src/runtime/runner-html/replace-presentation/motion'
import { normalizeProfile, resolveMediaCellSettings } from '../../../src/runtime/runner-html/replace-presentation/profile'
import { HtmlPlayerRunner } from '../../../src/runtime/runner-html'
import { SceneBuilder } from '../../../src/scene/compiled'

describe('V2 replacement modules', () => {
  let runner: HtmlPlayerRunner | undefined
  let restoreMediaFrameMocks: (() => void) | undefined
  let restoreMediaGeometryMock: (() => void) | undefined
  let restoreTextMeasurementMock: (() => void) | undefined

  afterEach(() => {
    runner?.destroy()
    runner = undefined
    restoreMediaFrameMocks?.()
    restoreMediaFrameMocks = undefined
    restoreMediaGeometryMock?.()
    restoreMediaGeometryMock = undefined
    restoreTextMeasurementMock?.()
    restoreTextMeasurementMock = undefined
    document.body.replaceChildren()
  })

  it('keeps glyph-roll trajectory bounds symmetric at 16 units', () => {
    const slotUp = normalizeReplacePresetCommand('slot-up', 'replace', REPLACE_TEXT_SPLITS)
    const slotDown = normalizeReplacePresetCommand('slot-down', 'replace', REPLACE_TEXT_SPLITS)

    expect(slotUp?.profile.intro.y).toEqual({ from: 16, to: 0 })
    expect(slotUp?.profile.outro.y).toEqual({ from: 0, to: -16 })
    expect(slotDown?.profile.intro.y).toEqual({ from: -16, to: 0 })
    expect(slotDown?.profile.outro.y).toEqual({ from: 0, to: 16 })
  })

  it('covers every JSON preset in the typed author choice table', () => {
    const names = Object.values(REPLACE_PRESET_CHOICES).flatMap((group) => Object.values(group))

    expect(assertReplacePresetChoiceCoverage()).toBe(true)
    expect(names).toHaveLength(54)
    expect(new Set(names).size).toBe(54)
  })

  it('normalizes every JSON preset for whole text and split media', () => {
    const names = Object.values(REPLACE_PRESET_CHOICES).flatMap((group) => Object.values(group))

    expect(names).toHaveLength(54)
    for (const transition of names) {
      const textCommand = normalizeReplacePresetCommand(transition, 'replace', REPLACE_TEXT_SPLITS)
      const mediaCommand = normalizeReplacePresetCommand(
        { transition, split: 'cells' },
        'replace',
        REPLACE_MEDIA_SPLITS,
      )

      expect(textCommand?.transition).toBe(transition)
      expect(textCommand?.duration).toBe(textCommand?.definition.durationMs)
      expect(textCommand?.profile.intro).toBe(textCommand?.definition.intro)
      expect(mediaCommand?.transition).toBe(transition)
      expect(mediaCommand?.split).toBe('cells')
      expect(mediaCommand?.profile.outro).toBe(mediaCommand?.definition.outro)
    }

    const shape = {
      path: 'M50 0 C84 8 100 42 82 72 C64 102 20 88 8 54 Z',
      viewBox: '0 0 100 100',
    }
    const shapedMediaCommand = normalizeReplacePresetCommand(
      { transition: 'fade', split: 'cells', shape },
      'replace',
      REPLACE_MEDIA_SPLITS,
    )
    expect(shapedMediaCommand?.shape).toEqual(shape)
    expect(shapedMediaCommand?.profile.shape).toEqual(shape)
  })

  it('prepares and samples every JSON trajectory through ACE', () => {
    const names = Object.values(REPLACE_PRESET_CHOICES).flatMap((group) => Object.values(group))

    expect(names).toHaveLength(54)
    for (const transition of names) {
      const command = normalizeReplacePresetCommand(transition, 'replace', REPLACE_TEXT_SPLITS)
      expect(command).toBeDefined()
      if (command === undefined) continue

      const trajectories = prepareMotionTrajectories(command.profile)
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        for (const trajectory of [trajectories.intro, trajectories.outro]) {
          const pose = resolveMotionTrajectory(trajectory, progress)
          expect(Object.values(pose).every(Number.isFinite)).toBe(true)
        }
      }
    }
  })

  it('keeps the canonical JSON limited to finite opacity and transform trajectories', () => {
    const allowedDefinitionFields = new Set(['durationMs', 'ease', 'slot', 'intro', 'outro'])
    const allowedMotionFields = new Set(['opacity', 'x', 'y', 'scale', 'scaleX', 'scaleY', 'rotate'])
    const definitions = Object.entries(replacePresetCatalog) as Array<[
      string,
      Record<string, unknown>,
    ]>

    expect(definitions).toHaveLength(54)
    for (const [name, definition] of definitions) {
      expect(Object.keys(definition).every((field) => allowedDefinitionFields.has(field))).toBe(true)
      expect(typeof definition.durationMs).toBe('number')
      expect(Number.isFinite(definition.durationMs)).toBe(true)
      expect((definition.durationMs as number) >= 0).toBe(true)
      expect(typeof definition.intro).toBe('object')
      expect(typeof definition.outro).toBe('object')

      for (const direction of ['intro', 'outro'] as const) {
        const motion = definition[direction] as Record<string, unknown>
        expect(Object.keys(motion).length).toBeGreaterThan(0)
        expect(Object.keys(motion).every((field) => allowedMotionFields.has(field))).toBe(true)
        for (const range of Object.values(motion) as Array<Record<string, unknown>>) {
          expect(typeof range).toBe('object')
          expect([range.from, range.to].every((value) => (
            value === undefined || (typeof value === 'number' && Number.isFinite(value))
          ))).toBe(true)
          expect(typeof range.to).toBe('number')
        }
      }

      if (definition.ease !== undefined) expect(typeof definition.ease).toBe('string')
      if (definition.slot !== undefined) {
        const slot = definition.slot as Record<string, unknown>
        expect(slot.axis === 'up' || slot.axis === 'down').toBe(true)
        expect(slot.bounce === undefined || typeof slot.bounce === 'number').toBe(true)
        expect(slot.chroma === undefined || typeof slot.chroma === 'boolean').toBe(true)
      }
      expect(normalizeReplacePresetCommand(name, 'replace', REPLACE_TEXT_SPLITS)).toBeDefined()
    }
  })

  it.each([
    ['left', [27, 53, 80, 0, 27, 53, 27, 53, 80]],
    ['right', [80, 53, 27, 53, 27, 0, 80, 53, 27]],
    ['top', [27, 0, 27, 53, 27, 53, 80, 53, 80]],
    ['bottom', [80, 53, 80, 53, 27, 53, 27, 0, 27]],
    ['left-top', [0, 20, 40, 20, 40, 60, 40, 60, 80]],
    ['right-top', [40, 20, 0, 60, 40, 20, 80, 60, 40]],
    ['left-bottom', [40, 60, 80, 20, 40, 60, 0, 20, 40]],
    ['right-bottom', [80, 60, 40, 60, 40, 20, 40, 20, 0]],
    ['center', [80, 40, 80, 40, 0, 40, 80, 40, 80]],
    ['edges', [0, 40, 0, 40, 80, 40, 0, 40, 0]],
  ] as const)(
    'preserves the V1 Manhattan propagation order from %s',
    (direction, expected) => {
      expect(computeReplaceStaggerDelays({
        cols: 3,
        rows: 3,
        totalStaggerMs: 80,
        direction,
      })).toEqual(expected)
    },
  )

  it('assigns row-wave and column-wave delays to individual cells across the full envelope', () => {
    expect(computeReplaceStaggerDelays({
      cols: 3,
      rows: 2,
      totalStaggerMs: 100,
      staggerPattern: 'row-wave',
    })).toEqual([0, 20, 40, 60, 80, 100])
    expect(computeReplaceStaggerDelays({
      cols: 1,
      rows: 1,
      totalStaggerMs: 100,
      staggerPattern: 'row-wave',
    })).toEqual([0])
    expect(computeReplaceStaggerDelays({
      cols: 3,
      rows: 2,
      totalStaggerMs: 100,
      staggerPattern: 'column-wave',
    })).toEqual([0, 40, 80, 20, 60, 100])
    const manhattan = { cols: 3, rows: 2, totalStaggerMs: 100, direction: 'center' as const }
    expect(computeReplaceStaggerDelays({ ...manhattan, staggerPattern: 'manhattan' }))
      .toEqual(computeReplaceStaggerDelays(manhattan))
  })

  it('keeps grid delays and effective duration in one timing result', () => {
    expect(computeReplaceStaggerTiming({
      cols: 3,
      rows: 2,
      durationMs: 850,
      totalStaggerMs: 800,
      staggerPattern: 'column-wave',
    })).toEqual({
      delays: [0, 320, 640, 160, 480, 800],
      totalDurationMs: 1_650,
    })
  })

  it('passes named stagger patterns through both media profile paths', () => {
    const slotProfile = normalizeReplaceMediaCommand({
      transition: 'mask-reveal',
      split: 'cells',
      staggerPattern: 'row-wave',
      stagger: 1_000,
    })
    expect(slotProfile?.profile).toMatchObject({
      split: 'cells',
      staggerPattern: 'row-wave',
      stagger: 1_000,
    })
    if (slotProfile !== undefined) {
      const htmlProfile = normalizeProfile(slotProfile.profile)
      expect(htmlProfile.mediaCells?.staggerPattern).toBe('row-wave')
      if (htmlProfile.mediaCells !== undefined) {
        expect(resolveMediaCellSettings(htmlProfile.mediaCells, 300, 150).staggerPattern).toBe('row-wave')
      }
    }

    const cssTransitionProfile = normalizeReplaceMediaCommand({
      transition: 'wipe',
      split: 'cells',
      shape: 'star',
      cellSize: 8,
      staggerPattern: 'column-wave',
      stagger: 800,
    })
    expect(cssTransitionProfile?.profile).toMatchObject({
      transition: 'wipe',
      split: 'cells',
      shape: 'star',
      cellSize: 8,
      staggerPattern: 'column-wave',
      stagger: 800,
    })

    const presetProfile = normalizeReplaceMediaCommand({
      transition: 'swipe-right',
      split: 'cells',
      staggerPattern: 'column-wave',
      stagger: 1_000,
    })
    expect(presetProfile?.profile).toMatchObject({
      split: 'cells',
      staggerPattern: 'column-wave',
      stagger: 1_000,
    })
    if (presetProfile !== undefined) {
      const htmlProfile = normalizeProfile(presetProfile.profile)
      expect(htmlProfile.mediaCells?.staggerPattern).toBe('column-wave')
      if (htmlProfile.mediaCells !== undefined) {
        expect(resolveMediaCellSettings(htmlProfile.mediaCells, 300, 150).staggerPattern).toBe('column-wave')
      }
    }
    const manhattanProfile = normalizeReplaceMediaCommand({
      transition: 'mask-reveal',
      split: 'cells',
      staggerPattern: 'manhattan',
      direction: 'center',
    })
    expect(manhattanProfile?.profile).toMatchObject({ staggerPattern: 'manhattan', direction: 'center' })
    expect(normalizeReplaceMediaCommand({
      transition: 'mask-reveal',
      split: 'cells',
      direction: 'center',
      staggerPattern: 'column-wave',
    })).toBeUndefined()
  })

  it('rejects unknown presets and invalid text replacement settings', () => {
    const invalidCommands: unknown[] = [
      'text-flythrough',
      { transition: 'fade', duration: -1 },
      { transition: 'fade', split: 'cells' },
      { transition: 'fade', stagger: Number.NaN },
      { transition: 'fade', direction: 'diagonal' },
      { transition: 'fade', split: 'cells', staggerPattern: 'row-wave' },
      { transition: 'fade', split: 'letter', staggerPattern: 'manhattan' },
      { transition: 'fade', cellX: 0 },
      { transition: 'fade', split: 'letter', cellSize: 2 },
      { transition: 'fade', skipUnchanged: 'false' },
    ]

    for (const command of invalidCommands) {
      expect(normalizeReplacePresetCommand(command, 'replace', REPLACE_TEXT_SPLITS)).toBeUndefined()
    }
  })

  it.each([
    ['tag', { transition: 'text-flythrough' }, 'AUTHOR_TEXT_REPLACE_TRANSITION_INVALID'],
    ['text', { transition: 'fade', split: 'cells' }, 'AUTHOR_TEXT_REPLACE_SPLIT_INVALID'],
    ['img', { transition: 'fade', split: 'line' }, 'AUTHOR_MEDIA_REPLACE_SPLIT_INVALID'],
    ['img', { transition: 'fade', split: 'cells', cellSize: 0 }, 'AUTHOR_MEDIA_REPLACE_GRID_INVALID'],
    ['media', { transition: 'fade', shape: 'star' }, 'AUTHOR_MEDIA_REPLACE_SHAPE_INVALID'],
    ['media', { transition: 'fade', duration: -1 }, 'AUTHOR_MEDIA_REPLACE_NUMBER_INVALID'],
  ] as const)(
    'rejects invalid %s replacement data at the SceneBuilder boundary',
    (componentType, replace, expectedCode) => {
      const initial = componentType === 'tag'
        ? { tag: 'p', content: 'A', move: '@root' }
        : componentType === 'text'
          ? { content: 'A', move: '@root' }
          : componentType === 'img'
            ? { src: '/image-a.png', move: '@root' }
            : { tag: 'video', src: '/video-a.mp4', move: '@root' }
      const action = componentType === 'tag' || componentType === 'text'
        ? { content: 'B', replace }
        : { src: componentType === 'img' ? '/image-b.png' : '/video-b.mp4', replace }
      const catalog = createCoreRuntimeCatalog()
      const build = new SceneBuilder(catalog.validationSnapshot()).build({
        id: 'replace-invalid-author-data',
        stories: {
          main: {
            id: 'main',
            persos: [{
              id: 'owner',
              type: componentType,
              initial,
              actions: { swap: action },
            }],
            eventimes: [{ name: 'swap', startAt: 100 }],
          },
        },
      } as never)

      expect(build.ok).toBe(false)
      if (build.ok) return
      expect(build.diagnostics.errors.map((diagnostic) => diagnostic.code)).toContain(expectedCode)
      expect(build.diagnostics.errors.some((diagnostic) => (
        typeof diagnostic.details?.context?.path === 'string'
        && diagnostic.details.context.path.includes('replace')
      ))).toBe(true)
    },
  )

  it('runs slot grid masks through the player timeline with one outgoing clone', () => {
    const geometry = mockMediaGeometry()
    restoreMediaGeometryMock = geometry
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
                replace: {
                  transition: 'mask-reveal',
                  shape: 'circle',
                  duration: 100,
                  split: 'cells',
                  cellSize: 25,
                  staggerPattern: 'column-wave',
                  stagger: 20,
                },
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
    expect(build.compiledScene.requirements.modules).toEqual(['replace-slot'])

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

    const snapshots = (): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>('[data-codplay-replace-view]'))
    expect(snapshots()).toHaveLength(1)
    const [outgoing] = snapshots()
    expect(outgoing?.id).toBe('')
    expect(outgoing?.textContent).toBe('A')
    const maskHost = root.querySelector<SVGSVGElement>('[data-codplay-replace-mask-host]')
    expect(maskHost?.querySelectorAll('[data-replace-cell-index]')).toHaveLength(12)
    expect(maskHost?.querySelectorAll('mask')).toHaveLength(1)
    expect(root.querySelectorAll('canvas')).toHaveLength(0)
    const outgoingContent = outgoing?.firstElementChild as HTMLElement | null | undefined
    expect(outgoingContent?.style.getPropertyValue('mask-image')).toContain('#codplay-replace-mask-')

    runner.getComponentSurface('main:host', 'foreignContent')?.attach([foreignB])
    expect(host.children).toHaveLength(1)
    expect(host.firstElementChild).toBe(foreignB)
    expect(foreignA.parentNode).toBeNull()

    runner.advance(150)
    expect(snapshots()).toHaveLength(1)
    expect(Array.from(maskHost?.querySelectorAll<SVGSVGElement>('[data-replace-cell-index]') ?? [])
      .some((cell) => cell.style.scale !== '1')).toBe(true)
    expect(host.style.visibility).toBe('')
    expect(host.style.getPropertyValue('mask-image')).toBe('')

    geometry.setSize(96, 96)
    runner.resize()
    expect(snapshots()).toHaveLength(1)
    expect(maskHost?.querySelectorAll('[data-replace-cell-index]')).toHaveLength(16)
    expect(host.style.getPropertyValue('mask-image')).toBe('')

    runner.advance(250)
    expect(snapshots()).toHaveLength(0)
    expect(host.style.visibility).toBe('')
    expect(root.querySelector('[data-codplay-replace-mask-host]')).toBeNull()
    expect(root.querySelectorAll('canvas')).toHaveLength(0)
    expect(foreignB.parentNode).toBe(host)
  })

  it('cancels the previous session and replays the active transition on seek', () => {
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
    const snapshots = (): HTMLElement[] => Array.from(root.querySelectorAll<HTMLElement>('[data-codplay-replace-view]'))
    runner.getComponentSurface('main:host', 'foreignContent')?.attach([foreignB])

    runner.player.play()
    runner.advance(0)
    runner.advance(100)
    expect(snapshots()).toHaveLength(2)
    runner.advance(150)
    expect(snapshots()).toHaveLength(2)
    expect(snapshots()[0]?.textContent).toBe('B')

    runner.getComponentSurface('main:host', 'foreignContent')?.attach([foreignC])
    expect(host.firstElementChild).toBe(foreignC)
    expect(runner.seek(50).ok).toBe(true)
    expect(snapshots()).toHaveLength(0)

    expect(runner.seek(175).ok).toBe(true)
    expect(snapshots()).toHaveLength(2)
    expect(snapshots()[0]?.textContent).toBe('C')
    expect(snapshots()[0]?.style.opacity).toBe('0.75')
    expect(snapshots()[1]?.style.opacity).toBe('0.25')
    expect(host.style.visibility).toBe('hidden')
    runner.advance(200)
    runner.advance(225)
    expect(snapshots()[0]?.style.opacity).toBe('0.5')
    expect(snapshots()[1]?.style.opacity).toBe('0.5')
    runner.advance(300)
    expect(snapshots()).toHaveLength(0)
  })

  it('replaces plain tags and rich text through the player and reconstructs both on seek', () => {
    restoreTextMeasurementMock = mockTextRangeMeasurements()
    const root = document.createElement('main')
    document.body.appendChild(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'replace-text-runtime',
      stories: {
        main: {
          id: 'main',
          persos: [
            {
              id: 'tag',
              type: 'tag',
              initial: { tag: 'p', content: 'Tag avant', move: '@root' },
              actions: {
                swap: {
                  content: 'Tag après',
                  replace: { transition: 'swipe-left', duration: 100 },
                },
              },
            },
            {
              id: 'text',
              type: 'text',
              initial: { tag: 'p', content: '<strong>Texte avant</strong>', move: '@root' },
              actions: {
                swap: {
                  content: '<em>Texte après</em>',
                  replace: { transition: 'slot-up', duration: 100, split: 'letter' },
                },
              },
            },
          ],
          eventimes: [{ name: 'swap', startAt: 100 }],
        },
      },
      eventimes: [{ name: 'sequence:end', startAt: 1000 }],
    })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    expect(build.compiledScene.requirements.modules).toEqual(['replace-text'])
    runner = new HtmlPlayerRunner({
      id: 'replace-text-player',
      compiledScene: build.compiledScene,
      root,
      catalog,
    })
    expect(runner.init().ok).toBe(true)

    const snapshots = (): HTMLElement[] => Array.from(
      root.querySelectorAll<HTMLElement>('[data-codplay-replace-view]'),
    )
    runner.player.play()
    runner.advance(0)
    runner.advance(100)

    expect(snapshots()).toHaveLength(4)
    expect(snapshots()[0]?.textContent).toBe('Tag avant')
    expect(snapshots()[1]?.textContent).toBe('Tag après')
    expect(snapshots()[2]?.textContent).toContain('Texte avant')
    expect(snapshots()[3]?.textContent).toContain('Texte après')
    expect(root.querySelectorAll('[data-codplay-replace-text-units="letter"]')).not.toHaveLength(0)

    expect(runner.seek(50).ok).toBe(true)
    expect(snapshots()).toHaveLength(0)
    expect(runner.seek(150).ok).toBe(true)
    expect(snapshots()).toHaveLength(4)
    expect(snapshots()[0]?.textContent).toBe('Tag avant')
    expect(snapshots()[1]?.textContent).toBe('Tag après')
    expect(snapshots()[2]?.textContent).toContain('Texte avant')
    expect(snapshots()[3]?.textContent).toContain('Texte après')
  })

  it.each(['letter', 'word', 'line'] as const)(
    'runs %s text replacement through the player and reflows at the current sample',
    (split) => {
      let wrapAt = 3
      restoreTextMeasurementMock = mockTextRangeMeasurements(() => wrapAt)
      const root = document.createElement('main')
      document.body.append(root)
      const catalog = createCoreRuntimeCatalog()
      const build = new SceneBuilder(catalog.validationSnapshot()).build({
        id: `replace-text-${split}-runtime`,
        stories: {
          main: {
            id: 'main',
            persos: [{
              id: 'copy',
              type: 'tag',
              initial: { tag: 'p', content: 'OLD VALUE', move: '@root' },
              actions: {
                swap: {
                  content: 'AB CDE',
                  replace: { transition: 'swipe-up', duration: 300, split, direction: 'left' },
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
      runner = new HtmlPlayerRunner({
        id: `replace-text-${split}-player`,
        compiledScene: build.compiledScene,
        root,
        catalog,
      })
      expect(runner.init().ok).toBe(true)
      const snapshots = (): HTMLElement[] => Array.from(
        root.querySelectorAll<HTMLElement>('[data-codplay-replace-view]'),
      )
      const unitIndexes = (snapshot: HTMLElement | undefined): string[] => Array.from(
        snapshot?.querySelectorAll<HTMLElement>('[data-replace-unit-index]') ?? [],
        (span) => span.dataset.replaceUnitIndex ?? '',
      )

      runner.player.play()
      runner.advance(0)
      runner.advance(200)
      expect(snapshots()).toHaveLength(2)
      expect(snapshots()[0]?.getAttribute('data-codplay-replace-view')).toBe('outgoing')
      expect(snapshots()[1]?.getAttribute('data-codplay-replace-view')).toBe('incoming')
      if (split === 'letter') expect(new Set(unitIndexes(snapshots()[1])).size).toBe(6)
      if (split === 'word') expect(new Set(unitIndexes(snapshots()[1])).size).toBe(3)
      if (split === 'line') expect(new Set(unitIndexes(snapshots()[1])).size).toBe(2)

      const firstUnit = snapshots()[1]?.querySelector<HTMLElement>('[data-replace-unit-index="0"]')
      const sampledTranslation = firstUnit?.style.translate
      expect(sampledTranslation).not.toBe('none')
      if (split === 'line') {
        wrapAt = 2
        runner.resize()
        expect(runner.getCurrentTimeMs()).toBe(200)
        expect(new Set(unitIndexes(snapshots()[1]))).toHaveProperty('size', 3)
        expect(snapshots()[1]?.querySelector<HTMLElement>('[data-replace-unit-index="0"]')?.style.translate)
          .toBe(sampledTranslation)
      }

      expect(runner.seek(50).ok).toBe(true)
      expect(snapshots()).toHaveLength(0)
      expect(runner.seek(200).ok).toBe(true)
      expect(snapshots()).toHaveLength(2)
      expect(new Set(unitIndexes(snapshots()[1])).size).toBe(split === 'letter' ? 6 : 3)
      expect(runner.seek(600).ok).toBe(true)
      expect(snapshots()).toHaveLength(0)
      expect((runner.getPersoNode('main:copy') as HTMLElement).textContent).toBe('AB CDE')
    },
  )

  it('applies JSON glyph-roll chroma and unchanged-unit handling through the text module', () => {
    restoreTextMeasurementMock = mockTextRangeMeasurements()
    const root = document.createElement('main')
    document.body.append(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'replace-text-glyph-roll-runtime',
      stories: {
        main: {
          id: 'main',
          persos: [
            {
              id: 'copy',
              type: 'tag',
              initial: {
                tag: 'p',
                content: 'ABA',
                className: 'default-roll',
                style: { color: 'rgb(12, 34, 56)' },
                move: '@root',
              },
              actions: {
                swap: {
                  content: 'ACA',
                  replace: { transition: 'slot-up', duration: 300, split: 'letter' },
                },
              },
            },
            {
              id: 'copy-no-skip',
              type: 'tag',
              initial: { tag: 'p', content: 'ABA', className: 'no-skip-roll', move: '@root' },
              actions: {
                swap: {
                  content: 'ACA',
                  replace: {
                    transition: 'slot-up',
                    duration: 300,
                    split: 'letter',
                    skipUnchanged: false,
                  },
                },
              },
            },
          ],
          eventimes: [{ name: 'swap', startAt: 100 }],
        },
      },
      eventimes: [{ name: 'sequence:end', startAt: 1000 }],
    })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    runner = new HtmlPlayerRunner({
      id: 'replace-text-glyph-roll-player',
      compiledScene: build.compiledScene,
      root,
      catalog,
    })
    expect(runner.init().ok).toBe(true)
    runner.player.play()
    runner.advance(0)
    runner.advance(200)

    const allViews = Array.from(root.querySelectorAll<HTMLElement>('[data-codplay-replace-view]'))
    const views = allViews.filter((view) => view.querySelector('.default-roll'))
    const noSkipViews = allViews.filter((view) => view.querySelector('.no-skip-roll'))
    expect(views).toHaveLength(2)
    expect(noSkipViews).toHaveLength(2)
    const [outgoing, incoming] = views
    const unchangedOutgoing = ['0', '2'].map((index) => outgoing?.querySelector<HTMLElement>(
      `[data-replace-unit-index="${index}"]`,
    ))
    const unchangedIncoming = ['0', '2'].map((index) => incoming?.querySelector<HTMLElement>(
      `[data-replace-unit-index="${index}"]`,
    ))
    expect(unchangedOutgoing.every((span) => span?.style.visibility === 'hidden')).toBe(true)
    expect(unchangedIncoming.every((span) => span?.style.visibility !== 'hidden')).toBe(true)
    expect(incoming?.querySelector<HTMLElement>('[data-replace-unit-index="1"]')?.style.color)
      .not.toBe('rgb(12, 34, 56)')
    expect(['0', '2'].every((index) => noSkipViews[0]?.querySelector<HTMLElement>(
      `[data-replace-unit-index="${index}"]`,
    )?.style.visibility !== 'hidden')).toBe(true)

    expect(runner.seek(600).ok).toBe(true)
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
    expect((runner.getPersoNode('main:copy') as HTMLElement).textContent).toBe('ACA')
    expect((runner.getPersoNode('main:copy') as HTMLElement).style.color).toBe('rgb(12, 34, 56)')
  })

  const contentForms = [
    { name: 'omitted', provided: false, isPresent: false, value: undefined },
    { name: 'null', provided: true, isPresent: false, value: null },
    { name: 'undefined', provided: true, isPresent: false, value: undefined },
    { name: 'empty string', provided: true, isPresent: false, value: '' },
    { name: 'text', provided: true, isPresent: true, value: 'visible' },
    { name: 'zero', provided: true, isPresent: true, value: 0 },
    { name: 'spaces', provided: true, isPresent: true, value: '  ' },
  ] as const

  for (const componentType of ['tag', 'text'] as const) {
    for (const outgoing of contentForms) {
      for (const incoming of contentForms) {
        it(`selects ${componentType} replace formula for ${outgoing.name} → ${incoming.name} content`, () => {
          const root = document.createElement('main')
          document.body.append(root)
          const diagnostics: unknown[] = []
          const catalog = createCoreRuntimeCatalog()
          const initial: Record<string, unknown> = { tag: 'p', move: '@root' }
          const action: Record<string, unknown> = {
            replace: { transition: 'fade', duration: 100 },
          }
          if (outgoing.provided) initial.content = outgoing.value
          if (incoming.provided) action.content = incoming.value

          const build = new SceneBuilder(catalog.validationSnapshot()).build({
            id: 'replace-content-presence',
            stories: {
              main: {
                id: 'main',
                persos: [{ id: 'copy', type: componentType, initial, actions: { swap: action } }],
                eventimes: [{ name: 'swap', startAt: 100 }],
              },
            },
            eventimes: [{ name: 'sequence:end', startAt: 1000 }],
          })

          expect(build.ok).toBe(true)
          if (!build.ok) return
          runner = new HtmlPlayerRunner({
            id: 'replace-content-presence-player',
            compiledScene: build.compiledScene,
            root,
            catalog,
            onEmitDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
          })
          expect(runner.init().ok).toBe(true)
          const component = runner.getPersoNode('main:copy') as HTMLElement
          runner.player.play()
          runner.advance(0)
          runner.advance(150)

          const snapshots = Array.from(root.querySelectorAll<HTMLElement>('[data-codplay-replace-view]'))
          const expectedCount = Number(outgoing.isPresent) + Number(incoming.isPresent)
          expect(snapshots).toHaveLength(expectedCount)
          if (outgoing.isPresent && incoming.isPresent) {
            expect(snapshots[0]?.textContent).toContain(String(outgoing.value))
            expect(snapshots[1]?.textContent).toContain(String(incoming.value))
          } else if (outgoing.isPresent) {
            expect(snapshots[0]?.textContent).toContain(String(outgoing.value))
          } else if (incoming.isPresent) {
            expect(snapshots[0]?.textContent).toContain(String(incoming.value))
          }

          expect(runner.seek(50).ok).toBe(true)
          expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
          expect(component.textContent).toBe(outgoing.isPresent ? String(outgoing.value) : '')
          expect(runner.seek(150).ok).toBe(true)
          expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(expectedCount)
          expect(runner.seek(300).ok).toBe(true)
          expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
          expect(component.textContent).toBe(incoming.isPresent ? String(incoming.value) : '')
          expect(diagnostics).toHaveLength(0)
        })
      }
    }
  }

  it('retargets an interrupted text replace from its visible composition and reconstructs it on seek', () => {
    const root = document.createElement('main')
    document.body.append(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'replace-text-interruption',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'copy',
            type: 'tag',
            initial: { tag: 'p', content: 'A', move: '@root' },
            actions: {
              first: { content: 'B', replace: { transition: 'fade', duration: 100 } },
              second: { content: 'C', replace: { transition: 'fade', duration: 100 } },
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
      id: 'replace-text-interruption-player',
      compiledScene: build.compiledScene,
      root,
      catalog,
    })
    expect(runner.init().ok).toBe(true)
    const directSnapshots = (): HTMLElement[] => Array.from(root.children)
      .filter((child): child is HTMLElement =>
        child instanceof HTMLElement && child.hasAttribute('data-codplay-replace-view'))

    runner.player.play()
    runner.advance(0)
    runner.advance(125)
    expect(directSnapshots()).toHaveLength(2)
    runner.advance(150)

    const [outgoing, incoming] = directSnapshots()
    expect(outgoing?.textContent).toContain('A')
    expect(outgoing?.textContent).toContain('B')
    expect(incoming?.textContent).toBe('C')

    expect(runner.seek(50).ok).toBe(true)
    expect(directSnapshots()).toHaveLength(0)
    expect(runner.seek(175).ok).toBe(true)
    const [seekOutgoing, seekIncoming] = directSnapshots()
    expect(seekOutgoing?.textContent).toContain('A')
    expect(seekOutgoing?.textContent).toContain('B')
    expect(seekIncoming?.textContent).toBe('C')
  })

  it('runs the fade-in preset for an image component without fading the outgoing snapshot', () => {
    restoreMediaFrameMocks = mockDecodedImageFrames()
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
                replace: { transition: 'fade-in', duration: 100 },
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
    expect(build.compiledScene.requirements.modules).toEqual(['replace-media'])

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
    expect(snapshots()).toHaveLength(2)
    expect(root.children[0]).toBe(snapshots()[0])
    expect(root.children[1]).toBe(snapshots()[1])
    expect(snapshots()[0]?.querySelector<HTMLCanvasElement>('canvas[data-codplay-replace-frame]')?.width).toBe(64)
    expect(snapshots()[1]?.querySelector<HTMLCanvasElement>('canvas[data-codplay-replace-frame]')?.width).toBe(64)
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/image-b.png')

    runner.advance(150)
    expect(snapshots()[0]?.style.opacity).toBe('1')
    expect(snapshots()[1]?.style.opacity).toBe('0.5')
    expect(host.style.visibility).toBe('hidden')

    runner.advance(200)
    expect(snapshots()).toHaveLength(0)
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/image-b.png')

    expect(runner.seek(150).ok).toBe(true)
    expect(snapshots()).toHaveLength(2)
    expect(snapshots()[0]?.querySelector<HTMLCanvasElement>('canvas[data-codplay-replace-frame]')?.width).toBe(64)
    expect(snapshots()[0]?.style.opacity).toBe('1')
    expect(snapshots()[1]?.querySelector<HTMLCanvasElement>('canvas[data-codplay-replace-frame]')?.width).toBe(64)
    expect(snapshots()[1]?.style.opacity).toBe('0.5')
    expect(host.style.visibility).toBe('hidden')
    expect(runner.seek(300).ok).toBe(true)
    expect(snapshots()).toHaveLength(0)
  })

  it.each(['fade', 'fade-in', 'mask-reveal', 'curtain', 'wipe', 'slide-over', 'stack'] as const)(
    'applies the %s slot profile to fixed image snapshots',
    (transition) => {
      restoreMediaFrameMocks = mockDecodedImageFrames()
      const root = document.createElement('main')
      document.body.append(root)
      const catalog = createCoreRuntimeCatalog()
      const build = new SceneBuilder(catalog.validationSnapshot()).build({
        id: `replace-image-${transition}`,
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
                  replace: {
                    transition,
                    duration: 100,
                    ...(transition === 'mask-reveal' ? { shape: 'star' } : {}),
                  },
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
      runner = new HtmlPlayerRunner({
        id: `replace-image-${transition}-player`,
        compiledScene: build.compiledScene,
        root,
        catalog,
        resources: ['/image-a.png', '/image-b.png'],
      })
      expect(runner.init().ok).toBe(true)
      const snapshots = (): HTMLElement[] => Array.from(
        root.querySelectorAll<HTMLElement>('[data-codplay-replace-view]'),
      )

      runner.player.play()
      runner.advance(0)
      runner.advance(150)
      const [outgoing, incoming] = snapshots()
      expect(outgoing?.querySelector<HTMLCanvasElement>('canvas[data-codplay-replace-frame]')?.width).toBe(64)
      expect(incoming?.querySelector<HTMLCanvasElement>('canvas[data-codplay-replace-frame]')?.width).toBe(64)

      if (transition === 'fade') {
        expect(outgoing?.style.opacity).toBe('0.5')
        expect(incoming?.style.opacity).toBe('0.5')
      } else if (transition === 'fade-in') {
        expect(outgoing?.style.opacity).toBe('1')
        expect(incoming?.style.opacity).toBe('0.5')
      } else if (transition === 'mask-reveal') {
        expect(incoming?.style.getPropertyValue('mask-image')).toContain('data:image/svg+xml')
        expect(incoming?.style.getPropertyValue('mask-size')).not.toBe('0% auto')
      } else if (transition === 'curtain') {
        expect(outgoing?.style.translate).not.toBe('0 0%')
        expect(incoming?.style.translate).not.toBe('0 100%')
      } else if (transition === 'wipe') {
        expect(incoming?.style.clipPath).toBe('inset(0 0 0 50%)')
      } else if (transition === 'slide-over') {
        expect(outgoing?.style.scale).not.toBe('1')
        expect(incoming?.style.translate).not.toBe('0 100%')
      } else {
        expect(outgoing?.style.scale).not.toBe('1')
        expect(incoming?.style.translate).not.toBe('0 100%')
      }

      expect(runner.seek(300).ok).toBe(true)
      expect(snapshots()).toHaveLength(0)
    },
  )

  it.each([...REPLACE_SLOT_TRANSITIONS, 'tilt-right'] as const)(
    'uses SVG masks over one source view and the persistent image for %s during Play and Seek',
    (transition) => {
    const authorShape = transition === 'wipe'
      ? { path: 'M50 0 C84 8 100 42 82 72 C64 102 20 88 8 54 Z', viewBox: '0 0 100 100' }
      : undefined
    restoreMediaFrameMocks = mockDecodedImageFrames()
    restoreMediaGeometryMock = mockMediaGeometry()
    const root = document.createElement('main')
    document.body.appendChild(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot(), {
      createdAt: '2026-09-11T00:00:00.000Z',
    }).build({
      id: 'replace-image-cells-runtime',
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
                replace: {
                  transition,
                  duration: 100,
                  split: 'cells',
                  cellX: 2,
                  cellY: 2,
                  shape: authorShape ?? 'star',
                },
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
    runner = new HtmlPlayerRunner({
      id: 'replace-image-cells-player',
      compiledScene: build.compiledScene,
      root,
      catalog,
      resources: ['/image-a.png', '/image-b.png'],
    })
    expect(runner.init().ok).toBe(true)
    const host = runner.getPersoNode('main:image') as HTMLDivElement
    const snapshots = (): HTMLElement[] => Array.from(
      root.querySelectorAll<HTMLElement>('[data-codplay-replace-view]'),
    )
    const assertVisibleMaskGrids = (): void => {
      const views = snapshots()
      expect(views).toHaveLength(1)
      expect(views[0]?.querySelector('img')?.getAttribute('src')).toBe('/image-a.png')
      const maskHost = root.querySelector<SVGSVGElement>('[data-codplay-replace-mask-host]')
      const masks = Array.from(maskHost?.querySelectorAll('mask') ?? [])
      expect(masks).toHaveLength(1)
      expect(masks.map((mask) => mask.querySelectorAll('[data-replace-cell-index]').length)).toEqual([4])
      if (authorShape !== undefined) {
        expect(masks.flatMap((mask) => Array.from(mask.querySelectorAll('path')))
          .every((path) => path.getAttribute('d') === authorShape.path)).toBe(true)
      }
      expect(root.querySelectorAll('canvas')).toHaveLength(0)
      expect(host.querySelector('img')?.getAttribute('src')).toBe('/image-b.png')
      expect(host.style.visibility).toBe('')
      expect(host.style.getPropertyValue('mask-image')).toBe('')
      expect((views[0]?.firstElementChild as HTMLElement | null)?.style.getPropertyValue('mask-image'))
        .toContain('#codplay-replace-mask-')
    }

    runner.player.play()
    runner.advance(0)
    runner.advance(100)
    assertVisibleMaskGrids()
    expect(host.parentElement).toBe(root)
    expect(host.style.visibility).toBe('')

    expect(runner.seek(50).ok).toBe(true)
    expect(snapshots()).toHaveLength(0)
    expect(host.style.visibility).toBe('')

    expect(runner.seek(125).ok).toBe(true)
    assertVisibleMaskGrids()
    expect(host.parentElement).toBe(root)

    expect(runner.seek(300).ok).toBe(true)
    expect(snapshots()).toHaveLength(0)
    expect(host.style.visibility).toBe('')
    },
  )

  it.each([...REPLACE_SLOT_TRANSITIONS, 'tilt-right'] as const)(
    'applies %s SVG masks to one frozen source and the persistent video node',
    (transition) => {
      restoreMediaFrameMocks = mockDecodedVideoFrames()
      restoreMediaGeometryMock = mockMediaGeometry()
      const root = document.createElement('main')
      document.body.append(root)
      const catalog = createCoreRuntimeCatalog()
      const build = new SceneBuilder(catalog.validationSnapshot()).build({
        id: `replace-video-cells-${transition}`,
        stories: {
          main: {
            id: 'main',
            persos: [{
              id: 'video',
              type: 'media',
              initial: { tag: 'video', move: '@root', src: '/video-a.mp4' },
              actions: {
                swap: {
                  src: '/video-b.mp4',
                  replace: {
                    transition,
                    duration: 100,
                    split: 'cells',
                    cellX: 2,
                    cellY: 2,
                    stagger: 0,
                    direction: 'left',
                    shape: 'star',
                  },
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
      runner = new HtmlPlayerRunner({
        id: `replace-video-cells-${transition}-player`,
        compiledScene: build.compiledScene,
        root,
        catalog,
        resources: ['/video-a.mp4', '/video-b.mp4'],
      })
      expect(runner.init().ok).toBe(true)
      const host = runner.getPersoNode('main:video') as HTMLElement
      const videoA = host.querySelector<HTMLVideoElement>('video')
      expect(videoA).not.toBeNull()
      if (videoA !== null) videoA.currentTime = 3.25
      const snapshots = (): HTMLElement[] => Array.from(
        root.querySelectorAll<HTMLElement>('[data-codplay-replace-view]'),
      )

      runner.player.play()
      runner.advance(0)
      runner.advance(150)
      const views = snapshots()
      expect(views).toHaveLength(1)
      const sourceClone = views[0]?.querySelector<HTMLVideoElement>('video')
      expect(sourceClone).not.toBeNull()
      expect(sourceClone?.paused).toBe(true)
      expect(sourceClone?.currentTime).toBe(3.25)
      const maskHost = root.querySelector<SVGSVGElement>('[data-codplay-replace-mask-host]')
      const masks = Array.from(maskHost?.querySelectorAll('mask') ?? [])
      const cells = masks.map((mask) => Array.from(
        mask.querySelectorAll<SVGSVGElement>('[data-replace-cell-index]'),
      ))
      expect(cells.map((grid) => grid.length)).toEqual([4])
      expect(root.querySelectorAll('video')).toHaveLength(2)
      expect(root.querySelectorAll('canvas')).toHaveLength(0)
      expect(host.style.visibility).toBe('')
      expect(host.style.getPropertyValue('mask-image')).toBe('')
      expect((views[0]?.firstElementChild as HTMLElement | null)?.style.getPropertyValue('mask-image'))
        .toContain('#codplay-replace-mask-')

      if (transition === 'fade') {
        expect(cells.flat().every((cell) => cell.style.opacity === '0.5')).toBe(true)
      } else if (transition === 'fade-in') {
        expect(cells.flat().every((cell) => cell.style.opacity === '0.5')).toBe(true)
      } else if (transition === 'mask-reveal') {
        expect(cells.flat().every((cell) => cell.style.scale !== '')).toBe(true)
      } else if (transition === 'curtain') {
        expect(cells.flat().every((cell) => cell.style.translate !== 'none')).toBe(true)
      } else if (transition === 'wipe') {
        expect(cells.flat().every((cell) => cell.style.clipPath !== '')).toBe(true)
      } else if (transition === 'slide-over' || transition === 'stack') {
        expect(cells[0]?.every((cell) => cell.style.scale !== 'none')).toBe(true)
        expect(cells[0]?.every((cell) => cell.style.opacity !== '')).toBe(true)
      } else {
        expect(cells.flat().every((cell) => cell.style.translate !== 'none' && cell.style.rotate !== 'none')).toBe(true)
      }

      const videoB = host.querySelector<HTMLVideoElement>('video')
      expect(videoB).not.toBeNull()
      expect(videoB).not.toBe(videoA)
      expect(runner.seek(50).ok).toBe(true)
      expect(snapshots()).toHaveLength(0)
      expect(host.querySelector('video')).toBe(videoA)

      expect(runner.seek(150).ok).toBe(true)
      expect(snapshots()).toHaveLength(1)
      expect(host.querySelector('video')).toBe(videoB)
      expect(root.querySelectorAll('video')).toHaveLength(2)
      expect(runner.seek(300).ok).toBe(true)
      expect(snapshots()).toHaveLength(0)
      expect(host.querySelector('video')).toBe(videoB)
      expect(root.querySelectorAll('video')).toHaveLength(1)
    },
  )

  it.each([...REPLACE_SLOT_TRANSITIONS, 'tilt-right'] as const)(
    'applies %s to fixed whole-video snapshots through the player',
    (transition) => {
      restoreMediaFrameMocks = mockDecodedVideoFrames()
      restoreMediaGeometryMock = mockMediaGeometry()
      const root = document.createElement('main')
      document.body.append(root)
      const catalog = createCoreRuntimeCatalog()
      const build = new SceneBuilder(catalog.validationSnapshot()).build({
        id: `replace-video-whole-${transition}`,
        stories: {
          main: {
            id: 'main',
            persos: [{
              id: 'video',
              type: 'media',
              initial: { tag: 'video', move: '@root', src: '/video-a.mp4' },
              actions: {
                swap: {
                  src: '/video-b.mp4',
                  replace: {
                    transition,
                    duration: 100,
                    ...(transition === 'mask-reveal' ? { shape: 'star' } : {}),
                  },
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
      runner = new HtmlPlayerRunner({
        id: `replace-video-whole-${transition}-player`,
        compiledScene: build.compiledScene,
        root,
        catalog,
        resources: ['/video-a.mp4', '/video-b.mp4'],
      })
      expect(runner.init().ok).toBe(true)
      runner.player.play()
      runner.advance(0)
      runner.advance(150)

      const [outgoing, incoming] = Array.from(
        root.querySelectorAll<HTMLElement>('[data-codplay-replace-view]'),
      )
      expect(outgoing?.querySelector('video')).toBeNull()
      expect(incoming?.querySelector('video')).toBeNull()
      expect(outgoing?.querySelector<HTMLCanvasElement>('canvas[data-codplay-replace-frame]')?.width).toBe(64)
      expect(incoming?.querySelector<HTMLCanvasElement>('canvas[data-codplay-replace-frame]')?.height).toBe(48)

      if (transition === 'fade') {
        expect(outgoing?.style.opacity).toBe('0.5')
        expect(incoming?.style.opacity).toBe('0.5')
      } else if (transition === 'fade-in') {
        expect(outgoing?.style.opacity).toBe('1')
        expect(incoming?.style.opacity).toBe('0.5')
      } else if (transition === 'mask-reveal') {
        expect(incoming?.style.getPropertyValue('mask-image')).toContain('data:image/svg+xml')
        expect(incoming?.style.getPropertyValue('mask-size')).not.toBe('0% auto')
      } else if (transition === 'curtain') {
        expect(outgoing?.style.translate).not.toBe('0 0%')
        expect(incoming?.style.translate).not.toBe('0 100%')
      } else if (transition === 'wipe') {
        expect(incoming?.style.clipPath).toBe('inset(0 0 0 50%)')
      } else if (transition === 'slide-over') {
        expect(outgoing?.style.scale).not.toBe('1')
        expect(incoming?.style.translate).not.toBe('0 100%')
      } else if (transition === 'stack') {
        expect(outgoing?.style.scale).not.toBe('1')
        expect(incoming?.style.translate).not.toBe('0 100%')
      } else {
        expect(outgoing?.style.translate).not.toBe('none')
        expect(incoming?.style.rotate).not.toBe('none')
      }

      expect(runner.seek(300).ok).toBe(true)
      expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
    },
  )

  it.each([
    ['img', '/image-a.png', '/image-b.png'],
    ['media', '/video-a.mp4', '/video-b.mp4'],
  ] as const)(
    'resizes whole %s snapshots through runner.resize without changing the player sample',
    (componentType, sourceA, sourceB) => {
      restoreMediaFrameMocks = componentType === 'img'
        ? mockDecodedImageFrames()
        : mockDecodedVideoFrames()
      const geometry = mockMediaGeometry()
      restoreMediaGeometryMock = geometry
      const root = document.createElement('main')
      document.body.append(root)
      const catalog = createCoreRuntimeCatalog()
      const initial = componentType === 'img'
        ? { move: '@root', src: sourceA }
        : { tag: 'video', move: '@root', src: sourceA }
      const build = new SceneBuilder(catalog.validationSnapshot()).build({
        id: `replace-${componentType}-whole-resize-runtime`,
        stories: {
          main: {
            id: 'main',
            persos: [{
              id: 'media',
              type: componentType,
              initial,
              actions: { swap: { src: sourceB, replace: { transition: 'curtain', duration: 300 } } },
            }],
            eventimes: [{ name: 'swap', startAt: 100 }],
          },
        },
        eventimes: [{ name: 'sequence:end', startAt: 1000 }],
      })

      expect(build.ok).toBe(true)
      if (!build.ok) return
      runner = new HtmlPlayerRunner({
        id: `replace-${componentType}-whole-resize-player`,
        compiledScene: build.compiledScene,
        root,
        catalog,
        resources: [sourceA, sourceB],
      })
      expect(runner.init().ok).toBe(true)
      runner.player.play()
      runner.advance(0)
      runner.advance(150)
      const snapshots = (): HTMLElement[] => Array.from(
        root.querySelectorAll<HTMLElement>('[data-codplay-replace-view]'),
      )
      const frames = (): HTMLCanvasElement[] => snapshots().map((snapshot) => {
        const frame = snapshot.querySelector<HTMLCanvasElement>('canvas[data-codplay-replace-frame]')
        if (frame === null) throw new Error('Expected each whole-media snapshot to retain one fixed frame.')
        return frame
      })
      const initialFrames = frames()
      expect(initialFrames).toHaveLength(2)
      expect(initialFrames.map((frame) => [frame.width, frame.height])).toEqual([[64, 48], [64, 48]])
      const initialPose = snapshots().map((snapshot) => snapshot.style.translate)
      expect(initialPose.some((pose) => pose !== '')).toBe(true)

      geometry.setSize(120, 60)
      runner.resize()

      expect(runner.getCurrentTimeMs()).toBe(150)
      expect(frames().map((frame) => [frame.width, frame.height])).toEqual([[120, 60], [120, 60]])
      expect(snapshots().map((snapshot) => snapshot.style.translate)).toEqual(initialPose)
      expect(snapshots().every((snapshot) => snapshot.querySelector('video') === null)).toBe(true)
    },
  )

  it.each([
    ['img', '/image-a.png', '/image-b.png'],
    ['media', '/video-a.mp4', '/video-b.mp4'],
  ] as const)(
    'resizes %s SVG cell masks through runner.resize without changing the player sample',
    (componentType, sourceA, sourceB) => {
      restoreMediaFrameMocks = componentType === 'img'
        ? mockDecodedImageFrames()
        : mockDecodedVideoFrames()
      const geometry = mockMediaGeometry()
      restoreMediaGeometryMock = geometry
      const root = document.createElement('main')
      document.body.append(root)
      const catalog = createCoreRuntimeCatalog()
      const initial = componentType === 'img'
        ? { move: '@root', src: sourceA }
        : { tag: 'video', move: '@root', src: sourceA }
      const build = new SceneBuilder(catalog.validationSnapshot()).build({
        id: `replace-${componentType}-cell-resize-runtime`,
        stories: {
          main: {
            id: 'main',
            persos: [{
              id: 'media',
              type: componentType,
              initial,
              actions: {
                swap: {
                  src: sourceB,
                  replace: {
                    transition: 'wipe',
                    duration: 300,
                    split: 'cells',
                    cellX: 2,
                    cellY: 2,
                    stagger: 0,
                    shape: 'circle',
                  },
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
      runner = new HtmlPlayerRunner({
        id: `replace-${componentType}-cell-resize-player`,
        compiledScene: build.compiledScene,
        root,
        catalog,
        resources: [sourceA, sourceB],
      })
      expect(runner.init().ok).toBe(true)
      runner.player.play()
      runner.advance(0)
      runner.advance(150)

      const host = runner.getPersoNode('main:media') as HTMLElement
      const maskHost = root.querySelector<SVGSVGElement>('[data-codplay-replace-mask-host]')
      const masks = Array.from(maskHost?.querySelectorAll<SVGMaskElement>('mask') ?? [])
      expect(masks).toHaveLength(1)
      expect(masks.every((mask) => (
        mask.getAttribute('maskUnits') === 'userSpaceOnUse'
        && mask.getAttribute('maskContentUnits') === 'userSpaceOnUse'
      ))).toBe(true)
      const cells = Array.from(maskHost?.querySelectorAll<SVGSVGElement>('[data-replace-cell-index]') ?? [])
      expect(cells).toHaveLength(4)
      const initialScales = cells.map((cell) => cell.style.scale)
      const initialBoxes = cells.map((cell) => [cell.getAttribute('x'), cell.getAttribute('y'), cell.getAttribute('width'), cell.getAttribute('height')])
      const initialPositions = cells.map((cell) => cell.parentElement?.getAttribute('transform'))
      expect(initialPositions.slice(0, 2)).toEqual(['translate(16 12)', 'translate(48 12)'])
      expect(cells.every((cell) => cell.parentElement?.style.scale === '')).toBe(true)
      expect(cells.every((cell) => cell.style.transformBox === 'view-box' && cell.style.transformOrigin === '50% 50%')).toBe(true)
      expect(root.querySelectorAll('canvas')).toHaveLength(0)
      expect(host.querySelector(componentType === 'img' ? 'img' : 'video')?.getAttribute('src'))
        .toContain(sourceB)

      geometry.setSize(120, 60)
      runner.resize()

      expect(runner.getCurrentTimeMs()).toBe(150)
      expect(cells.map((cell) => cell.style.scale)).toEqual(initialScales)
      expect(cells.map((cell) => [cell.getAttribute('x'), cell.getAttribute('y'), cell.getAttribute('width'), cell.getAttribute('height')]))
        .not.toEqual(initialBoxes)
      expect(cells.map((cell) => cell.parentElement?.getAttribute('transform'))).not.toEqual(initialPositions)
      expect(cells.every((cell) => cell.parentElement?.style.scale === '')).toBe(true)
      expect(maskHost?.querySelectorAll('[data-replace-cell-index]')).toHaveLength(4)
      expect(cells.every((cell) => cell.isConnected)).toBe(true)
      expect(root.querySelectorAll('canvas')).toHaveLength(0)
      expect(host.style.getPropertyValue('mask-image')).toBe('')
      const outgoing = root.querySelector<HTMLElement>('[data-codplay-replace-view="outgoing"]')
      expect((outgoing?.firstElementChild as HTMLElement | null)?.style.getPropertyValue('mask-image'))
        .toContain('#codplay-replace-mask-')

      expect(runner.seek(500).ok).toBe(true)
      expect(root.querySelector('[data-codplay-replace-mask-host]')).toBeNull()
      expect(host.style.getPropertyValue('mask-image')).toBe('')
    },
  )

  it('retargets an interrupted media-cell replace from its visible masked composition', () => {
    restoreMediaFrameMocks = mockDecodedImageFrames()
    restoreMediaGeometryMock = mockMediaGeometry()
    const root = document.createElement('main')
    document.body.append(root)
    const catalog = createCoreRuntimeCatalog()
    const replace = {
      transition: 'wipe',
      duration: 300,
      split: 'cells',
      cellX: 2,
      cellY: 2,
      stagger: 0,
      shape: 'circle',
    } as const
    const build = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'replace-image-cells-interruption-runtime',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'image',
            type: 'img',
            initial: { move: '@root', src: '/image-a.png' },
            actions: {
              first: { src: '/image-b.png', replace },
              second: { src: '/image-c.png', replace },
            },
          }],
          eventimes: [
            { name: 'first', startAt: 100 },
            { name: 'second', startAt: 200 },
          ],
        },
      },
      eventimes: [{ name: 'sequence:end', startAt: 1000 }],
    })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    runner = new HtmlPlayerRunner({
      id: 'replace-image-cells-interruption-player',
      compiledScene: build.compiledScene,
      root,
      catalog,
      resources: ['/image-a.png', '/image-b.png', '/image-c.png'],
    })
    expect(runner.init().ok).toBe(true)
    runner.player.play()
    runner.advance(0)
    runner.advance(150)
    expect(root.querySelector('[data-codplay-replace-mask-host]')).not.toBeNull()

    runner.advance(250)

    const host = runner.getPersoNode('main:image') as HTMLElement
    const outgoing = root.querySelector<HTMLElement>('[data-codplay-replace-view="outgoing"]')
    const visibleSources = new Set(Array.from(outgoing?.querySelectorAll<HTMLImageElement>('img') ?? [])
      .map((image) => image.getAttribute('src')))
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/image-c.png')
    expect(visibleSources).toEqual(new Set(['/image-a.png', '/image-b.png']))
    expect(root.querySelectorAll('canvas')).toHaveLength(0)
    expect(host.style.getPropertyValue('mask-image')).toBe('')
    const outgoingMaskTarget = Array.from(outgoing?.querySelectorAll<HTMLElement>('*') ?? [])
      .find((element) => element.style.getPropertyValue('mask-image').includes('#codplay-replace-mask-'))
    expect(outgoingMaskTarget).toBeDefined()
    const activeMaskHosts = Array.from(root.querySelectorAll<SVGSVGElement>('[data-codplay-replace-mask-host]'))
      .filter((maskHost) => maskHost.parentElement === root)
    expect(activeMaskHosts).toHaveLength(1)
    expect(activeMaskHosts[0]?.querySelectorAll('[data-replace-cell-index]')).toHaveLength(4)

    expect(runner.seek(800).ok).toBe(true)
    expect(root.querySelector('[data-codplay-replace-mask-host]')).toBeNull()
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/image-c.png')
  })

  it('retries whole and cell image snapshots when the incoming frame becomes ready at the same player time', async () => {
    const pendingFrames = mockPendingIncomingImageFrames()
    restoreMediaFrameMocks = pendingFrames.restore
    restoreMediaGeometryMock = mockMediaGeometry()
    const root = document.createElement('main')
    document.body.appendChild(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'replace-image-async-frame-runtime',
      stories: {
        main: {
          id: 'main',
          persos: [
            {
              id: 'whole',
              type: 'img',
              initial: { move: '@root', src: '/image-a.png', className: 'replace-whole' },
              actions: {
                swap: { src: '/image-b.png', replace: { transition: 'curtain', duration: 100 } },
              },
            },
            {
              id: 'cells',
              type: 'img',
              initial: { move: '@root', src: '/image-a.png', className: 'replace-cells' },
              actions: {
                swap: {
                  src: '/image-b.png',
                  replace: {
                    transition: 'wipe',
                    duration: 100,
                    split: 'cells',
                    cellX: 2,
                    cellY: 2,
                    stagger: 0,
                  },
                },
              },
            },
          ],
          eventimes: [{ name: 'swap', startAt: 100 }],
        },
      },
      eventimes: [{ name: 'sequence:end', startAt: 1000 }],
    })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    runner = new HtmlPlayerRunner({
      id: 'replace-image-async-frame-player',
      compiledScene: build.compiledScene,
      root,
      catalog,
      resources: ['/image-a.png', '/image-b.png'],
    })
    expect(runner.init().ok).toBe(true)

    runner.player.play()
    runner.advance(0)
    runner.advance(150)
    expect(root.querySelectorAll('[data-codplay-replace-view="incoming"]')).toHaveLength(0)

    const incomingImages = Array.from(root.querySelectorAll<HTMLImageElement>('img'))
      .filter((image) => image.getAttribute('src') === '/image-b.png')
    expect(incomingImages).toHaveLength(2)
    pendingFrames.ready()
    for (const image of incomingImages) image.dispatchEvent(new Event('load'))
    await Promise.resolve()
    await Promise.resolve()

    const views = Array.from(root.querySelectorAll<HTMLElement>('[data-codplay-replace-view]'))
    const wholeViews = views.filter((view) => view.querySelector('.replace-whole'))
    const cellViews = views.filter((view) => view.querySelector('.replace-cells'))
    expect(wholeViews.map((view) => view.dataset.codplayReplaceView)).toEqual(['outgoing', 'incoming'])
    expect(cellViews.map((view) => view.dataset.codplayReplaceView)).toEqual(['outgoing'])
    expect(wholeViews[1]?.querySelector('canvas[data-codplay-replace-frame]')).not.toBeNull()
    const cellHost = runner.getPersoNode('main:cells') as HTMLElement
    const sourceCellHost = cellViews[0]?.querySelector<HTMLElement>('.replace-cells')
    expect(cellHost?.style.getPropertyValue('mask-image')).toBe('')
    expect(sourceCellHost?.style.getPropertyValue('mask-image')).toContain('#codplay-replace-mask-')
    const maskHost = root.querySelector<SVGSVGElement>('[data-codplay-replace-mask-host]')
    const masks = Array.from(maskHost?.querySelectorAll('mask') ?? [])
    expect(masks).toHaveLength(1)
    expect(masks.map((mask) => mask.querySelectorAll('[data-replace-cell-index]').length)).toEqual([4])
    expect(cellHost?.querySelector('img')?.getAttribute('src')).toBe('/image-b.png')
    expect(cellViews[0]?.querySelectorAll('canvas')).toHaveLength(0)
  })

  it('cleans image snapshots when the incoming frame fails at the same player time', () => {
    const pendingFrames = mockPendingIncomingImageFrames()
    restoreMediaFrameMocks = pendingFrames.restore
    const root = document.createElement('main')
    document.body.appendChild(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'replace-image-error-frame-runtime',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'image',
            type: 'img',
            initial: { move: '@root', src: '/image-a.png' },
            actions: { swap: { src: '/image-b.png', replace: { transition: 'fade', duration: 100 } } },
          }],
          eventimes: [{ name: 'swap', startAt: 100 }],
        },
      },
      eventimes: [{ name: 'sequence:end', startAt: 1000 }],
    })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    runner = new HtmlPlayerRunner({
      id: 'replace-image-error-frame-player',
      compiledScene: build.compiledScene,
      root,
      catalog,
      resources: ['/image-a.png', '/image-b.png'],
    })
    expect(runner.init().ok).toBe(true)
    const host = runner.getPersoNode('main:image') as HTMLElement

    runner.player.play()
    runner.advance(0)
    runner.advance(150)
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(1)

    const incoming = Array.from(root.querySelectorAll<HTMLImageElement>('img'))
      .find((image) => image.getAttribute('src') === '/image-b.png')
    expect(incoming).toBeDefined()
    pendingFrames.fail()
    incoming?.dispatchEvent(new Event('error'))

    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
    expect(host.style.visibility).toBe('')
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/image-b.png')
  })

  it('ignores a pending incoming image frame after Seek cancels its replace session', () => {
    const pendingFrames = mockPendingIncomingImageFrames()
    restoreMediaFrameMocks = pendingFrames.restore
    const root = document.createElement('main')
    document.body.appendChild(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'replace-image-stale-frame-runtime',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'image',
            type: 'img',
            initial: { move: '@root', src: '/image-a.png' },
            actions: { swap: { src: '/image-b.png', replace: { transition: 'fade', duration: 100 } } },
          }],
          eventimes: [{ name: 'swap', startAt: 100 }],
        },
      },
      eventimes: [{ name: 'sequence:end', startAt: 1000 }],
    })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    runner = new HtmlPlayerRunner({
      id: 'replace-image-stale-frame-player',
      compiledScene: build.compiledScene,
      root,
      catalog,
      resources: ['/image-a.png', '/image-b.png'],
    })
    expect(runner.init().ok).toBe(true)
    const host = runner.getPersoNode('main:image') as HTMLElement

    runner.player.play()
    runner.advance(0)
    runner.advance(150)
    const staleIncoming = Array.from(root.querySelectorAll<HTMLImageElement>('img'))
      .find((image) => image.getAttribute('src') === '/image-b.png')
    expect(staleIncoming).toBeDefined()
    expect(runner.seek(50).ok).toBe(true)
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/image-a.png')

    pendingFrames.ready()
    staleIncoming?.dispatchEvent(new Event('load'))
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/image-a.png')

    expect(runner.seek(150).ok).toBe(true)
    const views = Array.from(root.querySelectorAll<HTMLElement>('[data-codplay-replace-view]'))
    expect(views.map((view) => view.dataset.codplayReplaceView)).toEqual(['outgoing', 'incoming'])
  })

  it('retries whole and cell video snapshots when the incoming frame becomes ready at the same player time', async () => {
    const pendingFrames = mockPendingIncomingVideoFrames()
    restoreMediaFrameMocks = pendingFrames.restore
    restoreMediaGeometryMock = mockMediaGeometry()
    const root = document.createElement('main')
    document.body.append(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'replace-video-async-frame-runtime',
      stories: {
        main: {
          id: 'main',
          persos: [
            {
              id: 'whole',
              type: 'media',
              initial: { tag: 'video', move: '@root', src: '/video-a.mp4', className: 'replace-video-whole' },
              actions: {
                swap: { src: '/video-b.mp4', replace: { transition: 'curtain', duration: 100 } },
              },
            },
            {
              id: 'cells',
              type: 'media',
              initial: { tag: 'video', move: '@root', src: '/video-a.mp4', className: 'replace-video-cells' },
              actions: {
                swap: {
                  src: '/video-b.mp4',
                  replace: {
                    transition: 'wipe',
                    duration: 100,
                    split: 'cells',
                    cellX: 2,
                    cellY: 2,
                    stagger: 0,
                  },
                },
              },
            },
          ],
          eventimes: [{ name: 'swap', startAt: 100 }],
        },
      },
      eventimes: [{ name: 'sequence:end', startAt: 1000 }],
    })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    runner = new HtmlPlayerRunner({
      id: 'replace-video-async-frame-player',
      compiledScene: build.compiledScene,
      root,
      catalog,
      resources: ['/video-a.mp4', '/video-b.mp4'],
    })
    expect(runner.init().ok).toBe(true)
    runner.player.play()
    runner.advance(0)
    runner.advance(150)
    expect(root.querySelectorAll('[data-codplay-replace-view="incoming"]')).toHaveLength(0)

    const incomingVideos = Array.from(root.querySelectorAll<HTMLVideoElement>('video'))
      .filter((video) => video.getAttribute('src')?.endsWith('/video-b.mp4'))
    expect(incomingVideos).toHaveLength(2)
    pendingFrames.ready()
    for (const video of incomingVideos) video.dispatchEvent(new Event('loadeddata'))
    await Promise.resolve()
    await Promise.resolve()

    const views = Array.from(root.querySelectorAll<HTMLElement>('[data-codplay-replace-view]'))
    const wholeViews = views.filter((view) => view.querySelector('.replace-video-whole'))
    const cellViews = views.filter((view) => view.querySelector('.replace-video-cells'))
    expect(wholeViews.map((view) => view.dataset.codplayReplaceView)).toEqual(['outgoing', 'incoming'])
    expect(cellViews.map((view) => view.dataset.codplayReplaceView)).toEqual(['outgoing'])
    expect(wholeViews.every((view) => view.querySelector('video') === null)).toBe(true)
    expect(cellViews[0]?.querySelector<HTMLVideoElement>('video')?.paused).toBe(true)
    const cellHost = runner.getPersoNode('main:cells') as HTMLElement
    const sourceCellHost = cellViews[0]?.querySelector<HTMLElement>('.replace-video-cells')
    expect(cellHost?.style.getPropertyValue('mask-image')).toBe('')
    expect(sourceCellHost?.style.getPropertyValue('mask-image')).toContain('#codplay-replace-mask-')
    const maskHost = root.querySelector<SVGSVGElement>('[data-codplay-replace-mask-host]')
    const masks = Array.from(maskHost?.querySelectorAll('mask') ?? [])
    expect(masks).toHaveLength(1)
    expect(masks.map((mask) => mask.querySelectorAll('[data-replace-cell-index]').length)).toEqual([4])
    expect(cellHost?.querySelector('video')?.getAttribute('src')).toBe('/video-b.mp4')
    expect(cellViews[0]?.querySelectorAll('canvas')).toHaveLength(0)
  })

  it('cleans video snapshots when the incoming frame fails at the same player time', () => {
    const pendingFrames = mockPendingIncomingVideoFrames()
    restoreMediaFrameMocks = pendingFrames.restore
    const root = document.createElement('main')
    document.body.append(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'replace-video-error-frame-runtime',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'video',
            type: 'media',
            initial: { tag: 'video', move: '@root', src: '/video-a.mp4' },
            actions: { swap: { src: '/video-b.mp4', replace: { transition: 'fade', duration: 100 } } },
          }],
          eventimes: [{ name: 'swap', startAt: 100 }],
        },
      },
      eventimes: [{ name: 'sequence:end', startAt: 1000 }],
    })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    runner = new HtmlPlayerRunner({
      id: 'replace-video-error-frame-player',
      compiledScene: build.compiledScene,
      root,
      catalog,
      resources: ['/video-a.mp4', '/video-b.mp4'],
    })
    expect(runner.init().ok).toBe(true)
    const host = runner.getPersoNode('main:video') as HTMLElement

    runner.player.play()
    runner.advance(0)
    runner.advance(150)
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(1)
    const incoming = Array.from(root.querySelectorAll<HTMLVideoElement>('video'))
      .find((video) => video.getAttribute('src')?.endsWith('/video-b.mp4'))
    expect(incoming).toBeDefined()
    pendingFrames.fail()
    incoming?.dispatchEvent(new Event('error'))

    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
    expect(host.style.visibility).toBe('')
    expect(host.querySelector('video')?.getAttribute('src')).toContain('/video-b.mp4')
  })

  it('ignores a pending incoming video frame after Seek cancels its replace session', () => {
    const pendingFrames = mockPendingIncomingVideoFrames()
    restoreMediaFrameMocks = pendingFrames.restore
    const root = document.createElement('main')
    document.body.append(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'replace-video-stale-frame-runtime',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'video',
            type: 'media',
            initial: { tag: 'video', move: '@root', src: '/video-a.mp4' },
            actions: { swap: { src: '/video-b.mp4', replace: { transition: 'fade', duration: 100 } } },
          }],
          eventimes: [{ name: 'swap', startAt: 100 }],
        },
      },
      eventimes: [{ name: 'sequence:end', startAt: 1000 }],
    })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    runner = new HtmlPlayerRunner({
      id: 'replace-video-stale-frame-player',
      compiledScene: build.compiledScene,
      root,
      catalog,
      resources: ['/video-a.mp4', '/video-b.mp4'],
    })
    expect(runner.init().ok).toBe(true)
    const host = runner.getPersoNode('main:video') as HTMLElement
    runner.player.play()
    runner.advance(0)
    runner.advance(150)
    const staleIncoming = Array.from(root.querySelectorAll<HTMLVideoElement>('video'))
      .find((video) => video.getAttribute('src')?.endsWith('/video-b.mp4'))
    expect(staleIncoming).toBeDefined()
    expect(runner.seek(50).ok).toBe(true)
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
    expect(host.querySelector('video')?.getAttribute('src')).toContain('/video-a.mp4')

    pendingFrames.ready()
    staleIncoming?.dispatchEvent(new Event('loadeddata'))
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
    expect(host.querySelector('video')?.getAttribute('src')).toContain('/video-a.mp4')

    expect(runner.seek(150).ok).toBe(true)
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(2)
  })

  it('does not restart or retain an incoming video wait after the component is detached', () => {
    const pendingFrames = mockPendingIncomingVideoFrames()
    restoreMediaFrameMocks = pendingFrames.restore
    const root = document.createElement('main')
    document.body.append(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'replace-video-detach-frame-runtime',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'video',
            type: 'media',
            initial: { tag: 'video', move: '@root', src: '/video-a.mp4' },
            actions: {
              swap: { src: '/video-b.mp4', replace: { transition: 'fade', duration: 300 } },
              detach: { move: '@off' },
              attach: { move: '@root' },
            },
          }],
          eventimes: [
            { name: 'swap', startAt: 100 },
            { name: 'detach', startAt: 200 },
            { name: 'attach', startAt: 300 },
          ],
        },
      },
      eventimes: [{ name: 'sequence:end', startAt: 1000 }],
    })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    runner = new HtmlPlayerRunner({
      id: 'replace-video-detach-frame-player',
      compiledScene: build.compiledScene,
      root,
      catalog,
      resources: ['/video-a.mp4', '/video-b.mp4'],
    })
    expect(runner.init().ok).toBe(true)
    const host = runner.getPersoNode('main:video') as HTMLElement
    runner.player.play()
    runner.advance(0)
    runner.advance(150)

    const staleIncoming = Array.from(root.querySelectorAll<HTMLVideoElement>('video'))
      .find((video) => video.getAttribute('src')?.endsWith('/video-b.mp4'))
    expect(staleIncoming).toBeDefined()
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(1)

    runner.advance(200)
    expect(host.parentElement).toBeNull()
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
    expect(host.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)

    pendingFrames.ready()
    staleIncoming?.dispatchEvent(new Event('loadeddata'))
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
    runner.advance(210)
    expect(host.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)

    runner.advance(300)
    expect(host.parentElement).toBe(root)
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
  })

  it('cancels pending video frame listeners when the player is destroyed', () => {
    const pendingFrames = mockPendingIncomingVideoFrames()
    restoreMediaFrameMocks = pendingFrames.restore
    const root = document.createElement('main')
    document.body.append(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'replace-video-destroy-frame-runtime',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'video',
            type: 'media',
            initial: { tag: 'video', move: '@root', src: '/video-a.mp4' },
            actions: { swap: { src: '/video-b.mp4', replace: { transition: 'fade', duration: 300 } } },
          }],
          eventimes: [{ name: 'swap', startAt: 100 }],
        },
      },
      eventimes: [{ name: 'sequence:end', startAt: 1000 }],
    })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    runner = new HtmlPlayerRunner({
      id: 'replace-video-destroy-frame-player',
      compiledScene: build.compiledScene,
      root,
      catalog,
      resources: ['/video-a.mp4', '/video-b.mp4'],
    })
    expect(runner.init().ok).toBe(true)
    runner.player.play()
    runner.advance(0)
    runner.advance(150)

    const staleIncoming = Array.from(root.querySelectorAll<HTMLVideoElement>('video'))
      .find((video) => video.getAttribute('src')?.endsWith('/video-b.mp4'))
    expect(staleIncoming).toBeDefined()
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(1)

    runner.destroy()
    runner = undefined
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)

    pendingFrames.ready()
    staleIncoming?.dispatchEvent(new Event('loadeddata'))
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
  })

  it('discards a pending incoming video frame when the replacement duration ends first', () => {
    const pendingFrames = mockPendingIncomingVideoFrames()
    restoreMediaFrameMocks = pendingFrames.restore
    const root = document.createElement('main')
    document.body.append(root)
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'replace-video-end-before-frame-runtime',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'video',
            type: 'media',
            initial: { tag: 'video', move: '@root', src: '/video-a.mp4' },
            actions: { swap: { src: '/video-b.mp4', replace: { transition: 'fade', duration: 50 } } },
          }],
          eventimes: [{ name: 'swap', startAt: 100 }],
        },
      },
      eventimes: [{ name: 'sequence:end', startAt: 1000 }],
    })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    runner = new HtmlPlayerRunner({
      id: 'replace-video-end-before-frame-player',
      compiledScene: build.compiledScene,
      root,
      catalog,
      resources: ['/video-a.mp4', '/video-b.mp4'],
    })
    expect(runner.init().ok).toBe(true)
    const host = runner.getPersoNode('main:video') as HTMLElement
    runner.player.play()
    runner.advance(0)
    runner.advance(200)

    const staleIncoming = Array.from(root.querySelectorAll<HTMLVideoElement>('video'))
      .find((video) => video.getAttribute('src')?.endsWith('/video-b.mp4'))
    expect(staleIncoming).toBeDefined()
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
    expect(host.style.visibility).toBe('')

    pendingFrames.ready()
    staleIncoming?.dispatchEvent(new Event('loadeddata'))
    runner.advance(210)
    expect(root.querySelectorAll('[data-codplay-replace-view]')).toHaveLength(0)
  })
})

/** Supplies decoded image dimensions and a minimal canvas context in jsdom. */
function mockDecodedImageFrames(): () => void {
  const imagePrototype = HTMLImageElement.prototype
  const canvasPrototype = HTMLCanvasElement.prototype
  const imageDescriptors = new Map<string, PropertyDescriptor | undefined>([
    ['complete', Object.getOwnPropertyDescriptor(imagePrototype, 'complete')],
    ['naturalWidth', Object.getOwnPropertyDescriptor(imagePrototype, 'naturalWidth')],
    ['naturalHeight', Object.getOwnPropertyDescriptor(imagePrototype, 'naturalHeight')],
  ])
  const canvasGetContext = Object.getOwnPropertyDescriptor(canvasPrototype, 'getContext')

  Object.defineProperties(imagePrototype, {
    complete: { configurable: true, get: () => true },
    naturalWidth: { configurable: true, get: () => 64 },
    naturalHeight: { configurable: true, get: () => 36 },
  })
  Object.defineProperty(canvasPrototype, 'getContext', {
    configurable: true,
    value: () => ({ clearRect: () => undefined, drawImage: () => undefined }),
  })

  return () => {
    for (const [name, descriptor] of imageDescriptors) {
      if (descriptor === undefined) delete (imagePrototype as unknown as Record<string, unknown>)[name]
      else Object.defineProperty(imagePrototype, name, descriptor)
    }
    if (canvasGetContext === undefined) delete (canvasPrototype as unknown as Record<string, unknown>).getContext
    else Object.defineProperty(canvasPrototype, 'getContext', canvasGetContext)
  }
}

/** Keeps only the replacement image pending until a test releases its load event. */
function mockPendingIncomingImageFrames(): Readonly<{
  ready: () => void
  fail: () => void
  restore: () => void
}> {
  const imagePrototype = HTMLImageElement.prototype
  const canvasPrototype = HTMLCanvasElement.prototype
  let incomingState: 'pending' | 'ready' | 'error' = 'pending'
  const imageDescriptors = new Map<string, PropertyDescriptor | undefined>([
    ['complete', Object.getOwnPropertyDescriptor(imagePrototype, 'complete')],
    ['naturalWidth', Object.getOwnPropertyDescriptor(imagePrototype, 'naturalWidth')],
    ['naturalHeight', Object.getOwnPropertyDescriptor(imagePrototype, 'naturalHeight')],
  ])
  const canvasGetContext = Object.getOwnPropertyDescriptor(canvasPrototype, 'getContext')
  const isIncomingImage = (image: HTMLImageElement): boolean => image.getAttribute('src') === '/image-b.png'

  Object.defineProperties(imagePrototype, {
    complete: {
      configurable: true,
      get: function (this: HTMLImageElement): boolean {
        return !isIncomingImage(this) || incomingState !== 'pending'
      },
    },
    naturalWidth: {
      configurable: true,
      get: function (this: HTMLImageElement): number {
        return isIncomingImage(this) && incomingState !== 'ready' ? 0 : 64
      },
    },
    naturalHeight: {
      configurable: true,
      get: function (this: HTMLImageElement): number {
        return isIncomingImage(this) && incomingState !== 'ready' ? 0 : 48
      },
    },
  })
  Object.defineProperty(canvasPrototype, 'getContext', {
    configurable: true,
    value: () => ({ clearRect: () => undefined, drawImage: () => undefined }),
  })

  return {
    ready: () => {
      incomingState = 'ready'
    },
    fail: () => {
      incomingState = 'error'
    },
    restore: () => {
      for (const [name, descriptor] of imageDescriptors) {
        if (descriptor === undefined) delete (imagePrototype as unknown as Record<string, unknown>)[name]
        else Object.defineProperty(imagePrototype, name, descriptor)
      }
      if (canvasGetContext === undefined) delete (canvasPrototype as unknown as Record<string, unknown>).getContext
      else Object.defineProperty(canvasPrototype, 'getContext', canvasGetContext)
    },
  }
}

type MediaGeometryMock = (() => void) & Readonly<{
  setSize: (width: number, height: number) => void
}>

/** Supplies responsive, deterministic boxes for fixed-media snapshot tests. */
function mockMediaGeometry(): MediaGeometryMock {
  const prototype = HTMLElement.prototype
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'getBoundingClientRect')
  let width = 64
  let height = 48
  Object.defineProperty(prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(0, 0, width, height),
  })

  const restore = (): void => {
    if (descriptor === undefined) delete (prototype as unknown as Record<string, unknown>).getBoundingClientRect
    else Object.defineProperty(prototype, 'getBoundingClientRect', descriptor)
  }
  return Object.assign(restore, {
    setSize: (nextWidth: number, nextHeight: number): void => {
      width = nextWidth
      height = nextHeight
    },
  })
}

/** Supplies deterministic range rectangles for text splitting in jsdom. */
function mockTextRangeMeasurements(getWrapAt: () => number = () => Number.MAX_SAFE_INTEGER): () => void {
  const rangePrototype = Range.prototype
  const descriptor = Object.getOwnPropertyDescriptor(rangePrototype, 'getClientRects')
  Object.defineProperty(rangePrototype, 'getClientRects', {
    configurable: true,
    value: function (this: Range) {
      const offset = this.startOffset
      const wrapAt = Math.max(1, Math.floor(getWrapAt()))
      const left = (offset % wrapAt) * 8
      const top = Math.floor(offset / wrapAt) * 16
      return [{ left, top, right: left + 8, bottom: top + 16, width: 8, height: 16 }]
    },
  })

  return () => {
    if (descriptor === undefined) delete (rangePrototype as unknown as Record<string, unknown>).getClientRects
    else Object.defineProperty(rangePrototype, 'getClientRects', descriptor)
  }
}

/** Supplies decoded video dimensions and a minimal fixed-frame canvas context in jsdom. */
function mockDecodedVideoFrames(): () => void {
  const videoPrototype = HTMLVideoElement.prototype
  const mediaPrototype = HTMLMediaElement.prototype
  const canvasPrototype = HTMLCanvasElement.prototype
  const videoDescriptors = new Map<string, PropertyDescriptor | undefined>([
    ['readyState', Object.getOwnPropertyDescriptor(videoPrototype, 'readyState')],
    ['videoWidth', Object.getOwnPropertyDescriptor(videoPrototype, 'videoWidth')],
    ['videoHeight', Object.getOwnPropertyDescriptor(videoPrototype, 'videoHeight')],
    ['seeking', Object.getOwnPropertyDescriptor(videoPrototype, 'seeking')],
    ['error', Object.getOwnPropertyDescriptor(videoPrototype, 'error')],
    ['currentTime', Object.getOwnPropertyDescriptor(videoPrototype, 'currentTime')],
  ])
  const currentTimes = new WeakMap<HTMLVideoElement, number>()
  const mediaPause = Object.getOwnPropertyDescriptor(mediaPrototype, 'pause')
  const canvasGetContext = Object.getOwnPropertyDescriptor(canvasPrototype, 'getContext')

  Object.defineProperties(videoPrototype, {
    readyState: { configurable: true, get: () => 4 },
    videoWidth: { configurable: true, get: () => 64 },
    videoHeight: { configurable: true, get: () => 48 },
    seeking: { configurable: true, get: () => false },
    error: { configurable: true, get: () => null },
    currentTime: {
      configurable: true,
      get: function (this: HTMLVideoElement): number { return currentTimes.get(this) ?? 0 },
      set: function (this: HTMLVideoElement, value: number): void { currentTimes.set(this, value) },
    },
  })
  Object.defineProperty(mediaPrototype, 'pause', { configurable: true, value: () => undefined })
  Object.defineProperty(canvasPrototype, 'getContext', {
    configurable: true,
    value: () => ({ clearRect: () => undefined, drawImage: () => undefined }),
  })

  return () => {
    for (const [name, descriptor] of videoDescriptors) {
      if (descriptor === undefined) delete (videoPrototype as unknown as Record<string, unknown>)[name]
      else Object.defineProperty(videoPrototype, name, descriptor)
    }
    if (mediaPause === undefined) delete (mediaPrototype as unknown as Record<string, unknown>).pause
    else Object.defineProperty(mediaPrototype, 'pause', mediaPause)
    if (canvasGetContext === undefined) delete (canvasPrototype as unknown as Record<string, unknown>).getContext
    else Object.defineProperty(canvasPrototype, 'getContext', canvasGetContext)
  }
}

/** Keeps only the replacement video pending until a test releases its native event. */
function mockPendingIncomingVideoFrames(): Readonly<{
  ready: () => void
  fail: () => void
  restore: () => void
}> {
  const videoPrototype = HTMLVideoElement.prototype
  const mediaPrototype = HTMLMediaElement.prototype
  const canvasPrototype = HTMLCanvasElement.prototype
  let incomingState: 'pending' | 'ready' | 'error' = 'pending'
  const videoDescriptors = new Map<string, PropertyDescriptor | undefined>([
    ['readyState', Object.getOwnPropertyDescriptor(videoPrototype, 'readyState')],
    ['videoWidth', Object.getOwnPropertyDescriptor(videoPrototype, 'videoWidth')],
    ['videoHeight', Object.getOwnPropertyDescriptor(videoPrototype, 'videoHeight')],
    ['seeking', Object.getOwnPropertyDescriptor(videoPrototype, 'seeking')],
    ['error', Object.getOwnPropertyDescriptor(videoPrototype, 'error')],
  ])
  const mediaPause = Object.getOwnPropertyDescriptor(mediaPrototype, 'pause')
  const canvasGetContext = Object.getOwnPropertyDescriptor(canvasPrototype, 'getContext')
  const isIncomingVideo = (video: HTMLVideoElement): boolean => (
    video.getAttribute('src') ?? video.src
  ).endsWith('/video-b.mp4')
  const isReady = (video: HTMLVideoElement): boolean => (
    !isIncomingVideo(video) || incomingState === 'ready'
  )

  Object.defineProperties(videoPrototype, {
    readyState: { configurable: true, get: function (this: HTMLVideoElement): number { return isReady(this) ? 4 : 0 } },
    videoWidth: { configurable: true, get: function (this: HTMLVideoElement): number { return isReady(this) ? 64 : 0 } },
    videoHeight: { configurable: true, get: function (this: HTMLVideoElement): number { return isReady(this) ? 48 : 0 } },
    seeking: { configurable: true, get: () => false },
    error: {
      configurable: true,
      get: function (this: HTMLVideoElement): MediaError | null {
        return isIncomingVideo(this) && incomingState === 'error' ? { code: 4 } as MediaError : null
      },
    },
  })
  Object.defineProperty(mediaPrototype, 'pause', { configurable: true, value: () => undefined })
  Object.defineProperty(canvasPrototype, 'getContext', {
    configurable: true,
    value: () => ({ clearRect: () => undefined, drawImage: () => undefined }),
  })

  return {
    ready: () => {
      incomingState = 'ready'
    },
    fail: () => {
      incomingState = 'error'
    },
    restore: () => {
      for (const [name, descriptor] of videoDescriptors) {
        if (descriptor === undefined) delete (videoPrototype as unknown as Record<string, unknown>)[name]
        else Object.defineProperty(videoPrototype, name, descriptor)
      }
      if (mediaPause === undefined) delete (mediaPrototype as unknown as Record<string, unknown>).pause
      else Object.defineProperty(mediaPrototype, 'pause', mediaPause)
      if (canvasGetContext === undefined) delete (canvasPrototype as unknown as Record<string, unknown>).getContext
      else Object.defineProperty(canvasPrototype, 'getContext', canvasGetContext)
    },
  }
}
