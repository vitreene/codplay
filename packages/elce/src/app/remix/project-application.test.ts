// @vitest-environment jsdom
import { createActor } from 'xstate'
import { describe, expect, it, vi } from 'vitest'
import { jsx } from 'remix/ui/jsx-runtime'
import { render } from 'remix/ui/test'
import { CHAPTER_TYPE } from '../../config/document-config'
import { controllerMachine } from '../controller/controller-machine'
import { EditorActionsFacade } from '../facades/editor-actions-facade'
import type { ProjectSessionPort } from '../projects/project-session-types'
import { EditorContextProvider } from './editor-context'
import { ProjectApplication } from './project-application'

describe('Remix project application', () => {
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
      startLock: () => {},
      dispose: async () => {},
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

    const rendered = render(jsx(EditorContextProvider, {
      controller,
      actions,
      children: jsx(ProjectApplication, {}),
    }))

    await rendered.act(() => Promise.resolve())
    expect(rendered.$('#elce-work-area-title')).not.toBeNull()
    expect(rendered.$('#elce-remix-section-editor-host-bdc-section-1')).not.toBeNull()
    expect(rendered.$(`#elce-question-editor-${questionId}`)).not.toBeNull()

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

    const rendered = render(jsx(EditorContextProvider, {
      controller,
      actions,
      children: jsx(ProjectApplication, {}),
    }))

    expect(rendered.$(`#elce-remix-standard-chapter-settings-${standardChapter.id}`)).toBeNull()
    await rendered.act(() => rendered.$(`#elce-chapter-select-${standardChapter.id}`)?.click())

    expect(controller.getSnapshot().context.selectedChapterId).toBe(standardChapter.id)
    expect(rendered.$(`#elce-remix-standard-chapter-settings-${standardChapter.id}`)).not.toBeNull()
    expect(rendered.$('#elce-remix-page-editor-host-container')).toBeNull()

    rendered.cleanup()
    controller.stop()
  })
})
