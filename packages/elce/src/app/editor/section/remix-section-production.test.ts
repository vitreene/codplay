// @vitest-environment jsdom
import type { Editor } from '@tiptap/core'
import { createActor } from 'xstate'
import { describe, expect, it, vi } from 'vitest'
import { jsx } from 'remix/ui/jsx-runtime'
import { render } from 'remix/ui/test'
import { BDC_TYPE } from '../../../config/document-config'
import { EditorContextProvider } from '../../remix/editor-context'
import { controllerMachine } from '../../controller/controller-machine'
import type { ElceDocumentStore, MediaBlob } from '../../../infrastructure/indexed-db/document-store-types'
import { EditorActionsFacade } from '../../facades/editor-actions-facade'
import { RemixPageEditor } from '../../remix/workspace/page-editor'

class PendingMediaStore implements ElceDocumentStore {
  public readonly pending: Array<{ media: MediaBlob; resolve: () => void }> = []
  public readonly media = new Map<string, Blob>()

  public async loadDocument(): Promise<null> {
    return null
  }

  public async saveDocument(): Promise<void> {}

  public async saveDocumentAndDeleteMedia(): Promise<void> {}

  public async deleteDocument(): Promise<void> {}

  public async deleteMedia(): Promise<void> {}

  public async loadSyncState(documentId: string) {
    return { documentId, remoteRevision: null, uploadedMediaIds: [], status: 'pending' as const }
  }

  public async saveSyncState(): Promise<void> {}

  public saveMedia(media: MediaBlob): Promise<void> {
    return new Promise((resolve) => this.pending.push({
      media,
      resolve: () => {
        this.media.set(media.id, media.blob)
        resolve()
      },
    }))
  }

  public async loadMedia(mediaId: string): Promise<Blob | null> {
    return this.media.get(mediaId) ?? null
  }
}

