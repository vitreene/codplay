import { on, type RemixNode } from 'remix/ui'
import { Images, List } from 'lucide-static'

import { PAGE_LOCATION, SCENARIO_ENTRY_KIND } from '../../../config/document-config'
import type { PagePlacement } from '../../../domain/commands/document-command-types'
import type { ScenarioEntry } from '../../../domain/scenario/scenario-entry-types'
import { renderChapterSettings } from './chapter-settings'
import { renderContentCatalogPanel } from './content-catalog-panel'
import { renderScenarioPanel } from './scenario-panel'
import { renderLucideIcon } from '../lucide-static-icon'
import type { EditorWorkspaceViewProps } from './editor-workspace-types'
import type { ScenarioPanelProps } from './scenario-panel-types'
import { renderSummaryProfileSettings } from './summary-profile-settings'

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

  const panelStateClass = props.responsivePanel === null
    ? ''
    : ` elce-main--${props.responsivePanel}-open`

  return <div
    id="elce-remix-editor-workspace"
  >
    <main
      id="elce-main"
      className={`elce-main${panelStateClass}`}
      hidden={!props.visible}
      inert={props.editable === false}
    >
      {renderScenarioPanel(scenarioProps)}
      <div
        id="elce-remix-center-layout"
        className="elce-remix-center-layout"
      >
        {renderWorkspaceAccess(props)}
        {center}
      </div>
      {renderContentCatalogPanel({
        view: props.view,
        actions: props.actions,
        responsivePanel: props.responsivePanel,
        profileTokenTargetId: props.profileTokenTargetId,
        dropTarget: props.dropTarget,
        onSetDropTarget: props.onSetDropTarget,
      })}
    </main>
  </div>
}

/** Renders the icon-only controls on the outer edges of the center column. */
function renderWorkspaceAccess(
  props: Pick<EditorWorkspaceViewProps,
    | 'responsivePanel'
    | 'onSetResponsivePanel'
    | 'onPreview'
    | 'previewError'
    | 'exportBusy'
    | 'exportError'
    | 'exportNotice'
  >,
): RemixNode {
  return <div
    id="elce-workspace-access-area"
    className="elce-workspace-access-area"
  >
    <nav
      id="elce-responsive-panel-access"
      className="elce-responsive-panel-access"
      aria-label="Commandes de l’éditeur"
    >
      {renderPanelToggle('outline', props.responsivePanel, props.onSetResponsivePanel)}
      {renderPreviewButton(props.onPreview)}
      {renderPanelToggle('properties', props.responsivePanel, props.onSetResponsivePanel)}
    </nav>
    {props.previewError === null ? null : <p
      id="elce-preview-open-error"
      className="elce-workspace-access-error"
      role="alert"
    >
      {props.previewError}
    </p>}
    {props.exportBusy || props.exportError !== null || props.exportNotice !== null ? <p
      id="elce-sighty-export-status"
      className={props.exportError === null ? 'elce-workspace-access-status' : 'elce-workspace-access-error'}
      role={props.exportError === null ? 'status' : 'alert'}
      aria-live="polite"
    >
      {props.exportBusy ? 'Préparation du paquet Sighty…' : props.exportError ?? props.exportNotice}
    </p> : null}
  </div>
}

/** Renders the preview action alongside the editor's panel controls. */
function renderPreviewButton(onPreview: () => void): RemixNode {
  return <button
    id="elce-preview-open"
    className="elce-preview-open-button"
    type="button"
    mix={on<HTMLButtonElement, 'click'>('click', onPreview)}
  >
    Prévisualiser
  </button>
}

/** Renders one unframed panel toggle while preserving its button semantics. */
function renderPanelToggle(
  panel: 'outline' | 'properties',
  responsivePanel: EditorWorkspaceViewProps['responsivePanel'],
  setResponsivePanel: EditorWorkspaceViewProps['onSetResponsivePanel'],
): RemixNode {
  const isOpen = responsivePanel === panel
  const panelLabel = panel === 'outline' ? 'le scénario' : 'les contenus'
  const label = `${isOpen ? 'Fermer' : 'Ouvrir'} ${panelLabel}`
  const id = panel === 'outline' ? 'elce-outline-toggle' : 'elce-properties-toggle'
  const targetId = panel === 'outline' ? 'elce-outline' : 'elce-properties'
  const icon = panel === 'outline' ? List : Images
  const className = isOpen
    ? `elce-responsive-panel-toggle elce-responsive-panel-toggle--${panel} elce-responsive-panel-toggle--open`
    : `elce-responsive-panel-toggle elce-responsive-panel-toggle--${panel}`
  return <button
    id={id}
    className={className}
    type="button"
    aria-label={label}
    title={label}
    aria-expanded={isOpen}
    aria-controls={targetId}
    mix={on<HTMLButtonElement, 'click'>('click', () => setResponsivePanel(isOpen ? null : panel, id))}
  >
    {renderLucideIcon(icon, `${id}-icon`, 14)}
  </button>
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
