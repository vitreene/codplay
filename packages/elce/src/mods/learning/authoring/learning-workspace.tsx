import type { RemixNode } from 'remix/component'

import { PAGE_LOCATION } from '../organization/learning-page-placement'
import { SCENARIO_ENTRY_KIND } from '../organization/learning-organization-config'
import type { PagePlacement } from '../organization/learning-page-placement'
import type { ScenarioEntry } from '../organization/learning-scenario-entry-types'
import type { ScenarioEntryPlacement } from '../organization/learning-scenario-entry-types'
import { renderChapterSettings } from './chapter-settings'
import { renderLearningContentCatalogPanel } from './learning-content-catalog-panel'
import { renderScenarioPanel } from './scenario-panel'
import type { EditorWorkspaceViewProps, WorkspacePanelName } from './learning-workspace-types'
import type { ScenarioPanelProps } from './scenario-panel-types'
import { renderSummaryProfileSettings } from './summary-profile-settings'
import { CLIPBOARD_TAB } from './learning-authoring-config'
import type { ClipboardTab } from './learning-authoring-config'
import { renderEditorFrame } from '../../../core/authoring/layout/editor-frame'
import type { DraggedScenarioEntry } from './learning-workspace-types'
import { editorPanelVisibilityFromResponsiveState } from '../../../core/authoring/layout/editor-panel-state'
import { createLearningTextFieldFeature } from '../inline-text/learning-inline-text-field'
import type { ProfileDefinition } from '../profile/domain/learning-profile-types'

/** Holds Learning-only workspace state that the shared project view does not own. */
export class LearningWorkspaceState {
  public summarySettingsOpen = false
  public clipboardTab: ClipboardTab = CLIPBOARD_TAB.PAGES
  public profileDraft: ProfileDefinition | null = null
  public profileTokenTargetId: string | null = null
  public selectedInlineLabel = null as import('../profile/authoring/profile-token-events').InlineTextLabelSelection | null
  public draggedEntry: DraggedScenarioEntry = null
}

/** Composes the native Remix scenario, chapter-settings and catalog surfaces. */
export function renderEditorWorkspace(props: EditorWorkspaceViewProps): RemixNode {
  const clipboardTab = props.clipboardTab ?? CLIPBOARD_TAB.PAGES
  const setClipboardTab = props.onSetClipboardTab ?? (() => {})
  const panelVisibility = props.panelVisibility
    ?? editorPanelVisibilityFromResponsiveState(props.responsivePanel, typeof window === 'undefined' ? 1280 : window.innerWidth)
  const scenarioPageIds = new Set(props.view.documentModel.scenarioPageIds)
  const textFieldFeature = createLearningTextFieldFeature(
    props.view.documentModel.data.profile.properties,
    props.view.documentModel.pages.filter((page) => scenarioPageIds.has(page.id)),
  )
  const scenarioProps: ScenarioPanelProps = {
    workspace: props,
    getDraggedEntry: props.getDraggedEntry,
    onSetDropTarget: props.onSetDropTarget,
    onDragStartPage: (event, pageId) => beginPageDrag(event, { kind: SCENARIO_ENTRY_KIND.PAGE, pageId }, props.onSetDraggedEntry),
    onDragStartChapter: (event, chapterId) => beginPageDrag(event, { kind: SCENARIO_ENTRY_KIND.CHAPTER, chapterId }, props.onSetDraggedEntry),
    onDragEnd: () => finishPageDrag(props.onSetDraggedEntry, props.onSetDropTarget),
    onDragOverScenarioEntry: (event, targetId) => dragOverRoot(event, targetId, props.getDraggedEntry, props.onSetDropTarget),
    onDragOverPage: (event, targetId) => dragOverPage(event, targetId, props.getDraggedEntry, props.onSetDropTarget),
    onDropScenarioEntry: (event, placement) => dropScenarioEntry(event, placement, props),
    onDropPage: (event, placement) => dropPageEntry(event, placement, props),
    onDragLeave: (event) => dragLeaveSeparator(event, props.onSetDropTarget),
  }
  const center = props.summarySettingsOpen
    ? <div id="elce-summary-profile-settings-host" className="elce-remix-center-column">
      {renderSummaryProfileSettings({
        document: props.view.documentModel,
        mediaSources: props.view.mediaSources,
        actions: props.actions,
        profileDraft: props.profileDraft,
        getProfileDraft: props.getProfileDraft,
        onProfileDraftChange: props.onSetProfileDraft,
        error: props.authoringError,
        onClose: () => props.onSetSummarySettingsOpen(false),
        onError: props.onSetAuthoringError,
      })}
    </div>
    : props.view.selectedChapter === undefined
    ? <div
      id="elce-remix-page-editor-host-container"
      className="elce-remix-page-editor-host elce-remix-center-column"
    >
      {props.pageEditorHost}
    </div>
    : <div
      id="elce-remix-chapter-settings-host"
      className="elce-remix-center-column"
    >
      {renderChapterSettings({
        chapter: props.view.selectedChapter,
        actions: props.actions,
        textFieldFeature,
      })}
    </div>

  return renderEditorFrame({
    leftPanel: renderScenarioPanel(scenarioProps),
    center,
    rightPanel: renderLearningContentCatalogPanel({
      view: props.view,
      actions: props.actions,
      responsivePanel: props.responsivePanel,
      panelOpen: panelVisibility.properties,
      onSetPanelVisibility: props.onSetPanelVisibility,
      onSetResponsivePanel: props.onSetResponsivePanel,
      sidePanelTab: props.sidePanelTab,
      appearanceTarget: props.appearanceTarget,
      onSetSidePanelTab: props.onSetSidePanelTab,
      profileTokenTargetId: props.profileTokenTargetId,
      selectedInlineLabel: props.selectedInlineLabel,
      scenario: scenarioProps,
      clipboardTab,
      dropTarget: props.dropTarget,
      getDraggedEntry: props.getDraggedEntry,
      onSetClipboardTab: setClipboardTab,
      onSetDropTarget: props.onSetDropTarget,
      onSetDraggedEntry: props.onSetDraggedEntry,
      onOpenAppearanceTarget: props.onOpenAppearanceTarget,
    }),
    workspaceAction: null,
    workspaceOverlay: null,
    panelVisibility,
    propertiesPanelLabel: 'Presse-papiers',
    visible: props.visible,
    editable: props.editable,
    onSetPanelVisibility: (panel: WorkspacePanelName, open: boolean, triggerId?: string) => {
      if (props.onSetPanelVisibility !== undefined) props.onSetPanelVisibility(panel, open, triggerId)
      else props.onSetResponsivePanel(open ? panel : null, triggerId)
    },
    onPreview: props.onPreview,
    previewError: props.previewError,
    exportBusy: props.exportBusy,
    exportKind: props.exportKind ?? null,
    exportError: props.exportError,
    exportNotice: props.exportNotice,
  })
}

