/** @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest'

import { DiagnosticCollector } from '../../../src/diagnostics'
import { createCoreRuntimeCatalog } from '../../../src/runtime/catalog'
import { createMarkupModuleServiceDefinition, type MarkupModuleServiceInstance } from '../../../src/runtime/capabilities/markup'
import { HtmlComponentMaterializer, SvgComponentMaterializer } from '../../../src/runtime/runner'
import { correctionIconPartId, selectionIconPartId } from '../../../src/runtime/components/input'
import {
  resolvePolygonPathString,
  sanitizeInputInitial,
  sanitizePolygonAction,
  sanitizePolygonInitial,
  validateImageInitial,
  type ComponentActionOccurrence,
  type InputState,
  type PolygonState,
} from '../../../src/runtime/components'
import type { CompiledScene } from '../../../src/scene/compiled'
import { SceneBuilder } from '../../../src/scene/compiled'
import { materializeScene, resolveScene } from '../../../src/runtime/player/pipeline'

type NodeMaps = {
  persoNodes: Map<string, unknown>
  targetNodes: Map<string, unknown>
}

/** Creates the two host-owned DOM maps used by a component materializer. */
function createNodeMaps(): NodeMaps {
  return { persoNodes: new Map(), targetNodes: new Map() }
}

/** Creates the player-scoped markup capability used by input tests. */
function createMarkup(): MarkupModuleServiceInstance {
  return createMarkupModuleServiceDefinition().create({
    playerId: 'component-test-player',
    compiledScene: {} as CompiledScene,
  }) as MarkupModuleServiceInstance
}

