import { Trash2 } from 'lucide-static'
import { on, type RemixNode } from 'remix/ui'

import type { Bdc } from '../../../domain/document/document-types'
import type { AppearanceTarget } from '../../../domain/commands/document-command-types'
import type { ElceCardEditorActions } from '../../facades/card/card-facade-types'
import type { EditorViewModel } from '../../selectors/editor-view-model'
import { renderLucideIcon } from '../../remix/lucide-static-icon'
import { RemixCardEditorFields } from './remix-card-editor-fields'
import { renderAppearanceTrigger } from '../../appearance/appearance-trigger'

/** Renders one standalone page Card while reusing the Carousel Card fields. */
export function renderRemixCardEditor(
  bdc: Bdc,
  view: EditorViewModel,
  cardActions: ElceCardEditorActions,
  onDelete: () => void,
  onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void,
): RemixNode {
  if (bdc.type !== 'card' || bdc.card == null) return null
  return <section
    id={`elce-card-editor-${bdc.id}`}
    className="elce-card-editor"
    aria-label="Éditeur de carte autonome"
  >
    <header
      id={`elce-card-editor-header-${bdc.id}`}
      className="elce-card-editor__header"
    >
      <h3
        id={`elce-card-editor-title-${bdc.id}`}
        className="elce-card-editor__title"
      >
        Carte
      </h3>
      <div
        id={`elce-card-editor-header-actions-${bdc.id}`}
        className="elce-bdc-header-actions"
      >
        {renderAppearanceTrigger({
          id: `elce-card-style-${bdc.id}`,
          target: { kind: 'bdc', bdcId: bdc.id },
          label: `Ouvrir le style de la carte ${bdc.card.title.trim() || ''}`,
          onOpen: onOpenAppearanceTarget,
          className: 'elce-appearance-trigger elce-bdc-style-trigger',
        })}
        <button
          id={`elce-card-editor-delete-${bdc.id}`}
          className="elce-card-editor__delete"
          type="button"
          aria-label="Supprimer la carte de cette page"
          title="Supprimer la carte de cette page"
          mix={on<HTMLButtonElement, 'click'>('click', onDelete)}
        >
          {renderLucideIcon(Trash2, `elce-card-editor-delete-icon-${bdc.id}`, 14)}
        </button>
      </div>
    </header>
    <RemixCardEditorFields
      bdc={bdc}
      mediaById={view.mediaById}
      actions={cardActions}
      idPrefix="elce-card"
      imageAspectRatio={null}
    />
  </section>
}
