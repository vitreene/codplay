import { describe, expect, it } from 'vitest'

import { sanitizeTagInitial, TagComponent } from '../../../src/runtime/components'
import type { ComponentServices, TagInitial } from '../../../src/runtime/components'

/** Creates the minimal service boundary required by direct component tests. */
function testServices(): ComponentServices {
  return {
    declare: () => undefined,
    get: () => ({ apply: () => undefined }),
    apply: () => undefined,
  }
}

describe('TagComponent V2', () => {
  it('uses the contract default when the author omits the root tag', () => {
    const component = new TagComponent({
      perso: {
        id: 'default-tag',
        storyId: 'main',
        initial: sanitizeTagInitial({}) as TagInitial,
      },
      services: testServices(),
    })

    expect(component.render()).toBe('<div></div>')
  })
})