/** Starts a native page or chapter drag and stores its typed source. */
function beginPageDrag(event: DragEvent, entry: ScenarioEntry, setDraggedEntry: (entry: ScenarioEntry | null) => void): void {
  const transfer = event.dataTransfer
  if (transfer === null) return
  setDraggedEntry(entry)
  transfer.effectAllowed = 'move'
  switch (entry.kind) {
    case SCENARIO_ENTRY_KIND.PAGE:
      transfer.setData('text/plain', entry.pageId)
      return
    case SCENARIO_ENTRY_KIND.CHAPTER:
      transfer.setData('text/plain', entry.chapterId)
      return
  }
}

/** Clears transient drag state after the browser ends a page or chapter drag. */
function finishPageDrag(
  setDraggedEntry: (entry: ScenarioEntry | null) => void,
  setDropTarget: (targetId: string | null) => void,
): void {
  setDraggedEntry(null)
  setDropTarget(null)
}

/** Accepts a page or chapter drag at a root insertion separator. */
function dragOverRoot(
  event: DragEvent,
  targetId: string,
  getDraggedEntry: () => ScenarioEntry | null,
  setDropTarget: (targetId: string | null) => void,
): void {
  if (getDraggedEntry() === null) return
  const transfer = event.dataTransfer
  if (transfer === null) return
  event.preventDefault()
  event.stopPropagation()
  transfer.dropEffect = 'move'
  setDropTarget(targetId)
}

/** Accepts only a page at a chapter or catalog insertion separator. */
function dragOverPage(
  event: DragEvent,
  targetId: string,
  getDraggedEntry: () => ScenarioEntry | null,
  setDropTarget: (targetId: string | null) => void,
): void {
  const entry = getDraggedEntry()
  switch (entry?.kind) {
    case SCENARIO_ENTRY_KIND.PAGE:
      break
    case SCENARIO_ENTRY_KIND.CHAPTER:
      event.stopPropagation()
      return
    default:
      return
  }
  const transfer = event.dataTransfer
  if (transfer === null) return
  event.preventDefault()
  event.stopPropagation()
  transfer.dropEffect = 'move'
  setDropTarget(targetId)
}

/** Clears the active insertion line after the pointer leaves its separator. */
function dragLeaveSeparator(event: DragEvent, setDropTarget: (targetId: string | null) => void): void {
  const currentTarget = event.currentTarget
  if (currentTarget instanceof Node && event.relatedTarget instanceof Node && currentTarget.contains(event.relatedTarget)) return
  setDropTarget(null)
}

/** Applies a page or chapter move to one mixed scenario entry list. */
function dropScenarioEntry(event: DragEvent, placement: ScenarioEntryPlacement, props: EditorWorkspaceViewProps): void {
  const entry = props.getDraggedEntry()
  switch (entry?.kind) {
    case SCENARIO_ENTRY_KIND.PAGE:
      event.preventDefault()
      event.stopPropagation()
      props.onMovePage(entry.pageId, placement.parentChapterId === null
        ? { kind: PAGE_LOCATION.SCENARIO, index: placement.index }
        : { kind: PAGE_LOCATION.CHAPTER, chapterId: placement.parentChapterId, index: placement.index })
      finishPageDrag(props.onSetDraggedEntry, props.onSetDropTarget)
      return
    case SCENARIO_ENTRY_KIND.CHAPTER:
      event.preventDefault()
      event.stopPropagation()
      props.onMoveChapter(entry.chapterId, placement.index, placement.parentChapterId)
      finishPageDrag(props.onSetDraggedEntry, props.onSetDropTarget)
      return
    default:
      return
  }
}

/** Applies a page move within or between page lists using its explicit placement. */
function dropPageEntry(event: DragEvent, placement: PagePlacement, props: EditorWorkspaceViewProps): void {
  const entry = props.getDraggedEntry()
  switch (entry?.kind) {
    case SCENARIO_ENTRY_KIND.PAGE:
      event.preventDefault()
      event.stopPropagation()
      props.onMovePage(entry.pageId, placement)
      finishPageDrag(props.onSetDraggedEntry, props.onSetDropTarget)
      return
    case SCENARIO_ENTRY_KIND.CHAPTER:
      event.stopPropagation()
      return
    default:
      return
  }
}
