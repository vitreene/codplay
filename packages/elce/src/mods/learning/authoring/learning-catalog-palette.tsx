import { on, type RemixNode } from 'remix/component'

import { ANCHOR_RETURN } from '../../../resources/anchoring/anchor-config'
import { BDC_TYPE } from '../learning-definition'
import { PAGE_LOCATION } from '../organization/learning-page-placement'
import { SCENARIO_ENTRY_KIND } from '../organization/learning-organization-config'
import { BDC_ORDER } from '../../../core/document/content-location'
import { MEDIA_TYPE } from '../../../core/media/media-config'
import type { ElceCatalogMediaEntry } from '../../../core/catalog/catalog-types'
import { renderCoreBdcCatalogList, renderCoreMediaCatalogList } from '../../../core/authoring/catalog/catalog-content-list'
import { renderLucideIcon } from '../../../core/authoring/lucide-static-icon'
import { Library } from 'lucide-static'
import type { AppearanceTarget } from '../../../domain/appearance/appearance-target-types'
import type { LearningEditorFacade } from './learning-editor-facade'
import type { EditorViewModel } from './learning-authoring-service'
import type { CatalogPaletteTab } from './learning-authoring-config'
import type { DraggedScenarioEntry } from './learning-workspace-types'
import type { ScenarioPanelProps } from './scenario-panel-types'
import { renderScenarioPageCatalog } from './scenario-panel'
import { CATALOG_PALETTE_TAB } from './learning-authoring-config'

const CATALOG_PALETTE_DROP_TARGET = 'elce-catalog-palette'

export interface LearningCatalogPaletteProps {
  readonly view: EditorViewModel
  readonly actions: LearningEditorFacade
  readonly scenario: ScenarioPanelProps
  readonly isOpen: boolean
  readonly activeTab: CatalogPaletteTab
  readonly dropTarget: string | null
  readonly getDraggedEntry: () => DraggedScenarioEntry
  readonly onSetTab: (tab: CatalogPaletteTab) => void
  readonly onSetDropTarget: (targetId: string | null) => void
  readonly onSetDraggedEntry: (entry: DraggedScenarioEntry) => void
  readonly onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void
}

