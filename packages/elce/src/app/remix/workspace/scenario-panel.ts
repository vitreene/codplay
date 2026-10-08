import { on, type RemixNode } from 'remix/ui'
import { jsx } from 'remix/ui/jsx-runtime'
import { ClipboardCheck, FilePlus, Folder, FolderPlus, GripVertical, Presentation, Trash2, X } from 'lucide-static'
import { CHAPTER_TYPE, CHAPTER_TYPE_CONFIG, PAGE_LOCATION, PAGE_TYPE, SCENARIO_ENTRY_KIND } from '../../../config/document-config'
import type { PageType } from '../../../config/document-config-types'
import type { PagePlacement } from '../../../domain/commands/document-command-types'
import type { Chapter, Page } from '../../../domain/document/document-types'
import type { ScenarioEntry } from '../../../domain/scenario/scenario-entry-types'
import { renderLucideIcon } from '../lucide-static-icon'
import type { ScenarioPanelProps } from './scenario-panel-types'

/** Renders the ordered scenario and its native Remix page/chapter controls. */
export function renderScenarioPanel(props: ScenarioPanelProps): RemixNode {
  const { workspace } = props
  const { view, actions, responsivePanel, onSetResponsivePanel } = workspace
  const selectedPageId = view.selectedChapter === undefined ? view.selectedPage?.id : undefined

  return jsx('section', {
    id: 'elce-outline',
    className: 'elce-panel elce-outline',
    'data-drawer-open': responsivePanel === 'outline',
    role: responsivePanel === 'outline' ? 'dialog' : undefined,
    'aria-modal': responsivePanel === 'outline' ? true : undefined,
    'aria-labelledby': 'elce-outline-title',
    children: [
      jsx('div', {
        id: 'elce-outline-heading',
        className: 'elce-panel-heading',
        children: [
          jsx('h1', { id: 'elce-outline-title', children: 'Scénario' }),
          jsx('div', {
            id: 'elce-outline-actions',
            className: 'elce-outline-actions',
            children: [
              renderIconButton('elce-create-chapter', CHAPTER_TYPE_CONFIG[CHAPTER_TYPE.STANDARD].createLabel, FolderPlus, () => actions.createChapter(view.documentModel)),
              renderIconButton('elce-create-evaluation-chapter', CHAPTER_TYPE_CONFIG[CHAPTER_TYPE.EVALUATION].createLabel, ClipboardCheck, () => actions.createEvaluationChapter(view.documentModel)),
              renderIconButton('elce-create-scenario-page', 'Ajouter une Page à la racine du scénario', FilePlus, () => actions.createPage({ kind: PAGE_LOCATION.SCENARIO }, PAGE_TYPE.FLUX), 14),
              renderIconButton('elce-create-scenario-diapo', 'Ajouter une Diapo à la racine du scénario', Presentation, () => actions.createPage({ kind: PAGE_LOCATION.SCENARIO }, PAGE_TYPE.DIAPO), 16),
            ],
          }),
          jsx('button', {
            id: 'elce-outline-close',
            className: 'elce-responsive-panel-close elce-outline-close',
            type: 'button',
            'aria-label': 'Fermer le scénario',
            mix: on<HTMLButtonElement, 'click'>('click', () => onSetResponsivePanel(null)),
            children: renderLucideIcon(X, 'elce-outline-close-icon', 18),
          }),
        ],
      }),
      jsx('p', { id: 'elce-document-name', children: view.documentModel.data.name }),
      jsx('p', { id: 'elce-page-dnd-help', className: 'elce-muted', children: 'Glissez une page pour la déplacer ou la réordonner.' }),
      renderScenarioEntryList(props, view.documentModel.data.scenarioEntries),
      jsx('section', {
        id: 'elce-catalog-pages',
        className: 'elce-outline-group',
        children: [
          jsx('h2', { id: 'elce-catalog-pages-title', children: 'Catalogue de pages' }),
          renderPageList(props, 'elce-catalog-page-list', view.documentModel.data.catalogPageIds, 'Déposer une page ici', () => ({ kind: PAGE_LOCATION.CATALOG }), selectedPageId),
        ],
      }),
    ],
  })
}

/** Renders root pages and chapters between their explicit insertion separators. */
function renderScenarioEntryList(props: ScenarioPanelProps, entries: readonly ScenarioEntry[]): RemixNode {
  const { workspace, onDropRoot, onDragOverRoot, onDragLeave } = props
  const { view, dropTarget } = workspace
  const children: RemixNode[] = []

  entries.forEach((entry, index) => {
    const placement = { kind: PAGE_LOCATION.SCENARIO, index } as const
    children.push(renderDropSeparator(`elce-scenario-entry-list-drop-${index}`, dropTarget, onDragOverRoot, onDragLeave, (event) => onDropRoot(event, placement)))
    switch (entry.kind) {
      case SCENARIO_ENTRY_KIND.PAGE: {
        const page = view.documentModel.pages.find((candidate) => candidate.id === entry.pageId)
        if (page !== undefined) children.push(renderPageItem(props, 'elce-scenario-entry-list', page, view.selectedChapter === undefined ? view.selectedPage?.id : undefined))
        return
      }
      case SCENARIO_ENTRY_KIND.CHAPTER: {
        const chapter = view.documentModel.chapters.find((candidate) => candidate.id === entry.chapterId)
        if (chapter !== undefined) children.push(renderChapterItem(props, chapter))
        return
      }
    }
  })

  const finalPlacement = { kind: PAGE_LOCATION.SCENARIO, index: entries.length } as const
  children.push(renderDropSeparator(
    `elce-scenario-entry-list-drop-${entries.length}`,
    dropTarget,
    onDragOverRoot,
    onDragLeave,
    (event) => onDropRoot(event, finalPlacement),
    entries.length === 0 ? 'Déposer une page à la racine du scénario' : undefined,
  ))
  return jsx('ul', { id: 'elce-scenario-entry-list', className: 'elce-outline-list', children })
}

