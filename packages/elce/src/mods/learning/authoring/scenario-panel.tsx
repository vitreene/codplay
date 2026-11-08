import { on, type RemixNode } from 'remix/component'

import { ClipboardCheck, Folder, FolderPlus, GripVertical, Library, Plus, Trash2 } from 'lucide-static'
import { PAGE_TYPE, type PageType } from '../learning-definition'
import { CHAPTER_TYPE, CHAPTER_TYPE_CONFIG, SCENARIO_ENTRY_KIND } from '../organization/learning-organization-config'
import { PAGE_LOCATION, type PagePlacement } from '../organization/learning-page-placement'
import type { LearningChapter, LearningPage } from '../document/learning-document-types'
import type { ScenarioEntry } from '../organization/learning-scenario-entry-types'
import { renderLucideIcon } from '../../../core/authoring/lucide-static-icon'
import { SUMMARY_PROFILE_ACCESS_ICON } from '../../../app/remix/summary-profile-access-icon'
import { getLearningPageTypeIcon } from './learning-page-type-icon'
import type { ScenarioPanelProps } from './scenario-panel-types'
import { renderAppearanceTrigger } from '../../../core/authoring/appearance-trigger'
import { plainTextFromValue } from '../inline-text/learning-inline-text-value'
import { renderWorkspacePanelReduceButton } from './workspace-panel-controls'
import { workspacePanelVisibilityFromResponsiveState } from './workspace-panel-state'
import { MAX_SCENARIO_CHAPTER_DEPTH } from '../organization/learning-organization-config'
import { scenarioChapterDepth } from '../organization/learning-scenario-tree'

const SCENARIO_TRASH_DROP_TARGET = 'elce-scenario-trash-drop'
const SCENARIO_CATALOG_DROP_TARGET = 'elce-scenario-catalog-drop'

/** Renders the ordered scenario and its native Remix page/chapter controls. */
export function renderScenarioPanel(props: ScenarioPanelProps): RemixNode {
  const { workspace } = props
  const { view, responsivePanel } = workspace
  const panelVisibility = workspace.panelVisibility
    ?? workspacePanelVisibilityFromResponsiveState(responsivePanel, typeof window === 'undefined' ? 1280 : window.innerWidth)
  return <section
    id="elce-outline"
    className="elce-panel elce-outline"
    data-panel-open={panelVisibility.outline}
    aria-labelledby="elce-outline-title"
  >
    <div
      id="elce-outline-reduce-row"
      className="elce-panel-reduce-row"
    >
      {renderWorkspacePanelReduceButton('outline', () => {
        if (workspace.onSetPanelVisibility !== undefined) workspace.onSetPanelVisibility('outline', false)
        else workspace.onSetResponsivePanel(null, 'elce-outline-toggle')
      })}
    </div>
    <div
      id="elce-outline-heading"
      className="elce-panel-heading elce-outline-heading"
    >
      <h1
        id="elce-outline-title"
      >
        Scénario
      </h1>
      <div
        id="elce-outline-actions"
        className="elce-outline-actions"
      >
        {renderScenarioAddMenu(props)}
        {renderScenarioDropTarget(props, 'trash')}
        {renderScenarioDropTarget(props, 'catalog')}
      </div>
      {renderAppearanceTrigger({
        id: 'elce-scenario-project-style-trigger',
        target: { kind: 'document' },
        label: 'Ouvrir les réglages de style du projet',
        onOpen: workspace.onOpenAppearanceTarget,
      })}
    </div>
    <div
      id="elce-outline-scroll-content"
      className="elce-outline-scroll-content"
    >
      <h2
        id="elce-document-name"
      >
        {view.documentModel.data.name}
      </h2>
      {renderScenarioEntryList(props, view.documentModel.data.scenarioEntries, null)}
    </div>
  </section>
}

