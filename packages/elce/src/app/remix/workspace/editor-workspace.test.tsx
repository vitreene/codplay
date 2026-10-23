// @vitest-environment jsdom
import { createActor } from 'xstate'
import { describe, expect, it, vi } from 'vitest'

import { render } from 'remix/ui/test'
import { CHAPTER_TYPE, PAGE_TYPE } from '../../../config/document-config'
import { controllerMachine } from '../../controller/controller-machine'
import { EditorActionsFacade } from '../../facades/editor-actions-facade'
import { selectEditorViewModel } from '../../selectors/editor-view-model'
import { renderEditorWorkspace } from './editor-workspace'
import type { DraggedScenarioEntry, ResponsivePanel } from './editor-workspace-types'

describe('Remix editor workspace', () => {
  it('keeps preview beside panel access commands and leaves export in the title bar', async () => {
    const onPreview = vi.fn()
    const previewError = 'Le navigateur a bloqué la fenêtre de lecture.'
    const { controller, mount, cleanup } = createWorkspace(onPreview, previewError)
    let rendered = mount()

    expect(rendered.$('#elce-responsive-panel-access #elce-preview-open')).not.toBeNull()
    expect(rendered.$('#elce-responsive-panel-access #elce-export-open')).toBeNull()
    expect(rendered.$('#elce-work-area-preview-row')).toBeNull()
    expect(rendered.$('#elce-workspace-access-area #elce-preview-open-error')?.textContent).toBe(previewError)
    await rendered.act(() => rendered.$('#elce-preview-open')?.dispatchEvent(new Event('click', { bubbles: true })))
    expect(onPreview).toHaveBeenCalledOnce()

    const evaluationChapter = controller.getSnapshot().context.document.chapters.find((chapter) => chapter.type === CHAPTER_TYPE.EVALUATION)
    if (evaluationChapter === undefined) throw new Error('Evaluation fixture chapter is missing.')
    rendered.cleanup()
    rendered = mount()
    await rendered.act(() => rendered.$(`#elce-chapter-select-${evaluationChapter.id}`)?.dispatchEvent(new Event('click', { bubbles: true })))
    rendered.cleanup()
    rendered = mount()

    expect(rendered.$(`#elce-remix-evaluation-chapter-settings-${evaluationChapter.id}`)).not.toBeNull()
    expect(rendered.$('#elce-responsive-panel-access #elce-preview-open')).not.toBeNull()
    expect(rendered.$('#elce-responsive-panel-access #elce-export-open')).toBeNull()
    expect(rendered.$('#elce-responsive-panel-access')?.querySelectorAll('#elce-preview-open')).toHaveLength(1)

    rendered.cleanup()
    cleanup()
    controller.stop()
  })

  it('disables an active package export and announces its result accessibly', () => {
    const { controller, mount, cleanup } = createWorkspace(
      () => undefined,
      null,
      true,
      null,
      null,
    )
    const rendered = mount()

    expect(rendered.$('#elce-sighty-export-status')?.textContent).toBe('Préparation de l’export du scénario…')
    expect(rendered.$('#elce-sighty-export-status')?.getAttribute('role')).toBe('status')

    rendered.cleanup()
    cleanup()
    controller.stop()
  })

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

  it('opens the Sommaire and profile editor and commits a stable profile property through XState', async () => {
    const { controller, mount, cleanup, setProfileTokenTargetId } = createWorkspace()
    let rendered = mount()

    expect(rendered.$('#elce-summary-profile-open')?.getAttribute('aria-label')).toBe('Sommaire')
    expect(rendered.$('#elce-summary-profile-open-icon')?.classList.contains('lucide-list')).toBe(true)
    await rendered.act(() => rendered.$('#elce-summary-profile-open')?.dispatchEvent(new Event('click', { bubbles: true })))
    rendered.cleanup()
    rendered = mount()
    expect(rendered.$('#elce-summary-profile-settings-title')?.textContent).toBe('Sommaire')
    expect((rendered.$('#elce-summary-title') as HTMLInputElement | null)?.value).toBe('Sommaire')

    await rendered.act(() => rendered.$('#elce-profile-property-add')?.dispatchEvent(new Event('click', { bubbles: true })))
    expect(controller.getSnapshot().context.document.data.profile.properties).toHaveLength(1)
    expect(controller.getSnapshot().context.document.data.profile.fieldPropertyIds).toEqual([
      controller.getSnapshot().context.document.data.profile.properties[0]?.id,
    ])
    const propertyId = controller.getSnapshot().context.document.data.profile.properties[0]?.id
    if (propertyId === undefined) throw new Error('The profile property was not created.')
    rendered.cleanup()
    rendered = mount()
    expect(rendered.$('#elce-profile-property-list')?.children).toHaveLength(1)

    await rendered.act(() => rendered.$('#elce-summary-profile-open')?.dispatchEvent(new Event('click', { bubbles: true })))
    rendered.cleanup()
    rendered = mount()
    expect(rendered.$('#elce-content-catalog-title')?.textContent).toBe('Contenus')
    expect(rendered.$('#elce-workspace-profile-token-insertion')).toBeNull()
    expect(rendered.$('#elce-content-catalog-tab-profile')).toBeNull()
    setProfileTokenTargetId('elce-test-profile-target')
    rendered.cleanup()
    rendered = mount()
    expect(rendered.$('#elce-content-catalog-tab-profile')?.textContent).toBe('Profil')
    await rendered.act(() => rendered.$('#elce-content-catalog-tab-profile')?.dispatchEvent(new Event('click', { bubbles: true })))
    rendered.cleanup()
    rendered = mount()
    expect(rendered.$('#elce-content-catalog-tab-profile')?.getAttribute('aria-pressed')).toBe('true')
    expect(rendered.$(`#elce-profile-token-insertion-${propertyId}`)).not.toBeNull()

    const target = rendered.$('#elce-test-profile-target') as HTMLTextAreaElement
    target.focus()
    target.setSelectionRange(8, 13)
    await rendered.act(() => {
      const insert = rendered.$(`#elce-profile-token-insertion-${propertyId}`)
      insert?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      insert?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(target.value).toBe(`Bonjour {{profile:${propertyId}}}`)

    setProfileTokenTargetId(null)
    rendered.cleanup()
    rendered = mount()
    expect(rendered.$('#elce-content-catalog-tab-profile')).toBeNull()
    expect(rendered.$('#elce-catalog-profile')?.hasAttribute('hidden')).toBe(true)

    rendered.cleanup()
    cleanup()
    controller.stop()
  })
})

/** Creates a local XState fixture and renders a fresh native workspace view. */
function createWorkspace(
  onPreview: () => void = () => undefined,
  previewError: string | null = null,
  exportBusy = false,
  exportError: string | null = null,
  exportNotice: string | null = null,
) {
  const controller = createActor(controllerMachine, { input: {} })
  controller.start()
  controller.send({ type: 'editor.access.activate' })
  const actions = new EditorActionsFacade(controller)
  actions.createEvaluationChapter(controller.getSnapshot().context.document)
  let responsivePanel: ResponsivePanel = null
  let summarySettingsOpen = false
  let profileTokenTargetId: string | null = null
  let authoringError: string | null = null
  let dropTarget: string | null = null
  let draggedEntry: DraggedScenarioEntry = null

  const mount = () => render(<div
    id="elce-remix-workspace-test-host"
  >
    {renderEditorWorkspace({
      view: selectEditorViewModel(controller.getSnapshot()),
      actions,
      pageEditorHost: <div id="elce-test-page-editor">
        <textarea id="elce-test-profile-target" data-elce-profile-token-target="true" defaultValue="Bonjour monde" />
      </div>,
      responsivePanel,
      summarySettingsOpen,
      profileTokenTargetId,
      authoringError,
      dropTarget,
      visible: true,
      onSetResponsivePanel: (panel) => { responsivePanel = panel },
      onSetSummarySettingsOpen: (open) => { summarySettingsOpen = open },
      onSetAuthoringError: (error) => { authoringError = error },
      onSetDropTarget: (target) => { dropTarget = target },
      onSetDraggedEntry: (entry) => { draggedEntry = entry },
      getDraggedEntry: () => draggedEntry,
      onPreview,
      previewError,
      exportBusy,
      exportKind: null,
      exportError,
      exportNotice,
      onMovePage: (pageId, placement) => actions.movePage(pageId, placement),
      onMoveChapter: (chapterId, index) => actions.moveChapter(chapterId, index),
    })}
  </div>)
  const cleanup = (): void => {
    responsivePanel = null
    summarySettingsOpen = false
    profileTokenTargetId = null
    authoringError = null
    dropTarget = null
    draggedEntry = null
  }

  return { controller, mount, cleanup, setProfileTokenTargetId: (targetId: string | null) => { profileTokenTargetId = targetId } }
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