describe('V2 core image, input and polygon components', () => {
  it('keeps one native image node per source and never reassigns a cached src', () => {
    const catalog = createCoreRuntimeCatalog()
    const nodes = createNodeMaps()
    const materializer = new HtmlComponentMaterializer(nodes)
    const identity = { componentId: 'story:image', storyId: 'story', componentType: 'img' }
    const initial = {
      src: '/image-a.png',
      alt: 'A',
      img: { className: 'photo', style: { objectFit: 'cover' } },
    }
    const component = catalog.createComponent(
      'img',
      { perso: { id: 'image', storyId: 'story', initial, actions: { swap: { src: '/image-b.png' } } } },
      identity,
      materializer,
      new Map(),
    )
    const handle = materializer.materializeComponent(component, identity, initial, [], new Map())
    component.update({ state: initial, timeMs: 0 })

    const root = nodes.persoNodes.get(identity.componentId) as HTMLDivElement
    const first = root.querySelector('img') as HTMLImageElement
    expect(first.getAttribute('src')).toBe('/image-a.png')
    expect(first.className).toContain('cp-img-inner')
    expect(first.className).toContain('photo')

    component.update({ state: { ...initial, src: '/image-b.png' }, timeMs: 100 })
    const second = root.querySelector('img') as HTMLImageElement
    expect(second).not.toBe(first)
    expect(second.getAttribute('src')).toBe('/image-b.png')

    component.update({ state: initial, timeMs: 200 })
    expect(root.querySelector('img')).toBe(first)
    expect(first.getAttribute('src')).toBe('/image-a.png')
    handle.destroy()
  })

  it('rejects the retired image fitMode contract', () => {
    const diagnostics = new DiagnosticCollector({ output: vi.fn() })
    validateImageInitial({ src: '/image.png', fitMode: 'wallpaper' }, {
      target: 'initial',
      path: 'initial',
      refs: { persoId: 'image' },
      diagnostics,
    })

    expect(diagnostics.report().errors).toEqual([
      expect.objectContaining({ code: 'AUTHOR_IMAGE_FIT_MODE_REMOVED' }),
    ])
  })

  it('materializes input parts and publishes only its two unique icon targets', () => {
    const catalog = createCoreRuntimeCatalog()
    const nodes = createNodeMaps()
    const materializer = new HtmlComponentMaterializer(nodes)
    const markup = createMarkup()
    const modules = new Map([['markup', markup]])
    const identity = { componentId: 'quiz:answer-a', storyId: 'quiz', componentType: 'input' }
    const initial = sanitizeInputInitial({
      inputType: 'radio',
      id: 'answer-a-control',
      name: 'answer',
      value: 'a',
      label: 'Answer A',
      hint: 'Choose one',
      checked: true,
      selectionIcon: { content: '✓' },
      correctionIcon: { correctContent: '+', incorrectContent: '-' },
      visualState: 'selected' as const,
    }) as InputState
    const component = catalog.createComponent(
      'input',
      { perso: { id: 'answer-a', storyId: 'quiz', initial, actions: {} } },
      identity,
      materializer,
      modules,
    )
    const publicPartIds = catalog.getMountablePartIds('input', identity)
    const handle = materializer.materializeComponent(component, identity, initial, publicPartIds, modules)
    component.update({ state: initial, timeMs: 0 })

    const root = nodes.persoNodes.get(identity.componentId) as HTMLLabelElement
    expect(root.id).toBe('answer-a')
    expect(root.querySelector('input')?.id).toBe('answer-a-control')
    expect(root.querySelector('[data-part]')).toBeNull()
    expect(root.querySelector('span')?.textContent).toBe('Answer A')
    expect(root.className).toContain('input--selected')
    expect(publicPartIds).toEqual([
      selectionIconPartId('quiz', 'answer-a'),
      correctionIconPartId('quiz', 'answer-a'),
    ])
    expect(markup.resolveTarget(publicPartIds[0]!)).toMatchObject({ partId: publicPartIds[0] })
    expect(markup.resolveTarget('control')).toBeUndefined()
    expect(markup.resolveTarget('label')).toBeUndefined()
    expect(markup.getAllTargets()).toHaveLength(2)

    handle.destroy()
    expect(markup.getAllTargets()).toHaveLength(0)
  })

  it('materializes a real SVG root and projects polygon morph deterministically', () => {
    const catalog = createCoreRuntimeCatalog()
    const nodes = createNodeMaps()
    const materializer = new SvgComponentMaterializer(nodes)
    const identity = { componentId: 'shape:polygon', storyId: 'shape', componentType: 'polygon' }
    const initial = sanitizePolygonInitial({ sides: 3, outer: 40, content: 'triangle' }) as PolygonState
    const targetAction = sanitizePolygonAction({
      sides: 7,
      inner: 18,
      outer: 40,
      rotationDeg: 12,
      content: 'heptagram',
    })
    const morphOptions = sanitizePolygonAction({ morph: { duration: 1000 } }).morph as PolygonState['morph']
    const target = { ...initial, ...targetAction } as PolygonState
    const component = catalog.createComponent(
      'polygon',
      { perso: { id: 'polygon', storyId: 'shape', initial, actions: { morph: { morph: morphOptions, ...targetAction } } } },
      identity,
      materializer,
      new Map(),
    )
    const handle = materializer.materializeComponent(component, identity, initial, [], new Map())
    component.update({ state: initial, timeMs: 0 })

    const root = nodes.persoNodes.get(identity.componentId) as SVGSVGElement
    const path = root.querySelector('path') as SVGPathElement
    expect(root.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(path.namespaceURI).toBe('http://www.w3.org/2000/svg')
    expect(path.getAttribute('d')).toBe(resolvePolygonPathString(initial))

    const occurrence: ComponentActionOccurrence = {
      name: 'morph',
      startAt: 0,
      elapsedMs: 0,
      eventId: 'morph-1',
      action: { morph: morphOptions, ...targetAction },
    }
    const targetState = { ...target, morph: morphOptions } as PolygonState
    component.update({ state: targetState, timeMs: 0, activeActions: [occurrence] })
    const startPath = path.getAttribute('d')
    component.update({ state: targetState, timeMs: 500, activeActions: [{ ...occurrence, elapsedMs: 500 }] })
    expect(path.getAttribute('d')).not.toBe(startPath)
    expect(path.getAttribute('d')).not.toBe(resolvePolygonPathString(target))

    component.update({ state: targetState, timeMs: 1000, activeActions: [{ ...occurrence, elapsedMs: 1000 }] })
    expect(path.getAttribute('d')).toBe(resolvePolygonPathString(target))
    expect(root.querySelector('text')?.textContent).toBe('heptagram')
    handle.destroy()
  })

  it('rejects an HTML root at the SVG materializer boundary', () => {
    const catalog = createCoreRuntimeCatalog()
    const nodes = createNodeMaps()
    const materializer = new SvgComponentMaterializer(nodes)
    const identity = { componentId: 'shape:tag', storyId: 'shape', componentType: 'tag' }
    const initial = { tag: 'div' }
    const component = catalog.createComponent(
      'tag',
      { perso: { id: 'tag', storyId: 'shape', initial, actions: {} } },
      identity,
      materializer,
      new Map(),
    )

    expect(() => materializer.materializeComponent(component, identity, initial, [], new Map())).toThrow(
      'SVG materializer requires an SVG root: tag',
    )
    expect(nodes.persoNodes.has(identity.componentId)).toBe(false)
  })

  it('carries component-specific action fields through the canonical V2 resolver', () => {
    const catalog = createCoreRuntimeCatalog()
    const build = new SceneBuilder(catalog.validationSnapshot(), {
      createdAt: '2026-08-24T00:00:00.000Z',
      diagnosticOutput: vi.fn(),
    }).build({
      id: 'component-state-scene',
      stories: {
        main: {
          id: 'main',
          initial: { move: '@root' },
          persos: [{
            id: 'answer',
            type: 'input',
            initial: {
              inputType: 'radio',
              selectedAnswerIds: [],
              selectionIcon: { content: 'idle' },
            },
            actions: {
              activate: {
                inputType: 'checkbox',
                selectedAnswerIds: ['answer-a'],
                selectionIcon: { content: 'selected' },
              },
            },
          }],
          eventimes: [{ name: 'activate', startAt: 0 }],
        },
      },
    })

    expect(build.ok).toBe(true)
    if (!build.ok) return
    const resolved = resolveScene(materializeScene(build.compiledScene, 0))
    expect(resolved.persos['main:answer']?.state).toMatchObject({
      inputType: 'checkbox',
      selectedAnswerIds: ['answer-a'],
      selectionIcon: { content: 'selected' },
    })
  })
})
