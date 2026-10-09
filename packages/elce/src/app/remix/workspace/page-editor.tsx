import { on, type Handle, type RemixNode } from 'remix/ui'

import { BadgeCheck, ClipboardCheck, FileText, Folder, GripVertical, Images, ListChecks, RectangleHorizontal } from 'lucide-static'
import { BDC_ORDER, BDC_TYPE, CATALOG_REFERENCE, CHAPTER_TYPE, CHAPTER_TYPE_CONFIG, PAGE_TYPE } from '../../../config/document-config'
import type { Bdc, Chapter, Page } from '../../../domain/document/document-types'
import { canMoveBdcToPage } from '../../../domain/commands/document-commands'
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

  return <section
    id="elce-work-area"
    className="elce-panel elce-work-area"
  >
    <div
      id="elce-work-area-heading"
      className="elce-work-area-heading"
    >
      {renderPreviewControls(state.onPreview, state.previewError)}
      <div
        id="elce-work-area-title-row"
        className="elce-work-area-title-row"
      >
        <div
          id="elce-work-area-titles"
          className="elce-work-area-titles"
        >
          {view.pageChapter === undefined ? null : renderPageChapterTitle(view.pageChapter, actions)}
          {renderPageTitle(page, actions)}
        </div>
        <div
          id="elce-work-area-actions"
          className="elce-work-area-actions"
        >
          {renderCreateButton('elce-section-create', 'Ajouter un bloc texte', FileText, !canCreateSection, addSection)}
          {renderCreateButton('elce-question-create', 'Ajouter un bloc quiz', ListChecks, !canCreateQuestion, addQuestion)}
          {renderCreateButton('elce-carousel-create', 'Ajouter un bloc Carousel', Images, !canCreateCarousel, addCarousel)}
          {page === undefined ? null : renderCreateButton('elce-card-create', 'Ajouter une carte', RectangleHorizontal, !canCreateStandaloneCard, addStandaloneCard)}
          {canCreateEvaluationResult
            ? renderCreateButton('elce-evaluation-result-create', 'Ajouter un bloc résultat', BadgeCheck, false, addEvaluationResult)
            : null}
        </div>
      </div>
    </div>
    {page === undefined
      ? <p
        id="elce-editor-unavailable"
      >
        Sélectionnez une page du scénario.
      </p>
      : renderPageBdcList(page, view, actions, state)}
  </section>
}

/** Renders the page preview command and any popup-blocking error. */
function renderPreviewControls(onPreview: () => void, previewError: string | null): RemixNode {
  return <div
    id="elce-work-area-preview-row"
    className="elce-work-area-preview-row"
  >
    <button
      id="elce-preview-open"
      type="button"
      mix={on<HTMLButtonElement, 'click'>('click', onPreview)}
    >
      Prévisualiser
    </button>
    {previewError === null ? null : <p
      id="elce-preview-open-error"
      role="alert"
    >
      {previewError}
    </p>}
  </div>
}

/** Renders one icon-only author command with the existing labels. */
function renderCreateButton(
  id: string,
  label: string,
  icon: Parameters<typeof renderLucideIcon>[0],
  disabled: boolean,
  run: () => void,
): RemixNode {
  return <button
    id={id}
    className="elce-icon-action"
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled}
    mix={on<HTMLButtonElement, 'click'>('click', run)}
  >
    {renderLucideIcon(icon, `${id}-icon`, 17)}
  </button>
}

/** Renders the containing chapter and selected page titles with inline editing. */
function renderPageChapterTitle(chapter: Chapter, actions: EditorActionsFacade): RemixNode {
  return <h2
    id="elce-work-area-chapter-title"
    className="elce-work-area-chapter-title"
  >
    {renderChapterTypeMark(chapter)}
    <input
      id={`elce-chapter-title-${chapter.id}`}
      className="elce-inline-title-input"
      type="text"
      aria-label={CHAPTER_TYPE_CONFIG[chapter.type].titleLabel}
      title={CHAPTER_TYPE_CONFIG[chapter.type].editTitleLabel}
      defaultValue={chapter.name}
      key={`${chapter.id}:${chapter.name}`}
      mix={[
        on<HTMLInputElement, 'blur'>('blur', (event) => commitInlineName(event.currentTarget, chapter.name, (name) => actions.renameChapter(chapter.id, name))),
        on<HTMLInputElement, 'keydown'>('keydown', (event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }),
      ]}
    />
  </h2>
}

/** Renders a chapter type icon and any configured visible label. */
function renderChapterTypeMark(chapter: Chapter): RemixNode {
  const presentation = CHAPTER_TYPE_CONFIG[chapter.type]
  const icon = chapterTypeIcons[presentation.icon]
  return <span
    id={`elce-chapter-type-mark-${chapter.id}`}
    className="elce-chapter-type-mark"
  >
    {renderLucideIcon(icon, `elce-chapter-type-icon-${chapter.id}`, 14)}
    {presentation.label === null ? null : <span
      id={`elce-chapter-type-label-${chapter.id}`}
    >
      {presentation.label}
    </span>}
  </span>
}

