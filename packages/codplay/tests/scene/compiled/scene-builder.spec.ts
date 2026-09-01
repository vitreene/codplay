import { describe, expect, it, vi } from 'vitest'

import { isPreparedPath, parseColor, prepareSvgPath } from '../../../src/ace'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import type { RuntimeCapabilityCatalog } from '../../../src/runtime/catalog'
import { BaseComponent, TagComponent } from '../../../src/runtime/components'
import type { ComponentUpdateInput } from '../../../src/runtime/components'
import { compileMovePath, SceneBuilder } from '../../../src/scene/compiled'
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
    const builder = new SceneBuilder(createCatalogForFixtures().validationSnapshot(), { diagnosticOutput: vi.fn() })

    const result = builder.build(scene)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(Object.keys(result.functions)).toHaveLength(3)
      expect(JSON.stringify(result.compiledScene)).not.toContain('=>')
      expect(result.compiledScene.scene.init).toMatchObject({ ref: expect.stringContaining('fn:') })
      expect(result.compiledScene.scene.stories.main.listen[0]?.transform).toHaveLength(1)
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
                  transition: { duration: 100, path: 'M 10 20 L 20 30 L 30 20' },
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

    expect(isPreparedPath(pathValue)).toBe(true)
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
            actions: { unknown: { src: '/assets/runtime.bin' } },
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

  it('extracts capture functions and nested end events from perso emit declarations', () => {
    const initCaptureState = ({ state }: { state: Readonly<Record<string, unknown>> }) => ({
      value: state.value,
    })
    const trackCommand = () => ({ action: { actionName: 'drag' } })
    const endCapture = () => ({ events: [{ name: 'drag:stored', mode: 'persist-only' as const }] })
    const builder = new SceneBuilder(createCatalogForFixtures().validationSnapshot(), { diagnosticOutput: vi.fn() })

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
                event: { name: 'drag:start' },
                capture: {
                  trackOn: ['pointermove'],
                  endOn: ['pointerup'],
                  initCaptureState,
                  trackCommand,
                  endEmit: { name: 'drag:end', data: { source: 'author' } },
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
      event: { name: 'drag:start' },
      capture: {
        trackOn: ['pointermove'],
        endOn: ['pointerup'],
        endEmit: { name: 'drag:end', data: { source: 'author' } },
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
