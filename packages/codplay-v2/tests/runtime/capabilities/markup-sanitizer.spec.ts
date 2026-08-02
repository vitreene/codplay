import { describe, expect, it } from 'vitest'
import { sanitizeMarkupTemplate } from '../../../src/runtime/capabilities/markup'
import { STYLE_SERVICE } from '../../../src/services'

describe('sanitizeMarkupTemplate', () => {
  it('produces a serializable tree and public part paths without using the DOM', () => {
    const markup = sanitizeMarkupTemplate(`
      <section class="shell">
        <main data-part="content">Hello &amp; welcome</main>
      </section>
    `, 'layout.initial.markup')

    expect(markup).toBe('<section class="shell"><main data-part="content">Hello &amp; welcome</main></section>')
  })

  it.each([
    ['script element', '<script>alert(1)</script>'],
    ['event attribute', '<button onclick="alert(1)"></button>'],
    ['inline style', '<div style="color:red"></div>'],
  ])('rejects %s at compilation', (_label, markup) => {
    expect(() => sanitizeMarkupTemplate(markup, 'layout.initial.markup')).toThrow()
  })

  it('rejects malformed nesting and duplicate public parts', () => {
    expect(() => sanitizeMarkupTemplate('<section><span></section>', 'layout.initial.markup'))
      .toThrow('mismatched closing tag')
    expect(() => sanitizeMarkupTemplate(
      '<section><main data-part="content"></main><aside data-part="content"></aside></section>',
      'layout.initial.markup',
    )).toThrow('data-part is duplicated')
  })

  it('leaves URL policy to preload or the resource service', () => {
    expect(sanitizeMarkupTemplate('<a href="custom-scheme:value">x</a>', 'layout.initial.markup'))
      .toBe('<a href="custom-scheme:value">x</a>')
  })

  it('delegates CSS markup values to the style service without narrowing modern syntax', () => {
    expect(sanitizeMarkupTemplate(
      '<div style="color:color-mix(in srgb, red 40%, blue); transform:translateX(calc(10px + 2vw))"></div>',
      'layout.initial.markup',
      [STYLE_SERVICE.sanitizeMarkupAttribute!],
    )).toContain('color-mix(in srgb, red 40%, blue)')
  })
})