/** Renders the horizontal plus menu with the existing scenario creation actions. */
function renderScenarioAddMenu(props: ScenarioPanelProps): RemixNode {
  const { view, actions } = props.workspace
  return <details
    id="elce-scenario-add"
    className="elce-scenario-add elce-page-bdc-add"
  >
    <summary
      id="elce-scenario-add-toggle"
      className="elce-scenario-add-toggle elce-bdc-icon-button elce-page-bdc-add-toggle"
      aria-label="Ajouter au scénario"
      title="Ajouter au scénario"
      aria-controls="elce-scenario-add-menu"
    >
      {renderLucideIcon(Plus, 'elce-scenario-add-icon')}
    </summary>
    <div
      id="elce-scenario-add-menu"
      className="elce-scenario-add-menu elce-page-bdc-add-menu"
      role="group"
      aria-label="Ajouter un élément au scénario"
    >
      {renderScenarioCreateButton('elce-create-chapter', CHAPTER_TYPE_CONFIG[CHAPTER_TYPE.STANDARD].createLabel, 'Chapitre', FolderPlus, () => runScenarioCreateAction(() => actions.createChapter(view.documentModel)))}
      {renderScenarioCreateButton('elce-create-scenario-page', 'Ajouter une Page à la racine du scénario', 'Page', getLearningPageTypeIcon(PAGE_TYPE.FLUX), () => runScenarioCreateAction(() => actions.createPage({ kind: PAGE_LOCATION.SCENARIO }, PAGE_TYPE.FLUX)))}
      {renderScenarioCreateButton('elce-create-scenario-diapo', 'Ajouter une Diapo à la racine du scénario', 'Diapo', getLearningPageTypeIcon(PAGE_TYPE.DIAPO), () => runScenarioCreateAction(() => actions.createPage({ kind: PAGE_LOCATION.SCENARIO }, PAGE_TYPE.DIAPO)))}
      {renderScenarioCreateButton('elce-create-evaluation-chapter', CHAPTER_TYPE_CONFIG[CHAPTER_TYPE.EVALUATION].createLabel, 'Évaluation', ClipboardCheck, () => runScenarioCreateAction(() => actions.createEvaluationChapter(view.documentModel)))}
    </div>
  </details>
}

/** Renders one labeled creation action inside the Scenario add menu. */
function renderScenarioCreateButton(id: string, label: string, visibleLabel: string, icon: string, action: () => void): RemixNode {
  return <button
    id={id}
    className="elce-add-content-action"
    type="button"
    aria-label={label}
    title={label}
    mix={on<HTMLButtonElement, 'click'>('click', action)}
  >
    {renderLucideIcon(icon, `${id}-icon`)}
    <span
      id={`${id}-label`}
      className="elce-add-content-action__label"
    >
      {visibleLabel}
    </span>
  </button>
}

/** Closes the plus menu before applying a selected existing creation action. */
function runScenarioCreateAction(action: () => void): void {
  const addMenu = document.getElementById('elce-scenario-add')
  if (addMenu instanceof HTMLDetailsElement) addMenu.open = false
  action()
}

/** Renders the horizontal Scenario trash or page-catalog drop target. */
function renderScenarioDropTarget(props: ScenarioPanelProps, target: 'trash' | 'catalog'): RemixNode {
  const isTrash = target === 'trash'
  const targetId = isTrash ? SCENARIO_TRASH_DROP_TARGET : SCENARIO_CATALOG_DROP_TARGET
  const icon = isTrash ? Trash2 : Library
  const ariaLabel = isTrash
    ? 'Corbeille : déposer une page ou un chapitre vide pour le supprimer'
    : 'Catalogue : déposer une page pour la rendre disponible'
  const title = isTrash
    ? 'Déposer une page ou un chapitre vide pour le supprimer'
    : 'Déposer une page pour la rendre disponible dans le catalogue'
  const classNames = [
    'elce-scenario-drop-target',
    isTrash ? 'elce-scenario-trash' : 'elce-scenario-catalog',
    props.workspace.dropTarget === targetId ? 'is-drop-target' : '',
  ].filter(Boolean).join(' ')
  return <div
    id={`elce-scenario-${target}`}
    className={classNames}
    role="region"
    aria-label={ariaLabel}
    title={title}
    mix={[
      on<HTMLElement, 'dragover'>('dragover', (event) => dragOverScenarioTarget(event, target, props)),
      on<HTMLElement, 'dragleave'>('dragleave', (event) => leaveScenarioTarget(event, targetId, props)),
      on<HTMLElement, 'drop'>('drop', (event) => dropScenarioEntryOnTarget(event, target, props)),
    ]}
  >
    <span
      id={`elce-scenario-${target}-icon`}
      aria-hidden={true}
    >
      {renderLucideIcon(icon, `elce-scenario-${target}-symbol`)}
    </span>
  </div>
}