/** Renders one chapter row and its nested page insertion list. */
function renderChapterItem(props: ScenarioPanelProps, chapter: Chapter): RemixNode {
  const { workspace, onDragStartChapter, onDragEnd } = props
  const { view, actions } = workspace
  const isSelected = view.selectedChapter?.id === chapter.id
  const itemId = `elce-chapter-${chapter.id}`
  const onAddChapterPage = (chapterId: string, pageType: PageType): void => {
    actions.createPage({ kind: PAGE_LOCATION.CHAPTER, chapterId }, pageType)
  }

  return jsx('li', {
    id: itemId,
    children: [
      jsx('div', {
        id: `elce-chapter-heading-${chapter.id}`,
        className: 'elce-outline-item-heading',
        draggable: true,
        'aria-label': `Glisser pour déplacer ${chapter.name}`,
        mix: [
          on<HTMLDivElement, 'dragstart'>('dragstart', (event) => onDragStartChapter(event, chapter.id)),
          on<HTMLDivElement, 'dragend'>('dragend', onDragEnd),
        ],
        children: [
          jsx('span', {
            id: `elce-chapter-drag-handle-${chapter.id}`,
            className: 'elce-drag-handle',
            title: 'Glisser pour déplacer',
            'aria-hidden': true,
            children: renderLucideIcon(GripVertical, `elce-chapter-drag-icon-${chapter.id}`, 14),
          }),
          jsx('button', {
            id: `elce-chapter-select-${chapter.id}`,
            className: isSelected ? 'elce-chapter-select elce-chapter-select--selected' : 'elce-chapter-select',
            type: 'button',
            'aria-pressed': isSelected,
            mix: on<HTMLButtonElement, 'click'>('click', () => actions.selectChapter(chapter.id)),
            children: [renderChapterTypeIcon(chapter), jsx('strong', { id: `elce-chapter-name-${chapter.id}`, children: chapter.name })],
          }),
          jsx('div', {
            id: `elce-chapter-actions-${chapter.id}`,
            className: 'elce-outline-item-actions',
            children: [
              renderIconButton(`elce-create-page-${chapter.id}`, `Ajouter une Page dans ${chapter.name}`, FilePlus, () => onAddChapterPage(chapter.id, PAGE_TYPE.FLUX), 14, 'elce-location-page-action'),
              renderIconButton(`elce-create-diapo-${chapter.id}`, `Ajouter une Diapo dans ${chapter.name}`, Presentation, () => onAddChapterPage(chapter.id, PAGE_TYPE.DIAPO), 16, 'elce-location-page-action'),
              renderDeleteButton(`elce-chapter-delete-${chapter.id}`, () => actions.deleteChapter(chapter.id), chapter.pageIds.length > 0),
            ],
          }),
        ],
      }),
      renderPageList(
        props,
        `elce-pages-${chapter.id}`,
        chapter.pageIds,
        'Déposer une page dans ce chapitre',
        (index) => ({ kind: PAGE_LOCATION.CHAPTER, chapterId: chapter.id, index }),
        view.selectedChapter === undefined ? view.selectedPage?.id : undefined,
      ),
    ],
  })
}

/** Renders a page collection using separators as its only drop targets. */
function renderPageList(
  props: ScenarioPanelProps,
  id: string,
  pageIds: readonly string[],
  emptyLabel: string,
  placementAt: (index: number) => PagePlacement,
  selectedPageId: string | undefined,
): RemixNode {
  const children: RemixNode[] = []
  const { workspace, onDragOverPage, onDragLeave, onDropPage } = props

  pageIds.forEach((pageId, index) => {
    const page = workspace.view.documentModel.pages.find((candidate) => candidate.id === pageId)
    if (page === undefined) return
    const placement = placementAt(index)
    children.push(renderDropSeparator(`${id}-drop-${index}`, workspace.dropTarget, onDragOverPage, onDragLeave, (event) => onDropPage(event, placement)))
    children.push(renderPageItem(props, id, page, selectedPageId))
  })

  children.push(renderDropSeparator(
    `${id}-drop-${pageIds.length}`,
    workspace.dropTarget,
    onDragOverPage,
    onDragLeave,
    (event) => onDropPage(event, placementAt(pageIds.length)),
    pageIds.length === 0 ? emptyLabel : undefined,
  ))
  return jsx('ul', { id, className: 'elce-outline-list', children })
}

