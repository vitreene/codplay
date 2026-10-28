// @vitest-environment jsdom
import { createActor } from 'xstate'
import { describe, expect, it, vi } from 'vitest'

import { render } from 'remix/ui/test'
import { CHAPTER_TYPE } from '../organization/learning-organization-config'
import { DEFAULT_PRESET_ID } from '../learning-definition'
import type { ElceDocumentStore } from '../../../infrastructure/indexed-db/document-store-types'
import { ElceMediaResourceService } from '../../../domain/media/media-resource-service'
import type { ProfileProperty } from '../profile/domain/learning-profile-types'
import { controllerMachine } from '../../../app/controller/controller-machine'
import { LearningEditorFacade } from './learning-editor-facade'
import type { ProjectSessionPort } from '../../../app/projects/project-session-types'
import { LearningEditorContextProvider } from '../composition/learning-editor-context'
import { LearningProjectApplication } from './learning-project-application'

const exportClientMocks = vi.hoisted(() => ({
  request: vi.fn(),
  download: vi.fn(),
  requestScorm: vi.fn(),
  downloadScorm: vi.fn(),
}))

vi.mock('../../../export/elce-sighty-export-client', () => ({
  requestElceSightyPackage: exportClientMocks.request,
  downloadElceSightyPackage: exportClientMocks.download,
}))

vi.mock('../../../export/elce-scorm-export-client', () => ({
  requestElceScormPackage: exportClientMocks.requestScorm,
  downloadElceScormPackage: exportClientMocks.downloadScorm,
}))

