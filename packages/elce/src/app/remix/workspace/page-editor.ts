import { on, type Handle, type RemixNode } from 'remix/ui'
import { jsx } from 'remix/ui/jsx-runtime'
import { BadgeCheck, ClipboardCheck, FileText, Folder, GripVertical, Images, ListChecks, RectangleHorizontal } from 'lucide-static'
import { BDC_ORDER, BDC_TYPE, CHAPTER_TYPE, CHAPTER_TYPE_CONFIG, PAGE_TYPE } from '../../../config/document-config'
import type { Bdc, Chapter, Page } from '../../../domain/document/document-types'
import type { EditorActionsFacade } from '../../facades/editor-actions-facade'
import { selectEditorViewModel } from '../../selectors/editor-view-model'
import type { EditorViewModel } from '../../selectors/editor-view-model'
import { EditorContextProvider } from '../editor-context'
import { renderLucideIcon } from '../lucide-static-icon'
import type { RemixRenderHandle } from '../remix-render-handle'
import { SectionTiptapAdapter } from '../../editor/section/section-editor-tiptap-adapter'
import type { SectionToolbarState } from '../../editor/section/section-editor-tiptap'
import { renderRemixSectionEditor } from '../../editor/section/section-editor-remix-view'
import { renderRemixQuestionEditor } from '../../editor/question/remix-question-editor'
import { renderRemixEvaluationResultEditor } from '../../editor/evaluation-result/remix-evaluation-result-editor'
import { renderRemixCardEditor } from '../../editor/card/remix-card-editor'
import { RemixCarouselEditor } from '../../editor/carousel/remix-carousel-editor'
import { mediaTypeFromMimeType } from '../../../domain/media/media-resource-service'

const chapterTypeIcons = {
  folder: Folder,
  'clipboard-check': ClipboardCheck,
} as const

export interface RemixPageEditorProps {
  readonly onPreview: () => void
  readonly previewError: string | null
}

/** Renders the selected page and all of its BDC editors in Remix. */
export function RemixPageEditor(handle: Handle<RemixPageEditorProps>) {
  const { controller, actions } = handle.context.get(EditorContextProvider)
  if (controller === null || actions === null) return () => null

  const current = { view: selectEditorViewModel(controller.getSnapshot()) }
  const sectionAdapters = new Map<string, SectionTiptapAdapter>()
  const toolbarStates = new Map<string, SectionToolbarState>()
  let draggedBdcId: string | null = null
  let dropTargetId: string | null = null
  let editingAnchorCardId: string | null = null

  const updateDropTarget = (targetId: string | null): void => {
    if (dropTargetId === targetId) return
    dropTargetId = targetId
    if (!handle.signal.aborted) void handle.update()
  }
  const setEditingAnchorCard = (bdcId: string | null): void => {
    editingAnchorCardId = bdcId
    if (!handle.signal.aborted) void handle.update()
  }

  handle.queueTask(() => {
    const subscription = controller.subscribe((snapshot) => {
      current.view = selectEditorViewModel(snapshot)
      const page = current.view.selectedPage
      if (page !== undefined) {
        for (const bdc of current.view.selectedPageBdcs) {
          if (bdc.type === BDC_TYPE.SECTION && bdc.section !== null) {
            sectionAdapters.get(bdc.id)?.updateSection(bdc.section)
          }
        }
      }
      if (!handle.signal.aborted) void handle.update()
    })
    handle.signal.addEventListener('abort', () => subscription.unsubscribe(), { once: true })
  })

  return () => renderPageEditor(current.view, actions, {
    actions,
    handle,
    current,
    sectionAdapters,
    toolbarStates,
    draggedBdcId: () => draggedBdcId,
    setDraggedBdcId: (bdcId) => { draggedBdcId = bdcId },
    dropTargetId: () => dropTargetId,
    updateDropTarget,
    editingAnchorCardId,
    setEditingAnchorCard,
    onPreview: handle.props.onPreview,
    previewError: handle.props.previewError,
  })
}

