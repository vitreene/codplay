// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from 'remix/ui/test'
import type { ProfileProperty } from '../domain/learning-profile-types'
import { renderProfileTokenInsertion } from './profile-token-insertion'
import { PROFILE_TOKEN_INSERT_EVENT } from './profile-token-events'

const property: ProfileProperty = {
  id: 'profile-region',
  name: 'region',
  label: 'Région',
  type: 'text',
  required: false,
  choices: [],
}

describe('profile token insertion', () => {
  it('inserts the stable property reference at the focused field selection', async () => {
    const rendered = render(<div id="profile-token-test-host">
      <input id="profile-token-target" data-elce-profile-token-target="true" defaultValue="Bonjour monde" />
      {renderProfileTokenInsertion('profile-token-test-tools', [property], 'profile-token-target')}
    </div>)
    const input = rendered.$('#profile-token-target') as HTMLInputElement
    input.focus()
    input.setSelectionRange(8, 13)
    expect(document.activeElement).toBe(input)
    expect(input.dataset.elceProfileTokenTarget).toBe('true')

    await rendered.act(() => {
      const button = rendered.$('#profile-token-test-tools-profile-region')
      button?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(input.value).toBe('Bonjour {{profile:profile-region}}')
    rendered.cleanup()
  })

  it('routes insertion to the selected rich-text target without exposing controls elsewhere', async () => {
    const rendered = render(<div id="profile-token-rich-test-host">
      <div id="profile-token-rich-target" contentEditable={true} data-elce-profile-token-target="true" />
      <div id="profile-token-unrelated-target" />
      {renderProfileTokenInsertion('profile-token-rich-tools', [property], 'profile-token-rich-target')}
    </div>)
    const richTarget = rendered.$('#profile-token-rich-target') as HTMLElement
    const inserted: string[] = []
    richTarget.addEventListener(PROFILE_TOKEN_INSERT_EVENT, (event) => {
      inserted.push((event as CustomEvent<{ propertyId: string }>).detail.propertyId)
    })

    await rendered.act(() => rendered.$('#profile-token-rich-tools-profile-region')?.click())
    expect(inserted).toEqual(['profile-region'])
    expect(rendered.$('#profile-token-rich-tools-profile-region')).not.toBeNull()
    rendered.cleanup()
  })
})
