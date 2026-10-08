// @vitest-environment jsdom
import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import { render } from 'remix/ui/test'
import { CHAPTER_TYPE, PAGE_TYPE } from '../../../config/document-config'
import { controllerMachine } from '../../controller/controller-machine'
import { EditorActionsFacade } from '../../facades/editor-actions-facade'
import { selectEditorViewModel } from '../../selectors/editor-view-model'
import { renderEditorWorkspace } from './editor-workspace'
import type { DraggedScenarioEntry, ResponsivePanel } from './editor-workspace-types'

describe('Remix editor workspace', () => {
  it('creates root and chapter Diapos, orders mixed root entries and moves pages by separators', async () => {
    const { controller, mount, cleanup } = createWorkspace()
    let rendered = mount()

    await rendered.act(() => rendered.$('#elce-create-scenario-diapo')?.dispatchEvent(new Event('click', { bubbles: true })))
    let documentModel = controller.getSnapshot().context.document
    const rootDiapo = documentModel.pages.find((page) => page.type === PAGE_TYPE.DIAPO)
    expect(rootDiapo).toMatchObject({ type: PAGE_TYPE.DIAPO, chapterId: null })
    expect(documentModel.data.scenarioEntries.at(-1)).toEqual({ kind: 'page', pageId: rootDiapo?.id })

    rendered.cleanup()
    rendered = mount()
    await rendered.act(() => rendered.$('#elce-create-chapter')?.dispatchEvent(new Event('click', { bubbles: true })))
    documentModel = controller.getSnapshot().context.document
    const secondChapter = documentModel.chapters.at(-1)
    if (secondChapter === undefined || rootDiapo === undefined || secondChapter.type !== CHAPTER_TYPE.STANDARD) {
      throw new Error('Workspace fixture creation failed.')
    }
    rendered.cleanup()
    rendered = mount()
    await rendered.act(() => rendered.$(`#elce-create-diapo-${secondChapter.id}`)?.dispatchEvent(new Event('click', { bubbles: true })))
    documentModel = controller.getSnapshot().context.document
    const chapterDiapo = documentModel.pages.find((page) => page.chapterId === secondChapter.id)
    expect(chapterDiapo?.type).toBe(PAGE_TYPE.DIAPO)

    rendered.cleanup()
    rendered = mount()
    const page = documentModel.pages.find((candidate) => candidate.id === rootDiapo.id)
    if (page === undefined) throw new Error('Root Diapo is missing.')
    const pageRow = rendered.$(`#elce-scenario-entry-list-row-${page.id}`) as HTMLElement
    const dataTransfer = createDataTransfer()
    await rendered.act(() => dispatchDrag(pageRow, 'dragstart', dataTransfer))
    let beforeFirstEntry = rendered.$('#elce-scenario-entry-list-drop-0') as HTMLElement
    await rendered.act(() => dispatchDrag(beforeFirstEntry, 'dragover', dataTransfer))
    rendered.cleanup()
    rendered = mount()
    beforeFirstEntry = rendered.$('#elce-scenario-entry-list-drop-0') as HTMLElement
    expect(beforeFirstEntry.classList.contains('elce-drop-separator--active')).toBe(true)
    expect(pageRow.classList.contains('elce-page-row--drop-target')).toBe(false)
    await rendered.act(() => dispatchDrag(beforeFirstEntry, 'drop', dataTransfer))
    expect(controller.getSnapshot().context.document.data.scenarioEntries[0]).toEqual({ kind: 'page', pageId: rootDiapo.id })

    rendered.cleanup()
    rendered = mount()
    const chapterHeading = rendered.$(`#elce-chapter-heading-${secondChapter.id}`) as HTMLElement
    const beforeFirstChapter = rendered.$('#elce-scenario-entry-list-drop-1') as HTMLElement
    await rendered.act(() => dispatchDrag(chapterHeading, 'dragstart', dataTransfer))
    await rendered.act(() => dispatchDrag(beforeFirstChapter, 'dragover', dataTransfer))
    await rendered.act(() => dispatchDrag(beforeFirstChapter, 'drop', dataTransfer))
    expect(controller.getSnapshot().context.document.data.scenarioEntries[1]).toEqual({
      kind: 'chapter',
      chapterId: secondChapter.id,
    })

    rendered.cleanup()
    rendered = mount()
    const movedRootPage = rendered.$(`#elce-scenario-entry-list-row-${rootDiapo.id}`) as HTMLElement
    const chapterDrop = rendered.$(`#elce-pages-chapter-1-drop-0`) as HTMLElement
    await rendered.act(() => dispatchDrag(movedRootPage, 'dragstart', dataTransfer))
    await rendered.act(() => dispatchDrag(chapterDrop, 'dragover', dataTransfer))
    await rendered.act(() => dispatchDrag(chapterDrop, 'drop', dataTransfer))
    documentModel = controller.getSnapshot().context.document
    expect(documentModel.chapters.find((chapter) => chapter.id === 'chapter-1')?.pageIds).toContain(rootDiapo.id)
    expect(documentModel.data.scenarioEntries.some((entry) => entry.kind === 'page' && entry.pageId === rootDiapo.id)).toBe(false)

    rendered.cleanup()
    rendered = mount()
    await rendered.act(() => rendered.$('#elce-content-catalog-tab-media')?.dispatchEvent(new Event('click', { bubbles: true })))
    rendered.cleanup()
    rendered = mount()
    expect(rendered.$('#elce-content-catalog-tab-media')?.getAttribute('aria-pressed')).toBe('true')
    expect(rendered.$('#elce-content-catalog-tab-bdcs')?.getAttribute('aria-pressed')).toBe('false')

    rendered.cleanup()
    cleanup()
    controller.stop()
  })

  it('opens editable chapter settings in the central work area and deletes a page through XState', async () => {
    const { controller, mount, cleanup } = createWorkspace()
    let rendered = mount()
    const evaluationChapter = controller.getSnapshot().context.document.chapters.find((chapter) => chapter.type === CHAPTER_TYPE.EVALUATION)

    if (evaluationChapter === undefined) throw new Error('Evaluation fixture chapter is missing.')
    await rendered.act(() => rendered.$(`#elce-chapter-select-${evaluationChapter.id}`)?.dispatchEvent(new Event('click', { bubbles: true })))
    rendered.cleanup()
    rendered = mount()
    expect(rendered.$(`#elce-remix-evaluation-chapter-settings-${evaluationChapter.id}`)).not.toBeNull()
    expect(rendered.$(`#elce-remix-evaluation-attempt-limit-${evaluationChapter.id}`)).not.toBeNull()
    expect(rendered.$('#elce-remix-page-editor-host-container')).toBeNull()

    rendered.cleanup()
    rendered = mount()
    const pageId = controller.getSnapshot().context.document.pages[0]?.id
    const pageChapterId = controller.getSnapshot().context.document.pages[0]?.chapterId
    if (pageId === undefined || pageChapterId === null || pageChapterId === undefined) throw new Error('Workspace fixture page is missing.')
    await rendered.act(() => rendered.$(`#elce-pages-${pageChapterId}-delete-${pageId}`)?.dispatchEvent(new Event('click', { bubbles: true })))
    expect(controller.getSnapshot().context.document.pages.some((page) => page.id === pageId)).toBe(false)

    rendered.cleanup()
    cleanup()
    controller.stop()
  })
})

