import { describe, expect, it } from 'vitest'
import { createDomComponentServiceCatalog } from '../../../src/runtime/runner'

type TestElement = {
  className: string
  style: Record<string, string> & { setProperty: (property: string, value: string) => void }
  textContent: string | null
  attributes: Map<string, string>
  setAttribute: (name: string, value: string) => void
  removeAttribute: (name: string) => void
}

/** Creates the small element double consumed by the DOM services. */
function element(): TestElement {
  const style = { setProperty: (property: string, value: string) => { style[property] = value } } as TestElement['style']
  const attributes = new Map<string, string>()
  return {
    className: '',
    style,
    textContent: null,
    attributes,
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
  }
}

describe('DOM component services', () => {
  it('reconciles class, style, attributes and content values', () => {
    const catalog = createDomComponentServiceCatalog()
    const services = catalog.createInstances({ componentId: 'item', storyId: 'main', componentType: 'tag' })
    const node = element()

    services.get('className')?.apply(node, 'active')
    services.get('style')?.apply(node, { opacity: 0.5, color: { kind: 'color', space: 'srgb', coords: [1, 0, 0], alpha: 1 } })
    services.get('attr')?.apply(node, { role: 'button', hidden: false })
    services.get('content')?.apply(node, 'Hello')

    expect(node.className).toBe('active')
    expect(node.style.opacity).toBe('0.5')
    expect(node.style.color).toBe('rgba(255, 0, 0, 1)')
    expect(node.attributes).toEqual(new Map([['role', 'button']]))
    expect(node.textContent).toBe('Hello')
  })

  it('removes previously managed style and attribute values', () => {
    const catalog = createDomComponentServiceCatalog()
    const services = catalog.createInstances({ componentId: 'item', storyId: 'main', componentType: 'tag' })
    const node = element()
    const style = services.get('style')!
    const attr = services.get('attr')!

    style.apply(node, { opacity: 1, color: 'red' })
    attr.apply(node, { role: 'button', title: 'old' })
    style.apply(node, { opacity: 0 })
    attr.apply(node, { role: 'link' })

    expect(node.style.opacity).toBe('0')
    expect(node.style.color).toBe('')
    expect(node.attributes).toEqual(new Map([['role', 'link']]))
  })

  it('composes x and y aliases into one CSS translation', () => {
    const catalog = createDomComponentServiceCatalog()
    const services = catalog.createInstances({ componentId: 'item', storyId: 'main', componentType: 'tag' })
    const node = element()
    const style = services.get('style')!

    style.apply(node, { x: '25%', y: 40 })
    expect(node.style.transform).toBe('translate(25%, 40px)')

    style.apply(node, { x: 10 })
    expect(node.style.transform).toBe('translate(10px, 0px)')
  })
})
