import { on, type RemixNode } from 'remix/component'
import { Images, List } from 'lucide-static'
import { renderLucideIcon } from '../lucide-static-icon'

export type EditorPanelName = 'outline' | 'properties'

export interface EditorPanelVisibility {
  readonly outline: boolean
  readonly properties: boolean
}

export interface EditorFrameProps {
  readonly leftPanel: RemixNode
  readonly center: RemixNode
  readonly rightPanel: RemixNode
  readonly panelVisibility: EditorPanelVisibility
  readonly visible: boolean
  readonly editable?: boolean
  readonly onSetPanelVisibility: (panel: EditorPanelName, open: boolean, triggerId?: string) => void
  readonly onPreview: () => void
  readonly workspaceAction: RemixNode
  readonly workspaceOverlay: RemixNode
  readonly previewError: string | null
  readonly exportBusy: boolean
  readonly exportKind: 'sighty' | 'scorm' | null
  readonly exportError: string | null
  readonly exportNotice: string | null
}

/** Renders the shared responsive authoring frame and its common access controls. */
export function renderEditorFrame(props: EditorFrameProps): RemixNode {
  const panelStateClass = ` elce-main--outline-${props.panelVisibility.outline ? 'open' : 'closed'} elce-main--properties-${props.panelVisibility.properties ? 'open' : 'closed'}`

  return <div id="elce-remix-editor-workspace">
    <main
      id="elce-main"
      className={`elce-main${panelStateClass}`}
      hidden={!props.visible}
      inert={props.editable === false}
    >
      {props.leftPanel}
      <div id="elce-remix-center-layout" className="elce-remix-center-layout">
        {renderWorkspaceAccess(props)}
        {props.center}
      </div>
      {props.rightPanel}
    </main>
    {props.workspaceOverlay}
  </div>
}

/** Renders preview, export status and responsive panel controls in the center column. */
function renderWorkspaceAccess(props: EditorFrameProps): RemixNode {
  return <div id="elce-workspace-access-area" className="elce-workspace-access-area">
    <nav
      id="elce-responsive-panel-access"
      className="elce-responsive-panel-access"
      aria-label="Commandes de l’éditeur"
    >
      {renderPanelToggle('outline', props.panelVisibility, props.onSetPanelVisibility)}
      <div id="elce-workspace-primary-actions" className="elce-workspace-primary-actions">
        {renderPreviewButton(props.onPreview)}
        {props.workspaceAction}
      </div>
      {renderPanelToggle('properties', props.panelVisibility, props.onSetPanelVisibility)}
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
      {props.exportBusy
        ? props.exportKind === 'scorm' ? 'Préparation du package SCORM…' : 'Préparation de l’export du scénario…'
        : props.exportError ?? props.exportNotice}
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
  panel: EditorPanelName,
  panelVisibility: EditorPanelVisibility,
  setPanelVisibility: EditorFrameProps['onSetPanelVisibility'],
): RemixNode {
  const isOpen = panelVisibility[panel]
  const panelLabel = panel === 'outline' ? 'le panneau Scénario' : 'le panneau Contenus'
  const label = `Ouvrir ${panelLabel}`
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
    hidden={isOpen}
    mix={on<HTMLButtonElement, 'click'>('click', () => setPanelVisibility(panel, true, id))}
  >
    {renderLucideIcon(icon, `${id}-icon`)}
  </button>
}
