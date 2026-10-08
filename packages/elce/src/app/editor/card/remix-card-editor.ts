import { Trash2 } from 'lucide-static'
import { on, type RemixNode } from 'remix/ui'
import { jsx } from 'remix/ui/jsx-runtime'
import type { Bdc } from '../../../domain/document/document-types'
import type { ElceCardEditorActions } from '../../facades/card/card-facade-types'
import type { EditorViewModel } from '../../selectors/editor-view-model'
import { renderLucideIcon } from '../../remix/lucide-static-icon'
import { RemixCardEditorFields } from './remix-card-editor-fields'

/** Renders one standalone page Card while reusing the Carousel Card fields. */
export function renderRemixCardEditor(
  bdc: Bdc,
  view: EditorViewModel,
  cardActions: ElceCardEditorActions,
  onDelete: () => void,
): RemixNode {
  if (bdc.type !== 'card' || bdc.card == null) return null
  return jsx('section', {
    id: `elce-card-editor-${bdc.id}`,
    className: 'elce-card-editor',
    'aria-label': 'Éditeur de carte autonome',
    children: [
      jsx('header', {
        id: `elce-card-editor-header-${bdc.id}`,
        className: 'elce-card-editor__header',
        children: [
          jsx('h3', { id: `elce-card-editor-title-${bdc.id}`, className: 'elce-card-editor__title', children: 'Carte' }),
          jsx('button', {
            id: `elce-card-editor-delete-${bdc.id}`,
            className: 'elce-card-editor__delete',
            type: 'button',
            'aria-label': 'Supprimer la carte de cette page',
            title: 'Supprimer la carte de cette page',
            mix: on<HTMLButtonElement, 'click'>('click', onDelete),
            children: renderLucideIcon(Trash2, `elce-card-editor-delete-icon-${bdc.id}`, 14),
          }),
        ],
      }),
      jsx(RemixCardEditorFields, {
        bdc,
        mediaById: view.mediaById,
        actions: cardActions,
        idPrefix: 'elce-card',
        imageAspectRatio: null,
      }),
    ],
  })
}
