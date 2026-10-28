import { on, type Handle, type RemixNode } from 'remix/ui'

import { Activity, BadgeCheck, ClipboardCheck, FileText, Folder, Images, ListChecks, RectangleHorizontal } from 'lucide-static'
import { BDC_TYPE } from '../learning-definition'
import { CHAPTER_TYPE_CONFIG } from '../organization/learning-organization-config'
import { CATALOG_REFERENCE } from '../../../core/catalog/catalog-config'
import { BDC_ORDER } from '../../../core/document/content-location'
import type { LearningBdc, LearningChapter, LearningPage } from '../document/learning-document-types'
import type { LearningEditorFacade } from './learning-editor-facade'
import type { AppearanceTarget } from '../../../domain/appearance/appearance-target-types'
import { editorViewModelEqual } from './learning-authoring-service'
import type { EditorViewModel } from './learning-authoring-service'
import { LearningEditorContextProvider } from '../composition/learning-editor-context'
import { renderLucideIcon } from '../../../core/authoring/lucide-static-icon'
import { getLearningPageTypeIcon } from './learning-page-type-icon'
import type { RemixRenderHandle } from '../../../app/remix/remix-render-handle'
import { renderRemixSectionEditor } from '../../../resources/bdcs/section/authoring/section-editor-remix-view'
import type { SectionEditorData } from '../../../resources/bdcs/section/authoring/section-editor-remix-view'
import { SectionEditorSession } from '../../../resources/bdcs/section/authoring/section-editor-session'
import { createLearningSectionTextFeature } from '../profile/authoring/learning-section-text-feature'
import { LEARNING_PROFILE_TEXT_FIELD_ATTRIBUTES } from '../profile/authoring/learning-profile-text-field-attributes'
import { createLearningPresetBuilder } from '../learning-presets'
import { appearanceClassNameForTarget } from '../../../builders/scene-style/appearance-class-names'
import { createAppearanceTargetStyleSheet } from '../../../player/appearance-scene-style-sheet'
import { renderRemixQuestionEditor } from '../../../resources/bdcs/question/authoring/remix-question-editor'
import { renderRemixEvaluationResultEditor } from './learning-evaluation-result-editor'
import { renderRemixCardEditor } from '../../../resources/bdcs/card/authoring/remix-card-editor'
import { RemixCarouselEditor } from '../../../resources/bdcs/carousel/authoring/remix-carousel-editor'
import { mediaTypeFromMimeType } from '../../../domain/media/media-resource-service'
import { renderRemixStatisticalGraphEditor } from '../../../resources/bdcs/statistical-graph/authoring/remix-statistical-graph-editor'
import { renderAppearanceTrigger } from '../../../core/authoring/appearance-trigger'
import { renderPageEditorView } from '../../../core/authoring/page/page-editor-view'

interface LearningPageEditorProps {
  readonly onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void
  readonly canMoveBdcToPage: (document: EditorViewModel['documentModel'], bdcId: string, pageId: string, index: number) => boolean
}

const chapterTypeIcons = {
  folder: Folder,
  'clipboard-check': ClipboardCheck,
} as const

