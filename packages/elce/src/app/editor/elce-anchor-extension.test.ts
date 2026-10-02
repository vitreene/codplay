/** @vitest-environment jsdom */

import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { NodeSelection } from '@tiptap/pm/state'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElceAnchorExtension, ElceAnchorExtension } from './elce-anchor-extension'

describe('Elcé anchor extension', () => {
  let editor: Editor | undefined

  afterEach(() => {
    editor?.destroy()
    editor = undefined
  })

  it('exports an anchor as a static span targeting a CodPlay part', () => {
    editor = new Editor({
      extensions: [StarterKit, ElceAnchorExtension],
      content: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Avant ' },
            { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } },
            { type: 'text', text: ' après' },
          ],
        }],
      },
    })

    const html = editor.getHTML()
    expect(html).toContain('id="page-a:bdc-image-1:anchor"')
    expect(html).toContain('data-elce-anchor="true"')
    expect(html).toContain('data-bdc-id="bdc-image-1"')
    expect(html).toContain('data-part="page-a:bdc-image-1:anchor"')
    expect(html).toContain('padding-bottom: 12rem')

    const restored = new Editor({ extensions: [StarterKit, ElceAnchorExtension], content: html })
    expect(restored.getJSON()).toMatchObject({
      content: [{
        content: [
          { text: 'Avant ' },
          { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } },
          { text: ' après' },
        ],
      }],
    })
    restored.destroy()
  })

  it('renders a draggable insertion handle in the editing surface', () => {
    const host = document.createElement('div')
    document.body.append(host)
    editor = new Editor({
      extensions: [StarterKit, ElceAnchorExtension],
      content: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } }],
        }],
      },
    })
    editor.mount(host)

    const anchor = host.querySelector('.elce-anchor')
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('draggable')).toBe('true')
    expect(anchor?.getAttribute('aria-label')).toBe('Bloc de contenu ancré')
    expect(anchor?.classList.contains('elce-anchor-placeholder')).toBe(true)
    expect(anchor?.querySelector('.elce-anchor-bdc')).not.toBeNull()
    expect(anchor?.querySelector('.elce-anchor-handle')?.getAttribute('draggable')).toBe('true')
  })

  it('renders the resolved media inside the reserved bdc area', () => {
    const host = document.createElement('div')
    document.body.append(host)
    editor = new Editor({
      extensions: [StarterKit, createElceAnchorExtension({ resolveMediaSource: () => 'blob:image-1' })],
      content: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', mediaId: 'media-image-1', mediaType: 'image', partId: 'page-a:bdc-image-1:anchor' } }],
        }],
      },
    })
    editor.mount(host)

    const placeholder = host.querySelector('.elce-anchor-placeholder')
    expect(placeholder?.querySelector('.elce-anchor-bdc img.elce-anchor-media-preview')?.getAttribute('src')).toBe('blob:image-1')
  })

  it('creates an image anchor from one external file drop', () => {
    const droppedFile = new File(['image'], 'photo.png', { type: 'image/png' })
    const onDropTarget = vi.fn(() => ({
      pageId: 'page-a',
      bdcId: 'bdc-image-1',
      mediaId: 'media-image-1',
      media: { id: 'media-image-1', type: 'image' as const, name: 'photo.png', mimeType: 'image/png', size: 5, caption: '' },
      bdcType: 'image' as const,
      presetId: 'image-basic',
      partId: 'page-a:bdc-image-1:anchor',
      paddingBottom: '75%',
    }))
    editor = new Editor({
      extensions: [StarterKit, createElceAnchorExtension({ createFileDropTarget: onDropTarget })],
      content: '<p>Avant après</p>',
    })
    vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos: 7, inside: -1 })
    const event = {
      clientX: 10,
      clientY: 10,
      dataTransfer: { files: [droppedFile] },
    } as unknown as DragEvent

    const handled = editor.view.someProp('handleDrop', (handler) => handler(editor!.view, event, editor!.state.doc.slice(1, 1), false))

    expect(handled).toBe(true)
    expect(onDropTarget).toHaveBeenCalledWith(droppedFile)
    expect(editor.getJSON()).toMatchObject({
      content: [{ content: [
        { type: 'text', text: 'Avant ' },
        { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', mediaId: 'media-image-1', mediaType: 'image', partId: 'page-a:bdc-image-1:anchor', paddingBottom: '75%' } },
        { type: 'text', text: 'après' },
      ] }],
    })
  })

  it('moves an anchor through the editor drop transaction and emits its bdc id', () => {
    editor = new Editor({
      extensions: [StarterKit, ElceAnchorExtension],
      content: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Avant ' },
            { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } },
            { type: 'text', text: ' après' },
          ],
        }],
      },
    })
    vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos: 1, inside: -1 })
    editor.commands.setNodeSelection(7)
    const anchorPosition = editor.state.selection instanceof NodeSelection ? editor.state.selection.from : 7
    const slice = editor.state.doc.slice(anchorPosition, anchorPosition + 1)
    const event = { clientX: 10, clientY: 10, dataTransfer: { files: [] } } as unknown as DragEvent

    const handled = editor.view.someProp('handleDrop', (handler) => handler(editor!.view, event, slice, true))

    expect(handled).toBe(true)
    expect(editor.getJSON()).toMatchObject({
      content: [{ content: [{ type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1' } }, { type: 'text', text: 'Avant  après' }] }],
    })
  })
})