interface PageEditorRenderState {
  readonly actions: EditorActionsFacade
  readonly handle: RemixRenderHandle
  readonly current: { view: EditorViewModel }
  readonly sectionAdapters: Map<string, SectionTiptapAdapter>
  readonly toolbarStates: Map<string, SectionToolbarState>
  readonly draggedBdcId: () => string | null
  readonly setDraggedBdcId: (bdcId: string | null) => void
  readonly dropTargetId: () => string | null
  readonly updateDropTarget: (targetId: string | null) => void
  readonly editingAnchorCardId: string | null
  readonly setEditingAnchorCard: (bdcId: string | null) => void
  readonly onPreview: () => void
  readonly previewError: string | null
}

/** Renders the page title, author commands, and ordered BDC sequence. */
function renderPageEditor(view: EditorViewModel, actions: EditorActionsFacade, state: PageEditorRenderState): RemixNode {
  const page = view.selectedPage
  const canCreateQuestion = pageAllowsQuestion(page)
    && !view.pageHasQuestion
    && (page?.type !== PAGE_TYPE.DIAPO || !view.pageHasContent)
  const canCreateSection = pageAllowsSection(page)
  const canCreateEvaluationResult = pageAllowsEvaluationResult(page, view.documentModel.chapters)
    && (page?.type !== PAGE_TYPE.DIAPO || !view.pageHasContent)
  const canCreateCarousel = page?.type === PAGE_TYPE.FLUX
    || (page?.type === PAGE_TYPE.DIAPO && !view.pageHasContent && !view.pageHasCarousel)
  const canCreateStandaloneCard = page?.type === PAGE_TYPE.FLUX
    || (page?.type === PAGE_TYPE.DIAPO && !view.pageHasContent)

  const addSection = (): void => {
    if (pageAllowsSection(page) && page !== undefined) actions.createSection(page.id, page.bdcIds.length)
  }
  const addQuestion = (): void => {
    if (page === undefined || !canCreateQuestion) return
    actions.createQuestion(view.documentModel, page.id, page.bdcIds.length)
  }
  const addEvaluationResult = (): void => {
    if (page === undefined || !canCreateEvaluationResult) return
    actions.createEvaluationResult(page.id, page.bdcIds.length)
  }
  const addCarousel = (): void => {
    if (page === undefined || !canCreateCarousel) return
    actions.createCarousel(page.id, page.bdcIds.length)
  }
  const addStandaloneCard = (): void => {
    if (page === undefined || !canCreateStandaloneCard) return
    actions.createStandaloneCard(page.id)
  }

  return jsx('section', {
    id: 'elce-work-area',
    className: 'elce-panel elce-work-area',
    children: [
      jsx('div', {
        id: 'elce-work-area-heading',
        className: 'elce-work-area-heading',
        children: [
          renderPreviewControls(state.onPreview, state.previewError),
          jsx('div', {
            id: 'elce-work-area-title-row',
            className: 'elce-work-area-title-row',
            children: [
              jsx('div', {
                id: 'elce-work-area-titles',
                className: 'elce-work-area-titles',
                children: [
                  view.pageChapter === undefined ? null : renderPageChapterTitle(view.pageChapter, actions),
                  renderPageTitle(page, actions),
                ],
              }),
              jsx('div', {
                id: 'elce-work-area-actions',
                className: 'elce-work-area-actions',
                children: [
                  renderCreateButton('elce-section-create', 'Ajouter un bloc texte', FileText, !canCreateSection, addSection),
                  renderCreateButton('elce-question-create', 'Ajouter un bloc quiz', ListChecks, !canCreateQuestion, addQuestion),
                  renderCreateButton('elce-carousel-create', 'Ajouter un bloc Carousel', Images, !canCreateCarousel, addCarousel),
                  page === undefined ? null : renderCreateButton('elce-card-create', 'Ajouter une carte', RectangleHorizontal, !canCreateStandaloneCard, addStandaloneCard),
                  canCreateEvaluationResult
                    ? renderCreateButton('elce-evaluation-result-create', 'Ajouter un bloc résultat', BadgeCheck, false, addEvaluationResult)
                    : null,
                ],
              }),
            ],
          }),
        ],
      }),
      page === undefined
        ? jsx('p', { id: 'elce-editor-unavailable', children: 'Sélectionnez une page du scénario.' })
        : renderPageBdcList(page, view, actions, state),
    ],
  })
}

