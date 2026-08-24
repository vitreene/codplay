import { describe, expect, it, vi } from 'vitest'

import { sanitizeTagInitial, TagComponent } from '../../../src/runtime/components'
import type { TagInitial } from '../../../src/runtime/components'

describe('TagComponent V2', () => {
  it('uses the contract default when the author omits the root tag', () => {
    const component = new TagComponent({
      perso: {
        id: 'default-tag',
        storyId: 'main',
        initial: sanitizeTagInitial({}) as TagInitial,
      },
      services: { apply: vi.fn() },
    })

    expect(component.render()).toBe('<div></div>')
  })
})
