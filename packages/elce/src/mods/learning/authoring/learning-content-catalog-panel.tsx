import { on, type RemixNode } from 'remix/ui'

import { ANCHOR_RETURN } from '../../../resources/anchoring/anchor-config'
import { BDC_TYPE } from '../learning-definition'
import { CATALOG_TAB } from './learning-authoring-config'
import { MEDIA_TYPE } from '../../../core/media/media-config'
import { BDC_ORDER } from '../../../core/document/content-location'
import type { ElceCatalogMediaEntry } from '../../../core/catalog/catalog-types'
import { renderCoreBdcCatalogList, renderCoreMediaCatalogList } from '../../../core/authoring/catalog/catalog-content-list'
import { renderProfileTokenInsertion } from '../profile/authoring/profile-token-insertion'
import type { LearningContentCatalogPanelProps } from './learning-content-catalog-panel-types'
import { renderAppearancePanel } from './learning-appearance-panel'

/** Renders the available BDC and reusable media tabs in the existing right panel. */
export function renderLearningContentCatalogPanel(props: LearningContentCatalogPanelProps): RemixNode {
  const { view, actions, responsivePanel, profileTokenTargetId, dropTarget, onSetDropTarget } = props
  const canShowProfileTab = profileTokenTargetId !== null && view.documentModel.data.profile.properties.length > 0
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
    aria-labelledby={props.sidePanelTab === 'contents' ? 'elce-content-catalog-title' : 'elce-appearance-title'}
  >
    <div
      id="elce-side-panel-tabs"
      className="elce-side-panel-tabs"
      role="tablist"
      aria-label="Panneau latéral"
    >
      <button
        id="elce-side-panel-tab-contents"
        className={props.sidePanelTab === 'contents' ? 'elce-side-panel-tab elce-side-panel-tab--active' : 'elce-side-panel-tab'}
        type="button"
        role="tab"
        aria-selected={props.sidePanelTab === 'contents'}
        aria-controls="elce-content-catalog"
        mix={on<HTMLButtonElement, 'click'>('click', () => props.onSetSidePanelTab('contents'))}
      >
        Contenus
      </button>
      <button
        id="elce-side-panel-tab-style"
        className={props.sidePanelTab === 'style' ? 'elce-side-panel-tab elce-side-panel-tab--active' : 'elce-side-panel-tab'}
        type="button"
        role="tab"
        aria-selected={props.sidePanelTab === 'style'}
        aria-controls="elce-appearance-tabpanel"
        mix={on<HTMLButtonElement, 'click'>('click', () => props.onSetSidePanelTab('style'))}
      >
        Style
      </button>
    </div>
    <section
      id="elce-content-catalog"
      className="elce-outline-group"
      role="tabpanel"
      aria-labelledby="elce-side-panel-tab-contents"
      hidden={props.sidePanelTab !== 'contents'}
    >
      <header
        id="elce-properties-heading"
        className="elce-properties-heading"
      >
        <h1
          id="elce-content-catalog-title"
        >
          Contenus
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
        {canShowProfileTab ? <button
          id="elce-content-catalog-tab-profile"
          className={view.catalogTab === CATALOG_TAB.PROFILE ? 'elce-content-catalog-tab elce-content-catalog-tab--active' : 'elce-content-catalog-tab'}
          type="button"
          aria-pressed={view.catalogTab === CATALOG_TAB.PROFILE}
          aria-controls="elce-catalog-profile"
          mix={on<HTMLButtonElement, 'click'>('click', () => actions.selectCatalogTab(CATALOG_TAB.PROFILE))}
        >
          Profil
        </button> : null}
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
        {renderCoreBdcCatalogList(
          view.catalogContents.bdcs.map((entry) => ({ ...entry, typeLabel: catalogBdcLabel(entry.bdcType) })),
          props.onOpenAppearanceTarget,
          (bdcId) => actions.deleteCatalogBdc(bdcId),
        )}
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
        {renderCoreMediaCatalogList(
          view.catalogContents.media.map((entry) => ({ ...entry, typeLabel: catalogMediaLabel(entry.mediaType) })),
        )}
      </section>
      <section
        id="elce-catalog-profile"
        className="elce-content-catalog-panel"
        aria-label="Variables de profil"
        hidden={view.catalogTab !== CATALOG_TAB.PROFILE || !canShowProfileTab}
      >
        {profileTokenTargetId === null ? null : renderProfileTokenInsertion(
          'elce-profile-token-insertion',
          view.documentModel.data.profile.properties,
          profileTokenTargetId,
        )}
      </section>
    </section>
    <section
      id="elce-appearance-tabpanel"
      role="tabpanel"
      aria-labelledby="elce-side-panel-tab-style"
      hidden={props.sidePanelTab !== 'style'}
    >
      {renderAppearancePanel({
        view,
        actions,
        target: props.appearanceTarget,
      })}
    </section>
  </aside>
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
function catalogBdcLabel(bdcType: string): string {
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
      return 'Graphe'
    default:
      return bdcType
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
