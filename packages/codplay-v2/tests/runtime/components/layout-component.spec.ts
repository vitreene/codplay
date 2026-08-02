import { describe, expect, it, vi } from 'vitest'
import { LayoutComponent } from '../../../src/runtime/components'
import {
  createLayoutModuleServiceDefinition,
  materializeComponentWithLayout,
} from '../../../src/runtime/capabilities/layout'
import type { LayoutModuleServiceInstance } from '../../../src/runtime/capabilities/layout'
import type { CompiledScene } from '../../../src/scene/compiled'

describe('LayoutComponent V2', () => {
  it('declares its template and layout service without exposing outlet registration methods', () => {
    const declared: string[][] = []
    const component = new LayoutComponent({
      perso: {
        id: 'page-layout',
        storyId: 'main',
        initial: {
          markup: '<section><main data-part="page-layout:content"></main></section>',
        },
      },
      services: {
        declare(names) {
          declared.push([...names])
        },
        apply: vi.fn(),
      },
    })

    expect(component.render()).toContain('data-part="page-layout:content"')
    expect(declared).toEqual([['layout', 'className', 'style', 'attr']])
  })

  it('projects resolved state through the component root', () => {
    const apply = vi.fn()
    const component = new LayoutComponent({
      perso: {
        id: 'page-layout',
        storyId: 'main',
        initial: { markup: '<section></section>' },
      },
      services: { declare: () => undefined, apply },
    })
    const root = {}
    component._materialize(root, [])

    component.update({ state: { className: 'active' }, timeMs: 0 })

    expect(apply).toHaveBeenCalledWith(root, { className: 'active' })
  })

  it('rejects an empty layout template before materialization', () => {
    const component = new LayoutComponent({
      perso: { id: 'empty-layout', storyId: 'main', initial: { markup: '  ' } },
      services: { declare: () => undefined, apply: () => undefined },
    })

    expect(() => component.render()).toThrow('Layout markup must not be empty: empty-layout')
  })

  it('registers public materialized parts and cleans them up with the component', () => {
    const layout = createLayoutModuleServiceDefinition().create({
      playerId: 'player',
      compiledScene: {} as CompiledScene,
    }) as LayoutModuleServiceInstance
    const component = new LayoutComponent({
      perso: {
        id: 'page-layout',
        storyId: 'main',
        initial: { markup: '<main data-part="page-layout:content"></main>' },
      },
      services: { declare: () => undefined, apply: vi.fn() },
    })

    const cleanup = materializeComponentWithLayout(layout, {
      component,
      identity: { componentId: 'page-layout', storyId: 'main', componentType: 'layout' },
      rootNode: {},
      parts: [{ partId: 'page-layout:content', nodeRef: {} }],
      publicParts: [{ partId: 'page-layout:content', nodeRef: {} }],
    })

    expect(layout.resolveTarget('page-layout:content')).toBeDefined()
    cleanup()
    expect(layout.resolveTarget('page-layout:content')).toBeUndefined()
  })
})
