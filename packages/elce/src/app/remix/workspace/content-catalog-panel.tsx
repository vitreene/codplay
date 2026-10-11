import { on, type RemixNode } from 'remix/ui'

import { ANCHOR_RETURN, BDC_ORDER, BDC_TYPE, CATALOG_REFERENCE, CATALOG_TAB, MEDIA_TYPE } from '../../../config/document-config'
import type { BdcType } from '../../../config/document-config-types'
import type { ElceCatalogMediaEntry, ElceCatalogReference } from '../../../domain/catalog/catalog-types'
import { GripVertical, Trash2 } from 'lucide-static'
import { renderLucideIcon } from '../lucide-static-icon'
import type { ContentCatalogPanelProps } from './catalog-panel-types'

/** Renders the available BDC and reusable media tabs in the existing right panel. */
export function renderContentCatalogPanel(props: ContentCatalogPanelProps): RemixNode {
  const { view, actions, responsivePanel, dropTarget, onSetDropTarget } = props
  const onDragOverAvailableBdcs = (event: DragEvent): void => {
    const transfer = event.dataTransfer
    if (transfer === null) return
    if (!hasTransferType(event, BDC_ORDER.MIME_TYPE) && !hasTransferType(event, ANCHOR_RETURN.MIME_TYPE)) return
    event.preventDefault()
    event.stopPropagation()
    transfer.dropEffect = 'move'
    if (dropTarget !== CATALOG_TAB.AVAILABLE_BDCS) onSetDropTarget(CATALOG_TAB.AVAILABLE_BDCS)
  }
  const onDragLeaveAvailableBdcs = (event: DragEvent): void => {
    const currentTarget = event.currentTarget
    if (currentTarget instanceof Node && event.relatedTarget instanceof Node && currentTarget.contains(event.relatedTarget)) return
    onSetDropTarget(null)
  }
  const onDropAvailableBdcs = (event: DragEvent): void => {
    const transfer = event.dataTransfer
    if (transfer === null) return
    const bdcId = pageBdcIdFromTransfer(transfer, view.selectedPageBdcs.map((bdc) => bdc.id))
    const isAnchorReturn = hasTransferType(event, ANCHOR_RETURN.MIME_TYPE)
    if (bdcId === null && !isAnchorReturn) return
    event.preventDefault()
    event.stopPropagation()
    transfer.dropEffect = 'move'
    onSetDropTarget(null)
    if (bdcId !== null) actions.returnBdcToCatalog(bdcId)
    if (view.catalogTab !== CATALOG_TAB.AVAILABLE_BDCS) actions.selectCatalogTab(CATALOG_TAB.AVAILABLE_BDCS)
  }

  return <aside
    id="elce-properties"
    className="elce-panel elce-properties"
    data-panel-open={responsivePanel === 'properties'}
    aria-labelledby="elce-content-catalog-title"
  >
    <section
      id="elce-content-catalog"
      className="elce-outline-group"
    >
      <header
        id="elce-properties-heading"
        className="elce-properties-heading"
      >
        <h1
          id="elce-content-catalog-title"
        >
          Contenus disponibles
        </h1>
      </header>
      <div
        id="elce-content-catalog-tabs"
        className="elce-content-catalog-tabs"
        role="group"
        aria-label="Contenus du catalogue"
      >
        <button
          id="elce-content-catalog-tab-bdcs"
          className={availableBdcTabClass(view.catalogTab === CATALOG_TAB.AVAILABLE_BDCS, dropTarget === CATALOG_TAB.AVAILABLE_BDCS)}
          type="button"
          aria-pressed={view.catalogTab === CATALOG_TAB.AVAILABLE_BDCS}
          aria-controls="elce-catalog-bdcs"
          mix={[
            on<HTMLButtonElement, 'click'>('click', () => actions.selectCatalogTab(CATALOG_TAB.AVAILABLE_BDCS)),
            on<HTMLButtonElement, 'dragover'>('dragover', onDragOverAvailableBdcs),
            on<HTMLButtonElement, 'dragleave'>('dragleave', onDragLeaveAvailableBdcs),
            on<HTMLButtonElement, 'drop'>('drop', onDropAvailableBdcs),
          ]}
        >
          Blocs disponibles
        </button>
        <button
          id="elce-content-catalog-tab-media"
          className={view.catalogTab === CATALOG_TAB.MEDIA ? 'elce-content-catalog-tab elce-content-catalog-tab--active' : 'elce-content-catalog-tab'}
          type="button"
          aria-pressed={view.catalogTab === CATALOG_TAB.MEDIA}
          aria-controls="elce-catalog-media"
          mix={on<HTMLButtonElement, 'click'>('click', () => actions.selectCatalogTab(CATALOG_TAB.MEDIA))}
        >
          Médias
        </button>
      </div>
      <section
        id="elce-catalog-bdcs"
        className={dropTarget === CATALOG_TAB.AVAILABLE_BDCS
          ? 'elce-content-catalog-panel elce-content-catalog-panel--drop-target'
          : 'elce-content-catalog-panel'}
        hidden={view.catalogTab !== CATALOG_TAB.AVAILABLE_BDCS}
        mix={[
          on<HTMLElement, 'dragover'>('dragover', onDragOverAvailableBdcs),
          on<HTMLElement, 'dragleave'>('dragleave', onDragLeaveAvailableBdcs),
          on<HTMLElement, 'drop'>('drop', onDropAvailableBdcs),
        ]}
      >
        <p
          id="elce-catalog-bdcs-description"
          className="elce-muted"
        >
          Faire glisser la poignée de placement d’un bloc de la page vers cet onglet le rend disponible ici. Déposer un bloc illustratif ancré retire aussi son ancre.
        </p>
        {view.catalogContents.bdcs.length === 0
          ? <p
            id="elce-catalog-bdcs-empty"
            className="elce-muted"
          >
            Aucun bloc disponible.
          </p>
          : <ul
            id="elce-catalog-bdcs-list"
            className="elce-content-catalog-list"
          >
            {view.catalogContents.bdcs.map((entry) => <li
              key={entry.key}
              id={`elce-catalog-bdc-${entry.reference.bdcId}`}
            >
              <div
                id={`elce-catalog-bdc-actions-${entry.reference.bdcId}`}
                className="elce-content-catalog-row"
              >
                {renderCatalogReference(entry.reference, entry.name, catalogBdcLabel(entry.bdcType), 'bdc', entry.key)}
                {renderDeleteButton(`elce-catalog-bdc-delete-${entry.reference.bdcId}`, `Supprimer définitivement le bloc ${entry.name}`, () => actions.deleteCatalogBdc(entry.reference.bdcId))}
              </div>
            </li>)}
          </ul>}
      </section>
      <section
        id="elce-catalog-media"
        className="elce-content-catalog-panel"
        hidden={view.catalogTab !== CATALOG_TAB.MEDIA}
      >
        <p
          id="elce-catalog-media-description"
          className="elce-muted"
        >
          Les fichiers image et vidéo restent disponibles après insertion.
        </p>
        {view.catalogContents.media.length === 0
          ? <p
            id="elce-catalog-media-empty"
            className="elce-muted"
          >
            Les médias ajoutés apparaîtront ici.
          </p>
          : <ul
            id="elce-catalog-media-list"
            className="elce-content-catalog-list"
          >
            {view.catalogContents.media.map((entry) => <li
              key={entry.key}
              id={`elce-catalog-media-${entry.reference.mediaId}`}
            >
              {renderCatalogReference(entry.reference, entry.name, catalogMediaLabel(entry.mediaType), 'media', entry.key)}
            </li>)}
          </ul>}
      </section>
    </section>
  </aside>
}

