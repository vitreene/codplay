// @vitest-environment jsdom
import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import { jsx } from 'remix/ui/jsx-runtime'
import { render } from 'remix/ui/test'
import { CHAPTER_TYPE } from '../../config/document-config'
import { controllerMachine } from '../controller/controller-machine'
import { EditorActionsFacade } from '../facades/editor-actions-facade'
import { EditorContextProvider } from './editor-context'
import { ProjectApplication } from './project-application'

describe('Remix project application', () => {
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