/** Renders the page preview command and any popup-blocking error. */
function renderPreviewControls(onPreview: () => void, previewError: string | null): RemixNode {
  return jsx('div', {
    id: 'elce-work-area-preview-row',
    className: 'elce-work-area-preview-row',
    children: [
      jsx('button', {
        id: 'elce-preview-open',
        type: 'button',
        mix: on<HTMLButtonElement, 'click'>('click', onPreview),
        children: 'Prévisualiser',
      }),
      previewError === null ? null : jsx('p', { id: 'elce-preview-open-error', role: 'alert', children: previewError }),
    ],
  })
}

/** Renders one icon-only author command with the existing labels. */
function renderCreateButton(
  id: string,
  label: string,
  icon: Parameters<typeof renderLucideIcon>[0],
  disabled: boolean,
  run: () => void,
): RemixNode {
  return jsx('button', {
    id,
    className: 'elce-icon-action',
    type: 'button',
    'aria-label': label,
    title: label,
    disabled,
    mix: on<HTMLButtonElement, 'click'>('click', run),
    children: renderLucideIcon(icon, `${id}-icon`, 17),
  })
}

/** Renders the containing chapter and selected page titles with inline editing. */
function renderPageChapterTitle(chapter: Chapter, actions: EditorActionsFacade): RemixNode {
  return jsx('h2', {
    id: 'elce-work-area-chapter-title',
    className: 'elce-work-area-chapter-title',
    children: [
      renderChapterTypeMark(chapter),
      jsx('input', {
        id: `elce-chapter-title-${chapter.id}`,
        className: 'elce-inline-title-input',
        type: 'text',
        'aria-label': CHAPTER_TYPE_CONFIG[chapter.type].titleLabel,
        title: CHAPTER_TYPE_CONFIG[chapter.type].editTitleLabel,
        defaultValue: chapter.name,
        key: `${chapter.id}:${chapter.name}`,
        mix: [
          on<HTMLInputElement, 'blur'>('blur', (event) => commitInlineName(event.currentTarget, chapter.name, (name) => actions.renameChapter(chapter.id, name))),
          on<HTMLInputElement, 'keydown'>('keydown', (event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
          }),
        ],
      }),
    ],
  })
}

/** Renders a chapter type icon and any configured visible label. */
function renderChapterTypeMark(chapter: Chapter): RemixNode {
  const presentation = CHAPTER_TYPE_CONFIG[chapter.type]
  const icon = chapterTypeIcons[presentation.icon]
  return jsx('span', {
    id: `elce-chapter-type-mark-${chapter.id}`,
    className: 'elce-chapter-type-mark',
    children: [
      renderLucideIcon(icon, `elce-chapter-type-icon-${chapter.id}`, 14),
      presentation.label === null ? null : jsx('span', { id: `elce-chapter-type-label-${chapter.id}`, children: presentation.label }),
    ],
  })
}

/** Renders the selected page's inline editable title. */
function renderPageTitle(page: Page | undefined, actions: EditorActionsFacade): RemixNode {
  if (page === undefined) return jsx('h1', { id: 'elce-work-area-title', children: 'Éditeur' })
  return jsx('h1', {
    id: 'elce-work-area-title',
    className: 'elce-work-area-page-title',
    children: jsx('input', {
      id: `elce-page-title-${page.id}`,
      className: 'elce-inline-title-input',
      type: 'text',
      'aria-label': 'Titre de la page',
      title: 'Modifier le titre de la page',
      defaultValue: page.name,
      key: `${page.id}:${page.name}`,
      mix: [
        on<HTMLInputElement, 'blur'>('blur', (event) => commitInlineName(event.currentTarget, page.name, (name) => actions.renamePage(page.id, name))),
        on<HTMLInputElement, 'keydown'>('keydown', (event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }),
      ],
    }),
  })
}

/** Keeps inline title validation consistent with the existing page editor. */
function commitInlineName(input: HTMLInputElement, previous: string, rename: (name: string) => void): void {
  const next = input.value.trim()
  if (next.length === 0) {
    input.value = previous
    return
  }
  if (next !== previous) rename(next)
}

