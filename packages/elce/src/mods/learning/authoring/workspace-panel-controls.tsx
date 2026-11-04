import { on, type RemixNode } from 'remix/component'
import { PanelLeftClose, PanelRightClose } from 'lucide-static'

import { renderLucideIcon } from '../../../core/authoring/lucide-static-icon'
import type { WorkspacePanelName } from './learning-workspace-types'

/** Renders the reduction control at the top of one visible workspace panel. */
export function renderWorkspacePanelReduceButton(
  panel: WorkspacePanelName,
  onReduce: () => void,
): RemixNode {
  const label = panel === 'outline' ? 'Scénario' : 'Contenus'
  const id = panel === 'outline' ? 'elce-outline-reduce' : 'elce-properties-reduce'
  const controls = panel === 'outline' ? 'elce-outline' : 'elce-properties'
  const icon = panel === 'outline' ? PanelLeftClose : PanelRightClose
  const actionLabel = `Réduire le panneau ${label}`
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
