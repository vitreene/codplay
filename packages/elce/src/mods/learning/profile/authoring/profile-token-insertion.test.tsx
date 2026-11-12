// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from 'remix/component/test'
import type { LearningPage } from '../../document/learning-document-types'
import { createPageLinkToken } from '../../inline-text/learning-inline-text-value'
import type { ProfileProperty } from '../domain/learning-profile-types'
import { renderProfileTokenInsertion } from './profile-token-insertion'
import { PROFILE_TOKEN_INSERT_EVENT } from './profile-token-events'
import type { InlineTextLabelSelection, InlineTextLabelUpdateDetail } from './profile-token-events'

const property: ProfileProperty = {
  id: 'profile-region',
  name: 'region',
  label: 'Région',
  type: 'text',
  required: false,
  choices: [],
}

const pages: readonly LearningPage[] = [
  { id: 'page-a', name: 'Page A', type: 'flux', chapterId: null, bdcIds: [] },
  { id: 'page-b', name: 'Page B', type: 'diapo', chapterId: null, bdcIds: [] },
]

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
      const button = rendered.$('#profile-token-test-tools-profile-profile-region')
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
      inserted.push((event as CustomEvent<{ kind: 'profile'; propertyId: string }>).detail.propertyId)
    })

    await rendered.act(() => rendered.$('#profile-token-rich-tools-profile-profile-region')?.click())
    expect(inserted).toEqual(['profile-region'])
    expect(rendered.$('#profile-token-rich-tools-profile-profile-region')).not.toBeNull()
    rendered.cleanup()
  })

  it('selects one page destination and inserts it with the single link action', async () => {
    const rendered = render(<div id="profile-token-page-test-host">
      <input id="profile-token-page-target" data-elce-profile-token-target="true" defaultValue="Bonjour monde" />
      {renderProfileTokenInsertion('profile-token-page-tools', [], 'profile-token-page-target', pages)}
    </div>)
    const input = rendered.$('#profile-token-page-target') as HTMLInputElement
    const pageGroup = rendered.$('#profile-token-page-tools-page-group') as HTMLElement
    const pageSelect = rendered.$('#profile-token-page-tools-page-target') as HTMLSelectElement
    const insertButton = rendered.$('#profile-token-page-tools-page-insert') as HTMLButtonElement

    expect(rendered.$('#profile-token-page-tools-page-list')).toBeNull()
    expect(rendered.$('#profile-token-page-tools-page-page-a')).toBeNull()
    expect(rendered.$('#profile-token-page-tools-page-page-b')).toBeNull()
    expect(pageGroup.querySelectorAll('button')).toHaveLength(1)
    expect(Array.from(pageSelect.options).map((option) => option.textContent)).toEqual([
      'Choisir une page', 'Page A', 'Page B',
    ])
    expect(insertButton.disabled).toBe(true)

    pageSelect.value = 'page-b'
    await rendered.act(() => pageSelect.dispatchEvent(new Event('change', { bubbles: true })))
    expect(insertButton.disabled).toBe(false)
    expect(insertButton.getAttribute('aria-label')).toBe('Insérer un lien vers Page B')

    const labelInput = rendered.$('#profile-token-page-tools-page-label') as HTMLInputElement
    const presentationSelect = rendered.$('#profile-token-page-tools-page-presentation') as HTMLSelectElement
    labelInput.value = 'Ouvrir la suite'
    presentationSelect.value = 'button'
    input.focus()
    input.setSelectionRange(8, 13)
    await rendered.act(() => {
      insertButton.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      insertButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(input.value).toBe(`Bonjour ${createPageLinkToken({
      pageId: 'page-b',
      label: 'Ouvrir la suite',
      fallbackLabel: 'Page B',
      presentation: 'button',
    })}`)
    rendered.cleanup()
  })

  it('loads and updates a selected profile label through the Variables panel', async () => {
    const selectedLabel: InlineTextLabelSelection = {
      targetId: 'profile-token-edit-target',
      position: 3,
      label: { kind: 'profile', propertyId: property.id },
    }
    const rendered = render(<div id="profile-token-edit-host">
      <div id="profile-token-edit-target" contentEditable={true} data-elce-profile-token-target="true" />
      {renderProfileTokenInsertion('profile-token-edit-tools', [property], selectedLabel.targetId, [], selectedLabel)}
    </div>)
    const target = rendered.$('#profile-token-edit-target') as HTMLElement
    const updates: InlineTextLabelUpdateDetail[] = []
    target.addEventListener('elce:inline-text-label-update', (event) => {
      updates.push((event as CustomEvent<InlineTextLabelUpdateDetail>).detail)
    })

    expect((rendered.$('#profile-token-edit-tools-selected-label-profile-property') as HTMLSelectElement).value)
      .toBe(property.id)
    await rendered.act(() => rendered.$('#profile-token-edit-tools-selected-label-update')?.click())

    expect(updates).toEqual([{
      position: selectedLabel.position,
      expected: selectedLabel.label,
      label: { kind: 'profile', propertyId: property.id },
    }])
    rendered.cleanup()
  })

  it('loads and updates a selected page link destination, label, and presentation', async () => {
    const selectedLabel: InlineTextLabelSelection = {
      targetId: 'profile-token-edit-link-target',
      position: 4,
      label: {
        kind: 'page-link',
        pageId: 'page-a',
        label: 'Continuer',
        fallbackLabel: 'Page A',
        presentation: 'text',
      },
    }
    const rendered = render(<div id="profile-token-edit-link-host">
      <div id="profile-token-edit-link-target" contentEditable={true} data-elce-profile-token-target="true" />
      {renderProfileTokenInsertion('profile-token-edit-link-tools', [], selectedLabel.targetId, pages, selectedLabel)}
    </div>)
    const target = rendered.$('#profile-token-edit-link-target') as HTMLElement
    const createTab = rendered.$('#profile-token-edit-link-tools-create-tab') as HTMLButtonElement
    const editTab = rendered.$('#profile-token-edit-link-tools-edit-tab') as HTMLButtonElement
    const createPanel = rendered.$('#profile-token-edit-link-tools-create-panel') as HTMLElement
    const editPanel = rendered.$('#profile-token-edit-link-tools-edit-panel') as HTMLElement
    const updates: InlineTextLabelUpdateDetail[] = []
    target.addEventListener('elce:inline-text-label-update', (event) => {
      updates.push((event as CustomEvent<InlineTextLabelUpdateDetail>).detail)
    })

    expect(createTab.getAttribute('aria-selected')).toBe('false')
    expect(editTab.getAttribute('aria-selected')).toBe('true')
    expect(createPanel.hidden).toBe(true)
    expect(editPanel.hidden).toBe(false)
    expect(editPanel.querySelector('#profile-token-edit-link-tools-selected-label-profile-fields')).toBeNull()
    expect(editPanel.querySelector('#profile-token-edit-link-tools-selected-label-date-fields')).toBeNull()
    expect(editPanel.querySelector('#profile-token-edit-link-tools-selected-label-page-fields')).not.toBeNull()

    await rendered.act(() => createTab.click())
    expect(createTab.getAttribute('aria-selected')).toBe('true')
    expect(editTab.getAttribute('aria-selected')).toBe('false')
    expect(createPanel.hidden).toBe(false)
    expect(editPanel.hidden).toBe(true)
    await rendered.act(() => editTab.click())
    expect(createPanel.hidden).toBe(true)
    expect(editPanel.hidden).toBe(false)

    expect((rendered.$('#profile-token-edit-link-tools-selected-label-page-target') as HTMLSelectElement).value)
      .toBe('page-a')
    expect((rendered.$('#profile-token-edit-link-tools-selected-label-page-label') as HTMLInputElement).value)
      .toBe('Continuer')

    const pageTarget = rendered.$('#profile-token-edit-link-tools-selected-label-page-target') as HTMLSelectElement
    const labelInput = rendered.$('#profile-token-edit-link-tools-selected-label-page-label') as HTMLInputElement
    const presentation = rendered.$('#profile-token-edit-link-tools-selected-label-page-presentation') as HTMLSelectElement
    pageTarget.value = 'page-b'
    labelInput.value = 'Voir la suite'
    presentation.value = 'button'
    await rendered.act(() => rendered.$('#profile-token-edit-link-tools-selected-label-update')?.click())

    expect(updates).toEqual([{
      position: selectedLabel.position,
      expected: selectedLabel.label,
      label: {
        kind: 'page-link',
        pageId: 'page-b',
        label: 'Voir la suite',
        fallbackLabel: 'Page B',
        presentation: 'button',
      },
    }])
    rendered.cleanup()
  })

  it('loads and updates a selected local-date label and its offset', async () => {
    const selectedLabel: InlineTextLabelSelection = {
      targetId: 'profile-token-edit-date-target',
      position: 5,
      label: { kind: 'local-date', dateKind: 'relative', offsetDays: -3 },
    }
    const rendered = render(<div id="profile-token-edit-date-host">
      <div id="profile-token-edit-date-target" contentEditable={true} data-elce-profile-token-target="true" />
      {renderProfileTokenInsertion('profile-token-edit-date-tools', [], selectedLabel.targetId, [], selectedLabel)}
    </div>)
    const target = rendered.$('#profile-token-edit-date-target') as HTMLElement
    const updates: InlineTextLabelUpdateDetail[] = []
    target.addEventListener('elce:inline-text-label-update', (event) => {
      updates.push((event as CustomEvent<InlineTextLabelUpdateDetail>).detail)
    })
    expect((rendered.$('#profile-token-edit-date-tools-selected-label-date-offset') as HTMLInputElement).value)
      .toBe('-3')
    const offset = rendered.$('#profile-token-edit-date-tools-selected-label-date-offset') as HTMLInputElement
    offset.value = '2'
    await rendered.act(() => rendered.$('#profile-token-edit-date-tools-selected-label-update')?.click())

    expect(updates).toEqual([{
      position: selectedLabel.position,
      expected: selectedLabel.label,
      label: { kind: 'local-date', dateKind: 'relative', offsetDays: 2 },
    }])
    rendered.cleanup()
  })
})
