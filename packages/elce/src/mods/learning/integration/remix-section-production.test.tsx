// @vitest-environment jsdom
import type { Editor } from '@tiptap/core'
import { createActor } from 'xstate'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { render } from 'remix/ui/test'
import { BDC_TYPE } from '../learning-definition'
import { MEDIA_TYPE } from '../../../core/media/media-config'
import { ElceEditorSettingsResolver } from '../../../domain/editor-settings/editor-settings-resolver'
import { LearningEditorContextProvider } from '../composition/learning-editor-context'
import { controllerMachine } from '../../../app/controller/controller-machine'
import type { ElceDocumentStore, MediaBlob } from '../../../infrastructure/indexed-db/document-store-types'
import { LearningEditorFacade } from '../authoring/learning-editor-facade'
import type { ProfileProperty } from '../profile/domain/learning-profile-types'
import { renderProfileTokenInsertion } from '../profile/authoring/profile-token-insertion'
import { LearningPageEditor } from '../authoring/learning-page-editor'
import { buildFluxScene } from '../../../resources/pages/flux/flux-scene-builder'
import { createLearningSceneBuilders } from '../reading/learning-scene-builders'
import { anchorNameFor } from '../../../domain/anchor/anchor-position'

const editorSettingsResolver = new ElceEditorSettingsResolver()

class PendingMediaStore implements ElceDocumentStore {
  public readonly pending: Array<{ media: MediaBlob; resolve: () => void }> = []
  public readonly media = new Map<string, Blob>()

  public async loadDocument(): Promise<null> {
    return null
  }

  public async saveDocument(): Promise<void> { }

  public async saveDocumentAndDeleteMedia(): Promise<void> { }

  public async deleteDocument(): Promise<void> { }

  public async deleteMedia(): Promise<void> { }

  public async loadSyncState(documentId: string) {
    return { documentId, remoteRevision: null, uploadedMediaIds: [], status: 'pending' as const }
  }

  public async saveSyncState(): Promise<void> { }

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
  let originalScrollIntoView: PropertyDescriptor | undefined

  afterEach(() => {
    if (originalScrollIntoView === undefined) Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
    else Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', originalScrollIntoView)
    originalScrollIntoView = undefined
    vi.restoreAllMocks()
  })