/** Renders each direct BDC in document order with a native drag separator. */
function renderPageBdcList(page: Page, view: EditorViewModel, actions: EditorActionsFacade, state: PageEditorRenderState): RemixNode {
  return jsx('div', {
    id: `elce-page-bdc-list-${page.id}`,
    className: 'elce-page-bdc-list',
    children: [
      view.selectedPageBdcs.length === 0
        ? jsx('p', { id: 'elce-editor-unavailable', children: 'Cette page ne contient aucun bloc éditable.' })
        : null,
      ...view.selectedPageBdcs.flatMap((bdc) => {
        const index = page.bdcIds.indexOf(bdc.id)
        const separatorId = `elce-page-bdc-drop-${index}`
        return [
          renderBdcSeparator(separatorId, index, state),
          jsx('div', {
            id: `elce-page-bdc-${bdc.id}`,
            className: 'elce-page-bdc',
            children: [
              jsx('button', {
                id: `elce-page-bdc-drag-${bdc.id}`,
                className: 'elce-page-bdc__drag',
                type: 'button',
                draggable: true,
                'aria-label': 'Déplacer le bloc dans la page',
                title: 'Glisser pour déplacer',
                mix: [
                  on<HTMLButtonElement, 'dragstart'>('dragstart', (event) => beginBdcDrag(event, bdc.id, state)),
                  on<HTMLButtonElement, 'dragend'>('dragend', () => endBdcDrag(state)),
                ],
                children: renderLucideIcon(GripVertical, `elce-page-bdc-drag-icon-${bdc.id}`, 15),
              }),
              renderBdcEditor(bdc, page, view, actions, state),
            ],
          }, bdc.id),
        ]
      }),
      renderBdcSeparator(`elce-page-bdc-drop-${page.bdcIds.length}`, page.bdcIds.length, state),
    ],
  })
}

/** Renders one insertion separator for a BDC drag. */
function renderBdcSeparator(id: string, index: number, state: PageEditorRenderState): RemixNode {
  const active = state.dropTargetId() === id
  return jsx('div', {
    id,
    className: active ? 'elce-page-bdc-drop elce-page-bdc-drop--active' : 'elce-page-bdc-drop',
    'aria-label': 'Déposer le bloc à cet endroit',
    mix: [
      on<HTMLElement, 'dragover'>('dragover', (event) => dragOverBdcSeparator(event, id, state)),
      on<HTMLElement, 'dragleave'>('dragleave', (event) => dragLeaveBdcSeparator(event, state)),
      on<HTMLElement, 'drop'>('drop', (event) => dropBdc(event, index, state)),
    ],
    children: jsx('span', { id: `${id}-line` }),
  })
}

