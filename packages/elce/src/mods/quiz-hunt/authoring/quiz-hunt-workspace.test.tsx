// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render } from 'remix/component/test'
import { SectionEditorSession } from '../../../resources/bdcs/section/authoring/section-editor-session'
import type { RemixRenderHandle } from '../../../app/remix/remix-render-handle'
import type { QuizHuntDocument } from '../document/quiz-hunt-document-types'
import { QuizHuntDocumentService } from '../document/quiz-hunt-document-service'
import type { QuizHuntEditorFacade } from './quiz-hunt-editor-facade'
import { renderQuizHuntWorkspace } from './quiz-hunt-workspace'
import type { QuizHuntWorkspaceInteraction, QuizHuntWorkspaceView } from './quiz-hunt-workspace'

describe('Quiz Hunt authoring workspace', () => {
  it('uses the shared editor panels for a selected bank', () => {
    const documents = new QuizHuntDocumentService()
    const initial = documents.createInitialDocument()
    const bank = initial.chapters.find((chapter) => chapter.type === 'questions')!
    const withSecond = documents.createPage(initial, bank.id, 'Question 2')
    const withThird = documents.createPage(withSecond, bank.id, 'Question 3')
    const actions = {} as QuizHuntEditorFacade
    const view = createWorkspaceView(withThird, bank.id)
    const rendered = render(renderQuizHuntWorkspace(
      view,
      actions,
      new SectionEditorSession(),
      {} as RemixRenderHandle,
      createWorkspaceInteraction(),
    ))

    expect(rendered.$('#elce-main')).not.toBeNull()
    expect(rendered.$('#elce-outline')).not.toBeNull()
    expect(rendered.$('#elce-properties')).not.toBeNull()
    expect(rendered.$('#elce-preview-open')).not.toBeNull()
    rendered.cleanup()
  })

  it('lets the Sommaire choose the question that triggers the extra', async () => {
    const documents = new QuizHuntDocumentService()
    const initial = documents.createInitialDocument()
    const questionBank = initial.chapters.find((chapter) => chapter.type === 'questions')!
    const finalBank = initial.chapters.find((chapter) => chapter.type === 'finals')!
    const group = initial.settings.groups[0]!
    const questionPage = initial.pages.find((page) => page.chapterId === questionBank.id)!
    const withQuestionColor = documents.setPageColor(initial, questionPage.id, group.id)
    const withFinal = documents.createPage(withQuestionColor, finalBank.id, 'Finale rouge')
    const withFinalColor = documents.setPageColor(withFinal, withFinal.pages.at(-1)!.id, group.id)
    const changedSettings: unknown[] = []
    const actions = {
      updateSettings: (settings: unknown) => changedSettings.push(settings),
    } as unknown as QuizHuntEditorFacade
    const rendered = render(renderQuizHuntWorkspace(
      createWorkspaceView(withFinalColor, questionBank.id),
      actions,
      new SectionEditorSession(),
      {} as RemixRenderHandle,
      createWorkspaceInteraction(true),
    ))
    const triggerSelect = rendered.$('#quiz-hunt-extra-trigger') as HTMLSelectElement

    expect(Array.from(triggerSelect.options).map((option) => option.textContent)).toEqual(['Selon le seed', questionPage.name])
    await rendered.act(() => {
      triggerSelect.value = questionPage.id
      triggerSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(changedSettings).toEqual([{ extraTriggerPageId: questionPage.id }])
    rendered.cleanup()
  })
})

/** Creates a Quiz Hunt workspace view with test-owned document and selection. */
function createWorkspaceView(document: QuizHuntDocument, chapterId: string): QuizHuntWorkspaceView {
  return {
    document,
    selection: { pageId: null, chapterId, sectionSelection: null },
    historySelection: null,
    mediaSources: {},
    importPending: false,
    editable: true,
    exportBusy: false,
    exportKind: null,
    exportError: null,
    exportNotice: null,
    previewError: null,
    onPreview: () => undefined,
  }
}

/** Creates the shared panel state needed to render Quiz Hunt's author interface. */
function createWorkspaceInteraction(summarySettingsOpen = false): QuizHuntWorkspaceInteraction {
  return {
    panelVisibility: { outline: true, properties: true },
    summarySettingsOpen,
    introductionPage: null,
    resultPage: null,
    getDraggedBdcId: () => null,
    onSetDraggedBdcId: () => undefined,
    dropTarget: null,
    onSetDropTarget: () => undefined,
    isAddContentMenuOpen: false,
    onSetAddContentMenuOpen: () => undefined,
    trashAnimationToken: 0,
    onTrashDropSuccess: () => undefined,
    onSetSummarySettingsOpen: () => undefined,
    onSelectIntroductionPage: () => undefined,
    onSelectResultPage: () => undefined,
    onSetPanelVisibility: () => undefined,
  }
}

