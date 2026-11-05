// @vitest-environment jsdom
import { createActor } from 'xstate'
import { describe, expect, it, vi } from 'vitest'

import { render } from 'remix/component/test'
import { CHAPTER_TYPE } from '../organization/learning-organization-config'
import { learningControllerMachine as controllerMachine } from './learning-controller-machine'
import { LearningEditorFacade } from './learning-editor-facade'
import { renderEditorWorkspace } from './learning-workspace'
import type { DraggedScenarioEntry, ResponsivePanel } from './learning-workspace-types'

describe('Remix editor workspace', () => {
  it('keeps the summary first in the scenario without changing document pages or insertion positions', async () => {
    const { controller, mount, cleanup } = createWorkspace()
    const initial = controller.getSnapshot().context.document
    let rendered = mount()
    expect(rendered.$('#elce-scenario-entry-list')?.firstElementChild?.id).toBe('elce-scenario-summary-entry')
    rendered.cleanup()

    controller.send({ type: 'document.apply', command: {
      type: 'summary.settings.update', summary: { ...initial.data.summary, showAtRoot: true },
    } })
    rendered = mount()
    expect(rendered.$('#elce-scenario-entry-list')?.firstElementChild?.id).toBe('elce-scenario-summary-entry')
    expect(rendered.$('#elce-scenario-entry-list')?.children[1]?.id).toBe('elce-scenario-entry-list-drop-0')
    expect(rendered.$('#elce-scenario-summary-entry')?.querySelector('[draggable], .elce-delete-button')).toBeNull()
    await rendered.act(() => (rendered.$('#elce-scenario-summary-page') as HTMLButtonElement).click())
    rendered.cleanup()
    rendered = mount()
    expect(rendered.$('#elce-summary-show-at-root-label')?.textContent).toBe('Afficher comme page')
    const checkbox = rendered.$('#elce-summary-show-at-root') as HTMLInputElement
    expect(checkbox.checked).toBe(true)
    await rendered.act(() => checkbox.click())
    rendered.cleanup()
    rendered = mount()
    expect(rendered.$('#elce-scenario-entry-list')?.firstElementChild?.id).toBe('elce-scenario-summary-entry')
    expect(controller.getSnapshot().context.document.pages).toEqual(initial.pages)
    expect(controller.getSnapshot().context.document.data.scenarioEntries).toEqual(initial.data.scenarioEntries)

    rendered.cleanup()
    cleanup()
    controller.stop()
  })

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

    expect(rendered.$('#elce-scenario-summary-page')).not.toBeNull()
    expect(rendered.$('#elce-scenario-summary-page-icon')?.classList.contains('lucide-list')).toBe(true)
    await rendered.act(() => rendered.$('#elce-scenario-summary-page')?.dispatchEvent(new Event('click', { bubbles: true })))
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

    await rendered.act(() => rendered.$('#elce-scenario-summary-page')?.dispatchEvent(new Event('click', { bubbles: true })))
    rendered.cleanup()
    rendered = mount()
    expect(rendered.$('#elce-content-catalog-title')?.textContent).toBe('Contenus')
    expect(rendered.$('#elce-workspace-profile-token-insertion')).toBeNull()
    expect(rendered.$('#elce-content-catalog-tab-profile')).toBeNull()
    setProfileTokenTargetId('elce-test-profile-target')
    rendered.cleanup()
    rendered = mount()
    expect(rendered.$('#elce-content-catalog-tab-profile')?.textContent).toBe('Variables')
    await rendered.act(() => rendered.$('#elce-content-catalog-tab-profile')?.dispatchEvent(new Event('click', { bubbles: true })))
    rendered.cleanup()
    rendered = mount()
    expect(rendered.$('#elce-content-catalog-tab-profile')?.getAttribute('aria-pressed')).toBe('true')
    expect(rendered.$(`#elce-profile-token-insertion-profile-${propertyId}`)).not.toBeNull()

    const target = rendered.$('#elce-test-profile-target') as HTMLTextAreaElement
    target.focus()
    target.setSelectionRange(8, 13)
    await rendered.act(() => {
      const insert = rendered.$(`#elce-profile-token-insertion-profile-${propertyId}`)
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
  const actions = new LearningEditorFacade(controller)
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
      view: actions.authoring.selectEditorViewModel(controller.getSnapshot()),
      actions,
      pageEditorHost: <div id="elce-test-page-editor">
        <textarea id="elce-test-profile-target" data-elce-profile-token-target="true" defaultValue="Bonjour monde" />
      </div>,
      responsivePanel,
      sidePanelTab: 'contents',
      appearanceTarget: { kind: 'document' },
      summarySettingsOpen,
      profileTokenTargetId,
      selectedInlineLabel: null,
      authoringError,
      dropTarget,
      visible: true,
      onSetResponsivePanel: (panel) => { responsivePanel = panel },
      onSetSidePanelTab: () => undefined,
      onOpenAppearanceTarget: () => undefined,
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
