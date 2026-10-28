import type { RemixNode } from 'remix/ui'

import { PAGE_LOCATION } from '../organization/learning-page-placement'
import { SCENARIO_ENTRY_KIND } from '../organization/learning-organization-config'
import type { PagePlacement } from '../organization/learning-page-placement'
import type { ScenarioEntry } from '../organization/learning-scenario-entry-types'
import { renderChapterSettings } from './chapter-settings'
import { renderLearningContentCatalogPanel } from './learning-content-catalog-panel'
import { renderScenarioPanel } from './scenario-panel'
import type { EditorWorkspaceViewProps } from './learning-workspace-types'
import type { ScenarioPanelProps } from './scenario-panel-types'
import { renderSummaryProfileSettings } from './summary-profile-settings'
import { renderEditorFrame } from '../../../core/authoring/layout/editor-frame'
import type { DraggedScenarioEntry } from './learning-workspace-types'

/** Holds Learning-only workspace state that the shared project view does not own. */
export class LearningWorkspaceState {
  public summarySettingsOpen = false
  public profileTokenTargetId: string | null = null
  public draggedEntry: DraggedScenarioEntry = null
}

/** Composes the native Remix scenario, chapter-settings and catalog surfaces. */
export function renderEditorWorkspace(props: EditorWorkspaceViewProps): RemixNode {
  const scenarioProps: ScenarioPanelProps = {
    workspace: props,
    onDragStartPage: (event, pageId) => beginPageDrag(event, { kind: SCENARIO_ENTRY_KIND.PAGE, pageId }, props.onSetDraggedEntry),
    onDragStartChapter: (event, chapterId) => beginPageDrag(event, { kind: SCENARIO_ENTRY_KIND.CHAPTER, chapterId }, props.onSetDraggedEntry),
    onDragEnd: () => finishPageDrag(props.onSetDraggedEntry, props.onSetDropTarget),
    onDragOverRoot: (event, targetId) => dragOverRoot(event, targetId, props.getDraggedEntry, props.onSetDropTarget),
    onDragOverPage: (event, targetId) => dragOverPage(event, targetId, props.getDraggedEntry, props.onSetDropTarget),
    onDropRoot: (event, placement) => dropScenarioEntry(event, placement, props),
    onDropPage: (event, placement) => dropPageEntry(event, placement, props),
    onDragLeave: (event) => dragLeaveSeparator(event, props.onSetDropTarget),
  }
  const center = props.summarySettingsOpen
    ? <div id="elce-summary-profile-settings-host" className="elce-remix-center-column">
      {renderSummaryProfileSettings({
        document: props.view.documentModel,
        mediaSources: props.view.mediaSources,
        actions: props.actions,
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
      })}
    </div>

  return renderEditorFrame({
    leftPanel: renderScenarioPanel(scenarioProps),
    center,
    rightPanel: renderLearningContentCatalogPanel({
        view: props.view,
        actions: props.actions,
        responsivePanel: props.responsivePanel,
        sidePanelTab: props.sidePanelTab,
        appearanceTarget: props.appearanceTarget,
        onSetSidePanelTab: props.onSetSidePanelTab,
        onOpenAppearanceTarget: props.onOpenAppearanceTarget,
        profileTokenTargetId: props.profileTokenTargetId,
        dropTarget: props.dropTarget,
        onSetDropTarget: props.onSetDropTarget,
    }),
    responsivePanel: props.responsivePanel,
    visible: props.visible,
    editable: props.editable,
    onSetResponsivePanel: props.onSetResponsivePanel,
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

/** Applies a page or chapter move to the mixed root scenario order. */
function dropScenarioEntry(event: DragEvent, placement: PagePlacement, props: EditorWorkspaceViewProps): void {
  const entry = props.getDraggedEntry()
  switch (entry?.kind) {
    case SCENARIO_ENTRY_KIND.PAGE:
      event.preventDefault()
      event.stopPropagation()
      props.onMovePage(entry.pageId, placement)
      finishPageDrag(props.onSetDraggedEntry, props.onSetDropTarget)
      return
    case SCENARIO_ENTRY_KIND.CHAPTER:
      event.preventDefault()
      event.stopPropagation()
      props.onMoveChapter(entry.chapterId, placement.kind === PAGE_LOCATION.SCENARIO && placement.index !== undefined
        ? placement.index
        : props.view.documentModel.data.scenarioEntries.length)
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
