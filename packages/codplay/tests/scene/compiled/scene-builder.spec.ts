import { describe, expect, it, vi } from 'vitest'

import { isPreparedPath, parseColor, prepareSvgPath } from '../../../src/ace'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import type { RuntimeCapabilityCatalog } from '../../../src/runtime/catalog'
import { BaseComponent, TagComponent } from '../../../src/runtime/components'
import type { ComponentUpdateInput } from '../../../src/runtime/components'
import { compileMovePath, SceneBuilder } from '../../../src/scene/compiled'
import type { CompiledRecord } from '../../../src/scene/compiled'
import { SCENE_BUILD_CONFIG } from '../../../src/scene/config/scene-build'
import type { SceneDoc } from '../../../src/scene/types'
import { demoSceneFixtures } from '../../fixtures/demo-scene-fixtures'

/** Substrate-neutral fixture component with no declared services. */
class NoServiceComponent extends BaseComponent<Record<string, unknown>> {
  static readonly declaredServices = [] as const

  update(_input: ComponentUpdateInput): void {}
}

function createCatalogForFixtures(): RuntimeCapabilityCatalog {
  const catalog = createCoreRuntimeCatalog()
  for (const type of ['text']) {
    catalog.registerComponent({
      type,
      component: TagComponent,
      modules: [],
      validateInitial: () => undefined,
      validateAction: () => undefined,
    })
  }
  return catalog
}

