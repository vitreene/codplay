import { describe, expect, it, vi } from 'vitest'

import { TagComponent } from '../../../src/runtime/components'
import type { TagState } from '../../../src/runtime/components'

describe('TagComponent V2', () => {
  it('uses the contract default when the author omits the root tag', () => {
    const component = new TagComponent({
      perso: {
        id: 'default-tag',
        storyId: 'main',
        initial: {} as TagState,
      },
      services: { apply: vi.fn() },
    })

    expect(component.render()).toBe('<div></div>')
  })
})