/** Renders the selected page and all of its BDC editors in Remix. */
export function LearningPageEditor(handle: Handle<LearningPageEditorProps>) {
  const { controller, actions } = handle.context.get(LearningEditorContextProvider)
  if (controller === null || actions === null) return () => null

  const current = { view: actions.authoring.selectEditorViewModel(controller.getSnapshot()) }
  const sectionSession = new SectionEditorSession()
  const sectionData = { data: createSectionEditorData(current.view) }
  const presetBuilder = createLearningPresetBuilder()
  let draggedBdcId: string | null = null
  let dropTargetId: string | null = null
  let editingAnchorBdcId: string | null = null

  const updateDropTarget = (targetId: string | null): void => {
    if (dropTargetId === targetId) return
    dropTargetId = targetId
    if (!handle.signal.aborted) void handle.update()
  }
  const setEditingAnchorBdc = (bdcId: string | null): void => {
    editingAnchorBdcId = bdcId
    if (handle.signal.aborted) return
    void handle.update().then(() => {
      if (bdcId === null || handle.signal.aborted) return
      document.getElementById(`elce-anchor-card-editor-${bdcId}`)?.scrollIntoView({ block: 'nearest' })
    })
  }

  handle.queueTask(() => {
    const subscription = controller.subscribe((snapshot) => {
      const nextView = actions.authoring.selectEditorViewModel(snapshot)
      if (editorViewModelEqual(current.view, nextView)) return
      const previousRestore = current.view.historyRestore
      current.view = nextView
      sectionData.data = createSectionEditorData(nextView)
      const page = current.view.selectedPage
      if (page !== undefined) {
        for (const bdc of current.view.selectedPageBdcs) {
          if (bdc.type === BDC_TYPE.SECTION && bdc.section !== null) {
            sectionSession.updateSection(bdc.id, bdc.section)
          }
        }
      }
      if (!handle.signal.aborted) void handle.update().then(() => {
        const restore = current.view.historyRestore
        if (restore === null || restore === previousRestore || restore.selection === null) return
        sectionSession.restoreSelection(restore.selection)
      })
    })
    handle.signal.addEventListener('abort', () => {
      subscription.unsubscribe()
      sectionSession.destroy()
    }, { once: true })
  })

  return () => renderPageEditor(current.view, actions, {
    actions,
    handle,
    current,
    sectionSession,
    sectionData,
    presetBuilder,
    draggedBdcId: () => draggedBdcId,
    setDraggedBdcId: (bdcId) => { draggedBdcId = bdcId },
    dropTargetId: () => dropTargetId,
    updateDropTarget,
    editingAnchorBdcId,
    setEditingAnchorBdc,
    onOpenAppearanceTarget: handle.props.onOpenAppearanceTarget,
    canMoveBdcToPage: handle.props.canMoveBdcToPage,
  })
}

interface PageEditorRenderState {
  readonly actions: LearningEditorFacade
  readonly handle: RemixRenderHandle
  readonly current: { view: EditorViewModel }
  readonly sectionSession: SectionEditorSession
  readonly sectionData: { data: SectionEditorData }
  readonly presetBuilder: ReturnType<typeof createLearningPresetBuilder>
  readonly draggedBdcId: () => string | null
  readonly setDraggedBdcId: (bdcId: string | null) => void
  readonly dropTargetId: () => string | null
  readonly updateDropTarget: (targetId: string | null) => void
  readonly editingAnchorBdcId: string | null
  readonly setEditingAnchorBdc: (bdcId: string | null) => void
  readonly onOpenAppearanceTarget: (target: AppearanceTarget, triggerId: string) => void
  readonly canMoveBdcToPage: LearningPageEditorProps['canMoveBdcToPage']
}

/** Selects only the document and presentation values consumed by the Section editor. */
function createSectionEditorData(view: EditorViewModel): SectionEditorData {
  return {
    document: view.documentModel.data,
    selectedPageId: view.selectedPage?.id ?? null,
    historySelection: view.historyRestore?.selection ?? null,
    mediaSources: view.mediaSources,
    mediaById: view.mediaById,
  }
}