describe('SceneBuilder', () => {
  it('compiles an immutable relation separately and ignores relation action patches', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot(), { diagnosticOutput: vi.fn() })
    const result = builder.build({
      id: 'relation-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'geometry',
            type: 'tag',
            initial: {
              rel: { host: 'geometry', target: 'grid' },
            },
            actions: {
              retarget: {
                rel: { host: 'other', target: 'other-grid' },
              },
            },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const perso = result.compiledScene.scene.stories.main?.persos[0]
    expect(perso?.rel).toEqual({ host: 'geometry', target: 'grid' })
    expect(perso?.initial.rel).toBeUndefined()
    expect(perso?.actions.retarget).toEqual({})
    expect(Object.isFrozen(perso?.rel)).toBe(true)
    expect(result.diagnostics.warnings.map((diagnostic) => diagnostic.code)).toContain('AUTHOR_REL_ACTION_IGNORED')
  })

  it('warns about unknown relation identities without blocking scene construction', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot(), { diagnosticOutput: vi.fn() })
    const result = builder.build({
      id: 'relation-target-scene',
      stories: {
        main: {
          id: 'main',
          persos: [
            {
              id: 'geometry',
              type: 'tag',
              initial: {},
            },
            {
              id: 'known-host-consumer',
              type: 'tag',
              initial: {
                rel: { host: 'geometry', target: 'opaque-target' },
              },
            },
          ],
        },
        secondary: {
          id: 'secondary',
          persos: [{
            id: 'consumer',
            type: 'tag',
            initial: {
              rel: { host: 'missing-host', target: 'opaque-target' },
            },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.diagnostics.warnings.map((diagnostic) => diagnostic.code)).toEqual([
      'AUTHOR_REL_HOST_UNKNOWN',
    ])
  })

  it('keeps an invalid relation non-blocking and does not compile a target from it', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot(), { diagnosticOutput: vi.fn() })
    const result = builder.build({
      id: 'invalid-relation-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'geometry',
            type: 'tag',
            initial: {
              rel: { host: '' },
            },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const perso = result.compiledScene.scene.stories.main?.persos[0]
    expect(perso?.rel).toBeUndefined()
    expect(result.diagnostics.warnings.map((diagnostic) => diagnostic.code)).toContain('AUTHOR_REL_INVALID')
  })

  it('preserves a story reset listen capability in the compiled scene', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot())
    const result = builder.build({
      id: 'story-reset-scene',
      stories: {
        main: {
          id: 'main',
          listen: [{ on: 'navigation:reset', reset: true }],
          persos: [],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.compiledScene.scene.stories.main?.listen).toEqual([
      expect.objectContaining({ on: 'navigation:reset', reset: true }),
    ])
  })

  it('compiles the exact story activation index and rejects duplicate wake rules', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot())
    const result = builder.build({
      id: 'story-isolation-scene',
      stories: {
        main: {
          id: 'main',
          listen: [
            { on: 'main:enter', active: true, reset: true },
            { on: 'main:leave', active: false },
          ],
          persos: [],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.compiledScene.storyActivationIndex).toEqual({ main: { 'main:enter': 0 } })
      expect(result.compiledScene.scene.stories.main?.listen[0]).toMatchObject({
        on: 'main:enter',
        active: true,
        reset: true,
      })
    }

    const duplicate = builder.build({
      id: 'duplicate-story-isolation-scene',
      stories: {
        main: {
          id: 'main',
          listen: [
            { on: 'main:enter', active: true },
            { on: 'main:enter', active: true },
          ],
          persos: [],
        },
      },
    })
    expect(duplicate.ok).toBe(false)
    if (!duplicate.ok) {
      expect(duplicate.diagnostics.errors.map((diagnostic) => diagnostic.code))
        .toContain('COMPILED_STORY_ACTIVATION_DUPLICATE')
    }
  })

  it('rejects active declarations at scene scope', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot())
    const result = builder.build({
      id: 'scene-isolation-invalid',
      listen: [{ on: 'scene:enter', active: true }],
      stories: { main: { id: 'main', persos: [] } },
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.diagnostics.errors.map((diagnostic) => diagnostic.code))
        .toContain('COMPILED_SCENE_LISTEN_ACTIVE_INVALID')
    }
  })

  it('compiles scene-level eventimes independently from story eventimes', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot())
    const result = builder.build({
      id: 'scene-eventime-scene',
      eventimes: [{
        name: 'sequence:end',
        startAt: 2_500,
        events: [{ name: 'scene:checkpoint', startAt: 100 }],
      }],
      stories: {
        main: {
          id: 'main',
          persos: [],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.compiledScene.scene.eventimes).toEqual([{
      name: 'sequence:end',
      startAt: 2_500,
      events: [{ name: 'scene:checkpoint', startAt: 100 }],
    }])
  })

  it('normalizes declared style colors before extracting CompiledScene', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot(), { diagnosticOutput: vi.fn() })
    const result = builder.build({
      id: 'color-service-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'tag',
            type: 'tag',
            initial: {
              style: {
                color: 'rebeccapurple',
                backgroundColor: 'rgb(0 255 0 / 50%)',
                borderColor: 'oklch(60% 0.2 30)',
                transform: 'translate(10px 20px)',
              },
            },
            actions: {
              paint: {
                style: {
                  color: { from: '#000', to: '#fff', duration: 100 },
                  transform: 'rotate(20deg)',
                },
              },
            },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const perso = result.compiledScene.scene.stories.main?.persos[0]
    expect(perso?.initial.style).toMatchObject({
      color: parseColor('rebeccapurple'),
      backgroundColor: parseColor('rgb(0 255 0 / 50%)'),
      borderColor: parseColor('oklch(60% 0.2 30)'),
      transform: 'translate(10px 20px)',
    })
    expect(perso?.actions.paint).toMatchObject({
      style: {
        color: { from: parseColor('#000'), to: parseColor('#fff'), duration: 100 },
        transform: 'rotate(20deg)',
      },
    })
  })

  it('qualifies structured numeric geometry while preserving other style values', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot(), { diagnosticOutput: vi.fn() })
    const result = builder.build({
      id: 'logical-length-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'item',
            type: 'tag',
            initial: {
              style: {
                x: 10,
                y: 5,
                width: 20,
                height: 12,
                opacity: 0.5,
                rotate: 15,
                'line-height': 1.25,
              },
            },
            actions: {
              resize: {
                style: {
                  x: { from: 10, to: 30, duration: 100, ease: 'linear' },
                  width: { from: 20, to: 40, duration: 100, ease: 'linear' },
                  opacity: { from: 0.5, to: 1, duration: 100, ease: 'linear' },
                },
              },
            },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const perso = result.compiledScene.scene.stories.main?.persos[0]
    expect(perso?.initial.style).toMatchObject({
      x: { kind: 'length', unit: SCENE_BUILD_CONFIG.logicalLengthUnit, value: 10 },
      y: { kind: 'length', unit: SCENE_BUILD_CONFIG.logicalLengthUnit, value: 5 },
      width: { kind: 'length', unit: SCENE_BUILD_CONFIG.logicalLengthUnit, value: 20 },
      height: { kind: 'length', unit: SCENE_BUILD_CONFIG.logicalLengthUnit, value: 12 },
      opacity: 0.5,
      rotate: 15,
      'line-height': 1.25,
    })
    expect(perso?.actions.resize).toMatchObject({
      style: {
        x: {
          from: { kind: 'length', unit: SCENE_BUILD_CONFIG.logicalLengthUnit, value: 10 },
          to: { kind: 'length', unit: SCENE_BUILD_CONFIG.logicalLengthUnit, value: 30 },
        },
        width: {
          from: { kind: 'length', unit: SCENE_BUILD_CONFIG.logicalLengthUnit, value: 20 },
          to: { kind: 'length', unit: SCENE_BUILD_CONFIG.logicalLengthUnit, value: 40 },
        },
        opacity: { from: 0.5, to: 1, duration: 100, ease: 'linear' },
      },
    })
  })

  it('sanitizes core component profiles before they enter CompiledScene', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot(), { diagnosticOutput: vi.fn() })
    const result = builder.build({
      id: 'component-profile-scene',
      stories: {
        main: {
          id: 'main',
          persos: [
            { id: 'tag', type: 'tag', initial: { content: 42 }, actions: {} },
            { id: 'list', type: 'list', initial: { tag: '  ' }, actions: {} },
            {
              id: 'polygon',
              type: 'polygon',
              initial: { move: '@root', sides: 4 },
              actions: { morph: { morph: {} } },
            },
            { id: 'input', type: 'input', initial: { label: 12 }, actions: {} },
          ],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const persos = result.compiledScene.scene.stories.main?.persos ?? []
    const tag = persos.find((perso) => perso.id === 'tag')!
    const list = persos.find((perso) => perso.id === 'list')!
    const polygon = persos.find((perso) => perso.id === 'polygon')!
    const input = persos.find((perso) => perso.id === 'input')!
    expect(tag.initial.tag).toBe('div')
    expect(tag.initial.content).toBe(42)
    expect(list.initial.tag).toBe('section')
    expect(polygon.initial).toMatchObject({
      sides: 4,
      inner: null,
      outer: 40,
      rotationDeg: -90,
      inflexion: [0, 0, 0, 0],
    })
    expect(polygon.actions.morph).toMatchObject({
      morph: { duration: 700, delayMs: 0, ease: 'linear', sampleCount: 96 },
    })
    expect(input.initial).toMatchObject({
      inputType: 'text',
      label: '12',
      hint: '',
      selectedAnswerIds: [],
      correctAnswerIds: [],
      disableAnswers: false,
      showCorrection: false,
    })
  })

  it('exposes the pure path transformation for future strap payloads', () => {
    const path = prepareSvgPath('M 0 0 L 0.5 0.8 L 1 0')
    const transformed = compileMovePath({
      move: { target: '@root', transition: { path: 'M 0 0 L 0.5 0.8 L 1 0' } },
    }, 'strap.output')

    expect(isPreparedPath(path)).toBe(true)
    expect(transformed).toMatchObject({
      move: { transition: { path: { kind: 'segments', traversal: 'arc-length' } } },
    })

    const sequence = compileMovePath([{
      durationMs: 120,
      action: { move: { target: '@root', transition: { path: 'M 0 0 L 1 1' } } },
    }], 'sequence')
    expect(sequence).toMatchObject([{
      action: { move: { transition: { path: { kind: 'segments' } } } },
    }])
  })

  it('keeps the optional move resize policy in the compiled author payload', () => {
    const compiled = compileMovePath({
      move: { target: '@root', resize: { width: 'auto', height: 'preserve' } },
    }, 'resize.move')

    expect(compiled).toEqual({
      move: { target: '@root', resize: { width: 'auto', height: 'preserve' } },
    })
    expect(() => compileMovePath({
      move: { target: '@root', resize: { height: 'invalid' } },
    }, 'resize.invalid')).toThrow('resize.invalid.move.resize.height')
  })

  it('builds representative demo scenes with requirements, roots, and resources', () => {
    const builder = new SceneBuilder(createCatalogForFixtures().validationSnapshot(), {
      createdAt: '2026-07-31T00:00:00.000Z',
      diagnosticOutput: vi.fn(),
    })

    for (const fixture of demoSceneFixtures) {
      const result = builder.build(fixture.scene)

      expect(result.ok, fixture.id).toBe(true)
      if (!result.ok) continue
      expect(result.compiledScene.scene.id).toBe(fixture.scene.id)
      expect(result.compiledScene.createdAt).toBe('2026-07-31T00:00:00.000Z')
      expect(result.compiledScene.scene.stories).toBeDefined()
    }

    const s4 = builder.build(demoSceneFixtures[3]!.scene)
    expect(s4.ok).toBe(true)
    if (s4.ok) {
      expect(s4.compiledScene.rootNodeIds).toEqual(['quiz-layout'])
      expect(s4.compiledScene.resources.entries).toEqual([
        expect.objectContaining({ url: '/assets/quiz.mp4', type: 'video' }),
      ])
      expect(s4.compiledScene.requirements.components).toEqual(['layout', 'media'])
    }

    const s2 = builder.build(demoSceneFixtures[1]!.scene)
    expect(s2.ok).toBe(true)
    if (s2.ok) {
      expect(s2.compiledScene.actionTargetIndex?.['sequence:reference:start']).toEqual([
        { storyId: 's2-reference-story', persoId: 'reference-list' },
        { storyId: 's2-reference-story', persoId: 'reference-title' },
      ])
    }
  })

  it('extracts functions and leaves the compiled payload JSON-safe', () => {
    const transform = () => [{ name: 'START' }]
    const init = () => undefined
    const scene: SceneDoc<string> = {
      id: 'function-scene',
      init,
      stories: {
        main: {
          id: 'main',
          listen: [{ on: 'start', transform: [transform] }],
          persos: [{ id: 'title', type: 'text', actions: { start: { style: { opacity: init } } } }],
        },
      },
    }
    const builder = new SceneBuilder(createCatalogForFixtures().validationSnapshot(), {
      export: true,
      diagnosticOutput: vi.fn(),
    })

    const result = builder.build(scene)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(Object.keys(result.functions)).toHaveLength(3)
      expect(JSON.stringify(result.compiledScene)).not.toContain('=>')
      expect(result.compiledScene.scene.init).toMatchObject({ ref: expect.stringContaining('fn:') })
      expect(result.compiledScene.scene.stories.main.listen[0]?.transform).toHaveLength(1)
      const referencesByPath = new Map(result.functionReferences?.map((reference) => [JSON.stringify(reference.path), reference.ref]))
      expect(referencesByPath.get(JSON.stringify(['init']))).toBe(result.compiledScene.scene.init?.ref)
      expect(referencesByPath.get(JSON.stringify(['stories', 'main', 'listen', 0, 'transform', 0])))
        .toBe(result.compiledScene.scene.stories.main.listen[0]?.transform?.[0]?.ref)
      expect(referencesByPath.get(JSON.stringify([
        'stories', 'main', 'persos', 0, 'actions', 'start', 'style', 'opacity',
      ]))).toBe((((result.compiledScene.scene.stories.main.persos[0]?.actions.start as CompiledRecord | undefined)
        ?.style as CompiledRecord | undefined)?.opacity as { ref?: string } | undefined)?.ref)
      expect(result.functionReferences).toHaveLength(3)
    }
  })

  it('extracts the V1-compatible scene lifecycle callbacks as function references', () => {
    const onStart = (): void => undefined
    const onSequenceEnd = (): void => undefined
    const result = new SceneBuilder(createCatalogForFixtures().validationSnapshot()).build({
      id: 'lifecycle-scene',
      onStart,
      onSequenceEnd,
      stories: {
        main: {
          id: 'main',
          persos: [{ id: 'title', type: 'text' }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.compiledScene.scene.onStart).toMatchObject({ ref: expect.stringContaining('fn:') })
      expect(result.compiledScene.scene.onSequenceEnd).toMatchObject({ ref: expect.stringContaining('fn:') })
      expect(Object.values(result.functions)).toEqual(expect.arrayContaining([onStart, onSequenceEnd]))
    }
  })

  it('compiles scene and story straps locally with the existing function collection', () => {
    const sceneStrap = () => ({ events: [{ name: 'scene:done' }] })
    const storyStrap = () => ({ events: [{ name: 'story:done' }] })
    const builder = new SceneBuilder(createCatalogForFixtures().validationSnapshot(), {
      createdAt: '2026-07-31T00:00:00.000Z',
    })

    const result = builder.build({
      id: 'local-straps-scene',
      straps: { 'scene-action': sceneStrap },
      stories: {
        main: {
          id: 'main',
          straps: { 'story-action': storyStrap },
          persos: [],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const sceneStraps = result.compiledScene.scene.straps
    const storyStraps = result.compiledScene.scene.stories.main?.straps
    expect(sceneStraps).toMatchObject({ 'scene-action': { ref: expect.stringContaining('fn:') } })
    expect(storyStraps).toMatchObject({ 'story-action': { ref: expect.stringContaining('fn:') } })
    expect(Object.values(result.functions)).toEqual(expect.arrayContaining([sceneStrap, storyStrap]))
    expect(JSON.stringify(result.compiledScene)).not.toContain('sceneStrap')
    expect(JSON.stringify(result.compiledScene)).not.toContain('storyStrap')
  })

  it('preserves named strap declarations as explicit reusable references', () => {
    const builder = new SceneBuilder(createCatalogForFixtures().validationSnapshot())
    const result = builder.build({
      id: 'reusable-straps-scene',
      straps: ['portable-scene-action'],
      stories: {
        main: {
          id: 'main',
          straps: ['portable-story-action'],
          persos: [],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.compiledScene.scene.straps).toEqual(['portable-scene-action'])
    expect(result.compiledScene.scene.stories.main?.straps).toEqual(['portable-story-action'])
  })

  it('normalizes author SVG move paths into compact prepared segments', () => {
    const builder = new SceneBuilder(createCatalogForFixtures().validationSnapshot(), { diagnosticOutput: vi.fn() })
    const result = builder.build({
      id: 'svg-path-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'item',
            type: 'text',
            initial: { move: '@root' },
            actions: {
              move: {
                move: {
                  target: '@root',
                  transition: {
                    duration: 100,
                    path: 'M 10 20 L 20 30 L 30 20',
                  },
                },
              },
            },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const path = result.compiledScene.scene.stories.main?.persos[0]?.actions.move
    const pathValue = (path as Record<string, unknown>).move && ((path as Record<string, unknown>).move as Record<string, unknown>).transition
      ? (((path as Record<string, unknown>).move as Record<string, unknown>).transition as Record<string, unknown>).path
      : undefined
    const transitionValue = (path as Record<string, unknown>).move && ((path as Record<string, unknown>).move as Record<string, unknown>).transition
      ? (((path as Record<string, unknown>).move as Record<string, unknown>).transition as Record<string, unknown>)
      : undefined

    expect(isPreparedPath(pathValue)).toBe(true)
    expect(transitionValue).not.toHaveProperty('pathAnchor')
    if (isPreparedPath(pathValue)) {
      expect(pathValue.kind).toBe('segments')
      expect(pathValue.segments?.[0]?.to).toEqual([0.5, 0.5])
      expect(pathValue.segments?.at(-1)?.to).toEqual([1, 0])
    }
  })

  it('derives resource types from configured URL extensions rather than perso type', () => {
    const builder = new SceneBuilder(createCatalogForFixtures().validationSnapshot(), { diagnosticOutput: vi.fn() })
    const result = builder.build({
      id: 'resource-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'media',
            type: 'text',
            initial: { src: '/assets/sound.mp3' },
            actions: {
              unknown: { src: '/assets/runtime.bin' },
              exportOnlyAudio: { src: '/assets/runtime.m4a' },
            },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.compiledScene.resources.entries).toEqual([
        expect.objectContaining({ url: '/assets/sound.mp3', type: 'audio' }),
      ])
    }
  })

  it('returns export-only media references for initial, future and native tag sources', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot(), {
      export: true,
      diagnosticOutput: vi.fn(),
    })
    const result = builder.build({
      id: 'export-resource-scene',
      stories: {
        main: {
          id: 'main',
          persos: [
            {
              id: 'poster',
              type: 'img',
              initial: { src: '/media/cover.png', img: { attr: { src: '/media/texture.webp' } } },
              actions: {
                replace: [{ action: { src: '/media/next.png', img: { attr: { src: '/media/swap.webp' } } }, startAt: 500 }],
              },
            },
            {
              id: 'clip',
              type: 'media',
              initial: { tag: 'video', src: '/media/intro.mp4' },
              actions: { change: { src: '/media/finale.webm' } },
            },
            {
              id: 'audio',
              type: 'media',
              initial: { tag: 'audio', src: '/media/narration.m4a' },
              actions: {},
            },
            {
              id: 'native-video',
              type: 'tag',
              initial: { tag: 'video', attr: { src: '/media/native.mp4', controls: true } },
            },
          ],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.compiledScene.resources.entries.map(({ url, type }) => ({ url, type }))).toEqual([
      { url: '/media/cover.png', type: 'image' },
      { url: '/media/texture.webp', type: 'image' },
      { url: '/media/next.png', type: 'image' },
      { url: '/media/swap.webp', type: 'image' },
      { url: '/media/intro.mp4', type: 'video' },
      { url: '/media/finale.webm', type: 'video' },
      { url: '/media/narration.m4a', type: 'audio' },
      { url: '/media/native.mp4', type: 'video' },
    ])
    expect(result.compiledScene.requirements.resources).toEqual(
      result.compiledScene.resources.entries.map(({ url }) => url),
    )
    expect(result.resourceReferences).toEqual([
      { url: '/media/cover.png', type: 'image', path: ['scene', 'stories', 'main', 'persos', 0, 'initial', 'src'] },
      { url: '/media/texture.webp', type: 'image', path: ['scene', 'stories', 'main', 'persos', 0, 'initial', 'img', 'attr', 'src'] },
      { url: '/media/next.png', type: 'image', path: ['scene', 'stories', 'main', 'persos', 0, 'actions', 'replace', 0, 'action', 'src'] },
      { url: '/media/swap.webp', type: 'image', path: ['scene', 'stories', 'main', 'persos', 0, 'actions', 'replace', 0, 'action', 'img', 'attr', 'src'] },
      { url: '/media/intro.mp4', type: 'video', path: ['scene', 'stories', 'main', 'persos', 1, 'initial', 'src'] },
      { url: '/media/finale.webm', type: 'video', path: ['scene', 'stories', 'main', 'persos', 1, 'actions', 'change', 'src'] },
      { url: '/media/narration.m4a', type: 'audio', path: ['scene', 'stories', 'main', 'persos', 2, 'initial', 'src'] },
      { url: '/media/native.mp4', type: 'video', path: ['scene', 'stories', 'main', 'persos', 3, 'initial', 'attr', 'src'] },
    ])
    expect(result.compiledScene).not.toHaveProperty('resourceReferences')
  })

  it('classifies exported media sources by each URL extension, independent of the tag hint', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot(), {
      export: true,
      diagnosticOutput: vi.fn(),
    })
    const result = builder.build({
      id: 'export-media-tag-hint-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'sound-and-picture',
            type: 'media',
            initial: { tag: 'video', src: '/media/narration.mp3' },
            actions: { switch: { src: '/media/clip.mp4' } },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.compiledScene.resources.entries.map(({ url, type }) => ({ url, type }))).toEqual([
      { url: '/media/narration.mp3', type: 'audio' },
      { url: '/media/clip.mp4', type: 'video' },
    ])
    expect(result.resourceReferences?.map(({ url, type }) => ({ url, type }))).toEqual([
      { url: '/media/narration.mp3', type: 'audio' },
      { url: '/media/clip.mp4', type: 'video' },
    ])
  })

  it('collects a Rive document through the existing rive preload resource type', () => {
    const catalog = createCoreRuntimeCatalog()
    catalog.registerComponent({
      type: 'rive',
      component: TagComponent,
      modules: [],
      validateInitial: () => undefined,
      validateAction: () => undefined,
    })
    const builder = new SceneBuilder(catalog.validationSnapshot(), {
      export: true,
      diagnosticOutput: vi.fn(),
    })
    const result = builder.build({
      id: 'export-rive-resource-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{ id: 'avatar', type: 'rive', initial: { src: '/avatars/coach.riv' } }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.compiledScene.resources.entries).toEqual([
      expect.objectContaining({ url: '/avatars/coach.riv', type: 'rive' }),
    ])
    expect(result.resourceReferences).toEqual([{
      url: '/avatars/coach.riv',
      type: 'rive',
      path: ['scene', 'stories', 'main', 'persos', 0, 'initial', 'src'],
    }])
  })

  it('compiles custom preload resources only at their declared component paths', () => {
    const catalog = createCoreRuntimeCatalog()
    catalog.registerComponent({
      type: 'avatar-fixture',
      component: NoServiceComponent,
      modules: [],
      validateInitial: () => undefined,
    })
    const builder = new SceneBuilder(catalog.validationSnapshot(), {
      export: true,
      preloadManifest: { entries: [
        {
          url: '/models/actor.glb',
          type: 'three-glb',
          policy: { cache: 'default', priority: 'high' },
        },
        {
          url: '/motions/walk.fbx',
          type: 'three-fbx',
          policy: { cache: 'default', priority: 'normal' },
        },
      ] },
      preloadResourceOccurrences: [
        {
          entryIndex: 0,
          storyId: 'main',
          persoId: 'avatar',
          path: ['initial', 'src'],
        },
        {
          entryIndex: 1,
          storyId: 'main',
          persoId: 'avatar',
          path: ['initial', 'animations', 'walk', 'src'],
        },
      ],
      diagnosticOutput: vi.fn(),
    })
    const result = builder.build({
      id: 'avatar-resource-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'avatar',
            type: 'avatar-fixture',
            initial: {
              src: '/models/actor.glb',
              animations: { walk: { src: '/motions/walk.fbx', format: 'fbx' } },
            },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.compiledScene.resources.entries.map(({ url, type }) => ({ url, type }))).toEqual([
      { url: '/models/actor.glb', type: 'three-glb' },
      { url: '/motions/walk.fbx', type: 'three-fbx' },
    ])
    expect(result.compiledScene.requirements.resources).toEqual([
      '/models/actor.glb', '/motions/walk.fbx',
    ])
    expect(result.resourceReferences).toEqual([
      {
        url: '/models/actor.glb',
        type: 'three-glb',
        path: ['scene', 'stories', 'main', 'persos', 0, 'initial', 'src'],
      },
      {
        url: '/motions/walk.fbx',
        type: 'three-fbx',
        path: ['scene', 'stories', 'main', 'persos', 0, 'initial', 'animations', 'walk', 'src'],
      },
    ])
  })

  it('blocks a custom preload occurrence whose declared path does not match the scene', () => {
    const catalog = createCoreRuntimeCatalog()
    catalog.registerComponent({
      type: 'avatar-fixture',
      component: NoServiceComponent,
      modules: [],
      validateInitial: () => undefined,
    })
    const builder = new SceneBuilder(catalog.validationSnapshot(), {
      export: true,
      preloadManifest: { entries: [{
        url: '/models/other.glb',
        type: 'three-glb',
        policy: { cache: 'default' },
      }] },
      preloadResourceOccurrences: [{
        entryIndex: 0,
        storyId: 'main',
        persoId: 'avatar',
        path: ['initial', 'src'],
      }],
      diagnosticOutput: vi.fn(),
    })
    const result = builder.build({
      id: 'avatar-resource-mismatch-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{ id: 'avatar', type: 'avatar-fixture', initial: { src: '/models/actor.glb' } }],
        },
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.diagnostics.errors.map(({ code }) => code)).toContain(
      'CODPLAY_EXPORT_PRELOAD_RESOURCE_REFERENCE_UNSUPPORTED',
    )
  })

  it('reports an unmapped custom preload entry as a compiler diagnostic', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot(), {
      export: true,
      preloadManifest: { entries: [{
        url: '/models/actor.glb',
        type: 'three-glb',
        policy: { cache: 'default' },
      }] },
      diagnosticOutput: vi.fn(),
    })
    const result = builder.build({
      id: 'unmapped-preload-entry-scene',
      stories: { main: { id: 'main', persos: [{ id: 'actor', type: 'tag', initial: { tag: 'div' } }] } },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.diagnostics.errors).toContainEqual(expect.objectContaining({
      code: 'CODPLAY_EXPORT_PRELOAD_RESOURCE_REFERENCE_UNSUPPORTED',
      message: 'Custom preload resource has no exact component occurrence declaration.',
      details: expect.objectContaining({ context: expect.objectContaining({
        entryIndex: 0,
        url: '/models/actor.glb',
        type: 'three-glb',
      }) }),
    }))
  })

  it('blocks export when a known media source type conflicts with its consumer', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot(), {
      export: true,
      diagnosticOutput: vi.fn(),
    })
    const result = builder.build({
      id: 'unsupported-export-resource',
      stories: {
        main: {
          id: 'main',
          persos: [{ id: 'picture', type: 'img', initial: { src: '/media/photo.mp4' } }],
        },
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.diagnostics.errors).toContainEqual(expect.objectContaining({
      code: 'CODPLAY_EXPORT_MEDIA_REFERENCE_UNSUPPORTED',
      details: expect.objectContaining({
        refs: { sceneId: 'unsupported-export-resource', storyId: 'main', persoId: 'picture' },
        context: expect.objectContaining({
          path: ['scene', 'stories', 'main', 'persos', 0, 'initial', 'src'],
          componentType: 'img',
          url: '/media/photo.mp4',
        }),
      }),
    }))
  })

  it('includes static media sources from sequenced future actions', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot(), {
      export: true,
      diagnosticOutput: vi.fn(),
    })
    const result = builder.build({
      id: 'export-sequenced-media-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'audio',
            type: 'media',
            initial: { tag: 'audio', src: '/media/intro.mp3' },
            actions: {
              replace: [{ action: { src: '/media/late.mp3#t=0.5' }, startAt: 2_000 }],
            },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.compiledScene.resources.entries.map(({ url, type }) => ({ url, type }))).toEqual([
      { url: '/media/intro.mp3', type: 'audio' },
      { url: '/media/late.mp3#t=0.5', type: 'audio' },
    ])
    expect(result.resourceReferences?.at(-1)).toEqual({
      url: '/media/late.mp3#t=0.5',
      type: 'audio',
      path: ['scene', 'stories', 'main', 'persos', 0, 'actions', 'replace', 0, 'action', 'src'],
    })
  })

  it('blocks markup resources while collecting CSS URL resources from inline styles', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot(), {
      export: true,
      diagnosticOutput: vi.fn(),
    })
    const result = builder.build({
      id: 'unclosed-export-resource-scene',
      stories: {
        main: {
          id: 'main',
          persos: [
            {
              id: 'markup-layout',
              type: 'layout',
              initial: { markup: '<video src="/media/markup.mp4"></video>' },
              actions: {},
            },
            {
              id: 'background',
              type: 'tag',
              initial: { tag: 'div', style: { backgroundImage: 'url("/media/background.png")' } },
              actions: {},
            },
          ],
        },
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.diagnostics.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'CODPLAY_EXPORT_MEDIA_REFERENCE_UNSUPPORTED',
        details: expect.objectContaining({
          refs: { sceneId: 'unclosed-export-resource-scene', storyId: 'main', persoId: 'markup-layout' },
          context: expect.objectContaining({
            path: ['scene', 'stories', 'main', 'persos', 0, 'initial', 'markup'],
          }),
        }),
      }),
    ]))
  })

  it('returns exact compiler paths for inline style image references without changing the CSS value', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot(), {
      export: true,
      diagnosticOutput: vi.fn(),
    })
    const result = builder.build({
      id: 'inline-style-export-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'background',
            type: 'tag',
            initial: { tag: 'div', style: { backgroundImage: 'linear-gradient(black, transparent), url("/media/background.png")' } },
            actions: { change: { style: { maskImage: 'url(/media/mask.svg)' } } },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.compiledScene.resources.entries.map(({ url, type }) => ({ url, type }))).toEqual([
      { url: '/media/background.png', type: 'image' },
      { url: '/media/mask.svg', type: 'image' },
    ])
    expect(result.resourceReferences).toEqual([
      {
        url: '/media/background.png',
        type: 'image',
        path: ['scene', 'stories', 'main', 'persos', 0, 'initial', 'style', 'backgroundImage'],
        cssValue: 'url("/media/background.png")',
      },
      {
        url: '/media/mask.svg',
        type: 'image',
        path: ['scene', 'stories', 'main', 'persos', 0, 'actions', 'change', 'style', 'maskImage'],
        cssValue: 'url(/media/mask.svg)',
      },
    ])
    expect(result.compiledScene.scene.stories.main.persos[0]?.initial.style)
      .toEqual({ backgroundImage: 'linear-gradient(black, transparent), url("/media/background.png")' })
  })

  it('blocks native resource tags and stylesheet markup outside the media closure', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot(), {
      export: true,
      diagnosticOutput: vi.fn(),
    })
    const result = builder.build({
      id: 'unclosed-native-resource-scene',
      stories: {
        main: {
          id: 'main',
          persos: [
            { id: 'stylesheet', type: 'tag', initial: { tag: 'link', attr: { rel: 'stylesheet', href: '/scene.css' } } },
            { id: 'embedded-page', type: 'tag', initial: { tag: 'iframe', attr: { src: '/nested.html' } } },
            { id: 'inline-stylesheet', type: 'tag', initial: { tag: 'style', content: '.scene { color: red }' } },
          ],
        },
      },
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.diagnostics.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'CODPLAY_EXPORT_MEDIA_REFERENCE_UNSUPPORTED',
        details: expect.objectContaining({
          refs: { sceneId: 'unclosed-native-resource-scene', storyId: 'main', persoId: 'stylesheet' },
          context: expect.objectContaining({ path: ['scene', 'stories', 'main', 'persos', 0, 'initial', 'attr', 'href'] }),
        }),
      }),
      expect.objectContaining({
        code: 'CODPLAY_EXPORT_MEDIA_REFERENCE_UNSUPPORTED',
        details: expect.objectContaining({
          refs: { sceneId: 'unclosed-native-resource-scene', storyId: 'main', persoId: 'embedded-page' },
          context: expect.objectContaining({ path: ['scene', 'stories', 'main', 'persos', 1, 'initial', 'attr', 'src'] }),
        }),
      }),
      expect.objectContaining({
        code: 'CODPLAY_EXPORT_MEDIA_REFERENCE_UNSUPPORTED',
        details: expect.objectContaining({
          refs: { sceneId: 'unclosed-native-resource-scene', storyId: 'main', persoId: 'inline-stylesheet' },
          context: expect.objectContaining({ path: ['scene', 'stories', 'main', 'persos', 2, 'initial', 'tag'] }),
        }),
      }),
    ]))
  })

  it('keeps navigation hrefs outside the preload resource manifest in export builds', () => {
    const builder = new SceneBuilder(createCoreRuntimeCatalog().validationSnapshot(), {
      export: true,
      diagnosticOutput: vi.fn(),
    })
    const result = builder.build({
      id: 'export-navigation-link-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'manual-link',
            type: 'tag',
            initial: { tag: 'a', attr: { href: './manual.pdf', download: '' } },
            actions: { reveal: { attr: { href: './appendix' } } },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.compiledScene.resources.entries).toEqual([])
    expect(result.resourceReferences).toEqual([])
    expect(result.compiledScene.scene.stories.main.persos[0]?.initial.attr).toEqual({
      href: './manual.pdf',
      download: '',
    })
    expect(result.compiledScene.scene.stories.main.persos[0]?.actions.reveal).toEqual({
      attr: { href: './appendix' },
    })
  })

  it('derives ModuleService requirements from component capability declarations', () => {
    const catalog = createCoreRuntimeCatalog()
    catalog.registerComponent({
      type: 'list-item',
      component: NoServiceComponent,
      modules: ['list'],
      validateInitial: () => undefined,
      validateAction: () => undefined,
    })
    const builder = new SceneBuilder(catalog.validationSnapshot(), { diagnosticOutput: vi.fn() })

    const result = builder.build({
      id: 'module-service-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{ id: 'item', type: 'list-item' }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.compiledScene.requirements.modules).toEqual(['list'])
  })

  it('derives the layout module requirement from the layout component definition', () => {
    const catalog = createCoreRuntimeCatalog()
    catalog.overrideComponent({
      type: 'layout',
      component: NoServiceComponent,
      modules: ['markup'],
      validateInitial: () => undefined,
      validateAction: () => undefined,
    })
    const builder = new SceneBuilder(catalog.validationSnapshot(), { diagnosticOutput: vi.fn() })

    const result = builder.build({
      id: 'layout-module-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'layout',
            type: 'layout',
            initial: {
              markup: '<section><main data-part="page-layout:content"></main></section>',
            },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.compiledScene.requirements.modules).toEqual(['markup'])
      const layout = result.compiledScene.scene.stories.main?.persos[0]
      expect(layout?.initial.markup).toBe('<section><main data-part="page-layout:content"></main></section>')
    }
  })

  it('derives engine library requirements from component declarations', () => {
    const catalog = createCoreRuntimeCatalog()
    catalog.registerLibrary({ id: 'three', load: () => undefined })
    catalog.registerComponent({
      type: 'three-host',
      component: TagComponent,
      modules: [],
      libraries: ['three'],
      validateInitial: () => undefined,
    })

    const result = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'three-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{ id: 'host', type: 'three-host', initial: {} }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.compiledScene.requirements.libraries).toEqual(['three'])
  })

  it('warns without blocking when a component names an undeclared engine library', () => {
    const catalog = createCoreRuntimeCatalog()
    catalog.registerComponent({
      type: 'unavailable-host',
      component: TagComponent,
      modules: [],
      libraries: ['missing-library'],
      validateInitial: () => undefined,
    })

    const result = new SceneBuilder(catalog.validationSnapshot()).build({
      id: 'missing-library-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{ id: 'host', type: 'unavailable-host', initial: {} }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.compiledScene.requirements.libraries).toEqual(['missing-library'])
      expect(result.diagnostics.warnings.map((diagnostic) => diagnostic.code)).toContain('AUTHOR_LIBRARY_UNKNOWN')
    }
  })

  it('extracts capture functions and nested end events from perso emit declarations', () => {
    const initCaptureState = ({ state }: { state: Readonly<Record<string, unknown>> }) => ({
      value: state.value,
    })
    const trackCommand = () => ({ actions: [{ name: 'drag' }] })
    const endCapture = () => ({ events: [{ name: 'drag:stored', visibility: 'story' as const }] })
    const builder = new SceneBuilder(createCatalogForFixtures().validationSnapshot(), {
      export: true,
      diagnosticOutput: vi.fn(),
    })

    const result = builder.build({
      id: 'capture-compiled-scene',
      stories: {
        main: {
          id: 'main',
          state: { value: 1 },
          persos: [{
            id: 'item',
            type: 'text',
            initial: {},
            emit: {
              pointerdown: {
                event: { name: 'drag:start', visibility: 'scene' },
                capture: {
                  trackOn: ['pointermove'],
                  endOn: ['pointerup'],
                  initCaptureState,
                  trackCommand,
                  endEmit: { name: 'drag:end', data: { source: 'author' }, visibility: 'public' },
                  endCapture,
                },
              },
            },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const capture = result.compiledScene.scene.stories.main?.persos[0]?.emit?.pointerdown
    expect(capture).toMatchObject({
      event: { name: 'drag:start', visibility: 'scene' },
      capture: {
        trackOn: ['pointermove'],
        endOn: ['pointerup'],
        endEmit: { name: 'drag:end', data: { source: 'author' }, visibility: 'public' },
      },
    })
    if (capture === undefined || !('event' in capture)) return
    const compiledCapture = capture?.capture
    expect(compiledCapture?.initCaptureStateRef).toBeDefined()
    expect(compiledCapture?.trackCommandRef).toBeDefined()
    expect(compiledCapture?.endCaptureRef).toBeDefined()
    expect(result.functions[compiledCapture!.initCaptureStateRef!.ref]).toBe(initCaptureState)
    expect(result.functions[compiledCapture!.trackCommandRef!.ref]).toBe(trackCommand)
    expect(result.functions[compiledCapture!.endCaptureRef!.ref]).toBe(endCapture)
    expect(result.functionReferences?.map(({ path }) => path)).toEqual([
      ['stories', 'main', 'persos', 0, 'emit', 'pointerdown', 'capture', 'initCaptureState'],
      ['stories', 'main', 'persos', 0, 'emit', 'pointerdown', 'capture', 'trackCommand'],
      ['stories', 'main', 'persos', 0, 'emit', 'pointerdown', 'capture', 'endCapture'],
    ])
  })

  it('rejects cascade on capture start and end events', () => {
    const builder = new SceneBuilder(createCatalogForFixtures().validationSnapshot(), { diagnosticOutput: vi.fn() })
    const legacyScene = {
      id: 'legacy-capture-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'item',
            type: 'text',
            initial: {},
            emit: {
              pointerdown: {
                event: { name: 'drag:start', cascade: true },
                capture: {
                  endEmit: { name: 'drag:end', cascade: false },
                },
              },
            },
          }],
        },
      },
    } as unknown as SceneDoc<string>

    const result = builder.build(legacyScene)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.diagnostics.errors.map((diagnostic) => diagnostic.code)).toEqual([
        'AUTHOR_CAPTURE_EVENT_SCOPE_LEGACY',
        'AUTHOR_CAPTURE_EVENT_SCOPE_LEGACY',
      ])
    }
  })

  it('rejects unsupported visibility on authored capture events', () => {
    const builder = new SceneBuilder(createCatalogForFixtures().validationSnapshot(), { diagnosticOutput: vi.fn() })
    const sceneWithInvalidVisibility = {
      id: 'invalid-capture-visibility-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'item',
            type: 'text',
            initial: {},
            emit: {
              pointerdown: {
                event: { name: 'drag:start', visibility: 'instance' },
                capture: {},
              },
            },
          }],
        },
      },
    } as unknown as SceneDoc<string>

    const result = builder.build(sceneWithInvalidVisibility)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.diagnostics.errors.map((diagnostic) => diagnostic.code)).toContain(
        'AUTHOR_CAPTURE_EVENT_VISIBILITY_INVALID',
      )
    }
  })

  it('preserves ordinary V1 emit fields while compiling V2 visibility', () => {
    const builder = new SceneBuilder(createCatalogForFixtures().validationSnapshot(), { diagnosticOutput: vi.fn() })
    const result = builder.build({
      id: 'ordinary-emit-compiled-scene',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'button',
            type: 'text',
            initial: {},
            emit: {
              click: {
                ref: 'control',
                keyCode: 'Space',
                preventDefault: true,
                data: { answerId: 'yes' },
                event: {
                  name: 'answer:selected',
                  data: { source: 'button' },
                  visibility: 'story',
                },
              },
            },
          }],
        },
      },
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const emit = result.compiledScene.scene.stories.main?.persos[0]?.emit?.click
    expect(emit).toMatchObject({
      ref: 'control',
      keyCode: 'Space',
      preventDefault: true,
      data: { answerId: 'yes' },
      event: {
        name: 'answer:selected',
        data: { source: 'button' },
        visibility: 'story',
      },
    })
  })
})