/** Accepts only deletable scenario entries or pages returning to the catalog. */
function dragOverScenarioTarget(event: DragEvent, target: 'trash' | 'catalog', props: ScenarioPanelProps): void {
  const entry = props.getDraggedEntry()
  if (!canDropScenarioEntry(entry, target, props)) return
  const transfer = event.dataTransfer
  if (transfer === null) return
  event.preventDefault()
  event.stopPropagation()
  transfer.dropEffect = 'move'
  props.onSetDropTarget(target === 'trash' ? SCENARIO_TRASH_DROP_TARGET : SCENARIO_CATALOG_DROP_TARGET)
}

/** Applies the existing delete or page-catalog placement to one dragged entry. */
function dropScenarioEntryOnTarget(event: DragEvent, target: 'trash' | 'catalog', props: ScenarioPanelProps): void {
  const entry = props.getDraggedEntry()
  if (entry === null || !canDropScenarioEntry(entry, target, props) || event.dataTransfer === null) {
    props.onSetDropTarget(null)
    return
  }
  event.preventDefault()
  event.stopPropagation()
  if (target === 'catalog' && entry.kind === SCENARIO_ENTRY_KIND.PAGE) {
    props.workspace.actions.movePage(entry.pageId, { kind: PAGE_LOCATION.CATALOG })
  }
  if (target === 'trash') {
    switch (entry.kind) {
      case SCENARIO_ENTRY_KIND.PAGE:
        props.workspace.actions.deletePage(entry.pageId)
        break
      case SCENARIO_ENTRY_KIND.CHAPTER:
        props.workspace.actions.deleteChapter(entry.chapterId)
        break
    }
  }
  props.onDragEnd()
}

/** Rejects catalog drops of chapters and deletion of nonempty chapters. */
function canDropScenarioEntry(
  entry: ScenarioEntry | null,
  target: 'trash' | 'catalog',
  props: ScenarioPanelProps,
): boolean {
  if (entry === null) return false
  if (target === 'catalog') return entry.kind === SCENARIO_ENTRY_KIND.PAGE
  if (entry.kind === SCENARIO_ENTRY_KIND.PAGE) return true
  return props.workspace.view.documentModel.chapters.find((chapter) => chapter.id === entry.chapterId)?.entries.length === 0
}

/** Clears a Scenario drop highlight only after leaving its target surface. */
function leaveScenarioTarget(event: DragEvent, targetId: string, props: ScenarioPanelProps): void {
  const currentTarget = event.currentTarget
  if (currentTarget instanceof Node && event.relatedTarget instanceof Node && currentTarget.contains(event.relatedTarget)) return
  if (props.workspace.dropTarget === targetId) props.onSetDropTarget(null)
}

/** Renders the existing page catalog list for the floating catalog palette. */
export function renderScenarioPageCatalog(props: ScenarioPanelProps): RemixNode {
  const { view } = props.workspace
  const selectedPageId = view.selectedChapter === undefined ? view.selectedPage?.id : undefined
  return <section
    id="elce-catalog-pages"
    className="elce-outline-group"
  >
    <h2 id="elce-catalog-pages-title">Catalogue de pages</h2>
    {renderPageList(
      props,
      'elce-catalog-page-list',
      view.documentModel.data.catalogPageIds,
      'Déposer une page ici',
      () => ({ kind: PAGE_LOCATION.CATALOG }),
      selectedPageId,
    )}
  </section>
}

