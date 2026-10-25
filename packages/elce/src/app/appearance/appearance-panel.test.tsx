// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createActor } from 'xstate'
import { render } from 'remix/ui/test'
import { BDC_TYPE, CHAPTER_TYPE, PAGE_LOCATION } from '../../config/document-config'
import type { AppearanceTarget } from '../../domain/commands/document-command-types'
import { controllerMachine } from '../controller/controller-machine'
import { EditorActionsFacade } from '../facades/editor-actions-facade'
import { selectEditorViewModel } from '../selectors/editor-view-model'
import { appearanceThemeCssAssetPathsForDocument } from '../../player/appearance-scene-style-sheet'
import { renderAppearancePanel } from './appearance-panel'

describe('appearance panel targets', () => {
  it('offers the shared appearance controls for the project, page, and every BDC type', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new EditorActionsFacade(controller)
    const initialDocument = controller.getSnapshot().context.document
    const page = initialDocument.pages[0]
    if (page === undefined) throw new Error('The appearance panel fixture has no page.')

    actions.createEvaluationChapter(initialDocument)
    let documentModel = controller.getSnapshot().context.document
    const evaluationChapter = documentModel.chapters.find((chapter) => chapter.type === CHAPTER_TYPE.EVALUATION)
    if (evaluationChapter === undefined) throw new Error('The appearance panel fixture has no Evaluation chapter.')
    actions.movePage(page.id, { kind: PAGE_LOCATION.CHAPTER, chapterId: evaluationChapter.id })
    documentModel = controller.getSnapshot().context.document
    let currentPage = documentModel.pages.find((candidate) => candidate.id === page.id)
    if (currentPage === undefined) throw new Error('The appearance panel fixture lost its page.')
    actions.createQuestion(documentModel, page.id, currentPage.bdcIds.length)
    documentModel = controller.getSnapshot().context.document
    currentPage = documentModel.pages.find((candidate) => candidate.id === page.id)
    if (currentPage === undefined) throw new Error('The appearance panel fixture lost its page after Question creation.')
    actions.createEvaluationResult(page.id, currentPage.bdcIds.length)
    documentModel = controller.getSnapshot().context.document
    currentPage = documentModel.pages.find((candidate) => candidate.id === page.id)
    if (currentPage === undefined) throw new Error('The appearance panel fixture lost its page after Result creation.')
    actions.createCarousel(page.id, currentPage.bdcIds.length)
    documentModel = controller.getSnapshot().context.document
    currentPage = documentModel.pages.find((candidate) => candidate.id === page.id)
    if (currentPage === undefined) throw new Error('The appearance panel fixture lost its page after Carousel creation.')
    actions.createStatisticalGraph(page.id, currentPage.bdcIds.length)
    documentModel = controller.getSnapshot().context.document

    const targets: AppearanceTarget[] = [
      { kind: 'document' },
      { kind: 'page', pageId: page.id },
      ...documentModel.bdcs.map((bdc) => ({ kind: 'bdc' as const, bdcId: bdc.id })),
    ]
    const expectedBdcTypes = new Set([
      BDC_TYPE.SECTION,
      BDC_TYPE.QUESTION,
      BDC_TYPE.EVALUATION_RESULT,
      BDC_TYPE.CAROUSEL,
      BDC_TYPE.CARD,
      BDC_TYPE.STATISTICAL_GRAPH,
    ])
    expect(new Set(documentModel.bdcs.map((bdc) => bdc.type))).toEqual(expectedBdcTypes)

    for (const target of targets) {
      const rendered = render(<div id="appearance-panel-test-root">
        {renderAppearancePanel({ view: selectEditorViewModel(controller.getSnapshot()), actions, target })}
      </div>)

      expect(rendered.$('#elce-appearance-palette-select')).not.toBeNull()
      expect(rendered.$('#elce-appearance-color-group-label')?.textContent).toBe('Couleurs')
      expect(rendered.$('#elce-appearance-background-picker')).not.toBeNull()
      expect(rendered.$('#elce-appearance-typography-pair-select')).not.toBeNull()
      expect(rendered.$('#elce-appearance-heading-font-select')).toBeNull()
      expect(rendered.$('#elce-appearance-body-font-select')).toBeNull()
      expect(rendered.$('#elce-appearance-density-select')).not.toBeNull()
      expect(rendered.$('#elce-appearance-auto-contrast')).not.toBeNull()
      expect((rendered.$('#elce-appearance-palette-select') as HTMLSelectElement | null)?.value).toBe('classic')
      expect((rendered.$('#elce-appearance-typography-pair-select') as HTMLSelectElement | null)?.value)
        .toBe('crimson-dm-sans')
      expect((rendered.$('#elce-appearance-density-select') as HTMLSelectElement | null)?.value).toBe('normal')
      expect(rendered.$('#elce-appearance-preset-select') !== null).toBe(target.kind === 'document')
      if (target.kind === 'document') {
        expect((rendered.$('#elce-appearance-preset-select') as HTMLSelectElement).value).toBe('classic')
      }
      expect(rendered.$('#elce-appearance-target-context')?.textContent).not.toMatch(/hérit|hérite/i)

      rendered.cleanup()
    }

    const textCard = documentModel.bdcs.find((bdc) => bdc.type === BDC_TYPE.CARD)
    const textCardParent = textCard?.parentBdcId === null || textCard?.parentBdcId === undefined
      ? undefined
      : documentModel.bdcs.find((bdc) => bdc.id === textCard.parentBdcId)
    const textCardPageId = textCard?.pageId ?? textCardParent?.pageId
    if (textCard === undefined || textCardPageId == null) throw new Error('The appearance panel fixture has no text Card on a page.')
    const densityPanel = render(<div id="appearance-density-test-root">
      {renderAppearancePanel({
        view: selectEditorViewModel(controller.getSnapshot()),
        actions,
        target: { kind: 'bdc', bdcId: textCard.id },
      })}
    </div>)
    const densitySelect = densityPanel.$('#elce-appearance-density-select') as HTMLSelectElement | null
    if (densitySelect === null) throw new Error('The text Card panel has no density select.')
    await densityPanel.act(() => {
      densitySelect.value = 'large'
      densitySelect.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const pairSelect = densityPanel.$('#elce-appearance-typography-pair-select') as HTMLSelectElement | null
    if (pairSelect === null) throw new Error('The text Card panel has no font-pair suggestion select.')
    await densityPanel.act(() => {
      pairSelect.value = 'inter-krub'
      pairSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const updatedDocument = controller.getSnapshot().context.document
    const updatedCard = updatedDocument.bdcs.find((bdc) => bdc.id === textCard.id)
    if (updatedCard === undefined) throw new Error('The changed text Card is absent from its document.')
    expect(updatedCard.appearance?.density).toBe('large')
    expect(updatedCard.appearance).toMatchObject({ headingFontId: 'inter', bodyFontId: 'krub' })
    expect(appearanceThemeCssAssetPathsForDocument(updatedDocument)).toContain('densities/large.css')
    densityPanel.cleanup()

    const transparentPanel = render(<div id="appearance-transparent-test-root">
      {renderAppearancePanel({
        view: selectEditorViewModel(controller.getSnapshot()),
        actions,
        target: { kind: 'bdc', bdcId: textCard.id },
      })}
    </div>)
    const transparentToggle = transparentPanel.$('#elce-appearance-background-transparent') as HTMLInputElement | null
    if (transparentToggle === null) throw new Error('The text Card panel has no Transparent checkbox.')
    await transparentPanel.act(() => {
      transparentToggle.checked = true
      transparentToggle.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === textCard.id)?.appearance?.density).toBe('none')
    const backgroundPicker = transparentPanel.$('#elce-appearance-background-picker') as HTMLInputElement | null
    if (backgroundPicker === null) throw new Error('The text Card panel has no background color picker.')
    await transparentPanel.act(() => {
      backgroundPicker.value = '#324b5a'
      backgroundPicker.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const reactivatedCard = controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === textCard.id)
    expect(reactivatedCard?.appearance?.density).toBe('normal')
    expect(reactivatedCard?.appearance?.background).toEqual({ kind: 'custom', value: '#324b5a' })
    transparentPanel.cleanup()

    controller.stop()
  })
})
