/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import { materializeTemplateString } from '../../../src/runtime/components'
import { sanitizeMarkupTemplate } from '../../../src/runtime/capabilities/markup'

describe('template-string materializer', () => {
  it('materializes an HTML template and consumes data-part markers', () => {
    const result = materializeTemplateString(sanitizeMarkupTemplate(`
      <section>
        <main data-part="content"></main>
        <aside data-part="aside"></aside>
      </section>
    `, 'test.markup'))

    expect(result.rootNode).toBeInstanceOf(HTMLElement)
    expect(result.parts.map((part) => part.partId)).toEqual(['content', 'aside'])
    expect((result.rootNode as Element).querySelector('[data-part]')).toBeNull()
  })

  it('rejects duplicate data-part identifiers', () => {
    expect(() => sanitizeMarkupTemplate(`
      <section>
        <main data-part="content"></main>
        <aside data-part="content"></aside>
      </section>
    `, 'test.markup')).toThrow('test.markup: data-part is duplicated: content.')
  })
})