/** Renders root pages and chapters between their explicit insertion separators. */
function renderScenarioEntryList(
  props: ScenarioPanelProps,
  entries: readonly ScenarioEntry[],
  parentChapterId: string | null,
): RemixNode {
  const { workspace, onDropScenarioEntry, onDragOverScenarioEntry, onDragLeave } = props
  const { view, dropTarget } = workspace
  const listId = parentChapterId === null ? 'elce-scenario-entry-list' : `elce-scenario-entry-list-${parentChapterId}`
  const children: RemixNode[] = []

  entries.forEach((entry, index) => {
    const placement = { parentChapterId, index } as const
    children.push(renderDropSeparator(`${listId}-drop-${index}`, dropTarget, onDragOverScenarioEntry, onDragLeave, (event) => onDropScenarioEntry(event, placement), undefined, parentChapterId === null))
    switch (entry.kind) {
      case SCENARIO_ENTRY_KIND.PAGE: {
        const page = view.documentModel.pages.find((candidate) => candidate.id === entry.pageId)
        if (page !== undefined) children.push(renderPageItem(props, listId, page, view.selectedChapter === undefined ? view.selectedPage?.id : undefined, false))
        return
      }
      case SCENARIO_ENTRY_KIND.CHAPTER: {
        const chapter = view.documentModel.chapters.find((candidate) => candidate.id === entry.chapterId)
        if (chapter !== undefined) children.push(renderChapterItem(props, chapter))
        return
      }
    }
  })

  const finalPlacement = { parentChapterId, index: entries.length } as const
  children.push(renderDropSeparator(
    `${listId}-drop-${entries.length}`,
    dropTarget,
    onDragOverScenarioEntry,
    onDragLeave,
    (event) => onDropScenarioEntry(event, finalPlacement),
    entries.length === 0 ? parentChapterId === null ? 'Déposer une page ou un chapitre à la racine du scénario' : 'Déposer une page ou un sous-chapitre ici' : undefined,
    parentChapterId === null,
  ))
  return <ul
    id={listId}
    className={parentChapterId === null ? 'elce-outline-list elce-outline-list--root' : 'elce-outline-list elce-outline-list--nested'}
  >
    {parentChapterId === null
      ? <li id="elce-scenario-summary-entry">
          <button
            id="elce-scenario-summary-page"
            type="button"
            className={workspace.summarySettingsOpen
              ? 'elce-page-button elce-page-button--selected elce-scenario-summary-page'
              : 'elce-page-button elce-scenario-summary-page'}
            aria-pressed={workspace.summarySettingsOpen}
            mix={on<HTMLButtonElement, 'click'>('click', () => workspace.onSetSummarySettingsOpen(!workspace.summarySettingsOpen))}
          >
            {renderLucideIcon(SUMMARY_PROFILE_ACCESS_ICON, 'elce-scenario-summary-page-icon')}
            <span id="elce-scenario-summary-page-title">{plainTextFromValue(view.documentModel.data.summary.title)}</span>
          </button>
        </li>
      : null}
    {children}
  </ul>
}

