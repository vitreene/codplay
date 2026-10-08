import { on, type RemixNode } from 'remix/ui'
import { jsx } from 'remix/ui/jsx-runtime'
import { ANCHOR_RETURN, CATALOG_REFERENCE, CATALOG_TAB, MEDIA_TYPE } from '../../../config/document-config'
import type { ElceCatalogMediaEntry, ElceCatalogReference } from '../../../domain/catalog/catalog-types'
import { Archive, GripVertical, Trash2, X } from 'lucide-static'
import { renderLucideIcon } from '../lucide-static-icon'
import type { ContentCatalogPanelProps } from './catalog-panel-types'

/** Renders the available BDC and reusable media tabs in the existing right panel. */
export function renderContentCatalogPanel(props: ContentCatalogPanelProps): RemixNode {
  const { view, actions, responsivePanel, dropTarget, onSetResponsivePanel, onSetDropTarget } = props
  const onDragOverAvailableBdcs = (event: DragEvent): void => {
    if (!hasTransferType(event, ANCHOR_RETURN.MIME_TYPE)) return
    const transfer = event.dataTransfer
    if (transfer === null) return
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
    if (!hasTransferType(event, ANCHOR_RETURN.MIME_TYPE)) return
    const transfer = event.dataTransfer
    if (transfer === null) return
    event.preventDefault()
    event.stopPropagation()
    transfer.dropEffect = 'move'
    onSetDropTarget(null)
    if (view.catalogTab !== CATALOG_TAB.AVAILABLE_BDCS) actions.selectCatalogTab(CATALOG_TAB.AVAILABLE_BDCS)
  }

  return jsx('aside', {
    id: 'elce-properties',
    className: 'elce-panel elce-properties',
    'data-drawer-open': responsivePanel === 'properties',
    role: responsivePanel === 'properties' ? 'dialog' : undefined,
    'aria-modal': responsivePanel === 'properties' ? true : undefined,
    'aria-labelledby': 'elce-content-catalog-title',
    children: [
      jsx('section', {
        id: 'elce-content-catalog',
        className: 'elce-outline-group',
        children: [
          jsx('header', {
            id: 'elce-properties-heading',
            className: 'elce-properties-heading',
            children: [
              jsx('h1', { id: 'elce-content-catalog-title', children: 'Contenus disponibles' }),
              jsx('button', {
                id: 'elce-properties-close',
                className: 'elce-responsive-panel-close elce-properties-close',
                type: 'button',
                'aria-label': 'Fermer les contenus disponibles',
                mix: on<HTMLButtonElement, 'click'>('click', () => onSetResponsivePanel(null)),
                children: renderLucideIcon(X, 'elce-properties-close-icon', 18),
              }),
            ],
          }),
          jsx('div', {
            id: 'elce-content-catalog-tabs',
            className: 'elce-content-catalog-tabs',
            role: 'group',
            'aria-label': 'Contenus du catalogue',
            children: [
              jsx('button', {
                id: 'elce-content-catalog-tab-bdcs',
                className: availableBdcTabClass(view.catalogTab === CATALOG_TAB.AVAILABLE_BDCS, dropTarget === CATALOG_TAB.AVAILABLE_BDCS),
                type: 'button',
                'aria-pressed': view.catalogTab === CATALOG_TAB.AVAILABLE_BDCS,
                'aria-controls': 'elce-catalog-bdcs',
                mix: [
                  on<HTMLButtonElement, 'click'>('click', () => actions.selectCatalogTab(CATALOG_TAB.AVAILABLE_BDCS)),
                  on<HTMLButtonElement, 'dragover'>('dragover', onDragOverAvailableBdcs),
                  on<HTMLButtonElement, 'dragleave'>('dragleave', onDragLeaveAvailableBdcs),
                  on<HTMLButtonElement, 'drop'>('drop', onDropAvailableBdcs),
                ],
                children: 'Blocs disponibles',
              }),
              jsx('button', {
                id: 'elce-content-catalog-tab-media',
                className: view.catalogTab === CATALOG_TAB.MEDIA ? 'elce-content-catalog-tab elce-content-catalog-tab--active' : 'elce-content-catalog-tab',
                type: 'button',
                'aria-pressed': view.catalogTab === CATALOG_TAB.MEDIA,
                'aria-controls': 'elce-catalog-media',
                mix: on<HTMLButtonElement, 'click'>('click', () => actions.selectCatalogTab(CATALOG_TAB.MEDIA)),
                children: 'Médias',
              }),
            ],
          }),
          jsx('section', {
            id: 'elce-catalog-bdcs',
            className: dropTarget === CATALOG_TAB.AVAILABLE_BDCS
              ? 'elce-content-catalog-panel elce-content-catalog-panel--drop-target'
              : 'elce-content-catalog-panel',
            hidden: view.catalogTab !== CATALOG_TAB.AVAILABLE_BDCS,
            mix: [
              on<HTMLElement, 'dragover'>('dragover', onDragOverAvailableBdcs),
              on<HTMLElement, 'dragleave'>('dragleave', onDragLeaveAvailableBdcs),
              on<HTMLElement, 'drop'>('drop', onDropAvailableBdcs),
            ],
            children: [
              jsx('p', {
                id: 'elce-catalog-bdcs-description',
                className: 'elce-muted',
                children: 'Ces blocs ne sont utilisés sur aucune page. Déposer ici un bloc ancré le retire du texte et le rend disponible.',
              }),
              view.catalogContents.bdcs.length === 0
                ? jsx('p', { id: 'elce-catalog-bdcs-empty', className: 'elce-muted', children: 'Aucun bloc image ou vidéo disponible.' })
                : jsx('ul', {
                    id: 'elce-catalog-bdcs-list',
                    className: 'elce-content-catalog-list',
                    children: view.catalogContents.bdcs.map((entry) => jsx('li', {
                      id: `elce-catalog-bdc-${entry.reference.bdcId}`,
                      children: jsx('div', {
                        id: `elce-catalog-bdc-actions-${entry.reference.bdcId}`,
                        className: 'elce-content-catalog-row',
                        children: [
                          renderCatalogReference(entry.reference, entry.name, entry.mediaType, 'bdc', entry.key),
                          renderDeleteButton(`elce-catalog-bdc-delete-${entry.reference.bdcId}`, `Supprimer définitivement le bloc ${entry.name}`, () => actions.deleteCatalogBdc(entry.reference.bdcId)),
                        ],
                      }),
                    }, entry.key)),
                  }),
            ],
          }),
          jsx('section', {
            id: 'elce-catalog-media',
            className: 'elce-content-catalog-panel',
            hidden: view.catalogTab !== CATALOG_TAB.MEDIA,
            children: [
              jsx('p', { id: 'elce-catalog-media-description', className: 'elce-muted', children: 'Les fichiers image et vidéo restent disponibles après insertion.' }),
              view.catalogContents.media.length === 0
                ? jsx('p', { id: 'elce-catalog-media-empty', className: 'elce-muted', children: 'Les médias ajoutés apparaîtront ici.' })
                : jsx('ul', {
                    id: 'elce-catalog-media-list',
                    className: 'elce-content-catalog-list',
                    children: view.catalogContents.media.map((entry) => jsx('li', {
                      id: `elce-catalog-media-${entry.reference.mediaId}`,
                      children: renderCatalogReference(entry.reference, entry.name, entry.mediaType, 'media', entry.key),
                    }, entry.key)),
                  }),
            ],
          }),
        ],
      }),
      view.unanchoredMediaBdcs.length === 0
        ? null
        : jsx('section', {
            id: 'elce-page-media',
            className: 'elce-outline-group',
            children: [
              jsx('h2', { id: 'elce-page-media-title', children: 'Médias dans la page' }),
              jsx('ul', {
                id: 'elce-page-media-list',
                className: 'elce-media-catalog-list',
                children: view.unanchoredMediaBdcs.map((bdc) => {
                  const media = view.documentModel.medias.find((candidate) => candidate.id === bdc.card?.mediaId)
                  return jsx('li', {
                    id: `elce-page-media-${bdc.id}`,
                    className: 'elce-media-catalog-row',
                    children: [
                      jsx('span', { id: `elce-page-media-name-${bdc.id}`, children: media?.name ?? bdc.type }),
                      jsx('button', {
                        id: `elce-page-media-catalog-${bdc.id}`,
                        className: 'elce-secondary-action',
                        type: 'button',
                        'aria-label': 'Renvoyer au catalogue',
                        title: 'Renvoyer au catalogue',
                        mix: on<HTMLButtonElement, 'click'>('click', () => actions.returnBdcToCatalog(bdc.id)),
                        children: renderLucideIcon(Archive, `elce-page-media-catalog-icon-${bdc.id}`, 14),
                      }),
                    ],
                  }, bdc.id)
                }),
              }),
            ],
          }),
    ],
  })
}