describe('Remix production Section editor', () => {
  it('keeps Tiptap mounted while Remix commands edit the Section and import an anchored image through XState', async () => {
    const store = new PendingMediaStore()
    const controller = createActor(controllerMachine, { input: { documentStore: store } })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new EditorActionsFacade(controller)
    const subscribeSpy = vi.spyOn(controller, 'subscribe')
    const rendered = render(jsx(EditorContextProvider, {
      controller,
      actions,
      children: jsx(RemixPageEditor, { onPreview: () => undefined, previewError: null }),
    }))

    const editor = getEditor(rendered.$('.ProseMirror'))
    const editorDom = editor.view.dom
    expect(rendered.$('#elce-section-toolbar-bdc-section-1')).not.toBeNull()

    await rendered.act(() => {
      editor.commands.insertContent('<h3><em>Texte édité</em></h3>')
    })

    const title = rendered.$('#elce-section-title-bdc-section-1') as HTMLInputElement
    await rendered.act(() => {
      title.value = 'Titre édité'
      title.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(controller.getSnapshot().context.document.bdcs[0]?.section?.title).toBe('Titre édité')
    expect(getEditor(rendered.$('.ProseMirror'))).toBe(editor)
    expect(editor.view.dom).toBe(editorDom)

    await rendered.act(() => {
      editor.commands.setTextSelection({ from: 1, to: 13 })
    })
    expect(rendered.$('#elce-section-heading-3-bdc-section-1')?.getAttribute('aria-pressed')).toBe('true')
    expect(rendered.$('#elce-section-italic-bdc-section-1')?.getAttribute('aria-pressed')).toBe('true')

    await rendered.act(() => {
      const button = rendered.$('#elce-section-bold-bdc-section-1')
      button?.dispatchEvent(new Event('click', { bubbles: true }))
    })
    const editedTextMarks = controller.getSnapshot().context.document.bdcs[0]?.section?.content.content?.[0]?.content?.[0]?.marks?.map(({ type }) => type)
    expect(editedTextMarks).toEqual(expect.arrayContaining(['italic', 'bold']))

    const posAtCoords = vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos: 1, inside: -1 })
    const file = new File(['image bytes'], 'photo.png', { type: 'image/png' })
    const fileDrop = {
      clientX: 4,
      clientY: 4,
      dataTransfer: { files: [file], types: ['Files'] },
    } as unknown as DragEvent
    await rendered.act(() => {
      const handled = editor.view.someProp('handleDrop', (handler) => handler(
        editor.view,
        fileDrop,
        editor.state.doc.slice(1, 1),
        false,
      ))
      expect(handled).toBe(true)
    })
    expect(posAtCoords).toHaveBeenCalled()
    await flush()
    expect(store.pending).toHaveLength(1)

    const pendingMedia = store.pending[0]
    if (pendingMedia === undefined) throw new Error('Le dépôt doit demander la persistance du fichier média.')
    const setContent = vi.spyOn(editor.commands, 'setContent')
    pendingMedia.resolve()
    await flush()

    const document = controller.getSnapshot().context.document
    expect(editor.getJSON()).toEqual(document.bdcs[0]?.section?.content)
    expect(document.bdcs.some((bdc) => bdc.type === BDC_TYPE.CARD && bdc.card?.mediaId === pendingMedia.media.id)).toBe(true)
    expect(document.medias.map((media) => media.id)).toContain(pendingMedia.media.id)
    expect(document.bdcs[0]?.section?.markup).toContain('data-elce-anchor="true"')
    expect(editor.view.dom.querySelector('.elce-anchor-media-preview')?.getAttribute('src')).toMatch(/^blob:/)
    expect(getEditor(rendered.$('.ProseMirror'))).toBe(editor)
    expect(editor.view.dom).toBe(editorDom)
    expect(setContent).not.toHaveBeenCalled()
    const anchorCard = document.bdcs.find((bdc) => bdc.type === BDC_TYPE.CARD && bdc.card?.mediaId === pendingMedia.media.id)
    if (anchorCard === undefined) throw new Error('Le média importé doit être associé à sa Carte unique.')

    const anchorHandle = editor.view.dom.querySelector('.elce-anchor-handle')
    if (anchorHandle === null) throw new Error('Le dépôt doit produire une prise d’ancre déplaçable.')
    const transfer = createMockDataTransfer()
    dispatchDragEvent('dragstart', anchorHandle, transfer.dataTransfer)
    transfer.dataTransfer.dropEffect = 'move'
    posAtCoords.mockReturnValue({ pos: editor.state.doc.content.size - 1, inside: -1 })
    const drop = dispatchDragEvent('drop', editor.view.dom, transfer.dataTransfer)
    expect(drop.defaultPrevented).toBe(true)
    await flush()
    const movedInlineContent = controller.getSnapshot().context.document.bdcs[0]?.section?.content.content?.[0]?.content
    expect(movedInlineContent?.at(-1)?.type).toBe('elceAnchor')
    expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === anchorCard.id)?.card?.mediaId).toBe(pendingMedia.media.id)

    const editButton = editor.view.dom.querySelector<HTMLButtonElement>(`#${anchorCard.id}-anchor-edit`)
    if (editButton === null) throw new Error('The anchor must expose its existing Card edit button.')
    expect(editButton.parentElement?.id).toBe(`${anchorCard.id}-anchor-edit-position`)
    await rendered.act(() => editButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
    expect(rendered.$(`#elce-anchor-card-editor-${anchorCard.id}`)).not.toBeNull()
    expect((rendered.$(`#elce-anchor-card-card-layout-${anchorCard.id}`) as HTMLSelectElement).value).toBe('photo-basic')
    expect((rendered.$(`#elce-anchor-card-image-fit-${anchorCard.id}`) as HTMLSelectElement).value).toBe('cover')

    const subscription = subscribeSpy.mock.results[0]?.value
    expect(subscription).toBeDefined()
    if (subscription === undefined) throw new Error('La page Remix doit s’abonner à l’acteur.')
    const unsubscribeSpy = vi.spyOn(subscription, 'unsubscribe')
    rendered.cleanup()
    expect(unsubscribeSpy).toHaveBeenCalledOnce()
    controller.stop()
  })
})

/** Reads the core Editor instance Tiptap attaches to its ProseMirror DOM. */
function getEditor(element: Element | null): Editor {
  const editor = (element as (Element & { editor?: Editor }) | null)?.editor
  if (editor === undefined) throw new Error('The Remix Section must mount a core Tiptap Editor.')
  return editor
}

/** Allows XState actor effects and media persistence promises to settle. */
async function flush(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

/** Creates the writable transfer ProseMirror needs for native anchor dragging. */
function createMockDataTransfer() {
  const values = new Map<string, string>()
  const types: string[] = []
  const dataTransfer = {
    effectAllowed: 'uninitialized' as DataTransfer['effectAllowed'],
    dropEffect: 'none' as DataTransfer['dropEffect'],
    files: [],
    types,
    clearData: () => {
      values.clear()
      types.length = 0
    },
    setData: (type: string, value: string) => {
      values.set(type, value)
      if (!types.includes(type)) types.push(type)
    },
    getData: (type: string) => values.get(type) ?? '',
  } as unknown as DataTransfer
  return { dataTransfer }
}

/** Dispatches a native-shaped drag event through ProseMirror's DOM listeners. */
function dispatchDragEvent(type: string, target: Element, dataTransfer: DataTransfer): Event {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    dataTransfer: { value: dataTransfer },
    clientX: { value: 10 },
    clientY: { value: 10 },
  })
  target.dispatchEvent(event)
  return event
}
