import { describe, expect, it, vi } from 'vitest'
import { LayoutComponent } from '../../../src/runtime/components'

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
})
