/** @vitest-environment jsdom */

import { Editor } from '@tiptap/core'
import { Fragment, Slice } from '@tiptap/pm/model'
import StarterKit from '@tiptap/starter-kit'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ANCHOR_RETURN, CARD_IMAGE_FIT, CAROUSEL_IMAGE_POSITION, CATALOG_REFERENCE, DEFAULT_PRESET_ID } from '../../../config/document-config'
import { createElceAnchorExtension, ELCE_ANCHOR_TRANSACTION_META, ElceAnchorExtension } from './elce-anchor-extension'

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
    expect(html).not.toContain('data-media-id')
    expect(html).not.toContain('data-card-layout')
    expect(html).not.toContain('data-media-type')

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
      extensions: [StarterKit, createElceAnchorExtension({ resolveCard: () => ({
        content: { mediaId: 'media-image-1', overline: '', title: '', description: '', message: '', note: '', caption: '', imagePosition: CAROUSEL_IMAGE_POSITION.LEFT, imageFit: CARD_IMAGE_FIT.COVER },
        layoutId: DEFAULT_PRESET_ID.PHOTO,
        media: { source: 'blob:image-1', type: 'image' },
      }) })],
      content: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } }],
        }],
      },
    })
    editor.mount(host)

    const placeholder = host.querySelector('.elce-anchor-placeholder')
    expect(placeholder?.querySelector('.elce-anchor-bdc img.elce-anchor-media-preview')?.getAttribute('src')).toBe('blob:image-1')
  })

  it('renders authored text fields for a text Card inside its anchor preview', () => {
    const host = document.createElement('div')
    document.body.append(host)
    editor = new Editor({
      extensions: [StarterKit, createElceAnchorExtension({ resolveCard: () => ({
        content: {
          mediaId: null,
          overline: 'Citation',
          title: 'Un titre',
          description: 'Une description',
          message: 'Texte cité',
          note: 'Source',
          caption: '',
          imagePosition: CAROUSEL_IMAGE_POSITION.LEFT,
          imageFit: CARD_IMAGE_FIT.COVER,
        },
        layoutId: DEFAULT_PRESET_ID.TEXT_SHORT,
        media: null,
      }) })],
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'elceAnchor', attrs: { bdcId: 'bdc-text-1', partId: 'page-a:bdc-text-1:anchor' } }] }],
      },
    })
    editor.mount(host)

    const preview = host.querySelector('.elce-anchor-bdc article.elce-card--text-short')
    expect(preview?.querySelector('.elce-card-text-short__overline')?.textContent).toBe('Citation')
    expect(preview?.querySelector('.elce-card-text-short__title')?.textContent).toBe('Un titre')
    expect(preview?.querySelector('.elce-card-text-short__message')?.textContent).toBe('Texte cité')
    expect(preview?.querySelector('.elce-card-text-short__note')?.textContent).toBe('Source')
  })

  it('renders the existing Text with image layout, its content, and its compatible media', () => {
    const host = document.createElement('div')
    document.body.append(host)
    editor = new Editor({
      extensions: [StarterKit, createElceAnchorExtension({ resolveCard: () => ({
        content: {
          mediaId: 'media-image-1',
          overline: 'Repère',
          title: 'Titre',
          description: 'Description',
          message: 'Message',
          note: 'Note',
          caption: '',
          imagePosition: CAROUSEL_IMAGE_POSITION.RIGHT,
          imageFit: CARD_IMAGE_FIT.CONTAIN,
        },
        layoutId: DEFAULT_PRESET_ID.TEXT_IMAGE,
        media: { source: 'blob:image-1', type: 'image' },
      }) })],
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'elceAnchor', attrs: { bdcId: 'bdc-text-image', partId: 'page-a:bdc-text-image:anchor' } }] }],
      },
    })
    editor.mount(host)

    const preview = host.querySelector('.elce-anchor-bdc article.elce-card--text-image')
    expect(preview?.classList.contains('elce-carousel-view--image-right')).toBe(true)
    expect(preview?.querySelector('.elce-card-text-image__title')?.textContent).toBe('Titre')
    expect(preview?.querySelector('.elce-card-text-image__message')?.textContent).toBe('Message')
    const image = preview?.querySelector('.elce-carousel-text-image__image img')
    expect(image?.getAttribute('src')).toBe('blob:image-1')
    expect(image?.classList.contains('elce-anchor-card-media-preview--contain')).toBe(true)
  })

  it('renders the existing Image with caption layout and its caption and image', () => {
    const host = document.createElement('div')
    document.body.append(host)
    editor = new Editor({
      extensions: [StarterKit, createElceAnchorExtension({ resolveCard: () => ({
        content: {
          mediaId: 'media-image-2',
          overline: '',
          title: '',
          description: '',
          message: '',
          note: '',
          caption: 'Légende',
          imagePosition: CAROUSEL_IMAGE_POSITION.LEFT,
          imageFit: CARD_IMAGE_FIT.COVER,
        },
        layoutId: DEFAULT_PRESET_ID.IMAGE_CAPTION,
        media: { source: 'blob:image-2', type: 'image' },
      }) })],
      content: {
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'elceAnchor', attrs: { bdcId: 'bdc-image-caption', partId: 'page-a:bdc-image-caption:anchor' } }] }],
      },
    })
    editor.mount(host)

    const preview = host.querySelector('.elce-anchor-bdc article.elce-card--image-caption')
    expect(preview?.querySelector('.elce-card-image-caption__caption')?.textContent).toBe('Légende')
    expect(preview?.querySelector('.elce-card-image-caption__image img')?.getAttribute('src')).toBe('blob:image-2')
  })

  it('creates an image anchor from one external file drop', () => {
    const droppedFile = new File(['image'], 'photo.png', { type: 'image/png' })
    const onDropTarget = vi.fn(() => ({
      pageId: 'page-a',
      bdcId: 'bdc-image-1',
      media: { id: 'media-image-1',  name: 'photo.png', mimeType: 'image/png', size: 5, caption: '' },
      presetId: 'photo-basic',
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
        { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor', paddingBottom: '75%' } },
        { type: 'text', text: 'après' },
      ] }],
    })
  })

  it('inserts a reusable catalog media reference at the text drop position', () => {
    const reference = { kind: CATALOG_REFERENCE.MEDIA, mediaId: 'media-image-1' } as const
    const target = {
      source: CATALOG_REFERENCE.MEDIA,
      reference,
      pageId: 'page-a',
      bdcId: 'bdc-image-from-catalog',
      media: { id: 'media-image-1',  name: 'photo.png', mimeType: 'image/png', size: 5, caption: '' },
      presetId: 'photo-basic',
      partId: 'page-a:bdc-image-from-catalog:anchor',
      paddingBottom: '75%',
    }
    const resolveTarget = vi.fn(() => target)
    editor = new Editor({
      extensions: [StarterKit, createElceAnchorExtension({ createCatalogDropTarget: resolveTarget })],
      content: '<p>Avant après</p>',
    })
    vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos: 7, inside: -1 })
    const dataTransfer = {
      types: [CATALOG_REFERENCE.MIME_TYPE],
      getData: (type: string) => type === CATALOG_REFERENCE.MIME_TYPE ? JSON.stringify(reference) : '',
      files: [],
    }
    const event = { clientX: 10, clientY: 10, dataTransfer } as unknown as DragEvent

    const handled = editor.view.someProp('handleDrop', (handler) => handler(editor!.view, event, editor!.state.doc.slice(1, 1), false))

    expect(handled).toBe(true)
    expect(resolveTarget).toHaveBeenCalledWith(reference)
    expect(editor.getJSON()).toMatchObject({
      content: [{ content: [
        { type: 'text', text: 'Avant ' },
        { type: 'elceAnchor', attrs: {
          bdcId: 'bdc-image-from-catalog',
          partId: 'page-a:bdc-image-from-catalog:anchor',
          paddingBottom: '75%',
        } },
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

  it('moves an image anchor through ProseMirror’s complete native drag and drop path', () => {
    const host = document.createElement('div')
    document.body.append(host)
    let anchorChange: unknown
    editor = new Editor({
      extensions: [StarterKit, createElceAnchorExtension({ resolveCard: () => ({
        content: { mediaId: 'media-image-1', overline: '', title: '', description: '', message: '', note: '', caption: '', imagePosition: CAROUSEL_IMAGE_POSITION.LEFT, imageFit: CARD_IMAGE_FIT.COVER },
        layoutId: DEFAULT_PRESET_ID.PHOTO,
        media: { source: 'blob:image-1', type: 'image' },
      }) })],
      content: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Avant ' },
            { type: 'elceAnchor', attrs: {
              bdcId: 'bdc-image-1',
              partId: 'page-a:bdc-image-1:anchor',
            } },
            { type: 'text', text: ' après' },
          ],
        }],
      },
      onUpdate: ({ transaction }) => { anchorChange = transaction.getMeta(ELCE_ANCHOR_TRANSACTION_META) },
    })
    editor.mount(host)
    const posAtCoords = vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos: 1, inside: -1 })
    const handle = host.querySelector('.elce-anchor-handle')
    if (handle === null) throw new Error('La prise de l’ancre image doit être rendue.')
    const transfer = createMockDataTransfer()

    dispatchDragEvent('dragstart', handle, transfer.dataTransfer)
    expect(transfer.dataTransfer.getData('text/html')).toContain('data-bdc-id="bdc-image-1"')
    transfer.dataTransfer.dropEffect = 'move'
    const drop = dispatchDragEvent('drop', editor.view.dom, transfer.dataTransfer)
    expect(posAtCoords).toHaveBeenCalled()
    expect(drop.defaultPrevented).toBe(true)

    expect(editor.getJSON()).toMatchObject({
      content: [{ content: [
        { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1' } },
        { type: 'text', text: 'Avant  après' },
      ] }],
    })
    expect(anchorChange).toEqual({ kind: 'move', bdcId: 'bdc-image-1' })

    const copiedTransfer = createMockDataTransfer()
    const movedHandle = host.querySelector('.elce-anchor-handle')
    if (movedHandle === null) throw new Error('La prise doit suivre l’ancre déplacée.')
    dispatchDragEvent('dragstart', movedHandle, copiedTransfer.dataTransfer)
    copiedTransfer.dataTransfer.dropEffect = 'copy'
    const copiedDrop = dispatchDragEvent('drop', editor.view.dom, copiedTransfer.dataTransfer, { ctrlKey: true, altKey: true })
    expect(copiedDrop.defaultPrevented).toBe(true)
    dispatchDragEvent('dragend', movedHandle, copiedTransfer.dataTransfer)
    expect(editor.getJSON()).toMatchObject({
      content: [{ content: [
        { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1' } },
        { type: 'text', text: 'Avant  après' },
      ] }],
    })
  })

  it('returns an anchor only when the available catalog accepts the drag', () => {
    const host = document.createElement('div')
    document.body.append(host)
    let anchorChange: unknown
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
      onUpdate: ({ transaction }) => { anchorChange = transaction.getMeta(ELCE_ANCHOR_TRANSACTION_META) },
    })
    editor.mount(host)
    const handle = host.querySelector('.elce-anchor-handle')
    if (handle === null) throw new Error('La prise de l’ancre doit être rendue.')
    const firstDrag = createMockDataTransfer()
    dispatchDragEvent('dragstart', handle, firstDrag.dataTransfer)
    expect(firstDrag.setData).toHaveBeenCalledWith(ANCHOR_RETURN.MIME_TYPE, 'bdc-image-1')
    expect(firstDrag.types).toContain(ANCHOR_RETURN.MIME_TYPE)
    expect(firstDrag.dataTransfer.effectAllowed).toBe('copyMove')

    firstDrag.dataTransfer.dropEffect = 'none'
    dispatchDragEvent('dragend', handle, firstDrag.dataTransfer)
    expect(editor.getJSON()).toMatchObject({ content: [{ content: [{ type: 'text', text: 'Avant ' }, { type: 'elceAnchor' }, { type: 'text', text: ' après' }] }] })

    const acceptedDrag = createMockDataTransfer()
    dispatchDragEvent('dragstart', handle, acceptedDrag.dataTransfer)
    acceptedDrag.dataTransfer.dropEffect = 'move'
    acceptedDrag.types.length = 0
    dispatchDragEvent('dragend', handle, acceptedDrag.dataTransfer)
    expect(editor.getJSON()).toMatchObject({ content: [{ content: [{ type: 'text', text: 'Avant  après' }] }] })
    expect(anchorChange).toEqual({ kind: 'return', bdcId: 'bdc-image-1' })
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

/** Creates the writable transfer needed to exercise ProseMirror's native drag listeners. */
function createMockDataTransfer() {
  const values = new Map<string, string>()
  const types: string[] = []
  const setData = vi.fn((type: string, value: string) => {
    values.set(type, value)
    if (!types.includes(type)) types.push(type)
  })
  const dataTransfer = {
    effectAllowed: 'uninitialized' as DataTransfer['effectAllowed'],
    dropEffect: 'none' as DataTransfer['dropEffect'],
    files: [],
    types,
    clearData: vi.fn(() => {
      values.clear()
      types.length = 0
    }),
    setData,
    getData: vi.fn((type: string) => values.get(type) ?? ''),
  } as unknown as DataTransfer
  return { dataTransfer, setData, types }
}

/** Dispatches one native-shaped drag event with the supplied transfer. */
function dispatchDragEvent(
  type: string,
  target: Element,
  dataTransfer: DataTransfer,
  modifiers: Readonly<Record<string, boolean>> = {},
): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    dataTransfer: { value: dataTransfer },
    clientX: { value: 10 },
    clientY: { value: 10 },
    ...Object.fromEntries(Object.entries(modifiers).map(([name, value]) => [name, { value }])),
  })
  target.dispatchEvent(event)
  return event
}