/** Renders one BDC with its native Remix editor and established action facade. */
function renderBdcEditor(
  bdc: Bdc,
  page: Page,
  view: EditorViewModel,
  actions: EditorActionsFacade,
  state: PageEditorRenderState,
): RemixNode {
  switch (bdc.type) {
    case BDC_TYPE.SECTION:
      return renderRemixSectionEditor(bdc, page, view, actions, {
        adapters: state.sectionAdapters,
        toolbarStates: state.toolbarStates,
        selectedAnchorCardId: state.editingAnchorCardId,
        onEditAnchorCard: state.setEditingAnchorCard,
        onCloseAnchorCard: () => state.setEditingAnchorCard(null),
        handle: state.handle,
        current: state.current,
      })
    case BDC_TYPE.QUESTION: {
      if (bdc.question === null) return null
      const mediaId = bdc.question.mediaId
      const media = mediaId === null
        ? null
        : view.documentModel.medias.find((candidate) => candidate.id === mediaId) ?? null
      return renderRemixQuestionEditor({
        bdcId: bdc.id,
        question: bdc.question,
        media,
        mediaType: media === null ? null : mediaTypeFromMimeType(media.mimeType),
        mediaSource: mediaId === null ? null : view.mediaSources[mediaId] ?? null,
        actions: actions.createQuestionEditorActions(bdc.id, bdc.question),
        onCatalogReference: (reference) => actions.attachQuestionMediaReference(bdc.id, reference),
      })
    }
    case BDC_TYPE.EVALUATION_RESULT:
      if (bdc.evaluationResult === null || bdc.evaluationResult === undefined) return null
      return renderRemixEvaluationResultEditor(
        bdc.id,
        bdc.evaluationResult,
        (evaluationResult) => actions.updateEvaluationResult(bdc.id, evaluationResult),
        () => actions.deleteEvaluationResult(bdc.id),
      )
    case BDC_TYPE.CAROUSEL: {
      if (bdc.carousel === null || bdc.carousel === undefined) return null
      const cards = bdc.carousel.cards.flatMap((entry) => {
        const card = view.documentModel.bdcs.find((candidate) => candidate.id === entry.bdcId)
        return card === undefined ? [] : [card]
      })
      return jsx(RemixCarouselEditor, {
        bdcId: bdc.id,
        content: bdc.carousel,
        cards,
        selectedCardBdcId: view.selectedCarouselCardBdcId,
        mediaById: view.mediaById,
        actions: actions.createCarouselEditorActions(
          bdc.id,
          bdc.carousel,
          cards,
          view.documentModel.data.revelationDefaults,
        ),
      })
    }
    case BDC_TYPE.CARD:
      return renderRemixCardEditor(
        bdc,
        view,
        actions.createCardEditorActions(view.documentModel.bdcs),
        () => actions.deleteCard(bdc.id),
      )
    default:
      return null
  }
}

/** Starts a native drag for one direct page BDC. */
function beginBdcDrag(event: DragEvent, bdcId: string, state: PageEditorRenderState): void {
  const transfer = event.dataTransfer
  if (transfer === null) return
  state.setDraggedBdcId(bdcId)
  transfer.effectAllowed = 'move'
  transfer.setData(BDC_ORDER.MIME_TYPE, bdcId)
}

/** Highlights a page separator only while a BDC is being dragged. */
function dragOverBdcSeparator(event: DragEvent, targetId: string, state: PageEditorRenderState): void {
  if (state.draggedBdcId() === null || event.dataTransfer === null) return
  event.preventDefault()
  event.stopPropagation()
  event.dataTransfer.dropEffect = 'move'
  state.updateDropTarget(targetId)
}

/** Clears an insertion highlight when the pointer leaves its separator. */
function dragLeaveBdcSeparator(event: DragEvent, state: PageEditorRenderState): void {
  const currentTarget = event.currentTarget
  if (currentTarget instanceof Node && event.relatedTarget instanceof Node && currentTarget.contains(event.relatedTarget)) return
  state.updateDropTarget(null)
}

/** Moves the dragged BDC through the existing facade at the selected index. */
function dropBdc(event: DragEvent, index: number, state: PageEditorRenderState): void {
  const bdcId = state.draggedBdcId()
  const page = state.current.view.selectedPage
  if (bdcId === null || page === undefined) return
  event.preventDefault()
  event.stopPropagation()
  state.actions.moveBdc(bdcId, page.id, index)
  endBdcDrag(state)
}

/** Clears the transient BDC drag source and its highlighted separator. */
function endBdcDrag(state: PageEditorRenderState): void {
  state.setDraggedBdcId(null)
  state.updateDropTarget(null)
}

/** Applies the current page type's Question creation whitelist. */
function pageAllowsQuestion(page: Page | undefined): boolean {
  return page?.type === PAGE_TYPE.FLUX || page?.type === PAGE_TYPE.DIAPO
}

/** Applies the current page type's Section creation whitelist. */
function pageAllowsSection(page: Page | undefined): boolean {
  return page?.type === PAGE_TYPE.FLUX
}

/** Applies the current evaluation chapter and page type whitelist for Result. */
function pageAllowsEvaluationResult(page: Page | undefined, chapters: readonly Chapter[]): boolean {
  if (page?.type !== PAGE_TYPE.FLUX && page?.type !== PAGE_TYPE.DIAPO) return false
  return page.chapterId !== null && chapters.find((chapter) => chapter.id === page.chapterId)?.type === CHAPTER_TYPE.EVALUATION
}
