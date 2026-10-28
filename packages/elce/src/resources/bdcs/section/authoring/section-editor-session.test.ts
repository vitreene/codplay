/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import type { SectionContent } from '../domain/section-types'
import { createAnchorTestPresetBuilder } from '../../../anchoring/authoring/anchor-test-fixtures'
import { SectionEditorSession } from './section-editor-session'
import { SectionTiptapAdapter } from './section-editor-tiptap-adapter'

describe('SectionEditorSession', () => {
  let session: SectionEditorSession | undefined
  const hosts: HTMLDivElement[] = []

  /** Creates a real Tiptap adapter for one test-owned Section value. */
  const createSectionAdapter = (bdcId: string, text: string): SectionTiptapAdapter => {
    const host = document.createElement('div')
    document.body.append(host)
    hosts.push(host)
    return new SectionTiptapAdapter(host, {
      bdcId,
      section: createSection(text),
      anchorOptions: { presetBuilder: createAnchorTestPresetBuilder() },
      onChange: () => undefined,
      onToolbarState: () => undefined,
    })
  }

  afterEach(() => {
    session?.destroy()
    session = undefined
    for (const host of hosts) host.remove()
    hosts.length = 0
  })

  it('keeps one adapter per Section, updates its content, and restores its selection', () => {
    session = new SectionEditorSession()
    const previous = createSectionAdapter('section-session-test', 'Texte initial')
    const current = createSectionAdapter('section-session-test', 'Texte courant')
    session.register('section-session-test', previous)
    session.register('section-session-test', current)

    expect(previous.editor.isDestroyed).toBe(true)
    expect(session.adapters.get('section-session-test')).toBe(current)

    session.updateSection('section-session-test', createSection('Texte actualisé'))
    expect(current.editor.getText()).toBe('Texte actualisé')

    session.restoreSelection({ sectionBdcId: 'section-session-test', anchor: 1, head: 4 })
    expect(current.editor.state.selection.anchor).toBe(1)
    expect(current.editor.state.selection.head).toBe(4)

    session.toolbarStates.set('section-session-test', {
      bold: true,
      italic: false,
      underline: false,
      subscript: false,
      superscript: false,
      paragraph: false,
      headingLevel: 0,
      textAlign: null,
    })
    session.unregister('section-session-test', previous)
    expect(session.adapters.get('section-session-test')).toBe(current)
    expect(current.editor.isDestroyed).toBe(false)

    session.unregister('section-session-test', current)
    expect(session.adapters.has('section-session-test')).toBe(false)
    expect(session.toolbarStates.has('section-session-test')).toBe(false)
    expect(current.editor.isDestroyed).toBe(true)
  })

  it('destroys every mounted adapter when the page editor closes', () => {
    session = new SectionEditorSession()
    const first = createSectionAdapter('section-session-a', 'Premier')
    const second = createSectionAdapter('section-session-b', 'Second')
    session.register('section-session-a', first)
    session.register('section-session-b', second)

    session.destroy()

    expect(first.editor.isDestroyed).toBe(true)
    expect(second.editor.isDestroyed).toBe(true)
    expect(session.adapters.size).toBe(0)
    expect(session.toolbarStates.size).toBe(0)
  })
})

/** Creates a minimal independent Section editor fixture with a text paragraph. */
function createSection(text: string): SectionContent {
  return {
    title: '',
    markup: `<p id="section-session-text">${text}</p>`,
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
    revelation: { intro: null, outro: null },
  }
}

