import { describe, expect, it } from 'vitest'
import { createHtmlAttrService } from '../../../src/services/attr/html-attr-service'
import { createHtmlClassNameService } from '../../../src/services/class-name/html-class-name-service'
import { createHtmlContentService } from '../../../src/services/content/html-content-service'
import { createHtmlStyleService } from '../../../src/services/style/html-style-service'
import type { RuntimeComponentServiceInstance } from '../../../src/runtime/catalog'

type TestElement = {
  className: string
  style: Record<string, string> & { setProperty: (property: string, value: string) => void }
  textContent: string | null
  attributes: Map<string, string>
  setAttribute: (name: string, value: string) => void
  removeAttribute: (name: string) => void
}

/** Creates the small element double consumed by the HTML materializer services. */
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

/** Creates the standard HTML service adapters for one materializer context. */
function createHtmlServices(context: { numericLengthScale: number } = { numericLengthScale: 1 }): ReadonlyMap<string, RuntimeComponentServiceInstance> {
  return new Map([
    ['className', createHtmlClassNameService()],
    ['style', createHtmlStyleService(context)],
    ['attr', createHtmlAttrService()],
    ['content', createHtmlContentService()],
  ])
}

describe('HTML component materializer services', () => {
  it('reconciles class, style, attributes and content values', () => {
    const catalog = createHtmlServices()
    const services = catalog
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
    const catalog = createHtmlServices()
    const services = catalog
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
    const catalog = createHtmlServices()
    const services = catalog
    const node = element()
    const style = services.get('style')!

    style.apply(node, { x: '25%', y: 40 })
    expect(node.style.transform).toBe('translate(25%, 40px)')

    style.apply(node, { x: 10 })
    expect(node.style.transform).toBe('translateX(10px)')

    style.apply(node, { y: 20 })
    expect(node.style.transform).toBe('translateY(20px)')
  })

  it('keeps canonical transform channels ordered and preserves authored units', () => {
    const catalog = createHtmlServices()
    const services = catalog
    const node = element()
    const style = services.get('style')!

    style.apply(node, {
      scale: 2,
      rotate: '20deg',
      translateZ: '3cqw',
      translateX: '10%',
      translateY: '4px',
    })

    expect(node.style.transform).toBe('translate(10%, 4px) translateZ(3cqw) rotate(20deg) scale(2)')
  })

  it('keeps a raw transform sequence separate from scalar channels', () => {
    const catalog = createHtmlServices()
    const services = catalog
    const node = element()
    const style = services.get('style')!
    const raw = 'translate(10px 20px) rotate(20deg) matrix(1, 0, 0, 1, 4, 5)'

    style.apply(node, { x: 6, transform: raw })
    expect(node.style.transform).toBe(`translateX(6px) ${raw}`)

    style.apply(node, { transform: raw })
    expect(node.style.transform).toBe(raw)
  })

  it('applies the runtime length scale only at the HTML boundary', () => {
    const context = { numericLengthScale: 2 }
    const catalog = createHtmlServices(context)
    const services = catalog
    const node = element()
    const style = services.get('style')!

    style.apply(node, { x: 20, perspective: 10, translate: '5 6' })
    expect(node.style.transform).toBe('perspective(20px) translateX(40px)')
    expect(node.style.translate).toBe('10px 12px')

    context.numericLengthScale = 3
    style.apply(node, { x: 20, perspective: 10, translate: '5 6' })
    expect(node.style.transform).toBe('perspective(30px) translateX(60px)')
    expect(node.style.translate).toBe('15px 18px')
  })
})