/** Renders a draggable catalogue BDC or reusable media reference. */
function renderCatalogReference(
  reference: ElceCatalogReference,
  name: string,
  mediaType: ElceCatalogMediaEntry['mediaType'],
  referenceKind: 'bdc' | 'media',
  key: string,
): RemixNode {
  return jsx('button', {
    id: `elce-catalog-${referenceKind}-drag-${key}`,
    className: 'elce-content-catalog-item',
    type: 'button',
    draggable: true,
    'aria-label': referenceKind === 'bdc'
      ? `Insérer le bloc ${catalogMediaLabel(mediaType)} : ${name}`
      : `Déposer le média ${catalogMediaLabel(mediaType)} : ${name}`,
    title: referenceKind === 'bdc'
      ? `Insérer le bloc ${catalogMediaLabel(mediaType)} : ${name}`
      : `Déposer le média ${catalogMediaLabel(mediaType)} : ${name}`,
    mix: on<HTMLButtonElement, 'dragstart'>('dragstart', (event) => {
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
    }),
    children: [
      renderLucideIcon(GripVertical, `elce-catalog-${referenceKind}-handle-${key}`, 14),
      jsx('span', { id: `elce-catalog-${referenceKind}-name-${key}`, children: name }),
      jsx('small', {
        id: `elce-catalog-${referenceKind}-type-${key}`,
        children: referenceKind === 'bdc'
          ? `Bloc ${catalogMediaLabel(mediaType)} · unique`
          : catalogMediaLabel(mediaType),
      }),
    ],
  })
}

/** Renders a compact accessible delete icon for an unused catalogue BDC. */
function renderDeleteButton(id: string, label: string, onClick: () => void): RemixNode {
  return jsx('button', {
    id,
    className: 'elce-danger-action',
    type: 'button',
    'aria-label': label,
    title: label,
    mix: on<HTMLButtonElement, 'click'>('click', onClick),
    children: renderLucideIcon(Trash2, `${id}-icon`, 14),
  })
}

/** Checks for one MIME type on the native transfer object. */
function hasTransferType(event: DragEvent, type: string): boolean {
  const transfer = event.dataTransfer
  return transfer !== null && Array.from(transfer.types).includes(type)
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

/** Returns the active tab style and the cue for an accepted anchor return. */
function availableBdcTabClass(isActive: boolean, isDropTarget: boolean): string {
  return [
    'elce-content-catalog-tab',
    ...(isActive ? ['elce-content-catalog-tab--active'] : []),
    ...(isDropTarget ? ['elce-content-catalog-tab--drop-target'] : []),
  ].join(' ')
}
