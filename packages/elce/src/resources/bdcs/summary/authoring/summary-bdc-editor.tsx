import { on, type RemixNode } from 'remix/component'
import type { SummaryDisplayMode } from '../summary-config'

interface SummaryBdcEditorProps {
  readonly bdcId: string
  readonly displayMode: SummaryDisplayMode
  readonly onDisplayModeChange: (displayMode: SummaryDisplayMode) => void
}

/** Renders the shared display rule editor used by every Summary view. */
export function renderSummaryBdcEditor(props: SummaryBdcEditorProps): RemixNode {
  const prefix = `elce-summary-bdc-editor-${props.bdcId}`
  return <fieldset id={`${prefix}-fieldset`} className="elce-summary-bdc-editor">
    <legend id={`${prefix}-legend`}>Règles d’affichage partagées</legend>
    <label id={`${prefix}-mode-label`}>
      Présentation
      <select
        id={`${prefix}-mode`}
        value={props.displayMode}
        aria-label="Présentation de tous les sommaires"
        mix={on<HTMLSelectElement, 'change'>('change', (event) => props.onDisplayModeChange(event.currentTarget.value as SummaryDisplayMode))}
      >
        <option value="chapters" selected={props.displayMode === 'chapters'}>Niveaux seuls</option>
        <option value="pages" selected={props.displayMode === 'pages'}>Pages et niveaux</option>
      </select>
    </label>
    <p id={`${prefix}-shared-hint`}>Ce réglage s’applique au Sommaire principal et aux autres blocs Sommaire.</p>
  </fieldset>
}