/** Renders the floating Pages, BDC and media catalogs with their existing drop actions. */
export function renderLearningCatalogPalette(props: LearningCatalogPaletteProps): RemixNode {
  /** Accepts existing page and BDC placements anywhere on the palette. */
  const onDragOverPalette = (event: DragEvent): void => {
    if (!isPaletteDrag(event, props.getDraggedEntry())) return
    event.preventDefault()
    if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move'
    if (props.dropTarget !== CATALOG_PALETTE_DROP_TARGET) {
      props.onSetDropTarget(CATALOG_PALETTE_DROP_TARGET)
    }
  }
  /** Clears the palette drop cue only after the pointer leaves the palette. */
  const onDragLeavePalette = (event: DragEvent): void => {
    if (didLeaveDropSurface(event) && props.dropTarget === CATALOG_PALETTE_DROP_TARGET) {
      props.onSetDropTarget(null)
    }
  }
  /** Routes each accepted palette drop through its existing placement command. */
  const onDropPalette = (event: DragEvent): void => {
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
      props.onSetTab(CATALOG_PALETTE_TAB.PAGES)
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
    props.onSetTab(CATALOG_PALETTE_TAB.BDCS)
  }

  return <aside
    id="elce-catalog-palette"
    className={props.dropTarget === CATALOG_PALETTE_DROP_TARGET
      ? 'elce-catalog-palette elce-catalog-palette--drop-target'
      : 'elce-catalog-palette'}
    aria-label="Palette des catalogues"
    hidden={!props.isOpen}
    mix={[
      on<HTMLElement, 'dragover'>('dragover', onDragOverPalette),
      on<HTMLElement, 'dragleave'>('dragleave', onDragLeavePalette),
      on<HTMLElement, 'drop'>('drop', onDropPalette),
    ]}
  >
    <header
      id="elce-catalog-palette-heading"
      className="elce-catalog-palette__heading"
    >
      <h2 id="elce-catalog-palette-title">Catalogue</h2>
    </header>
    <div
      id="elce-catalog-palette-tabs"
      className="elce-catalog-palette__tabs"
      role="tablist"
      aria-label="Catalogues du document"
    >
      <button
        id="elce-catalog-palette-tab-pages"
        className={paletteTabClass(props.activeTab === CATALOG_PALETTE_TAB.PAGES)}
        type="button"
        role="tab"
        aria-selected={props.activeTab === CATALOG_PALETTE_TAB.PAGES}
        aria-controls="elce-catalog-palette-panel-pages"
        mix={on<HTMLButtonElement, 'click'>('click', () => props.onSetTab(CATALOG_PALETTE_TAB.PAGES))}
      >
        Pages
      </button>
      <button
        id="elce-catalog-palette-tab-bdcs"
        className={paletteTabClass(props.activeTab === CATALOG_PALETTE_TAB.BDCS)}
        type="button"
        role="tab"
        aria-selected={props.activeTab === CATALOG_PALETTE_TAB.BDCS}
        aria-controls="elce-catalog-palette-panel-bdcs"
        mix={on<HTMLButtonElement, 'click'>('click', () => props.onSetTab(CATALOG_PALETTE_TAB.BDCS))}
      >
        BDC
      </button>
      {renderPaletteTab(CATALOG_PALETTE_TAB.MEDIA, 'Médias', props.activeTab, () => props.onSetTab(CATALOG_PALETTE_TAB.MEDIA))}
    </div>
    <section
      id="elce-catalog-palette-panel-pages"
      className="elce-catalog-palette__panel"
      role="tabpanel"
      aria-labelledby="elce-catalog-palette-tab-pages"
      hidden={props.activeTab !== CATALOG_PALETTE_TAB.PAGES}
    >
      {renderScenarioPageCatalog(props.scenario)}
    </section>
    <section
      id="elce-catalog-palette-panel-bdcs"
      className="elce-catalog-palette__panel"
      role="tabpanel"
      aria-labelledby="elce-catalog-palette-tab-bdcs"
      hidden={props.activeTab !== CATALOG_PALETTE_TAB.BDCS}
    >
      <p id="elce-catalog-palette-bdcs-description" className="elce-muted">
        Faire glisser la poignée de placement d’un bloc de la page vers cet onglet le rend disponible ici. Déposer un bloc illustratif ancré retire aussi son ancre.
      </p>
      {renderCoreBdcCatalogList(
        props.view.catalogContents.bdcs.map((entry) => ({ ...entry, typeLabel: catalogBdcLabel(entry.bdcType) })),
        props.onOpenAppearanceTarget,
        (bdcId) => props.actions.deleteCatalogBdc(bdcId),
      )}
    </section>
    <section
      id="elce-catalog-palette-panel-media"
      className="elce-catalog-palette__panel"
      role="tabpanel"
      aria-labelledby="elce-catalog-palette-tab-media"
      hidden={props.activeTab !== CATALOG_PALETTE_TAB.MEDIA}
    >
      <p id="elce-catalog-palette-media-description" className="elce-muted">
        Les fichiers image et vidéo restent disponibles après insertion.
      </p>
      {renderCoreMediaCatalogList(
        props.view.catalogContents.media.map((entry) => ({ ...entry, typeLabel: catalogMediaLabel(entry.mediaType) })),
      )}
    </section>
  </aside>
}

/** Renders the tab button for one catalog section. */
function renderPaletteTab(
  tab: CatalogPaletteTab,
  label: string,
  activeTab: CatalogPaletteTab,
  onSelect: () => void,
): RemixNode {
  return <button
    id={`elce-catalog-palette-tab-${tab}`}
    className={paletteTabClass(activeTab === tab)}
    type="button"
    role="tab"
    aria-selected={activeTab === tab}
    aria-controls={`elce-catalog-palette-panel-${tab}`}
    mix={on<HTMLButtonElement, 'click'>('click', onSelect)}
  >
    {label}
  </button>
}

/** Renders the toolbar toggle for the floating catalog palette. */
export function renderLearningCatalogPaletteToggle(isOpen: boolean, onToggle: () => void): RemixNode {
  const label = isOpen ? 'Réduire le catalogue' : 'Afficher le catalogue'
  return <button
    id="elce-catalog-palette-toggle"
    className={isOpen ? 'elce-catalog-palette-toggle elce-catalog-palette-toggle--open' : 'elce-catalog-palette-toggle'}
    type="button"
    aria-label={label}
    title={label}
    aria-expanded={isOpen}
    aria-controls="elce-catalog-palette"
    mix={on<HTMLButtonElement, 'click'>('click', onToggle)}
  >
    {renderLucideIcon(Library, 'elce-catalog-palette-toggle-icon')}
    <span id="elce-catalog-palette-toggle-label" className="elce-catalog-palette-toggle__label">Catalogue</span>
  </button>
}

/** Adds the active state to one catalog tab. */
function paletteTabClass(isActive: boolean): string {
  return isActive ? 'elce-catalog-palette__tab elce-catalog-palette__tab--active' : 'elce-catalog-palette__tab'
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

/** Identifies page, BDC and anchor-return drags accepted by the palette. */
function isPaletteDrag(event: DragEvent, entry: DraggedScenarioEntry): boolean {
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