/** Renders one chapter row and its nested page insertion list. */
function renderChapterItem(props: ScenarioPanelProps, chapter: LearningChapter): RemixNode {
  const { workspace, onDragStartChapter, onDragEnd } = props
  const { view, actions } = workspace
  const isSelected = view.selectedChapter?.id === chapter.id
  const itemId = `elce-chapter-${chapter.id}`
  const chapterName = plainTextFromValue(chapter.name)
  const onAddChapterPage = (chapterId: string, pageType: PageType): void => {
    actions.createPage({ kind: PAGE_LOCATION.CHAPTER, chapterId }, pageType)
  }

  return <li
    id={itemId}
  >
    <div
      id={`elce-chapter-heading-${chapter.id}`}
      className="elce-outline-item-heading"
      draggable={true}
      aria-label={`Glisser pour déplacer ${chapterName}`}
      mix={[
        on<HTMLDivElement, 'dragstart'>('dragstart', (event) => onDragStartChapter(event, chapter.id)),
        on<HTMLDivElement, 'dragend'>('dragend', onDragEnd),
      ]}
    >
      <span
        id={`elce-chapter-drag-handle-${chapter.id}`}
        className="elce-drag-handle"
        title="Glisser pour déplacer"
        aria-hidden={true}
      >
        {renderLucideIcon(GripVertical, `elce-chapter-drag-icon-${chapter.id}`)}
      </span>
      <button
        id={`elce-chapter-select-${chapter.id}`}
        className={isSelected ? 'elce-chapter-select elce-chapter-select--selected' : 'elce-chapter-select'}
        type="button"
        aria-pressed={isSelected}
        mix={on<HTMLButtonElement, 'click'>('click', () => {
          workspace.onSetSummarySettingsOpen(false)
          actions.selectChapter(chapter.id)
        })}
      >
        {renderChapterTypeIcon(chapter)}
        <strong
          id={`elce-chapter-name-${chapter.id}`}
        >
          {chapterName}
        </strong>
      </button>
      <div
        id={`elce-chapter-actions-${chapter.id}`}
        className="elce-outline-item-actions"
      >
        {chapter.type === CHAPTER_TYPE.STANDARD && scenarioChapterDepth(view.documentModel.data, chapter.id) < MAX_SCENARIO_CHAPTER_DEPTH
          ? renderIconButton(`elce-create-chapter-${chapter.id}`, `Ajouter un sous-chapitre dans ${chapter.name}`, FolderPlus, () => actions.createChapter(view.documentModel, chapter.id), 'elce-location-page-action')
          : null}
        {renderIconButton(`elce-create-page-${chapter.id}`, `Ajouter une Page dans ${chapter.name}`, getLearningPageTypeIcon(PAGE_TYPE.FLUX), () => onAddChapterPage(chapter.id, PAGE_TYPE.FLUX), 'elce-location-page-action')}
        {renderIconButton(`elce-create-diapo-${chapter.id}`, `Ajouter une Diapo dans ${chapter.name}`, getLearningPageTypeIcon(PAGE_TYPE.DIAPO), () => onAddChapterPage(chapter.id, PAGE_TYPE.DIAPO), 'elce-location-page-action')}
        {renderDeleteButton(`elce-chapter-delete-${chapter.id}`, () => actions.deleteChapter(chapter.id), chapter.entries.length > 0)}
      </div>
    </div>
    {renderScenarioEntryList(props, chapter.entries, chapter.id)}
  </li>
}

/** Renders a page collection using separators as its only drop targets. */
function renderPageList(
  props: ScenarioPanelProps,
  id: string,
  pageIds: readonly string[],
  emptyLabel: string,
  placementAt: (index: number) => PagePlacement,
  selectedPageId: string | undefined,
  showDelete = true,
): RemixNode {
  const children: RemixNode[] = []
  const { workspace, onDragOverPage, onDragLeave, onDropPage } = props

  pageIds.forEach((pageId, index) => {
    const page = workspace.view.documentModel.pages.find((candidate) => candidate.id === pageId)
    if (page === undefined) return
    const placement = placementAt(index)
    children.push(renderDropSeparator(`${id}-drop-${index}`, workspace.dropTarget, onDragOverPage, onDragLeave, (event) => onDropPage(event, placement)))
    children.push(renderPageItem(props, id, page, selectedPageId, showDelete))
  })

  children.push(renderDropSeparator(
    `${id}-drop-${pageIds.length}`,
    workspace.dropTarget,
    onDragOverPage,
    onDragLeave,
    (event) => onDropPage(event, placementAt(pageIds.length)),
    pageIds.length === 0 ? emptyLabel : undefined,
  ))
  return <ul
    id={id}
    className="elce-outline-list"
  >
    {children}
  </ul>
}

