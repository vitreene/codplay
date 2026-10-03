/** @vitest-environment jsdom */

import { Editor } from '@tiptap/core'
import { Fragment, Slice } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'
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
    expect(html).toContain('--elce-anchor-padding: 12rem')
    expect(html).toContain('padding-bottom: calc(1lh + 1rem + 1rem + 12rem)')
    expect(html).toContain('vertical-align: top')
    expect(html).not.toContain('margin-inline-end')

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
    expect(anchor?.getAttribute('style')).toContain('width: 0px')
    expect(anchor?.querySelector('.elce-anchor-bdc')).not.toBeNull()
    expect(anchor?.getAttribute('style')).toContain('--elce-anchor-padding: 12rem')
    expect(anchor?.getAttribute('style')).toContain('padding-bottom: calc(1lh + 1rem + 1rem + 12rem)')
    expect(anchor?.getAttribute('style')).toContain('vertical-align: top')
    expect(anchor?.getAttribute('style')).not.toContain('margin-inline-end')
    expect(anchor?.getAttribute('style')).toContain('anchor-name: --anchor-page-a-bdc-image-1-anchor')
    expect(anchor?.querySelector('.elce-anchor-bdc')?.getAttribute('style')).toContain('position-anchor: --anchor-page-a-bdc-image-1-anchor')
    expect(anchor?.querySelector('.elce-anchor-bdc')?.getAttribute('style')).toContain('inset-block-start: calc((1lh + 1rem) + anchor(top))')
    expect(anchor?.querySelector('.elce-anchor-handle')?.getAttribute('draggable')).toBe('true')
    expect(anchor?.querySelector('.elce-anchor-handle')?.parentElement).toBe(anchor)
    expect(anchor?.querySelector('.elce-anchor-bdc')?.querySelector('.elce-anchor-handle')).toBeNull()
    expect(anchor?.querySelector('.elce-anchor-handle')?.getAttribute('style')).toContain('position-anchor: --anchor-page-a-bdc-image-1-anchor')
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
    const host = document.createElement('div')
    document.body.append(host)
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
    editor.mount(host)
    vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos: 1, inside: -1 })
    const handle = host.querySelector('.elce-anchor-handle')
    const interactionPlugin = editor.state.plugins.find((plugin) => plugin.props.handleDrop && plugin.props.handleDOMEvents?.dragstart)
    expect(handle).not.toBeNull()
    const dragStart = interactionPlugin?.props.handleDOMEvents?.dragstart
    if (dragStart && interactionPlugin) dragStart.call(interactionPlugin, editor.view, { target: handle } as unknown as DragEvent)
    const anchorPosition = 7
    const slice = editor.state.doc.slice(anchorPosition, anchorPosition + 1)
    const event = { clientX: 10, clientY: 10, dataTransfer: { files: [] } } as unknown as DragEvent

    const handled = editor.view.someProp('handleDrop', (handler) => handler(editor!.view, event, slice, true))

    expect(handled).toBe(true)
    expect(editor.getJSON()).toMatchObject({
      content: [{ content: [{ type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1' } }, { type: 'text', text: 'Avant  après' }] }],
    })
  })

  it('prevents copying a unique bdc anchor into another editor position', () => {
    editor = new Editor({ extensions: [StarterKit, ElceAnchorExtension], content: '<p>Texte</p>' })
    const paragraph = editor.schema.nodeFromJSON({
      type: 'paragraph',
      content: [
        { type: 'text', text: 'copié ' },
        { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } },
        { type: 'text', text: 'avec le reste' },
      ],
    })
    const slice = new Slice(Fragment.from(paragraph), 0, 0)
    const dropEvent = { dataTransfer: { files: [] } } as unknown as DragEvent
    const handledCopyDrop = editor.view.someProp('handleDrop', (handler) => handler(editor!.view, dropEvent, slice, false))
    const handledDropWithoutLocalSource = editor.view.someProp('handleDrop', (handler) => handler(editor!.view, dropEvent, slice, true))
    const anchorPlugin = editor.state.plugins.find((plugin) => plugin.props.transformPasted)
    const transformPasted = anchorPlugin?.props.transformPasted
    if (anchorPlugin === undefined || transformPasted === undefined) throw new Error('Le filtre de collage Elcé doit être installé.')

    const pasted = transformPasted.call(anchorPlugin, slice, editor.view, false)
    let pastedAnchorCount = 0
    pasted.content.descendants((node) => {
      if (node.type.name === 'elceAnchor') pastedAnchorCount += 1
    })

    expect(handledCopyDrop).toBe(true)
    expect(handledDropWithoutLocalSource).toBe(true)
    expect(pastedAnchorCount).toBe(0)
    expect(pasted.content.textBetween(0, pasted.content.size)).toBe('copié avec le reste')
  })
})
