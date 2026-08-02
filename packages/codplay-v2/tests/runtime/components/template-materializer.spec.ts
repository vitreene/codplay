/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import { materializeTemplateString } from '../../../src/runtime/components'

describe('template-string materializer', () => {
  it('materializes an HTML template and consumes data-part markers', () => {
    const result = materializeTemplateString(`
      <section>
        <main data-part="content"></main>
        <aside data-part="aside"></aside>
      </section>
    `)

    expect(result.rootNode).toBeInstanceOf(HTMLElement)
    expect(result.parts.map((part) => part.partId)).toEqual(['content', 'aside'])
    expect((result.rootNode as Element).querySelector('[data-part]')).toBeNull()
  })

  it('rejects duplicate data-part identifiers', () => {
    expect(() => materializeTemplateString(`
      <section>
        <main data-part="content"></main>
        <aside data-part="content"></aside>
      </section>
    `)).toThrow('Component data-part is duplicated: content')
  })
})