/** Renders a page as a draggable source, never as a drop target. */
function renderPageItem(props: ScenarioPanelProps, listId: string, page: LearningPage, selectedPageId: string | undefined, showDelete: boolean): RemixNode {
  const { workspace, onDragStartPage, onDragEnd } = props
  const pageName = plainTextFromValue(page.name)
  return <li
    id={`${listId}-item-${page.id}`}
  >
    <div
      id={`${listId}-row-${page.id}`}
      className={showDelete ? 'elce-page-row elce-page-row--deletable' : 'elce-page-row'}
      draggable={true}
      aria-label={`Glisser pour déplacer ${pageName}`}
      mix={[
        on<HTMLDivElement, 'dragstart'>('dragstart', (event) => {
          event.stopPropagation()
          onDragStartPage(event, page.id)
        }),
        on<HTMLDivElement, 'dragend'>('dragend', onDragEnd),
      ]}
    >
      <span
        id={`${listId}-handle-${page.id}`}
        className="elce-drag-handle"
        title="Glisser pour déplacer"
        aria-hidden={true}
      >
        {renderLucideIcon(GripVertical, `${listId}-handle-icon-${page.id}`)}
      </span>
      <button
        id={`${listId}-select-${page.id}`}
        className={page.id === selectedPageId ? 'elce-page-button elce-page-button--selected' : 'elce-page-button'}
        type="button"
        mix={on<HTMLButtonElement, 'click'>('click', () => {
          workspace.onSetSummarySettingsOpen(false)
          workspace.actions.selectPage(page.id)
        })}
      >
        {renderLucideIcon(getLearningPageTypeIcon(page.type), `${listId}-type-icon-${page.id}`)}
        {pageName}
      </button>
      {showDelete ? <div
        id={`${listId}-actions-${page.id}`}
        className="elce-page-actions"
      >
        {renderDeleteButton(`${listId}-delete-${page.id}`, () => workspace.actions.deletePage(page.id))}
      </div> : null}
    </div>
  </li>
}

/** Renders one insertion line and forwards its native drag events. */
function renderDropSeparator(
  id: string,
  dropTarget: string | null,
  onDragOver: (event: DragEvent, targetId: string) => void,
  onDragLeave: (event: DragEvent) => void,
  onDrop: (event: DragEvent) => void,
  label?: string,
  isPrimary = false,
): RemixNode {
  const separatorClass = dropTarget === id
    ? `elce-drop-separator elce-drop-separator--active${isPrimary ? ' elce-drop-separator--primary' : ''}`
    : `elce-drop-separator${isPrimary ? ' elce-drop-separator--primary' : ''}`
  return <li
    id={id}
    className={separatorClass}
    aria-label={label ?? 'Point d’insertion'}
    mix={[
      on<HTMLLIElement, 'dragover'>('dragover', (event) => onDragOver(event, id)),
      on<HTMLLIElement, 'dragleave'>('dragleave', onDragLeave),
      on<HTMLLIElement, 'drop'>('drop', onDrop),
    ]}
  >
    <span
      id={`${id}-line`}
      className="elce-drop-separator__line"
      aria-hidden={true}
    />
    {label === undefined ? null : <span
      id={`${id}-label`}
      className="elce-drop-separator__label"
    >
      {label}
    </span>}
  </li>
}

/** Renders the chapter icon assigned by the configured chapter type. */
function renderChapterTypeIcon(chapter: LearningChapter): RemixNode {
  switch (chapter.type) {
    case CHAPTER_TYPE.STANDARD:
      return renderLucideIcon(Folder, `elce-chapter-type-icon-${chapter.id}`)
    case CHAPTER_TYPE.EVALUATION:
      return renderLucideIcon(ClipboardCheck, `elce-chapter-type-icon-${chapter.id}`)
    default:
      return assertNever(chapter.type)
  }
}

/** Renders an icon-only action button with an accessible name and tooltip. */
function renderIconButton(id: string, label: string, icon: string, action: () => void, className = 'elce-icon-action'): RemixNode {
  return <button
    id={id}
    className={className}
    type="button"
    aria-label={label}
    title={label}
    mix={on<HTMLButtonElement, 'click'>('click', action)}
  >
    {renderLucideIcon(icon, `${id}-icon`)}
  </button>
}

/** Renders the compact permanent-delete action for a page or empty chapter. */
function renderDeleteButton(id: string, action: () => void, disabled = false): RemixNode {
  return <button
    id={id}
    className="elce-danger-action"
    type="button"
    aria-label="Supprimer définitivement"
    title="Supprimer définitivement"
    disabled={disabled}
    mix={on<HTMLButtonElement, 'click'>('click', action)}
  >
    {renderLucideIcon(Trash2, `${id}-icon`)}
  </button>
}

/** Makes additional chapter types require an explicit visual definition. */
function assertNever(value: never): never {
  throw new Error(`Valeur de scénario non prise en charge : ${String(value)}`)
}
