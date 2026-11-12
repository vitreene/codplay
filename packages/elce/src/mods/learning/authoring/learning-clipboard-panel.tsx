import { on, type RemixNode } from 'remix/component'

import { ANCHOR_RETURN } from '../../../resources/anchoring/anchor-config'
import { BDC_TYPE } from '../learning-definition'
import { PAGE_LOCATION } from '../organization/learning-page-placement'
import { SCENARIO_ENTRY_KIND } from '../organization/learning-organization-config'
import { BDC_ORDER } from '../../../core/document/content-location'
import { MEDIA_TYPE } from '../../../core/media/media-config'
import type { ElceCatalogMediaEntry } from '../../../core/catalog/catalog-types'
import { renderCoreBdcCatalogList, renderCoreMediaCatalogList } from '../../../core/authoring/catalog/catalog-content-list'
import type { AppearanceTarget } from '../../../domain/appearance/appearance-target-types'
import type { LearningEditorFacade } from './learning-editor-facade'
import type { EditorViewModel } from './learning-authoring-service'
import type { ClipboardTab } from './learning-authoring-config'
import type { DraggedScenarioEntry } from './learning-workspace-types'
import type { ScenarioPanelProps } from './scenario-panel-types'
import { renderScenarioPageCatalog } from './scenario-panel'
import { CLIPBOARD_TAB } from './learning-authoring-config'

const CLIPBOARD_DROP_TARGET = 'elce-clipboard-content'

export interface LearningClipboardPanelProps {
  readonly view: EditorViewModel
  readonly actions: LearningEditorFacade
  readonly scenario: ScenarioPanelProps
  readonly activeTab: ClipboardTab
  readonly dropTarget: string | null
  readonly getDraggedEntry: () => DraggedScenarioEntry
  readonly onSetTab: (tab: ClipboardTab) => void
  readonly onSetDropTarget: (targetId: string | null) => void
  readonly onSetDraggedEntry: (entry: DraggedScenarioEntry) => void
  readonly onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void
}

/** Renders the Pages, BDC and media catalogs in the right editor panel. */
export function renderLearningClipboardPanel(props: LearningClipboardPanelProps): RemixNode {
  /** Accepts existing page and BDC placements anywhere in the clipboard. */
  const onDragOverClipboard = (event: DragEvent): void => {
    if (!isClipboardDrag(event, props.getDraggedEntry())) return
    event.preventDefault()
    if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move'
    if (props.dropTarget !== CLIPBOARD_DROP_TARGET) {
      props.onSetDropTarget(CLIPBOARD_DROP_TARGET)
    }
  }
  /** Clears the clipboard drop cue only after the pointer leaves the panel. */
  const onDragLeaveClipboard = (event: DragEvent): void => {
    if (didLeaveDropSurface(event) && props.dropTarget === CLIPBOARD_DROP_TARGET) {
      props.onSetDropTarget(null)
    }
  }
  /** Routes each accepted clipboard drop through its existing placement command. */
  const onDropClipboard = (event: DragEvent): void => {
    const transfer = event.dataTransfer
    if (transfer === null) return
    const entry = props.getDraggedEntry()
    const hasBdcTransfer = hasTransferType(event, BDC_ORDER.MIME_TYPE)
      || hasTransferType(event, ANCHOR_RETURN.MIME_TYPE)
    if (entry?.kind === SCENARIO_ENTRY_KIND.PAGE && !hasBdcTransfer) {
      event.preventDefault()
      event.stopPropagation()
      transfer.dropEffect = 'move'
      props.actions.movePage(entry.pageId, { kind: PAGE_LOCATION.CATALOG })
      props.onSetDraggedEntry(null)
      props.onSetDropTarget(null)
      props.onSetTab(CLIPBOARD_TAB.PAGES)
      return
    }

    const bdcId = pageBdcIdFromTransfer(transfer, props.view.selectedPageBdcs.map((bdc) => bdc.id))
    const isAnchorReturn = hasTransferType(event, ANCHOR_RETURN.MIME_TYPE)
    if (bdcId === null && !isAnchorReturn) return
    event.preventDefault()
    event.stopPropagation()
    transfer.dropEffect = 'move'
    props.onSetDropTarget(null)
    if (bdcId !== null) props.actions.returnBdcToCatalog(bdcId)
    props.onSetTab(CLIPBOARD_TAB.BDCS)
  }

  return <section
    id="elce-clipboard-content"
    className={props.dropTarget === CLIPBOARD_DROP_TARGET
      ? 'elce-clipboard-panel elce-clipboard-panel--drop-target'
      : 'elce-clipboard-panel'}
    aria-label="Presse-papiers"
    mix={[
      on<HTMLElement, 'dragover'>('dragover', onDragOverClipboard),
      on<HTMLElement, 'dragleave'>('dragleave', onDragLeaveClipboard),
      on<HTMLElement, 'drop'>('drop', onDropClipboard),
    ]}
  >
    <header
      id="elce-clipboard-heading"
      className="elce-clipboard-panel__heading"
    >
      <h2 id="elce-clipboard-title">Presse-papiers</h2>
    </header>
    <div
      id="elce-clipboard-tabs"
      className="elce-clipboard-panel__tabs"
      role="tablist"
      aria-label="Sous-rubriques du Presse-papiers"
    >
      <button
        id="elce-clipboard-tab-pages"
        className={clipboardTabClass(props.activeTab === CLIPBOARD_TAB.PAGES)}
        type="button"
        role="tab"
        aria-selected={props.activeTab === CLIPBOARD_TAB.PAGES}
        aria-controls="elce-clipboard-section-pages"
        mix={on<HTMLButtonElement, 'click'>('click', () => props.onSetTab(CLIPBOARD_TAB.PAGES))}
      >
        Pages
      </button>
      <button
        id="elce-clipboard-tab-bdcs"
        className={clipboardTabClass(props.activeTab === CLIPBOARD_TAB.BDCS)}
        type="button"
        role="tab"
        aria-selected={props.activeTab === CLIPBOARD_TAB.BDCS}
        aria-controls="elce-clipboard-section-bdcs"
        mix={on<HTMLButtonElement, 'click'>('click', () => props.onSetTab(CLIPBOARD_TAB.BDCS))}
      >
        BDC
      </button>
      {renderClipboardTab(CLIPBOARD_TAB.MEDIA, 'Médias', props.activeTab, () => props.onSetTab(CLIPBOARD_TAB.MEDIA))}
    </div>
    <section
      id="elce-clipboard-section-pages"
      className="elce-clipboard-panel__section"
      role="tabpanel"
      aria-labelledby="elce-clipboard-tab-pages"
      hidden={props.activeTab !== CLIPBOARD_TAB.PAGES}
    >
      {renderScenarioPageCatalog(props.scenario)}
    </section>
    <section
      id="elce-clipboard-section-bdcs"
      className="elce-clipboard-panel__section"
      role="tabpanel"
      aria-labelledby="elce-clipboard-tab-bdcs"
      hidden={props.activeTab !== CLIPBOARD_TAB.BDCS}
    >
      <p id="elce-clipboard-bdcs-description" className="elce-muted">
        Faire glisser la poignée de placement d’un bloc de la page vers cet onglet le rend disponible ici. Déposer un bloc illustratif ancré retire aussi son ancre.
      </p>
      {renderCoreBdcCatalogList(
        props.view.catalogContents.bdcs.map((entry) => ({ ...entry, typeLabel: catalogBdcLabel(entry.bdcType) })),
        props.onOpenAppearanceTarget,
        (bdcId) => props.actions.deleteCatalogBdc(bdcId),
      )}
    </section>
    <section
      id="elce-clipboard-section-media"
      className="elce-clipboard-panel__section"
      role="tabpanel"
      aria-labelledby="elce-clipboard-tab-media"
      hidden={props.activeTab !== CLIPBOARD_TAB.MEDIA}
    >
      <p id="elce-clipboard-media-description" className="elce-muted">
        Les fichiers image et vidéo restent disponibles après insertion.
      </p>
      {renderCoreMediaCatalogList(
        props.view.catalogContents.media.map((entry) => ({ ...entry, typeLabel: catalogMediaLabel(entry.mediaType) })),
      )}
    </section>
  </section>
}

