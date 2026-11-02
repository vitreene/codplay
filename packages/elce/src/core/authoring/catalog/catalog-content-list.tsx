import { on, type RemixNode } from 'remix/ui'
import { GripVertical, Trash2 } from 'lucide-static'
import { CATALOG_REFERENCE } from '../../catalog/catalog-config'
import type { ElceCatalogBdcEntry, ElceCatalogMediaEntry, ElceCatalogReference } from '../../catalog/catalog-types'
import type { AppearanceTarget } from '../../../domain/appearance/appearance-target-types'
import { renderAppearanceTrigger } from '../appearance-trigger'
import { renderLucideIcon } from '../lucide-static-icon'

export type CoreCatalogBdcEntry = ElceCatalogBdcEntry & Readonly<{ typeLabel: string }>
export type CoreCatalogMediaEntry = ElceCatalogMediaEntry & Readonly<{ typeLabel: string }>

/** Renders the shared reusable BDC list and forwards its existing author actions. */
export function renderCoreBdcCatalogList(
  entries: readonly CoreCatalogBdcEntry[],
  onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void,
  onDeleteBdc: (bdcId: string, name: string) => void,
): RemixNode {
  if (entries.length === 0) return <p id="elce-catalog-bdcs-empty" className="elce-muted">Aucun bloc disponible.</p>
  return <ul id="elce-catalog-bdcs-list" className="elce-content-catalog-list">
    {entries.map((entry) => <li key={entry.key} id={`elce-catalog-bdc-${entry.reference.bdcId}`}>
      <div id={`elce-catalog-bdc-actions-${entry.reference.bdcId}`} className="elce-content-catalog-row">
        {renderCatalogReference(entry.reference, entry.name, entry.typeLabel, 'bdc', entry.key)}
        {renderAppearanceTrigger({
          id: `elce-catalog-bdc-style-${entry.reference.bdcId}`,
          target: { kind: 'bdc', bdcId: entry.reference.bdcId },
          label: `Ouvrir le style du bloc ${entry.typeLabel} « ${entry.name} »`,
          onOpen: onOpenAppearanceTarget,
          className: 'elce-appearance-trigger elce-content-catalog-style-trigger',
        })}
        {renderDeleteButton(`elce-catalog-bdc-delete-${entry.reference.bdcId}`, `Supprimer définitivement le bloc ${entry.name}`, () => onDeleteBdc(entry.reference.bdcId, entry.name))}
      </div>
    </li>)}
  </ul>
}

/** Renders the shared reusable media list with its native copy payload. */
export function renderCoreMediaCatalogList(entries: readonly CoreCatalogMediaEntry[]): RemixNode {
  if (entries.length === 0) return <p id="elce-catalog-media-empty" className="elce-muted">Les médias ajoutés apparaîtront ici.</p>
  return <ul id="elce-catalog-media-list" className="elce-content-catalog-list">
    {entries.map((entry) => <li key={entry.key} id={`elce-catalog-media-${entry.reference.mediaId}`}>
      {renderCatalogReference(entry.reference, entry.name, entry.typeLabel, 'media', entry.key)}
    </li>)}
  </ul>
}

/** Renders a draggable shared BDC or media catalog reference. */
function renderCatalogReference(
  reference: ElceCatalogReference,
  name: string,
  typeLabel: string,
  referenceKind: 'bdc' | 'media',
  key: string,
): RemixNode {
  return <button
    id={`elce-catalog-${referenceKind}-drag-${key}`}
    className="elce-content-catalog-item"
    type="button"
    draggable={true}
    aria-label={referenceKind === 'bdc' ? `Déplacer le bloc ${typeLabel} : ${name}` : `Déposer le média ${typeLabel} : ${name}`}
    title={referenceKind === 'bdc' ? `Déplacer le bloc ${typeLabel} : ${name}` : `Déposer le média ${typeLabel} : ${name}`}
    mix={on<HTMLButtonElement, 'dragstart'>('dragstart', (event) => {
      const transfer = event.dataTransfer
      if (transfer === null) return
      transfer.setData(CATALOG_REFERENCE.MIME_TYPE, JSON.stringify(reference))
      transfer.effectAllowed = reference.kind === CATALOG_REFERENCE.BDC ? 'move' : 'copy'
    })}
  >
    {renderLucideIcon(GripVertical, `elce-catalog-${referenceKind}-handle-${key}`)}
    <span id={`elce-catalog-${referenceKind}-name-${key}`}>{name}</span>
    <small id={`elce-catalog-${referenceKind}-type-${key}`}>
      {referenceKind === 'bdc' ? `Bloc ${typeLabel} · unique` : typeLabel}
    </small>
  </button>
}

/** Renders a compact accessible delete icon for an unused BDC. */
function renderDeleteButton(id: string, label: string, onClick: () => void): RemixNode {
  return <button
    id={id}
    className="elce-danger-action"
    type="button"
    aria-label={label}
    title={label}
    mix={on<HTMLButtonElement, 'click'>('click', onClick)}
  >{renderLucideIcon(Trash2, `${id}-icon`)}</button>
}
