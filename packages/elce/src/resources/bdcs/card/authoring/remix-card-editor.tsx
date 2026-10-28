import { Trash2 } from 'lucide-static'
import { on, type RemixNode } from 'remix/ui'

import type { ResourceBdc } from '../../../document/resource-document-types'
import type { AppearanceTarget } from '../../../../domain/appearance/appearance-target-types'
import type { ElceCardEditorActions } from './card-facade-types'
import type { MediaType } from '../../../../core/media/media-config'
import { renderLucideIcon } from '../../../../core/authoring/lucide-static-icon'
import { RemixCardEditorFields } from './remix-card-editor-fields'
import { renderAppearanceTrigger } from '../../../../core/authoring/appearance-trigger'

/** Renders one standalone page Card while reusing the Carousel Card fields. */
export function renderRemixCardEditor(
  bdc: ResourceBdc,
  mediaById: Readonly<Record<string, Readonly<{ name: string; type: MediaType; source: string | null }>>>,
  cardActions: ElceCardEditorActions,
  onDelete: () => void,
  onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void,
  textFieldAttributes?: Readonly<Record<string, string>>,
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
          {renderLucideIcon(Trash2, `elce-card-editor-delete-icon-${bdc.id}`)}
        </button>
      </div>
    </header>
    <RemixCardEditorFields
      bdc={bdc}
      mediaById={mediaById}
      actions={cardActions}
      idPrefix="elce-card"
      imageAspectRatio={null}
      textFieldAttributes={textFieldAttributes}
    />
  </section>
}