/** Renders one clipboard subcategory tab. */
function renderClipboardTab(
  tab: ClipboardTab,
  label: string,
  activeTab: ClipboardTab,
  onSelect: () => void,
): RemixNode {
  return <button
    id={`elce-clipboard-tab-${tab}`}
    className={clipboardTabClass(activeTab === tab)}
    type="button"
    role="tab"
    aria-selected={activeTab === tab}
    aria-controls={`elce-clipboard-section-${tab}`}
    mix={on<HTMLButtonElement, 'click'>('click', onSelect)}
  >
    {label}
  </button>
}

/** Adds the active state to one clipboard subcategory tab. */
function clipboardTabClass(isActive: boolean): string {
  return isActive ? 'elce-clipboard-panel__tab elce-clipboard-panel__tab--active' : 'elce-clipboard-panel__tab'
}

/** Checks whether one native drag transfer contains the requested type. */
function hasTransferType(event: DragEvent, type: string): boolean {
  return event.dataTransfer !== null && Array.from(event.dataTransfer.types).includes(type)
}

/** Resolves a direct page BDC from the active page's placement handle. */
function pageBdcIdFromTransfer(transfer: DataTransfer, pageBdcIds: readonly string[]): string | null {
  if (!Array.from(transfer.types).includes(BDC_ORDER.MIME_TYPE)) return null
  const bdcId = transfer.getData(BDC_ORDER.MIME_TYPE)
  return pageBdcIds.includes(bdcId) ? bdcId : null
}

/** Identifies page, BDC and anchor-return drags accepted by the clipboard. */
function isClipboardDrag(event: DragEvent, entry: DraggedScenarioEntry): boolean {
  return entry?.kind === SCENARIO_ENTRY_KIND.PAGE
    || hasTransferType(event, BDC_ORDER.MIME_TYPE)
    || hasTransferType(event, ANCHOR_RETURN.MIME_TYPE)
}

/** Detects whether a drag has exited the entire current drop surface. */
function didLeaveDropSurface(event: DragEvent): boolean {
  const currentTarget = event.currentTarget
  return !(currentTarget instanceof Node
    && event.relatedTarget instanceof Node
    && currentTarget.contains(event.relatedTarget))
}

/** Gives a catalog entry a concise image or video label. */
function catalogMediaLabel(mediaType: ElceCatalogMediaEntry['mediaType']): string {
  switch (mediaType) {
    case MEDIA_TYPE.IMAGE:
      return 'image'
    case MEDIA_TYPE.AUDIO:
      return 'Son'
    case MEDIA_TYPE.VIDEO:
      return 'vidéo'
  }
}

/** Gives each available BDC type its existing catalog label. */
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