/** Renders the selected page's inline editable title. */
function renderPageTitle(page: Page | undefined, actions: EditorActionsFacade): RemixNode {
  if (page === undefined) return <h1
    id="elce-work-area-title"
  >
    Éditeur
  </h1>
  return <h1
    id="elce-work-area-title"
    className="elce-work-area-page-title"
  >
    <input
      id={`elce-page-title-${page.id}`}
      className="elce-inline-title-input"
      type="text"
      aria-label="Titre de la page"
      title="Modifier le titre de la page"
      defaultValue={page.name}
      key={`${page.id}:${page.name}`}
      mix={[
        on<HTMLInputElement, 'blur'>('blur', (event) => commitInlineName(event.currentTarget, page.name, (name) => actions.renamePage(page.id, name))),
        on<HTMLInputElement, 'keydown'>('keydown', (event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }),
      ]}
    />
  </h1>
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
  return <div
    id={`elce-page-bdc-list-${page.id}`}
    className="elce-page-bdc-list"
  >
    {[
      view.selectedPageBdcs.length === 0
        ? <p
          id="elce-editor-unavailable"
        >
          Cette page ne contient aucun bloc éditable.
        </p>
        : null,
      ...view.selectedPageBdcs.flatMap((bdc) => {
        const index = page.bdcIds.indexOf(bdc.id)
        const separatorId = `elce-page-bdc-drop-${index}`
        return [
          renderBdcSeparator(separatorId, index, state),
          <div
            key={bdc.id}
            id={`elce-page-bdc-${bdc.id}`}
            className="elce-page-bdc"
          >
            <button
              id={`elce-page-bdc-drag-${bdc.id}`}
              className="elce-page-bdc__drag"
              type="button"
              draggable={true}
              aria-label="Déplacer le bloc dans la page"
              title="Glisser pour déplacer"
              mix={[
                on<HTMLButtonElement, 'dragstart'>('dragstart', (event) => beginBdcDrag(event, bdc.id, state)),
                on<HTMLButtonElement, 'dragend'>('dragend', () => endBdcDrag(state)),
              ]}
            >
              {renderLucideIcon(GripVertical, `elce-page-bdc-drag-icon-${bdc.id}`, 15)}
            </button>
            {renderBdcEditor(bdc, page, view, actions, state)}
          </div>,
        ]
      }),
      renderBdcSeparator(`elce-page-bdc-drop-${page.bdcIds.length}`, page.bdcIds.length, state),
    ]}
  </div>
}

/** Renders one insertion separator for a BDC drag. */
function renderBdcSeparator(id: string, index: number, state: PageEditorRenderState): RemixNode {
  const active = state.dropTargetId() === id
  return <div
    id={id}
    className={active ? 'elce-page-bdc-drop elce-page-bdc-drop--active' : 'elce-page-bdc-drop'}
    aria-label="Déposer le bloc à cet endroit"
    mix={[
      on<HTMLElement, 'dragover'>('dragover', (event) => dragOverBdcSeparator(event, id, index, state)),
      on<HTMLElement, 'dragleave'>('dragleave', (event) => dragLeaveBdcSeparator(event, state)),
      on<HTMLElement, 'drop'>('drop', (event) => dropBdc(event, index, state)),
    ]}
  >
    <span
      id={`${id}-line`}
    />
  </div>
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
      return <RemixCarouselEditor
        bdcId={bdc.id}
        content={bdc.carousel}
        cards={cards}
        selectedCardBdcId={view.selectedCarouselCardBdcId}
        mediaById={view.mediaById}
        actions={actions.createCarouselEditorActions(
          bdc.id,
          bdc.carousel,
          cards,
          view.documentModel.data.revelationDefaults,
        )}
      />
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
function dragOverBdcSeparator(event: DragEvent, targetId: string, index: number, state: PageEditorRenderState): void {
  const transfer = event.dataTransfer
  if (transfer === null) return
  const localBdcId = state.draggedBdcId()
  const isCatalogBdc = transfer.effectAllowed === 'move'
    && Array.from(transfer.types).includes(CATALOG_REFERENCE.MIME_TYPE)
  if (localBdcId === null && !isCatalogBdc) return
  const page = state.current.view.selectedPage
  if (page === undefined) return
  if (localBdcId !== null && !canMoveBdcToPage(state.current.view.documentModel, localBdcId, page.id, index)) return
  event.preventDefault()
  event.stopPropagation()
  transfer.dropEffect = 'move'
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
  const bdcId = state.draggedBdcId() ?? catalogBdcIdFromTransfer(event.dataTransfer)
  const page = state.current.view.selectedPage
  if (bdcId === null || page === undefined) {
    state.updateDropTarget(null)
    return
  }
  if (!canMoveBdcToPage(state.current.view.documentModel, bdcId, page.id, index)) {
    event.preventDefault()
    event.stopPropagation()
    state.updateDropTarget(null)
    return
  }
  event.preventDefault()
  event.stopPropagation()
  state.actions.moveBdc(bdcId, page.id, index)
  endBdcDrag(state)
}

/** Reads one unique BDC reference from a catalogue drag payload. */
function catalogBdcIdFromTransfer(transfer: DataTransfer | null): string | null {
  if (transfer === null || !Array.from(transfer.types).includes(CATALOG_REFERENCE.MIME_TYPE)) return null
  try {
    const reference: unknown = JSON.parse(transfer.getData(CATALOG_REFERENCE.MIME_TYPE))
    if (typeof reference !== 'object' || reference === null) return null
    const value = reference as { kind?: unknown; bdcId?: unknown }
    return value.kind === CATALOG_REFERENCE.BDC && typeof value.bdcId === 'string' ? value.bdcId : null
  } catch {
    return null
  }
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