/** Renders the page title, author commands, and ordered BDC sequence. */
function renderPageEditor(view: EditorViewModel, actions: LearningEditorFacade, state: PageEditorRenderState): RemixNode {
  const page = view.selectedPage
  const availability = actions.authoring.pageBdcAvailability(view)

  const addSection = (): void => {
    if (availability.canCreateSection && page !== undefined) actions.createSection(page.id, page.bdcIds.length)
  }
  const addQuestion = (): void => {
    if (page === undefined || !availability.canCreateQuestion) return
    actions.createQuestion(view.documentModel, page.id, page.bdcIds.length)
  }
  const addEvaluationResult = (): void => {
    if (page === undefined || !availability.canCreateEvaluationResult) return
    actions.createEvaluationResult(page.id, page.bdcIds.length)
  }
  const addCarousel = (): void => {
    if (page === undefined || !availability.canCreateCarousel) return
    actions.createCarousel(page.id, page.bdcIds.length)
  }
  const addStandaloneCard = (): void => {
    if (page === undefined || !availability.canCreateStandaloneCard) return
    actions.createStandaloneCard(page.id)
  }
  const addStatisticalGraph = (): void => {
    if (page === undefined || !availability.canCreateStatisticalGraph) return
    actions.createStatisticalGraph(page.id, page.bdcIds.length)
  }

  return renderPageEditorView({
    page,
    sequence: view.selectedPageBdcs.map((bdc) => ({ bdcId: bdc.id, index: page?.bdcIds.indexOf(bdc.id) ?? -1 })),
    dropTarget: state.dropTargetId(),
    pageToolbar: [
      renderCreateButton('elce-section-create', 'Ajouter un bloc texte', 'Texte', FileText, !availability.canCreateSection, addSection),
      renderCreateButton('elce-question-create', 'Ajouter un bloc quiz', 'Quiz', ListChecks, !availability.canCreateQuestion, addQuestion),
      renderCreateButton('elce-carousel-create', 'Ajouter un bloc Carousel', 'Carousel', Images, !availability.canCreateCarousel, addCarousel),
      page === undefined ? null : renderCreateButton('elce-card-create', 'Ajouter une carte', 'Carte', RectangleHorizontal, !availability.canCreateStandaloneCard, addStandaloneCard),
      page === undefined ? null : renderCreateButton('elce-statistical-graph-create', 'Ajouter un graphe', 'Graphe', Activity, !availability.canCreateStatisticalGraph, addStatisticalGraph),
      availability.canCreateEvaluationResult
        ? renderCreateButton('elce-evaluation-result-create', 'Ajouter un bloc résultat', 'Résultat', BadgeCheck, false, addEvaluationResult)
        : null,
    ],
    chapterTitle: view.pageChapter === undefined ? null : renderPageChapterTitle(view.pageChapter, actions),
    renderPageTypeMark: (currentPage) => renderLucideIcon(
      getLearningPageTypeIcon(currentPage.type),
      `elce-page-type-icon-${currentPage.id}`,
    ),
    onRenamePage: (pageId, name) => actions.renamePage(pageId, name),
    onOpenAppearanceTarget: state.onOpenAppearanceTarget,
    renderBdcEditor: (bdcId) => {
      if (page === undefined) return null
      const bdc = view.selectedPageBdcs.find((candidate) => candidate.id === bdcId)
      return bdc === undefined ? null : renderBdcEditor(bdc, page, view, actions, state)
    },
    onStartBdcDrag: (event, bdcId) => beginBdcDrag(event, bdcId, state),
    onEndBdcDrag: () => endBdcDrag(state),
    onDragOverSeparator: (event, targetId, index) => dragOverBdcSeparator(event, targetId, index, state),
    onDragLeaveSeparator: (event) => dragLeaveBdcSeparator(event, state),
    onDropBdc: (event, index) => dropBdc(event, index, state),
  })
}

