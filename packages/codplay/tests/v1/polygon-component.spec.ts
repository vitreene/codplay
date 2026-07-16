// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { CodPlay } from '../../src/creator'
import { createComponentModules } from '../../src/runtime/components/lib/component-modules'
import { CORE_SERVICES, createComponentServices } from '../../src/runtime/components/lib/component-services'
import type { RuntimeEmitEvent } from '../../src/runtime/types'
import type { SceneDoc } from '../../src/player/types'
import {
  createPolygonVertices,
  normalizePolygonShapeState,
  PolygonComponent,
  resolveMorphPathString,
  resolvePolygonPathString,
} from '../../src/runtime/components'

/** Creates one polygon component instance wired with runtime defaults. */
function createPolygonComponent(options: { onEmit?: (event: RuntimeEmitEvent) => void } = {}): PolygonComponent {
  const services = createComponentServices(new Map(Object.entries(CORE_SERVICES)))

  return new PolygonComponent({
    perso: {
      id: 'polygon-demo',
      storyId: 'polygon-story',
      type: 'polygon',
      initial: {
        className: 'polygon-shape',
        style: { color: 'rebeccapurple' },
        attr: { 'data-shape': 'etoile' },
        content: 'etoile',
        sides: 5,
        inner: 20,
        outer: 40,
      },
      emit: {
        click: { event: { name: 'polygon:morph-test:click' } },
      },
      actions: {},
    },
    createElementOptions: options.onEmit === undefined ? undefined : { emitRuntimeEvent: options.onEmit },
    services,
    modules: createComponentModules(),
    report: () => undefined,
  })
}

describe('V1 - polygon core component', () => {
  it('normalizes and serializes polygon geometry', () => {
    expect(normalizePolygonShapeState({ sides: 2, outer: -3, inner: 999, rotationDeg: 45 })).toEqual({
      sides: 3,
      outer: 1,
      inner: 1,
      rotationDeg: 45,
      inflexion: [0, 0, 0],
    })
    expect(createPolygonVertices(normalizePolygonShapeState({ sides: 5, inner: 20, outer: 40 }))).toHaveLength(10)
    expect(resolvePolygonPathString({ sides: 3, outer: 40 })).toMatch(/^M /)
    expect(resolveMorphPathString({ from: { sides: 3, outer: 40 }, to: { sides: 5, inner: 20, outer: 40 }, progress: 0.5 })).toMatch(/^M /)
  })

  it('reuses the same SVG root and restores authored state on refresh', () => {
    const component = createPolygonComponent()

    component._init()
    const initialRootNode = component.node as SVGSVGElement

    component.update({
      persoId: 'polygon-demo',
      eventId: 'polygon:heptagone',
      eventMs: 0,
      eventSeq: 1,
      action: {
        className: 'polygon-shape is-updated',
        style: { color: 'tomato' },
        attr: { 'data-shape': 'heptagone' },
        content: 'heptagone',
        sides: 7,
        inner: null,
      },
    })

    component._init()

    const refreshedRootNode = component.node as SVGSVGElement
    const pathNode = refreshedRootNode.querySelector('path')
    const textNode = refreshedRootNode.querySelector('text')

    expect(refreshedRootNode).toBe(initialRootNode)
    expect(refreshedRootNode.className.baseVal).toBe('polygon-shape')
    expect(refreshedRootNode.style.color).toBe('rebeccapurple')
    expect(refreshedRootNode.getAttribute('data-shape')).toBe('etoile')
    expect(textNode?.textContent).toBe('etoile')
    expect(pathNode?.getAttribute('d')).toBe(resolvePolygonPathString({ sides: 5, inner: 20, outer: 40 }))
  })

  it('emits authored click events from the SVG root', () => {
    const emittedEvents: RuntimeEmitEvent[] = []
    const component = createPolygonComponent({
      onEmit: (event) => emittedEvents.push(event),
    })

    component._init()
    ;(component.node as SVGSVGElement).dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(emittedEvents).toEqual([
      {
        name: 'polygon:morph-test:click',
        data: { self: { id: 'polygon-demo', storyId: 'polygon-story' } },
        cascade: undefined,
        scopeStoryId: 'polygon-story',
      },
    ])
  })

  it('applies a runtime Anime SVG morph update on seek without external binding', async () => {
    const mountTarget = document.createElement('div')
    document.body.appendChild(mountTarget)
    const scene: SceneDoc = {
      id: 'polygon-runtime-morph-scene',
      stories: {
        'polygon-story': {
          id: 'polygon-story',
          initial: { move: '@root' },
          persos: [
            {
              id: 'polygon-runtime-morph',
              type: 'polygon',
              initial: {
                move: '@root',
                sides: 5,
                inner: 20,
                outer: 40,
                rotationDeg: -18,
              },
              actions: {
                'polygon:morph': {
                  morph: { duration: 1000, precision: 0 },
                  sides: 8,
                  inner: null,
                  outer: 40,
                  rotationDeg: 22.5,
                },
              },
            },
          ],
        },
      },
      onStart(_scene, options) {
        options.schedule('polygon-story')
      },
      tracks: {
        'track-polygon-story': {
          id: 'track-polygon-story',
          source: 'story',
          order: 0,
          events: [
            { id: 'evt-polygon-morph', ms: 0, name: 'polygon:morph', index: 0, source: 'story' },
            { id: 'evt-sequence-end', ms: 2000, name: 'sequence:end', index: 1, source: 'story' },
          ],
        },
      },
    }
    const studio = new CodPlay()

    const loadResult = await studio.load({ scene, mountTarget })
    expect(loadResult.ok).toBe(true)
    await studio.player.play()
    await studio.player.seek({ timelineMs: 1500 })

    const pathNode = mountTarget.querySelector('path')
    expect(pathNode?.getAttribute('d')).toBe(resolvePolygonPathString({ sides: 8, inner: null, outer: 40, rotationDeg: 22.5 }))

    await studio.player.destroy()
    mountTarget.remove()
  })
})
