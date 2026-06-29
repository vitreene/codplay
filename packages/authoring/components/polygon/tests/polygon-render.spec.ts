// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { createComponentModules } from 'codplay/runtime/components/lib/component-modules'
import { CORE_SERVICES, createComponentServices } from 'codplay/runtime/components/lib/component-services'
import { PolygonComponent } from '../src/polygon-component.js'
import { resolvePolygonPointsString } from '../src/polygon-geometry.js'

/** Creates one polygon component instance wired with the runtime defaults. */
function createPolygonComponent(): PolygonComponent {
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
      actions: {},
    },
    services,
    modules: createComponentModules(),
    report: () => {},
  })
}

describe('PolygonComponent', () => {
  it('reuses the same SVG root and restores the authored state on refresh', () => {
    const component = createPolygonComponent()

    component._init()
    const initialRootNode = component.node as SVGSVGElement

    component.update({
      persoId: 'polygon-demo',
      eventId: 'polygon:heptagone',
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
    const polygonNode = refreshedRootNode.querySelector('polygon')
    const textNode = refreshedRootNode.querySelector('text')

    expect(refreshedRootNode).toBe(initialRootNode)
    expect(refreshedRootNode.className.baseVal).toBe('polygon-shape')
    expect(refreshedRootNode.style.color).toBe('rebeccapurple')
    expect(refreshedRootNode.getAttribute('data-shape')).toBe('etoile')
    expect(textNode?.textContent).toBe('etoile')
    expect(polygonNode?.getAttribute('points')).toBe(resolvePolygonPointsString({ sides: 5, inner: 20, outer: 40 }))
  })
})