/** Renders one compact author command with a short visible label and full accessible name. */
function renderCreateButton(
  id: string,
  label: string,
  visibleLabel: string,
  icon: Parameters<typeof renderLucideIcon>[0],
  disabled: boolean,
  run: () => void,
): RemixNode {
  return <button
    id={id}
    className="elce-add-content-action"
    type="button"
    aria-label={label}
    title={label}
    disabled={disabled}
    mix={on<HTMLButtonElement, 'click'>('click', run)}
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

/** Renders the containing chapter and selected page titles with inline editing. */
function renderPageChapterTitle(chapter: LearningChapter, actions: LearningEditorFacade): RemixNode {
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
      data-elce-profile-token-target="true"
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
function renderChapterTypeMark(chapter: LearningChapter): RemixNode {
  const presentation = CHAPTER_TYPE_CONFIG[chapter.type]
  const icon = chapterTypeIcons[presentation.icon]
  return <span
    id={`elce-chapter-type-mark-${chapter.id}`}
    className="elce-chapter-type-mark"
  >
    {renderLucideIcon(icon, `elce-chapter-type-icon-${chapter.id}`)}
    {presentation.label === null ? null : <span
      id={`elce-chapter-type-label-${chapter.id}`}
    >
      {presentation.label}
    </span>}
  </span>
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

/** Renders one BDC with its native Remix editor and established action facade. */
function renderBdcEditor(
  bdc: LearningBdc,
  page: LearningPage,
  view: EditorViewModel,
  actions: LearningEditorFacade,
  state: PageEditorRenderState,
): RemixNode {
  switch (bdc.type) {
    case BDC_TYPE.SECTION:
      return renderRemixSectionEditor(bdc, page, state.sectionData.data, actions, {
        session: state.sectionSession,
        selectedAnchorBdcId: state.editingAnchorBdcId,
        onEditAnchorBdc: state.setEditingAnchorBdc,
        onCloseAnchorBdc: () => state.setEditingAnchorBdc(null),
        onOpenAppearanceTarget: state.onOpenAppearanceTarget,
        textFeature: createLearningSectionTextFeature(view.documentModel.data.profile.properties),
        textFieldAttributes: LEARNING_PROFILE_TEXT_FIELD_ATTRIBUTES,
        presetBuilder: state.presetBuilder,
        appearanceForBdc: (anchorBdcId) => {
          const document = state.current.view.documentModel
          const target = { kind: 'bdc', bdcId: anchorBdcId } as const
          return {
            className: appearanceClassNameForTarget(document.data, target, (targetBdc) =>
              targetBdc.type === BDC_TYPE.EVALUATION_RESULT ? 'evaluation-result' : undefined),
            styleSheet: createAppearanceTargetStyleSheet(document, target),
          }
        },
        handle: state.handle,
        current: state.sectionData,
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
        textFieldAttributes: LEARNING_PROFILE_TEXT_FIELD_ATTRIBUTES,
        onCatalogReference: (reference) => actions.attachQuestionMediaReference(bdc.id, reference),
        onOpenAppearanceTarget: state.onOpenAppearanceTarget,
      })
    }
    case BDC_TYPE.EVALUATION_RESULT:
      if (bdc.evaluationResult === null || bdc.evaluationResult === undefined) return null
      return renderRemixEvaluationResultEditor(
        bdc.id,
        bdc.evaluationResult,
        (evaluationResult) => actions.updateEvaluationResult(bdc.id, evaluationResult),
        () => actions.deleteEvaluationResult(bdc.id),
        state.onOpenAppearanceTarget,
      )
    case BDC_TYPE.CAROUSEL: {
      if (bdc.carousel === null || bdc.carousel === undefined) return null
      const views = bdc.carousel.cards.flatMap((entry) => {
        const child = view.documentModel.bdcs.find((candidate) => candidate.id === entry.bdcId)
        return child === undefined ? [] : [child]
      })
      return <RemixCarouselEditor
        bdcId={bdc.id}
        content={bdc.carousel}
        bdcs={views}
        selectedCardBdcId={view.selectedCarouselCardBdcId}
        mediaById={view.mediaById}
        textFieldAttributes={LEARNING_PROFILE_TEXT_FIELD_ATTRIBUTES}
        onOpenAppearanceTarget={state.onOpenAppearanceTarget}
        createStatisticalGraphActions={(childBdcId, graph) => actions.createStatisticalGraphEditorActions(childBdcId, graph)}
        actions={actions.createCarouselEditorActions(
          bdc.id,
          bdc.carousel,
          views,
          view.documentModel.data.revelationDefaults,
        )}
      />
    }
    case BDC_TYPE.CARD:
      return renderRemixCardEditor(
        bdc,
        view.mediaById,
        actions.createCardEditorActions(view.documentModel.bdcs),
        () => actions.deleteCard(bdc.id),
        state.onOpenAppearanceTarget,
        LEARNING_PROFILE_TEXT_FIELD_ATTRIBUTES,
      )
    case BDC_TYPE.STATISTICAL_GRAPH:
      if (bdc.statisticalGraph == null) return null
      return renderRemixStatisticalGraphEditor(
        bdc,
        actions.createStatisticalGraphEditorActions(bdc.id, bdc.statisticalGraph),
        () => actions.deleteStatisticalGraph(bdc.id),
        undefined,
        renderAppearanceTrigger({
          id: `elce-statistical-graph-style-${bdc.id}`,
          target: { kind: 'bdc', bdcId: bdc.id },
          label: 'Ouvrir le style du graphe',
          onOpen: state.onOpenAppearanceTarget,
          className: 'elce-appearance-trigger elce-bdc-style-trigger',
        }),
        LEARNING_PROFILE_TEXT_FIELD_ATTRIBUTES,
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
  if (localBdcId !== null && !state.canMoveBdcToPage(state.current.view.documentModel, localBdcId, page.id, index)) return
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
  if (!state.canMoveBdcToPage(state.current.view.documentModel, bdcId, page.id, index)) {
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