describe('Remix project application', () => {
  it('prevents the browser from opening a file dropped outside an authoring target', async () => {
    const project = { id: 'outside-file-drop-project', name: 'Dépôt hors cible', revision: 0 }
    const projectSession: ProjectSessionPort = {
      rememberedProjectId: () => null,
      perform: async (_operation, document) => ({
        projects: [project], activeProject: project, document, status: 'active', editAccess: 'waiting',
      }),
      startLock: () => {},
      dispose: async () => {},
    }
    const controller = createActor(controllerMachine, { input: { projectSession } })
    controller.start()
    controller.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: null } })
    await vi.waitFor(() => expect(controller.getSnapshot().context.activeProject?.id).toBe(project.id))
    controller.send({ type: 'editor.access.activate' })
    const originalDocument = controller.getSnapshot().context.document
    const rendered = render(<LearningEditorContextProvider
      controller={controller}
      actions={new LearningEditorFacade(controller)}
    ><LearningProjectApplication /></LearningEditorContextProvider>)
    const file = new File(['image'], 'outside-target.png', { type: 'image/png' })
    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(drop, 'dataTransfer', { value: { files: [file] } })
    let reachedDocumentBubble = false
    document.addEventListener('drop', () => { reachedDocumentBubble = true }, { once: true })

    await rendered.act(() => document.body.dispatchEvent(drop))

    expect(drop.defaultPrevented).toBe(true)
    expect(reachedDocumentBubble).toBe(true)
    expect(controller.getSnapshot().context.document).toBe(originalDocument)

    rendered.cleanup()
    controller.stop()
  })

  it('ignores controller snapshots that do not change the rendered project view', async () => {
    const project = { id: 'stable-view-project', name: 'Vue stable', revision: 0 }
    const projectSession: ProjectSessionPort = {
      rememberedProjectId: () => null,
      perform: async (_operation, document) => ({
        projects: [project], activeProject: project, document, status: 'active', editAccess: 'waiting',
      }),
      startLock: () => {},
      dispose: async () => {},
    }
    const controller = createActor(controllerMachine, { input: { projectSession } })
    controller.start()
    controller.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: null } })
    await vi.waitFor(() => expect(controller.getSnapshot().context.activeProject?.id).toBe(project.id))

    const subscriptionTask: { current: (() => void) | null } = { current: null }
    const abortController = new AbortController()
    const update = vi.fn(async () => {})
    const handle = {
      context: { get: () => ({ controller, actions: new LearningEditorFacade(controller) }) },
      queueTask: (callback: () => void) => { subscriptionTask.current = callback },
      signal: abortController.signal,
      update,
    } as unknown as Parameters<typeof LearningProjectApplication>[0]
    LearningProjectApplication(handle)
    if (subscriptionTask.current === null) throw new Error('L’abonnement de l’application doit être installé.')
    subscriptionTask.current()
    update.mockClear()

    controller.send({ type: 'project.summary.refresh', project: { ...project } })
    expect(update).not.toHaveBeenCalled()

    controller.send({
      type: 'project.local-copy.availability', projectId: 'another-project', available: true,
    })
    expect(update).not.toHaveBeenCalled()

    controller.send({
      type: 'project.access.recovery', message: 'L’accès doit pouvoir être repris.',
    })
    expect(update).toHaveBeenCalledOnce()

    abortController.abort()
    controller.stop()
  })

  it('keeps ordinary read-only status quiet until access recovery is needed', async () => {
    const project = { id: 'reader-project', name: 'Projet en lecture', revision: 0 }
    const projectSession: ProjectSessionPort = {
      rememberedProjectId: () => null,
      perform: async (_operation, document) => ({
        projects: [project], activeProject: project, document, status: 'active', editAccess: 'waiting',
      }),
      startLock: () => {},
      dispose: async () => {},
    }
    const controller = createActor(controllerMachine, { input: { projectSession } })
    controller.start()
    controller.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: null } })
    await vi.waitFor(() => expect(controller.getSnapshot().context.activeProject?.id).toBe(project.id))

    const actions = new LearningEditorFacade(controller)
    const rendered = render(<LearningEditorContextProvider controller={controller} actions={actions}>
      <LearningProjectApplication />
    </LearningEditorContextProvider>)

    expect(rendered.$('#elce-project-sync-status')?.textContent).toBe('Lecture seule')
    expect(rendered.$('#elce-project-reader-status')).toBeNull()
    expect(rendered.$('#elce-project-access-retry')).toBeNull()
    expect(rendered.$('#elce-project-access-force')).toBeNull()

    await rendered.act(() => controller.send({
      type: 'project.access.recovery',
      message: 'L’accès n’a pas pu être repris après plusieurs tentatives.',
    }))
    expect(rendered.$('#elce-project-reader-status')?.textContent).toBe('L’accès n’a pas pu être repris après plusieurs tentatives.')
    expect(rendered.$('#elce-project-access-retry')).not.toBeNull()
    expect(rendered.$('#elce-project-access-force')).not.toBeNull()

    await rendered.act(() => controller.send({ type: 'editor.access.activate' }))
    expect(rendered.$('#elce-project-reader-status')).toBeNull()
    expect(rendered.$('#elce-project-access-retry')).toBeNull()
    expect(rendered.$('#elce-project-access-force')).toBeNull()

    rendered.cleanup()
    controller.stop()
  })

  it('keeps the scenario editable while its export uses the captured document', async () => {
    exportClientMocks.request.mockReset()
    exportClientMocks.download.mockReset()
    exportClientMocks.requestScorm.mockReset()
    exportClientMocks.downloadScorm.mockReset()
    let finishExport: (blob: Blob) => void = () => {}
    exportClientMocks.request.mockImplementation(() => new Promise<Blob>((resolve) => {
      finishExport = resolve
    }))
    exportClientMocks.download.mockReturnValue('Projet export.sighty.zip')

    const project = { id: 'export-project', name: 'Projet export', revision: 0 }
    const projectSession: ProjectSessionPort = {
      rememberedProjectId: () => null,
      perform: async (_operation, document) => ({
        projects: [project], activeProject: project, document, status: 'active', editAccess: 'waiting',
      }),
      startLock: () => {},
      dispose: async () => {},
    }
    const controller = createActor(controllerMachine, { input: { projectSession } })
    controller.start()
    controller.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: null } })
    await vi.waitFor(() => expect(controller.getSnapshot().context.activeProject?.id).toBe(project.id))
    controller.send({ type: 'editor.access.activate' })
    const exportedDocument = controller.getSnapshot().context.document
    const initialPageCount = exportedDocument.pages.length

    const rendered = render(<LearningEditorContextProvider
      controller={controller}
      actions={new LearningEditorFacade(controller)}
    >
      <LearningProjectApplication />
    </LearningEditorContextProvider>)
    const exportButton = rendered.$('#elce-export-open') as HTMLButtonElement | null
    if (exportButton === null) throw new Error('Le bouton d’export doit être présent dans la barre de titre.')

    expect(exportButton.closest('#elce-project-header')).not.toBeNull()
    expect(rendered.$('#elce-project-header')?.lastElementChild).toBe(exportButton)
    expect(rendered.$('#elce-responsive-panel-access #elce-export-open')).toBeNull()
    expect(rendered.$('#elce-export-dialog')?.getAttribute('aria-modal')).toBeNull()
    expect(rendered.$('#elce-export-dialog-title')?.textContent).toBe('Exporter')
    expect(rendered.$('#elce-export-dialog-close')?.getAttribute('aria-label')).toBe('Fermer la fenêtre d’export')
    expect(rendered.$('#elce-export-dialog-close')?.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(rendered.$('#elce-sighty-export-action')?.textContent).toContain('Exporter le scénario')
    expect(rendered.$('#elce-sighty-export-action')?.textContent).not.toContain('Sighty')
    expect(rendered.$('#elce-scorm-export-action')?.textContent).toContain('Exporter en SCORM')
    expect((rendered.$('#elce-scorm-version-2004') as HTMLInputElement).checked).toBe(true)
    expect((rendered.$('#elce-scorm-mono-sco') as HTMLInputElement).checked).toBe(false)
    expect(rendered.$('#elce-scorm-export-action')?.classList.contains('elce-export-dialog__action--primary')).toBe(false)

    const dialog = rendered.$('#elce-export-dialog') as HTMLDialogElement
    const dialogMethods = stubDialogMethods(dialog)

    await rendered.act(() => exportButton.click())
    expect(dialogMethods.showModal).toHaveBeenCalledOnce()
    expect(dialog.open).toBe(true)
    await rendered.act(() => rendered.$('#elce-sighty-export-action')?.dispatchEvent(new Event('click', { bubbles: true })))
    expect(exportClientMocks.request).toHaveBeenCalledOnce()
    expect(exportButton.disabled).toBe(true)
    expect(exportButton.getAttribute('aria-busy')).toBe('true')
    expect(rendered.$('#elce-sighty-export-status')?.textContent).toBe('Préparation de l’export du scénario…')
    expect(dialogMethods.close).toHaveBeenCalledOnce()
    expect(exportClientMocks.request.mock.calls[0]?.[0]).toBe(exportedDocument)

    const editor = rendered.$('#elce-main') as HTMLElement | null
    const addPage = rendered.$('#elce-create-scenario-diapo') as HTMLButtonElement | null
    expect(editor?.hasAttribute('inert')).toBe(false)
    if (addPage === null) throw new Error('Le bouton de création de page doit rester disponible pendant l’export.')
    expect(addPage.disabled).toBe(false)
    await rendered.act(() => addPage.dispatchEvent(new Event('click', { bubbles: true })))
    expect(controller.getSnapshot().context.document.pages).toHaveLength(initialPageCount + 1)
    expect(exportedDocument.pages).toHaveLength(initialPageCount)

    await rendered.act(() => finishExport(new Blob(['package'], { type: 'application/zip' })))
    await vi.waitFor(() => expect(exportClientMocks.download).toHaveBeenCalledOnce())
    expect(exportButton.disabled).toBe(false)
    expect(rendered.$('#elce-sighty-export-status')?.textContent).toBe('Téléchargement de « Projet export.sighty.zip » démarré.')

    rendered.cleanup()
    controller.stop()
  })

  it('keeps the editor writable while creating a SCORM package from a stable snapshot', async () => {
    exportClientMocks.request.mockReset().mockResolvedValue(new Blob(['Sighty'], { type: 'application/zip' }))
    exportClientMocks.download.mockReset()
    let finishScormExport: (download: { archive: Blob; filename: string }) => void = () => {}
    exportClientMocks.requestScorm.mockReset().mockImplementation(() => new Promise<{ archive: Blob; filename: string }>((resolve) => {
      finishScormExport = resolve
    }))
    exportClientMocks.downloadScorm.mockReset().mockReturnValue('Projet-SCORM-scorm-monosco-2026-10-22(1.2).zip')

    const project = { id: 'scorm-export-project', name: 'Projet SCORM', revision: 0 }
    const projectSession: ProjectSessionPort = {
      rememberedProjectId: () => null,
      perform: async (_operation, document) => ({
        projects: [project], activeProject: project, document, status: 'active', editAccess: 'waiting',
      }),
      startLock: () => {},
      dispose: async () => {},
    }
    const controller = createActor(controllerMachine, { input: { projectSession } })
    controller.start()
    controller.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: null } })
    await vi.waitFor(() => expect(controller.getSnapshot().context.activeProject?.id).toBe(project.id))
    controller.send({ type: 'editor.access.activate' })
    const exportedDocument = controller.getSnapshot().context.document
    const initialPageCount = exportedDocument.pages.length
    const rendered = render(<LearningEditorContextProvider controller={controller} actions={new LearningEditorFacade(controller)}>
      <LearningProjectApplication />
    </LearningEditorContextProvider>)
    const dialog = rendered.$('#elce-export-dialog') as HTMLDialogElement
    stubDialogMethods(dialog)

    await rendered.act(() => rendered.$('#elce-export-open')?.dispatchEvent(new Event('click', { bubbles: true })))
    await rendered.act(() => (rendered.$('#elce-scorm-version-12') as HTMLInputElement).click())
    await rendered.act(() => (rendered.$('#elce-scorm-mono-sco') as HTMLInputElement).click())
    await rendered.act(() => rendered.$('#elce-scorm-export-action')?.dispatchEvent(new Event('click', { bubbles: true })))

    expect(exportClientMocks.request).toHaveBeenCalledOnce()
    expect(exportClientMocks.request.mock.calls[0]?.[0]).toBe(exportedDocument)
    await vi.waitFor(() => expect(exportClientMocks.requestScorm).toHaveBeenCalledOnce())
    expect(exportClientMocks.requestScorm).toHaveBeenCalledWith(expect.any(Blob), 'Document Elcé', '1.2', true)
    expect(exportClientMocks.downloadScorm).not.toHaveBeenCalled()
    expect(exportClientMocks.download).not.toHaveBeenCalled()

    const editor = rendered.$('#elce-main') as HTMLElement | null
    const addPage = rendered.$('#elce-create-scenario-diapo') as HTMLButtonElement | null
    expect(editor?.hasAttribute('inert')).toBe(false)
    if (addPage === null) throw new Error('Le bouton de création de page doit rester disponible pendant l’export.')
    expect(addPage.disabled).toBe(false)
    await rendered.act(() => addPage.dispatchEvent(new Event('click', { bubbles: true })))

    const updatedDocument = controller.getSnapshot().context.document
    expect(controller.getSnapshot().context.editAccess).toBe('active')
    expect(updatedDocument).not.toBe(exportedDocument)
    expect(updatedDocument.pages).toHaveLength(initialPageCount + 1)
    expect(exportedDocument.pages).toHaveLength(initialPageCount)

    const scormArchive = new Blob(['SCORM'], { type: 'application/zip' })
    const scormFilename = 'Document-Elce-scorm-monosco-2026-10-22(1.2).zip'
    await rendered.act(() => finishScormExport({ archive: scormArchive, filename: scormFilename }))
    await vi.waitFor(() => expect(exportClientMocks.downloadScorm).toHaveBeenCalledOnce())
    expect(exportClientMocks.downloadScorm).toHaveBeenCalledWith(scormArchive, scormFilename)
    await vi.waitFor(() => expect(rendered.$('#elce-sighty-export-status')?.textContent).toContain('Extrayez cette archive'))

    rendered.cleanup()
    controller.stop()
  })

  it('shows a distinct cancellation button only while a file import is pending', async () => {
    const project = { id: 'import-cancel-project', name: 'Import à annuler', revision: 0 }
    const projectSession: ProjectSessionPort = {
      rememberedProjectId: () => null,
      perform: async (_operation, document) => ({
        projects: [project], activeProject: project, document, status: 'active', editAccess: 'active',
      }),
      startLock: () => { },
      dispose: async () => { },
    }
    let finishSave: () => void = () => {}
    let saveStarted = false
    const deleteMedia = vi.fn(async () => {})
    const store: ElceDocumentStore = {
      loadDocument: async () => null,
      saveDocument: async () => {},
      saveDocumentAndDeleteMedia: async () => {},
      deleteDocument: async () => {},
      deleteMedia,
      loadSyncState: async (documentId) => ({ documentId, remoteRevision: null, uploadedMediaIds: [], status: 'pending' }),
      saveSyncState: async () => {},
      saveMedia: () => new Promise<void>((resolve) => { saveStarted = true; finishSave = resolve }),
      loadMedia: async () => null,
    }
    const controller = createActor(controllerMachine, { input: { projectSession, documentStore: store } })
    controller.start()
    controller.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: null } })
    await vi.waitFor(() => expect(controller.getSnapshot().context.activeProject?.id).toBe(project.id))
    controller.send({ type: 'editor.access.activate' })
    const actions = new LearningEditorFacade(controller)
    actions.createQuestion(controller.getSnapshot().context.document, 'page-a', 1)
    const questionId = controller.getSnapshot().context.document.pages[0]?.bdcIds[1]
    if (questionId === undefined) throw new Error('La Question de test doit exister.')
    const imported = new ElceMediaResourceService().createImport(new File(['image'], 'pending.png', { type: 'image/png' }))
    if (imported === null) throw new Error('Le fichier de test doit être accepté.')
    const rendered = render(<LearningEditorContextProvider controller={controller} actions={actions}>
      <LearningProjectApplication />
    </LearningEditorContextProvider>)

    await rendered.act(() => controller.send({ type: 'question.media.file.import', bdcId: questionId, ...imported }))
    await vi.waitFor(() => expect(rendered.$('#elce-import-cancel')).not.toBeNull())
    await vi.waitFor(() => expect(saveStarted).toBe(true))
    await rendered.act(() => rendered.$('#elce-import-cancel')?.click())
    expect(rendered.$('#elce-import-cancel')).toBeNull()
    expect(controller.getSnapshot().context.document.medias).toHaveLength(0)
    finishSave()
    await vi.waitFor(() => expect(deleteMedia).toHaveBeenCalledWith([imported.media.id]))

    rendered.cleanup()
    controller.stop()
  })

  it('mounts the Remix page and its native BDC editor in the active production workspace', async () => {
    const project = { id: 'page-editor-project', name: 'Projet de test', revision: 0 }
    const projectSession: ProjectSessionPort = {
      rememberedProjectId: () => null,
      perform: async (_operation, document) => ({
        projects: [project],
        activeProject: project,
        document,
        status: 'active',
        editAccess: 'active',
      }),
      startLock: () => { },
      dispose: async () => { },
    }
    const controller = createActor(controllerMachine, { input: { projectSession } })
    controller.start()
    controller.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: null } })
    await vi.waitFor(() => expect(controller.getSnapshot().context.activeProject?.id).toBe(project.id))
    controller.send({ type: 'editor.access.activate' })

    const actions = new LearningEditorFacade(controller)
    const documentModel = controller.getSnapshot().context.document
    const page = documentModel.pages[0]
    if (page === undefined) throw new Error('La fixture de la page Remix est vide.')
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
      fieldPropertyIds: [profileProperty.id],
    })
    actions.createQuestion(documentModel, page.id, page.bdcIds.length)
    const questionId = controller.getSnapshot().context.document.pages[0]?.bdcIds[1]
    if (questionId === undefined) throw new Error('La fixture de la page Remix ne contient pas de Question.')

    const rendered = render(<LearningEditorContextProvider
      controller={controller}
      actions={actions}
    >
      <LearningProjectApplication />
    </LearningEditorContextProvider>)

    await rendered.act(() => Promise.resolve())
    expect(rendered.$('#elce-work-area-title')).not.toBeNull()
    expect(rendered.$('#elce-remix-section-editor-host-bdc-section-1')).not.toBeNull()
    expect(rendered.$(`#elce-question-editor-${questionId}`)).not.toBeNull()
    expect(rendered.$('#elce-content-catalog-title')?.textContent).toBe('Contenus')
    expect(rendered.$('#elce-content-catalog-tab-profile')).toBeNull()

    await rendered.act(() => rendered.$('#elce-history-undo')?.click())
    expect(controller.getSnapshot().context.document.bdcs.some((bdc) => bdc.id === questionId)).toBe(false)
    await rendered.act(() => rendered.$('#elce-history-redo')?.click())
    expect(controller.getSnapshot().context.document.bdcs.some((bdc) => bdc.id === questionId)).toBe(true)

    const title = rendered.$(`#elce-page-title-${page.id}`) as HTMLInputElement | null
    if (title === null) throw new Error('Le titre de page doit être éditable.')
    title.focus()
    title.value = 'Titre en attente'
    await rendered.act(() => title.dispatchEvent(new Event('input', { bubbles: true })))
    expect(controller.getSnapshot().context.document.pages[0]?.name).toBe(page.name)
    await rendered.act(() => rendered.$('#elce-history-undo')?.click())
    expect(controller.getSnapshot().context.document.pages[0]?.name).toBe(page.name)
    expect((rendered.$('#elce-history-redo') as HTMLButtonElement | null)?.disabled).toBe(false)

    await rendered.act(() => document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true,
    })))
    expect(controller.getSnapshot().context.document.pages[0]?.name).toBe('Titre en attente')

    const prompt = rendered.$(`#elce-question-prompt-${questionId}`) as HTMLTextAreaElement | null
    if (prompt === null) throw new Error('La Question de test doit contenir son champ texte.')
    await rendered.act(() => {
      prompt.focus()
      prompt.setSelectionRange(0, prompt.value.length)
    })
    await vi.waitFor(() => expect(rendered.$('#elce-content-catalog-tab-profile')).not.toBeNull())
    await rendered.act(() => rendered.$('#elce-content-catalog-tab-profile')?.click())
    await vi.waitFor(() => expect(rendered.$('#elce-profile-token-insertion-profile-audience')).not.toBeNull())
    await rendered.act(() => {
      const insert = rendered.$('#elce-profile-token-insertion-profile-audience')
      insert?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      insert?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect((rendered.$(`#elce-question-prompt-${questionId}`) as HTMLTextAreaElement).value).toBe('{{profile:profile-audience}}')
    expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === questionId)?.question?.prompt).toBe('{{profile:profile-audience}}')

    await rendered.act(() => (rendered.$('#elce-preview-open') as HTMLButtonElement).focus())
    await vi.waitFor(() => expect(rendered.$('#elce-content-catalog-tab-profile')).toBeNull())

    rendered.cleanup()
    controller.stop()
  })

  it('settles after a loaded anchored image stores its measured ratio', async () => {
    const project = { id: 'loaded-anchor-project', name: 'Image déjà chargée', revision: 0 }
    const projectSession: ProjectSessionPort = {
      rememberedProjectId: () => null,
      perform: async (_operation, document) => ({
        projects: [project], activeProject: project, document, status: 'active', editAccess: 'active',
      }),
      startLock: () => {},
      dispose: async () => {},
    }
    const controller = createActor(controllerMachine, { input: { projectSession } })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const media = { id: 'loaded-image', name: 'photo.png', mimeType: 'image/png', size: 10, caption: '' }
    controller.send({
      type: 'document.apply',
      command: {
        type: 'bdc.anchor.create',
        sectionBdcId: 'bdc-section-1',
        pageId: 'page-a',
        bdcId: 'card-image',
        presetId: DEFAULT_PRESET_ID.PHOTO,
        media,
        partId: 'page-a:card-image:anchor',
        markup: '<p id="section-text-1">Avant <span id="page-a:card-image:anchor" data-elce-anchor="true"></span> après</p>',
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [
            { type: 'text', text: 'Avant ' },
            { type: 'elceAnchor', attrs: {
              bdcId: 'card-image', partId: 'page-a:card-image:anchor', paddingBottom: '75%',
            } },
            { type: 'text', text: ' après' },
          ] }],
        },
      },
    })
    controller.send({ type: 'project.operation', operation: { kind: 'bootstrap', rememberedProjectId: null } })
    await vi.waitFor(() => expect(controller.getSnapshot().context.activeProject?.id).toBe(project.id))
    controller.send({ type: 'media.source.register', mediaId: media.id, source: 'data:image/png;base64,fixture' })

    const complete = vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
    const naturalWidth = vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(400)
    const naturalHeight = vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(200)
    const snapshotCount = { value: 0 }
    const subscription = controller.subscribe(() => { snapshotCount.value += 1 })
    const rendered = render(<LearningEditorContextProvider controller={controller} actions={new LearningEditorFacade(controller)}>
      <LearningProjectApplication />
    </LearningEditorContextProvider>)

    try {
      await vi.waitFor(() => {
        const content = controller.getSnapshot().context.document.bdcs
          .find((bdc) => bdc.id === 'bdc-section-1')?.section?.content
        const anchor = content?.content[0]?.content?.find((node) => node.type === 'elceAnchor')
        expect(anchor?.attrs?.paddingBottom).toBe('50%')
      })
      await new Promise((resolve) => setTimeout(resolve, 30))
      expect(snapshotCount.value).toBeLessThan(20)
      expect(rendered.$('#elce-project-sync-status')?.textContent).not.toBe('Lecture seule')
    } finally {
      rendered.cleanup()
      subscription.unsubscribe()
      complete.mockRestore()
      naturalWidth.mockRestore()
      naturalHeight.mockRestore()
      controller.stop()
    }
  })

  it('updates the central work area when a chapter is selected through the scenario', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new LearningEditorFacade(controller)
    actions.createEvaluationChapter(controller.getSnapshot().context.document)
    const standardChapter = controller.getSnapshot().context.document.chapters.find((chapter) => chapter.type === CHAPTER_TYPE.STANDARD)

    if (standardChapter === undefined) throw new Error('La Fixture ne contient aucun chapitre standard.')

    const rendered = render(<LearningEditorContextProvider
      controller={controller}
      actions={actions}
    >
      <LearningProjectApplication />
    </LearningEditorContextProvider>)

    expect(rendered.$(`#elce-remix-standard-chapter-settings-${standardChapter.id}`)).toBeNull()
    await rendered.act(() => rendered.$(`#elce-chapter-select-${standardChapter.id}`)?.click())

    expect(controller.getSnapshot().context.selection.selectedChapterId).toBe(standardChapter.id)
    expect(rendered.$(`#elce-remix-standard-chapter-settings-${standardChapter.id}`)).not.toBeNull()
    expect(rendered.$('#elce-remix-page-editor-host-container')).toBeNull()

    rendered.cleanup()
    controller.stop()
  })
})

/** Supplies native dialog open and close methods when the DOM test environment omits them. */
function stubDialogMethods(dialog: HTMLDialogElement): Readonly<{ showModal: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> }> {
  const showModal = vi.fn(() => dialog.setAttribute('open', ''))
  const close = vi.fn(() => dialog.removeAttribute('open'))
  Object.defineProperty(dialog, 'showModal', { configurable: true, value: showModal })
  Object.defineProperty(dialog, 'close', { configurable: true, value: close })
  return { showModal, close }
}
