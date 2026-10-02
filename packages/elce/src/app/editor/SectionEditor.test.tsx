/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { createInitialDocument } from '../../domain/document-model'
import { SectionEditor } from './SectionEditor'

describe('SectionEditor', () => {
  let root: ReturnType<typeof createRoot> | undefined

  afterEach(() => {
    root?.unmount()
    root = undefined
    document.body.replaceChildren()
  })

  it('renders the Tiptap editing surface for a Section', async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const section = createInitialDocument().bdcs[0]!
    root = createRoot(host)

    await act(async () => {
      root?.render(<SectionEditor bdc={section} onChange={() => undefined} />)
    })

    expect(host.querySelector(`#elce-editor-content-${section.id}`)).not.toBeNull()
    expect(host.querySelector('[contenteditable="true"]')).not.toBeNull()
    expect(host.querySelector(`#elce-section-title-${section.id}`)?.getAttribute('placeholder')).toBe('Titre (facultatif)')
    expect(host.querySelector(`#elce-editor-content-${section.id}`)?.getAttribute('data-placeholder')).toBe('Écrire le contenu…')
    const toolbarButtons = Array.from(host.querySelectorAll(`#elce-section-toolbar-${section.id} button`))
    expect(toolbarButtons.length).toBe(16)
    expect(toolbarButtons.every((button) => button.getAttribute('aria-label') !== null)).toBe(true)
    expect(toolbarButtons.every((button) => button.querySelector('svg') !== null)).toBe(true)
  })

  it('marks the commands active for the selected heading and text marks', async () => {
    const baseSection = createInitialDocument().bdcs[0]!
    const section = {
      ...baseSection,
      section: {
        ...baseSection.section!,
        content: {
          type: 'doc' as const,
          content: [{
            type: 'heading' as const,
            attrs: { level: 3 },
            content: [{ type: 'text' as const, text: 'Texte', marks: [{ type: 'italic' as const }] }],
          }, {
            type: 'paragraph' as const,
            content: [{ type: 'text' as const, text: 'Autre texte' }],
          }],
        },
      },
    }
    const host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)

    await act(async () => {
      root?.render(<SectionEditor bdc={section} onChange={() => undefined} />)
    })

    const headingText = host.querySelector(`#elce-editor-content-${section.id} h3`)?.firstChild
    expect(headingText).not.toBeNull()
    const editorContent = host.querySelector(`#elce-editor-content-${section.id}`) as HTMLElement
    editorContent.focus()
    const selection = window.getSelection()
    const headingRange = document.createRange()
    headingRange.selectNodeContents(headingText!)
    selection?.removeAllRanges()
    selection?.addRange(headingRange)
    await act(async () => {
      document.dispatchEvent(new Event('selectionchange'))
    })

    expect(host.querySelector(`#elce-section-italic-${section.id}`)?.getAttribute('aria-pressed')).toBe('true')
    expect(host.querySelector(`#elce-section-italic-${section.id}`)?.getAttribute('data-active')).toBe('true')
    expect(host.querySelector(`#elce-section-heading-3-${section.id}`)?.getAttribute('aria-pressed')).toBe('true')
    expect(host.querySelector(`#elce-section-heading-2-${section.id}`)?.getAttribute('aria-pressed')).toBe('false')

    const paragraphText = host.querySelector(`#elce-editor-content-${section.id} p`)?.firstChild
    expect(paragraphText).not.toBeNull()
    const range = document.createRange()
    range.selectNodeContents(paragraphText!)
    selection?.removeAllRanges()
    selection?.addRange(range)
    await act(async () => {
      document.dispatchEvent(new Event('selectionchange'))
    })

    expect(host.querySelector(`#elce-section-italic-${section.id}`)?.getAttribute('aria-pressed')).toBe('false')
    expect(host.querySelector(`#elce-section-paragraph-${section.id}`)?.getAttribute('aria-pressed')).toBe('true')
  })
})
