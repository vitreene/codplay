// @vitest-environment jsdom
import { createActor } from 'xstate'
import { describe, expect, it, vi } from 'vitest'

import { render } from 'remix/ui/test'
import { CHAPTER_TYPE } from '../../config/document-config'
import type { ElceDocumentStore } from '../../infrastructure/indexed-db/document-store-types'
import { ElceMediaResourceService } from '../../domain/media/media-resource-service'
import { controllerMachine } from '../controller/controller-machine'
import { EditorActionsFacade } from '../facades/editor-actions-facade'
import type { ProjectSessionPort } from '../projects/project-session-types'
import { EditorContextProvider } from './editor-context'
import { ProjectApplication } from './project-application'

describe('Remix project application', () => {
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

    const actions = new EditorActionsFacade(controller)
    const rendered = render(<EditorContextProvider controller={controller} actions={actions}>
      <ProjectApplication />
    </EditorContextProvider>)

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
    const actions = new EditorActionsFacade(controller)
    actions.createQuestion(controller.getSnapshot().context.document, 'page-a', 1)
    const questionId = controller.getSnapshot().context.document.pages[0]?.bdcIds[1]
    if (questionId === undefined) throw new Error('La Question de test doit exister.')
    const imported = new ElceMediaResourceService().createImport(new File(['image'], 'pending.png', { type: 'image/png' }))
    if (imported === null) throw new Error('Le fichier de test doit être accepté.')
    const rendered = render(<EditorContextProvider controller={controller} actions={actions}>
      <ProjectApplication />
    </EditorContextProvider>)

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

    const actions = new EditorActionsFacade(controller)
    const documentModel = controller.getSnapshot().context.document
    const page = documentModel.pages[0]
    if (page === undefined) throw new Error('La fixture de la page Remix est vide.')
    actions.createQuestion(documentModel, page.id, page.bdcIds.length)
    const questionId = controller.getSnapshot().context.document.pages[0]?.bdcIds[1]
    if (questionId === undefined) throw new Error('La fixture de la page Remix ne contient pas de Question.')

    const rendered = render(<EditorContextProvider
      controller={controller}
      actions={actions}
    >
      <ProjectApplication />
    </EditorContextProvider>)

    await rendered.act(() => Promise.resolve())
    expect(rendered.$('#elce-work-area-title')).not.toBeNull()
    expect(rendered.$('#elce-remix-section-editor-host-bdc-section-1')).not.toBeNull()
    expect(rendered.$(`#elce-question-editor-${questionId}`)).not.toBeNull()

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

    rendered.cleanup()
    controller.stop()
  })

  it('updates the central work area when a chapter is selected through the scenario', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new EditorActionsFacade(controller)
    actions.createEvaluationChapter(controller.getSnapshot().context.document)
    const standardChapter = controller.getSnapshot().context.document.chapters.find((chapter) => chapter.type === CHAPTER_TYPE.STANDARD)

    if (standardChapter === undefined) throw new Error('La Fixture ne contient aucun chapitre standard.')

    const rendered = render(<EditorContextProvider
      controller={controller}
      actions={actions}
    >
      <ProjectApplication />
    </EditorContextProvider>)

    expect(rendered.$(`#elce-remix-standard-chapter-settings-${standardChapter.id}`)).toBeNull()
    await rendered.act(() => rendered.$(`#elce-chapter-select-${standardChapter.id}`)?.click())

    expect(controller.getSnapshot().context.selectedChapterId).toBe(standardChapter.id)
    expect(rendered.$(`#elce-remix-standard-chapter-settings-${standardChapter.id}`)).not.toBeNull()
    expect(rendered.$('#elce-remix-page-editor-host-container')).toBeNull()

    rendered.cleanup()
    controller.stop()
  })
})