/** Renders a draggable catalogue BDC or reusable media reference. */
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
    aria-label={referenceKind === 'bdc'
      ? `Déplacer le bloc ${typeLabel} : ${name}`
      : `Déposer le média ${typeLabel} : ${name}`}
    title={referenceKind === 'bdc'
      ? `Déplacer le bloc ${typeLabel} : ${name}`
      : `Déposer le média ${typeLabel} : ${name}`}
    mix={on<HTMLButtonElement, 'dragstart'>('dragstart', (event) => {
      const transfer = event.dataTransfer
      if (transfer === null) return
      transfer.setData(CATALOG_REFERENCE.MIME_TYPE, JSON.stringify(reference))
      switch (reference.kind) {
        case CATALOG_REFERENCE.BDC:
          transfer.effectAllowed = 'move'
          break
        case CATALOG_REFERENCE.MEDIA:
          transfer.effectAllowed = 'copy'
          break
      }
    })}
  >
    {renderLucideIcon(GripVertical, `elce-catalog-${referenceKind}-handle-${key}`, 14)}
    <span
      id={`elce-catalog-${referenceKind}-name-${key}`}
    >
      {name}
    </span>
    <small
      id={`elce-catalog-${referenceKind}-type-${key}`}
    >
      {referenceKind === 'bdc' ? `Bloc ${typeLabel} · unique` : typeLabel}
    </small>
  </button>
}

/** Renders a compact accessible delete icon for an unused catalogue BDC. */
function renderDeleteButton(id: string, label: string, onClick: () => void): RemixNode {
  return <button
    id={id}
    className="elce-danger-action"
    type="button"
    aria-label={label}
    title={label}
    mix={on<HTMLButtonElement, 'click'>('click', onClick)}
  >
    {renderLucideIcon(Trash2, `${id}-icon`, 14)}
  </button>
}

/** Checks for one MIME type on the native transfer object. */
function hasTransferType(event: DragEvent, type: string): boolean {
  const transfer = event.dataTransfer
  return transfer !== null && Array.from(transfer.types).includes(type)
}

/** Resolves a drag from the selected page's placement handle. */
function pageBdcIdFromTransfer(transfer: DataTransfer, pageBdcIds: readonly string[]): string | null {
  if (!Array.from(transfer.types).includes(BDC_ORDER.MIME_TYPE)) return null
  const bdcId = transfer.getData(BDC_ORDER.MIME_TYPE)
  return pageBdcIds.includes(bdcId) ? bdcId : null
}

/** Gives the catalog a compact label for an image or video. */
function catalogMediaLabel(mediaType: ElceCatalogMediaEntry['mediaType']): string {
  switch (mediaType) {
    case MEDIA_TYPE.IMAGE:
      return 'image'
    case MEDIA_TYPE.VIDEO:
      return 'vidéo'
  }
}

/** Gives each BDC type a stable label in the available-content panel. */
function catalogBdcLabel(bdcType: BdcType): string {
  switch (bdcType) {
    case BDC_TYPE.SECTION:
      return 'Texte'
    case BDC_TYPE.CARD:
      return 'Carte'
    case BDC_TYPE.QUESTION:
      return 'Quiz'
    case BDC_TYPE.EVALUATION_RESULT:
      return 'Résultat'
    case BDC_TYPE.CAROUSEL:
      return 'Carousel'
    case BDC_TYPE.STATISTICAL_GRAPH:
      return 'Graphe statistique'
  }
}

/** Returns the active tab style and the cue for an accepted anchor return. */
function availableBdcTabClass(isActive: boolean, isDropTarget: boolean): string {
  return [
    'elce-content-catalog-tab',
    ...(isActive ? ['elce-content-catalog-tab--active'] : []),
    ...(isDropTarget ? ['elce-content-catalog-tab--drop-target'] : []),
  ].join(' ')
}
