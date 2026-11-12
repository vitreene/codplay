import { on, type RemixNode } from 'remix/component'
import { PanelLeftClose, PanelRightClose } from 'lucide-static'

import { renderLucideIcon } from '../lucide-static-icon'
import type { EditorPanelName } from './editor-frame'

/** Renders the reduction control at the top of one visible editor panel. */
export function renderEditorPanelReduceButton(
  panel: EditorPanelName,
  onReduce: () => void,
  panelLabel = panel === 'outline' ? 'Scénario' : 'Contenus',
): RemixNode {
  const id = panel === 'outline' ? 'elce-outline-reduce' : 'elce-properties-reduce'
  const controls = panel === 'outline' ? 'elce-outline' : 'elce-properties'
  const icon = panel === 'outline' ? PanelLeftClose : PanelRightClose
  const actionLabel = `Réduire le panneau ${panelLabel}`
  return <button
    id={id}
    className="elce-panel-reduce"
    type="button"
    aria-label={actionLabel}
    title={actionLabel}
    aria-expanded={true}
    aria-controls={controls}
    mix={on<HTMLButtonElement, 'click'>('click', onReduce)}
  >
    {renderLucideIcon(icon, `${id}-icon`)}
  </button>
}