  it('keeps Tiptap mounted while Remix commands edit the Section and import an anchored image through XState', async () => {
    let replacementImageLoaded = false
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockImplementation(() => replacementImageLoaded ? 2 : 900)
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockImplementation(() => replacementImageLoaded ? 2 : 593)

    const store = new PendingMediaStore()
    const controller = createActor(controllerMachine, { input: { documentStore: store } })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new LearningEditorFacade(controller)
    const submitSectionChange = vi.spyOn(actions, 'submitSectionChange')
    const profileProperty: ProfileProperty = {
      id: 'profile-audience',
      name: 'audience',
      label: 'Public',
      type: 'text',
      required: false,
      choices: [],
    }
    actions.updateProfileDefinition({
      ...controller.getSnapshot().context.document.data.profile,
      properties: [profileProperty],
    })
    const subscribeSpy = vi.spyOn(controller, 'subscribe')
    const rendered = render(<div id="elce-section-test-host">
      {renderProfileTokenInsertion('elce-profile-test-tools', [profileProperty], 'elce-editor-content-bdc-section-1')}
      <LearningEditorContextProvider
        controller={controller}
        actions={actions}
      >
        <LearningPageEditor canMoveBdcToPage={actions.authoring.canMoveBdcToPage.bind(actions.authoring)} onOpenAppearanceTarget={() => undefined} />
      </LearningEditorContextProvider>
    </div>)

    const editor = getEditor(rendered.$('.ProseMirror'))
    const editorDom = editor.view.dom
    expect(rendered.$('#elce-section-toolbar-bdc-section-1')).not.toBeNull()
    expect(rendered.$('#elce-section-profile-label-bdc-section-1-profile-audience')).toBeNull()

    await rendered.act(() => {
      editor.commands.insertContent('<h3><em>Texte édité</em></h3>')
    })

    const title = rendered.$('#elce-section-title-bdc-section-1') as HTMLInputElement
    await rendered.act(() => {
      title.value = 'Titre édité'
      title.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await flush()

    expect(submitSectionChange).toHaveBeenCalledWith(
      'bdc-section-1',
      expect.objectContaining({ kind: 'content', title: 'Titre édité' }),
      undefined,
    )
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
    await flush()
    const editedTextMarks = controller.getSnapshot().context.document.bdcs[0]?.section?.content.content?.[0]?.content?.[0]?.marks?.map(({ type }) => type)
    expect(editedTextMarks).toEqual(expect.arrayContaining(['italic', 'bold']))

    await rendered.act(() => {
      const end = editor.state.doc.content.size - 1
      editor.commands.focus()
      editor.commands.setTextSelection(end)
      const insert = rendered.$('#elce-profile-test-tools-profile-audience')
      insert?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      insert?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await flush()
    const sectionAfterProfileLabel = controller.getSnapshot().context.document.bdcs[0]?.section
    expect(JSON.stringify(sectionAfterProfileLabel?.content)).toContain('"profilePropertyId":"profile-audience"')
    expect(sectionAfterProfileLabel?.markup).toContain('data-elce-profile-property="profile-audience"')

    const posAtCoords = vi.spyOn(editor.view, 'posAtCoords').mockReturnValue({ pos: 1, inside: -1 })
    const file = new File(['image bytes'], 'photo.png', { type: 'image/png' })
    await rendered.act(() => {
      const event = dispatchDragEvent('drop', editor.view.dom, createMockDataTransfer([file]).dataTransfer)
      expect(event.defaultPrevented).toBe(true)
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
    const anchorCard = document.bdcs.find((bdc) => bdc.type === BDC_TYPE.CARD && bdc.card?.mediaId === pendingMedia.media.id)
    if (anchorCard === undefined) throw new Error('Le média importé doit être associé à sa Carte unique.')
    expect(editor.getJSON()).toEqual(document.bdcs[0]?.section?.content)
    expect(document.bdcs.some((bdc) => bdc.type === BDC_TYPE.CARD && bdc.card?.mediaId === pendingMedia.media.id)).toBe(true)
    expect(document.medias.map((media) => media.id)).toContain(pendingMedia.media.id)
    expect(document.bdcs[0]?.section?.markup).toContain('data-elce-anchor="true"')
    expect(document.bdcs[0]?.section?.content.content?.[0]?.content?.find((node) => node.type === 'elceAnchor')?.attrs?.paddingBottom)
      .toBe('65.88888889%')
    expect(document.bdcs[0]?.section?.markup).toContain('--elce-anchor-padding: 65.88888889%')
    const scene = buildFluxScene(document.pages[0]!, document.bdcs, {
      ...createLearningSceneBuilders(),
      mediaSources: { [pendingMedia.media.id]: 'blob:image-1' },
      mediaTypes: { [pendingMedia.media.id]: MEDIA_TYPE.IMAGE },
      editorSettings: editorSettingsResolver.resolvePage(
        document.pages[0]!,
        document.bdcs,
        document.data.revelationDefaults,
      ),
    })
    expect(scene.sceneDoc.stories['page-a-page']?.persos.find((perso) => perso.id === 'page-a-article')?.initial).toMatchObject({
      flowReservations: [{ partId: `page-a:${anchorCard.id}:anchor`, blockSize: 'calc(65.88888889% + 2rem + 2rem)' }],
    })
    expect(editor.view.dom.querySelector('.elce-anchor-media-preview')?.getAttribute('src')).toMatch(/^blob:/)
    expect(getEditor(rendered.$('.ProseMirror'))).toBe(editor)
    expect(editor.view.dom).toBe(editorDom)
    expect(setContent).not.toHaveBeenCalled()

    const replacementFile = new File(['replacement image bytes'], 'replacement.png', { type: 'image/png' })
    const imageTarget = editor.view.dom.querySelector('.elce-anchor-bdc img.elce-anchor-media-preview')
    if (imageTarget === null) throw new Error('La Carte ancrée doit afficher une image qui accepte le dépôt de remplacement.')
    const sectionContentBeforeReplacement = document.bdcs.find((bdc) => bdc.id === 'bdc-section-1')?.section?.content
    const previousMediaId = anchorCard.card?.mediaId
    if (previousMediaId === null || previousMediaId === undefined) throw new Error('La Carte ancrée doit déjà référencer son image.')
    posAtCoords.mockClear()
    posAtCoords.mockReturnValue(null)
    replacementImageLoaded = true
    await rendered.act(() => {
      const event = dispatchDragEvent('drop', imageTarget, createMockDataTransfer([replacementFile]).dataTransfer)
      expect(event.defaultPrevented).toBe(true)
    })
    expect(posAtCoords).not.toHaveBeenCalled()
    await flush()
    const replacementPending = store.pending[1]
    if (replacementPending === undefined) throw new Error('Le dépôt sur l’image doit importer le remplacement par le service Card existant.')
    replacementPending.resolve()
    await flush()

    const replacementDocument = controller.getSnapshot().context.document
    const replacedCard = replacementDocument.bdcs.find((bdc) => bdc.id === anchorCard.id)
    expect(replacedCard?.card?.mediaId).toBe(replacementPending.media.id)
    expect(replacementDocument.bdcs.find((bdc) => bdc.id === 'bdc-section-1')?.section?.content.content?.[0]?.content
      ?.find((node) => node.type === 'elceAnchor')?.attrs?.paddingBottom).toBe('100%')
    expect(replacementDocument.medias.map((media) => media.id)).toContain(previousMediaId)
    expect(replacementDocument.medias.map((media) => media.id)).toContain(replacementPending.media.id)

    replacementImageLoaded = false
    await rendered.act(() => controller.send({ type: 'history.undo' }))
    await flush()
    expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === anchorCard.id)?.card?.mediaId)
      .toBe(previousMediaId)
    expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === 'bdc-section-1')?.section?.content)
      .toEqual(sectionContentBeforeReplacement)

    replacementImageLoaded = true
    await rendered.act(() => controller.send({ type: 'history.redo' }))
    await flush()
    expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === anchorCard.id)?.card?.mediaId)
      .toBe(replacementPending.media.id)
    const sectionAfterRedo = controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === 'bdc-section-1')?.section
    expect(sectionAfterRedo?.content.content?.[0]?.content?.find((node) => node.type === 'elceAnchor')?.attrs?.paddingBottom)
      .toBe('100%')

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
    expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === anchorCard.id)?.card?.mediaId)
      .toBe(replacementPending.media.id)

    const editButton = editor.view.dom.querySelector<HTMLButtonElement>(`#${anchorCard.id}-anchor-edit`)
    if (editButton === null) throw new Error('The anchor must expose its existing Card edit button.')
    expect(editButton.parentElement?.id).toBe(`${anchorCard.id}-anchor-edit-position`)
    const scrollIntoView = vi.fn()
    originalScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
    await rendered.act(() => editButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
    await flush()
    const anchorEditor = rendered.$(`#elce-anchor-card-editor-${anchorCard.id}`)
    expect(anchorEditor).not.toBeNull()
    expect(anchorEditor?.getAttribute('data-anchor-part-id')).toBe(`page-a:${anchorCard.id}:anchor`)
    expect((anchorEditor as HTMLElement).style.position).toBe('absolute')
    expect((anchorEditor as HTMLElement).style.positionAnchor).toBe(anchorNameFor(`page-a:${anchorCard.id}:anchor-editor-frame`))
    expect((anchorEditor as HTMLElement).style.insetInlineStart).toBe('anchor(left)')
    expect((anchorEditor as HTMLElement).style.insetBlockStart).toBe('anchor(top)')
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
    expect((scrollIntoView.mock.contexts[0] as HTMLElement).id).toBe(`elce-anchor-card-editor-${anchorCard.id}`)
    expect((rendered.$(`#elce-anchor-card-card-layout-${anchorCard.id}`) as HTMLSelectElement).value).toBe('photo-basic')
    expect((rendered.$(`#elce-anchor-card-image-fit-${anchorCard.id}`) as HTMLSelectElement).value).toBe('cover')
    expect(rendered.$(`#elce-anchor-card-editor-close-icon-${anchorCard.id}`)?.classList.contains('lucide-x')).toBe(true)
    expect(rendered.$(`#elce-anchor-card-media-clear-icon-${anchorCard.id}`)?.classList.contains('lucide-trash-2')).toBe(true)

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
function createMockDataTransfer(files: File[] = []) {
  const values = new Map<string, string>()
  const types: string[] = []
  const dataTransfer = {
    effectAllowed: 'uninitialized' as DataTransfer['effectAllowed'],
    dropEffect: 'none' as DataTransfer['dropEffect'],
    files,
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
