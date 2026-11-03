/** @vitest-environment jsdom */

import { Editor } from '@tiptap/core'
import { afterEach, describe, expect, it } from 'vitest'
import { SECTION_EDITOR_EXTENSIONS, readSectionToolbarState } from '../authoring/section-editor-tiptap'

const editors: Editor[] = []

/** Mounts the actual Section schema on a test-owned editable host. */
function createEditor(content = '<p><strong>Entrée</strong><em>24 €</em></p>') {
  const host = document.createElement('div')
  document.body.append(host)
  const editor = new Editor({ element: host, extensions: SECTION_EDITOR_EXTENSIONS, content })
  editors.push(editor)
  return editor
}

afterEach(() => {
  editors.splice(0).forEach((editor) => editor.destroy())
  document.body.replaceChildren()
})

describe('Section dot-leader paragraphs', () => {
  it('splits at the caret, preserves both marks and reunites the original paragraph', () => {
    const editor = createEditor()
    const original = editor.getJSON()
    editor.commands.setTextSelection(7)
    expect(editor.commands.toggleDotLeader()).toBe(true)
    expect(readSectionToolbarState(editor).dotLeader).toBe(true)
    expect(editor.getJSON().content?.[0]).toMatchObject({
      type: 'dotLeaderParagraph',
      content: [
        { type: 'dotLeaderText', content: [{ type: 'text', text: 'Entrée', marks: [{ type: 'bold' }] }] },
        { type: 'dotLeaderText', content: [{ type: 'text', text: '24 €', marks: [{ type: 'italic' }] }] },
      ],
    })
    expect(editor.state.selection.$from.parent.textContent).toBe('24 €')
    expect(editor.state.selection.$from.parentOffset).toBe(0)
    expect(editor.view.dom.querySelector('.elce-dot-leader-rule')?.textContent).toBe('')
    expect(editor.view.dom.querySelector('.elce-dot-leader-rule')?.getAttribute('aria-hidden')).toBe('true')
    expect(editor.commands.toggleDotLeader()).toBe(true)
    expect(editor.getJSON()).toEqual(original)
    expect(editor.state.selection.from).toBe(7)
    expect(readSectionToolbarState(editor).dotLeader).toBe(false)
  })

  it('round-trips the row through HTML and JSON without exposing the decorative rule as content', () => {
    const editor = createEditor()
    editor.commands.setTextSelection(7)
    editor.commands.toggleDotLeader()
    const content = editor.getJSON()
    const markup = editor.getHTML()
    const reopened = createEditor(markup)
    expect(reopened.getJSON()).toEqual(content)
    expect(reopened.getHTML()).toBe(markup)
    reopened.commands.setContent(content)
    expect(reopened.getHTML()).toBe(markup)
    expect(Array.from(reopened.view.dom.querySelectorAll('p, span[data-elce-dot-leader-text], .elce-dot-leader-content'))
      .every((element) => element.id.length > 0)).toBe(true)
  })

  it('uses the start of a text selection as the separator without deleting the selected text', () => {
    const editor = createEditor()
    const original = editor.getJSON()
    editor.commands.setTextSelection({ from: 3, to: 10 })
    editor.commands.toggleDotLeader()
    expect(editor.state.doc.firstChild?.child(0).textContent).toBe('En')
    expect(editor.state.doc.firstChild?.child(1).textContent).toBe('trée24 €')
    editor.commands.toggleDotLeader()
    expect(editor.getJSON()).toEqual(original)
  })

  it('keeps paragraph neighbors and creates editable empty left or right sides', () => {
    const editor = createEditor('<p>Avant</p><p>Valeur</p><p>Après</p>')
    editor.commands.setTextSelection(8)
    editor.commands.toggleDotLeader()
    expect(editor.getJSON().content?.map((node) => node.type)).toEqual(['paragraph', 'dotLeaderParagraph', 'paragraph'])
    expect(editor.state.doc.child(1).child(0).textContent).toBe('')
    editor.commands.insertContent('Suffixe')
    expect(editor.state.doc.child(1).child(1).textContent).toBe('SuffixeValeur')
    editor.commands.toggleDotLeader()
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    editor.commands.toggleDotLeader()
    expect(editor.state.doc.lastChild?.child(1).textContent).toBe('')
    editor.commands.insertContent('Fin')
    expect(editor.state.doc.lastChild?.child(1).textContent).toBe('Fin')
  })

  it('leaves the complete row with Enter and resumes ordinary paragraph editing', () => {
    const editor = createEditor()
    editor.commands.setTextSelection(7)
    editor.commands.toggleDotLeader()
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(editor.getJSON().content?.map((node) => node.type)).toEqual(['dotLeaderParagraph', 'paragraph'])
    expect(editor.state.selection.$from.parent.type.name).toBe('paragraph')
    editor.commands.insertContent('Suite')
    expect(editor.state.doc.lastChild?.textContent).toBe('Suite')
    expect(editor.state.doc.firstChild?.textContent).toBe('Entrée24 €')
  })

  it('removes the separator with Backspace at the start of the right text', () => {
    const editor = createEditor()
    editor.commands.setTextSelection(7)
    editor.commands.toggleDotLeader()
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true }))
    expect(editor.state.doc.firstChild?.type.name).toBe('paragraph')
    expect(editor.state.doc.textContent).toBe('Entrée24 €')
    expect(editor.state.selection.from).toBe(7)
  })

  it('removes the separator with Delete at the end of the left text', () => {
    const editor = createEditor()
    editor.commands.setTextSelection(7)
    editor.commands.toggleDotLeader()
    editor.commands.setTextSelection(8)
    editor.view.dom.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }))
    expect(editor.state.doc.firstChild?.type.name).toBe('paragraph')
    expect(editor.state.doc.textContent).toBe('Entrée24 €')
    expect(editor.state.selection.from).toBe(7)
  })

  it('refuses headings and multi-paragraph selections without changing their document', () => {
    const editor = createEditor('<h2>Titre</h2><p>Texte</p>')
    const original = editor.getJSON()
    editor.commands.setTextSelection(2)
    expect(editor.commands.toggleDotLeader()).toBe(false)
    editor.commands.setTextSelection({ from: 2, to: 10 })
    expect(editor.commands.toggleDotLeader()).toBe(false)
    expect(editor.getJSON()).toEqual(original)
  })

  it('refuses to remove a leader format when the selection also covers another paragraph', () => {
    const editor = createEditor('<p>Libellé42</p><p>Suite</p>')
    editor.commands.setTextSelection(8)
    editor.commands.toggleDotLeader()
    const original = editor.getJSON()
    editor.commands.setTextSelection({ from: 2, to: editor.state.doc.content.size - 1 })
    expect(editor.commands.toggleDotLeader()).toBe(false)
    expect(editor.getJSON()).toEqual(original)
  })
})