/** Renders a page as a draggable source, never as a drop target. */
function renderPageItem(props: ScenarioPanelProps, listId: string, page: Page, selectedPageId?: string): RemixNode {
  const { workspace, onDragStartPage, onDragEnd } = props
  return jsx('li', {
    id: `${listId}-item-${page.id}`,
    children: jsx('div', {
      id: `${listId}-row-${page.id}`,
      className: 'elce-page-row',
      draggable: true,
      'aria-label': `Glisser pour déplacer ${page.name}`,
      mix: [
        on<HTMLDivElement, 'dragstart'>('dragstart', (event) => {
          event.stopPropagation()
          onDragStartPage(event, page.id)
        }),
        on<HTMLDivElement, 'dragend'>('dragend', onDragEnd),
      ],
      children: [
        jsx('span', {
          id: `${listId}-handle-${page.id}`,
          className: 'elce-drag-handle',
          title: 'Glisser pour déplacer',
          'aria-hidden': true,
          children: renderLucideIcon(GripVertical, `${listId}-handle-icon-${page.id}`, 14),
        }),
        jsx('button', {
          id: `${listId}-select-${page.id}`,
          className: page.id === selectedPageId ? 'elce-page-button elce-page-button--selected' : 'elce-page-button',
          type: 'button',
          mix: on<HTMLButtonElement, 'click'>('click', () => workspace.actions.selectPage(page.id)),
          children: page.name,
        }),
        jsx('span', { id: `${listId}-type-${page.id}`, className: 'elce-muted', children: ` · ${pageTypeLabel(page.type)}` }),
        jsx('div', {
          id: `${listId}-actions-${page.id}`,
          className: 'elce-page-actions',
          children: renderDeleteButton(`${listId}-delete-${page.id}`, () => workspace.actions.deletePage(page.id)),
        }),
      ],
    }),
  })
}

/** Renders one insertion line and forwards its native drag events. */
function renderDropSeparator(
  id: string,
  dropTarget: string | null,
  onDragOver: (event: DragEvent, targetId: string) => void,
  onDragLeave: (event: DragEvent) => void,
  onDrop: (event: DragEvent) => void,
  label?: string,
): RemixNode {
  return jsx('li', {
    id,
    className: dropTarget === id ? 'elce-drop-separator elce-drop-separator--active' : 'elce-drop-separator',
    'aria-label': label ?? 'Point d’insertion',
    mix: [
      on<HTMLLIElement, 'dragover'>('dragover', (event) => onDragOver(event, id)),
      on<HTMLLIElement, 'dragleave'>('dragleave', onDragLeave),
      on<HTMLLIElement, 'drop'>('drop', onDrop),
    ],
    children: [
      jsx('span', { id: `${id}-line`, className: 'elce-drop-separator__line', 'aria-hidden': true }),
      label === undefined ? null : jsx('span', { id: `${id}-label`, className: 'elce-drop-separator__label', children: label }),
    ],
  })
}

/** Renders the chapter icon assigned by the configured chapter type. */
function renderChapterTypeIcon(chapter: Chapter): RemixNode {
  switch (chapter.type) {
    case CHAPTER_TYPE.STANDARD:
      return renderLucideIcon(Folder, `elce-chapter-type-icon-${chapter.id}`, 14)
    case CHAPTER_TYPE.EVALUATION:
      return renderLucideIcon(ClipboardCheck, `elce-chapter-type-icon-${chapter.id}`, 14)
    default:
      return assertNever(chapter.type)
  }
}

/** Renders an accessible compact action button with a Lucide icon. */
function renderIconButton(id: string, label: string, icon: string, action: () => void, size = 17, className = 'elce-icon-action'): RemixNode {
  return jsx('button', {
    id,
    className,
    type: 'button',
    'aria-label': label,
    title: label,
    mix: on<HTMLButtonElement, 'click'>('click', action),
    children: renderLucideIcon(icon, `${id}-icon`, size),
  })
}

/** Renders the compact permanent-delete action for a page or empty chapter. */
function renderDeleteButton(id: string, action: () => void, disabled = false): RemixNode {
  return jsx('button', {
    id,
    className: 'elce-danger-action',
    type: 'button',
    'aria-label': 'Supprimer définitivement',
    title: 'Supprimer définitivement',
    disabled,
    mix: on<HTMLButtonElement, 'click'>('click', action),
    children: renderLucideIcon(Trash2, `${id}-icon`, 14),
  })
}

/** Provides the visible label for each configured page format. */
function pageTypeLabel(pageType: PageType): 'Page' | 'Diapo' {
  switch (pageType) {
    case PAGE_TYPE.FLUX:
      return 'Page'
    case PAGE_TYPE.DIAPO:
      return 'Diapo'
    default:
      return assertNever(pageType)
  }
}

/** Makes additional chapter types require an explicit visual definition. */
function assertNever(value: never): never {
  throw new Error(`Valeur de scénario non prise en charge : ${String(value)}`)
}