/** Creates a local XState fixture and renders a fresh native workspace view. */
function createWorkspace() {
  const controller = createActor(controllerMachine, { input: {} })
  controller.start()
  controller.send({ type: 'editor.access.activate' })
  const actions = new EditorActionsFacade(controller)
  actions.createEvaluationChapter(controller.getSnapshot().context.document)
  let responsivePanel: ResponsivePanel = null
  let dropTarget: string | null = null
  let draggedEntry: DraggedScenarioEntry = null

  const mount = () => render(<div
    id="elce-remix-workspace-test-host"
  >
    {renderEditorWorkspace({
      view: selectEditorViewModel(controller.getSnapshot()),
      actions,
      pageEditorHost: <div
        id="elce-test-page-editor"
      />,
      responsivePanel,
      dropTarget,
      visible: true,
      onSetResponsivePanel: (panel) => { responsivePanel = panel },
      onSetDropTarget: (target) => { dropTarget = target },
      onSetDraggedEntry: (entry) => { draggedEntry = entry },
      getDraggedEntry: () => draggedEntry,
      onPreview: () => { },
      previewError: null,
      onMovePage: (pageId, placement) => actions.movePage(pageId, placement),
      onMoveChapter: (chapterId, index) => actions.moveChapter(chapterId, index),
    })}
  </div>)
  const cleanup = (): void => {
    responsivePanel = null
    dropTarget = null
    draggedEntry = null
  }

  return { controller, mount, cleanup }
}

/** Creates the small native DataTransfer surface used by browser drag events. */
function createDataTransfer() {
  const values = new Map<string, string>()
  const types: string[] = []
  return {
    effectAllowed: 'none',
    dropEffect: 'none',
    types,
    files: [] as unknown as FileList,
    setData: (type: string, value: string) => {
      values.set(type, value)
      if (!types.includes(type)) types.push(type)
    },
    getData: (type: string) => values.get(type) ?? '',
  }
}

/** Dispatches the browser-shaped event used by the native Remix handlers. */
function dispatchDrag(target: HTMLElement, type: string, dataTransfer: ReturnType<typeof createDataTransfer>): void {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  target.dispatchEvent(event)
}
