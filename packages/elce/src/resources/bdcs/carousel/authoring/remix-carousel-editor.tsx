import { Activity, ChevronDown, ChevronUp, GripVertical, Library, List, Plus, RectangleHorizontal, Trash2 } from 'lucide-static'
import {
  CAROUSEL_ASPECT_RATIO_OPTIONS,
  CAROUSEL_CONFIG,
  CAROUSEL_PLAYBACK_MODE,
  CAROUSEL_PLAYBACK_MODE_OPTIONS,
} from '../carousel-config'
import { CAROUSEL_TRANSITION_OPTIONS } from '../../../revelation/revelation-config'
import type { CarouselAspectRatioId } from '../carousel-config'
import type { CarouselAspectRatio } from '../domain/carousel-types'
import type { ResourceBdc } from '../../../document/resource-document-types'
import { on, type Handle, type RemixNode } from 'remix/component'

import type { ElceCarouselEditorProps } from './carousel-facade-types'
import { renderLucideIcon } from '../../../../core/authoring/lucide-static-icon'
import { renderAppearanceTrigger } from '../../../../core/authoring/appearance-trigger'
import { installOutsideMenuDismissal } from '../../../../core/authoring/menus/outside-menu-dismissal'
import { RemixCardEditorFields } from '../../card/authoring/remix-card-editor-fields'
import { renderRemixStatisticalGraphEditor } from '../../statistical-graph/authoring/remix-statistical-graph-editor'
import { authoredTextToPlainText } from '../../../../core/document/rich-text-utils'

/** Renders Carousel settings and its ordered illustration BDCs in the Remix runtime. */
export function RemixCarouselEditor(handle: Handle<ElceCarouselEditorProps>) {
  let draggedCardBdcId: string | null = null
  let isAddViewMenuOpen = false
  let isTrashDropTargetActive = false
  let isCatalogDropTargetActive = false
  let trashAnimationToken = 0
  let trashAnimationTimer: ReturnType<typeof setTimeout> | undefined

  /** Updates transient visibility of the horizontal add-view menu. */
  const updateAddViewMenuOpen = (isOpen: boolean): void => {
    if (isAddViewMenuOpen === isOpen) return
    isAddViewMenuOpen = isOpen
    if (!handle.signal.aborted) void handle.update()
  }

  const removeAddViewMenuDismissal = installOutsideMenuDismissal({
    getRoot: () => document.getElementById(`elce-carousel-view-add-${handle.props.bdcId}`),
    isOpen: () => isAddViewMenuOpen,
    onDismiss: () => updateAddViewMenuOpen(false),
  })
  handle.signal.addEventListener('abort', () => {
    removeAddViewMenuDismissal()
  }, { once: true })

  /** Updates the highlighted state of the view-strip trash target. */
  const updateTrashDropTarget = (isActive: boolean): void => {
    if (isTrashDropTargetActive === isActive) return
    isTrashDropTargetActive = isActive
    if (!handle.signal.aborted) void handle.update()
  }

  /** Updates the highlighted state of the view-strip catalog target. */
  const updateCatalogDropTarget = (isActive: boolean): void => {
    if (isCatalogDropTargetActive === isActive) return
    isCatalogDropTargetActive = isActive
    if (!handle.signal.aborted) void handle.update()
  }

  /** Confirms a completed view deletion with one short trash-icon turn. */
  const animateTrashDropSuccess = (): void => {
    trashAnimationToken += 1
    if (trashAnimationTimer !== undefined) clearTimeout(trashAnimationTimer)
    if (!handle.signal.aborted) void handle.update()
    trashAnimationTimer = setTimeout(() => {
      trashAnimationTimer = undefined
      trashAnimationToken = 0
      if (!handle.signal.aborted) void handle.update()
    }, 420)
  }

  return () => renderCarouselEditor(handle.props, {
    beginCardDrag: (bdcId) => { draggedCardBdcId = bdcId },
    draggedCardBdcId: () => draggedCardBdcId,
    clearDraggedCard: () => { draggedCardBdcId = null },
    isAddViewMenuOpen: () => isAddViewMenuOpen,
    updateAddViewMenuOpen,
    isTrashDropTargetActive: () => isTrashDropTargetActive,
    updateTrashDropTarget,
    isCatalogDropTargetActive: () => isCatalogDropTargetActive,
    updateCatalogDropTarget,
    trashAnimationToken: () => trashAnimationToken,
    animateTrashDropSuccess,
  })
}

interface CarouselEditorTransientState {
  readonly beginCardDrag: (bdcId: string) => void
  readonly draggedCardBdcId: () => string | null
  readonly clearDraggedCard: () => void
  readonly isAddViewMenuOpen: () => boolean
  readonly updateAddViewMenuOpen: (isOpen: boolean) => void
  readonly isTrashDropTargetActive: () => boolean
  readonly updateTrashDropTarget: (isActive: boolean) => void
  readonly isCatalogDropTargetActive: () => boolean
  readonly updateCatalogDropTarget: (isActive: boolean) => void
  readonly trashAnimationToken: () => number
  readonly animateTrashDropSuccess: () => void
}

/** Offers timestamp-valued radio choices inside each eligible Carousel Card. */
function renderTranscriptAssociation(
  props: ElceCarouselEditorProps,
  selected: { readonly entry: ElceCarouselEditorProps['content']['cards'][number]; readonly bdc: ResourceBdc },
  cardIndex: number,
): RemixNode {
  const avatar = props.avatar
  const take = avatar?.avatar?.take
  if (take == null || avatar === undefined || selected.bdc.type !== 'card' || cardIndex === 0 || props.onAssociateWord === undefined) return null
  const previousWordStartAtMs = props.content.cards.slice(0, cardIndex).reduce((previousStartAtMs, entry) => {
    const reference = entry.cue?.word
    if (reference?.avatarBdcId !== avatar.id || reference.takeId !== take.id) return previousStartAtMs
    const wordStartAtMs = take.words[reference.wordIndex]?.startAtMs
    return wordStartAtMs !== undefined && wordStartAtMs > previousStartAtMs ? wordStartAtMs : previousStartAtMs
  }, 0)
  const prefix = `elce-carousel-transcript-${selected.bdc.id}`
  return <details id={`${prefix}-details`} className="elce-carousel-editor__transcript" open={true}>
    <summary
      id={`${prefix}-summary`}
      aria-label="Afficher ou masquer les mots du son"
      title="Afficher ou masquer les mots du son"
    >
      {renderLucideIcon(ChevronUp, `${prefix}-expanded-icon`)}
      {renderLucideIcon(ChevronDown, `${prefix}-collapsed-icon`)}
    </summary>
    <div id={`${prefix}-words`} className="elce-carousel-editor__transcript-words" role="radiogroup" aria-label="Choisir un mot du son">
      {take.words.map((word, wordIndex) => {
        const selectedWord = selected.entry.cue?.word
        const checked = selectedWord?.avatarBdcId === avatar.id && selectedWord.takeId === take.id && selectedWord.wordIndex === wordIndex
        const disabled = word.startAtMs <= previousWordStartAtMs
        return <label
          id={`${prefix}-choice-${wordIndex}`}
          key={`${take.id}-${wordIndex}`}
          className={`elce-carousel-editor__view-tab${checked ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
          aria-disabled={disabled}
        >
          <input
            id={`${prefix}-word-${wordIndex}`}
            className="elce-carousel-editor__transcript-radio"
            type="radio"
            name={`${prefix}-choice`}
            value={word.startAtMs}
            checked={checked}
            aria-label={`${word.text}, occurrence ${wordIndex + 1}`}
            disabled={disabled}
            mix={on<HTMLInputElement, 'change'>('change', (event) => {
              const startAtMs = Number(event.currentTarget.value)
              if (event.currentTarget.checked && startAtMs === word.startAtMs) {
                props.onAssociateWord?.(selected.bdc.id, avatar.id, wordIndex, startAtMs)
              }
            })}
          />
          <span id={`${prefix}-word-label-${wordIndex}`}>{word.text}</span>
        </label>
      })}
    </div>
  </details>
}

/** Builds settings, view order and the selected child BDC editor from one snapshot. */
function renderCarouselEditor(props: ElceCarouselEditorProps, state: CarouselEditorTransientState): RemixNode {
  const { bdcId, content, bdcs, selectedCardBdcId, actions } = props
  const bdcById = new Map(bdcs.map((bdc) => [bdc.id, bdc]))
  const orderedViews = content.cards.flatMap((entry) => {
    const bdc = bdcById.get(entry.bdcId)
    return bdc === undefined ? [] : [{ entry, bdc }]
  })
  const selected = orderedViews.find(({ bdc }) => bdc.id === selectedCardBdcId) ?? orderedViews[0]

  return <section
    id={`elce-carousel-editor-${bdcId}`}
    className="elce-carousel-editor"
    aria-label="Éditeur Carousel"
  >
    <header
      id={`elce-carousel-header-${bdcId}`}
      className="elce-carousel-editor__header"
    >
      <h3
        id={`elce-carousel-title-${bdcId}`}
        className="elce-carousel-editor__title"
      >
        Carousel
      </h3>
      <div
        id={`elce-carousel-header-actions-${bdcId}`}
        className="elce-bdc-header-actions"
      >
        {renderAppearanceTrigger({
          id: `elce-carousel-style-${bdcId}`,
          target: { kind: 'bdc', bdcId },
          label: 'Ouvrir le style du Carousel',
          onOpen: props.onOpenAppearanceTarget,
        })}
      </div>
    </header>
    {renderCarouselSettings(props)}
    <div
      id={`elce-carousel-card-tabs-${bdcId}`}
      className="elce-carousel-editor__views"
    >
      <div
        id={`elce-carousel-view-tablist-${bdcId}`}
        className="elce-carousel-editor__view-tabs"
        role="tablist"
        aria-label="Vues du Carousel"
      >
        {orderedViews.map(({ bdc }, index) => renderCardTab(bdcId, bdc, index, bdc.id === selected?.bdc.id, actions, state))}
      </div>
      {renderCarouselViewActions(
        bdcId,
        content,
        orderedViews,
        selected,
        selectedCardBdcId,
        props.onReturnBdcToCatalog,
        actions,
        state,
      )}
    </div>
    {selected === undefined
      ? <p
        id={`elce-carousel-empty-${bdcId}`}
        className="elce-carousel-editor__empty"
      >
        Ajoutez une vue pour commencer.
      </p>
      : renderSelectedCard(props, selected)}
  </section>
}

/** Renders the horizontal add and delete controls beside the Carousel view tabs. */
function renderCarouselViewActions(
  carouselBdcId: string,
  content: ElceCarouselEditorProps['content'],
  orderedViews: readonly Readonly<{
    entry: ElceCarouselEditorProps['content']['cards'][number]
    bdc: ResourceBdc
  }>[],
  selected: Readonly<{
    entry: ElceCarouselEditorProps['content']['cards'][number]
    bdc: ResourceBdc
  }> | undefined,
  selectedCardBdcId: string | null,
  onReturnBdcToCatalog: ElceCarouselEditorProps['onReturnBdcToCatalog'],
  actions: ElceCarouselEditorProps['actions'],
  state: CarouselEditorTransientState,
): RemixNode {
  const canRemoveView = content.cards.length > 1
  const trashClassNames = [
    'elce-carousel-editor__view-trash',
    ...(state.isTrashDropTargetActive() ? ['elce-carousel-editor__view-trash--drop-target'] : []),
    ...(canRemoveView ? [] : ['elce-carousel-editor__view-trash--disabled']),
  ]
  const trashLabel = canRemoveView
    ? 'Corbeille : déposer une vue pour la supprimer'
    : 'Corbeille indisponible : le Carousel doit conserver au moins une vue'
  const catalogLabel = canRemoveView
    ? 'Catalogue : déposer une vue pour la rendre disponible'
    : 'Catalogue indisponible : le Carousel doit conserver au moins une vue'
  const menuId = `elce-carousel-view-add-menu-${carouselBdcId}`
  const catalogClassNames = [
    'elce-carousel-editor__view-catalog',
    ...(state.isCatalogDropTargetActive() ? ['elce-carousel-editor__view-catalog--drop-target'] : []),
    ...(canRemoveView ? [] : ['elce-carousel-editor__view-catalog--disabled']),
  ]

  return <div
    id={`elce-carousel-view-actions-${carouselBdcId}`}
    className="elce-carousel-editor__view-actions"
    role="group"
    aria-label="Actions des vues du Carousel"
  >
    <div
      id={`elce-carousel-view-add-${carouselBdcId}`}
      className="elce-carousel-editor__view-add-container"
    >
      <button
        id={`elce-carousel-view-add-toggle-${carouselBdcId}`}
        className="elce-carousel-editor__view-action"
        type="button"
        aria-label="Ajouter une vue"
        title="Ajouter une vue"
        aria-expanded={state.isAddViewMenuOpen()}
        aria-controls={menuId}
        mix={on<HTMLButtonElement, 'click'>('click', () => state.updateAddViewMenuOpen(!state.isAddViewMenuOpen()))}
      >
        {renderLucideIcon(Plus, `elce-carousel-view-add-icon-${carouselBdcId}`)}
      </button>
      <div
        id={menuId}
        className="elce-carousel-editor__view-add-menu"
        role="group"
        aria-label="Ajouter une vue au Carousel"
        hidden={!state.isAddViewMenuOpen()}
      >
        <button
          id={`elce-carousel-card-add-${carouselBdcId}`}
          className="elce-carousel-editor__view-add elce-add-content-action"
          type="button"
          aria-label="Ajouter une carte"
          title="Ajouter une carte"
          mix={on<HTMLButtonElement, 'click'>('click', () => {
            state.updateAddViewMenuOpen(false)
            actions.addCard()
          })}
        >
          {renderLucideIcon(RectangleHorizontal, `elce-carousel-card-add-icon-${carouselBdcId}`)}
          <span
            id={`elce-carousel-card-add-label-${carouselBdcId}`}
            className="elce-add-content-action__label"
          >
            Carte
          </span>
        </button>
        <button
          id={`elce-carousel-list-add-${carouselBdcId}`}
          className="elce-carousel-editor__view-add elce-add-content-action"
          type="button"
          aria-label="Ajouter une carte Liste à points"
          title="Ajouter une carte Liste à points"
          mix={on<HTMLButtonElement, 'click'>('click', () => {
            state.updateAddViewMenuOpen(false)
            actions.addList()
          })}
        >
          {renderLucideIcon(List, `elce-carousel-list-add-icon-${carouselBdcId}`)}
          <span id={`elce-carousel-list-add-label-${carouselBdcId}`} className="elce-add-content-action__label">Liste à points</span>
        </button>
        <button
          id={`elce-carousel-graph-add-${carouselBdcId}`}
          className="elce-carousel-editor__view-add elce-add-content-action"
          type="button"
          aria-label="Ajouter un graphe"
          title="Ajouter un graphe"
          mix={on<HTMLButtonElement, 'click'>('click', () => {
            state.updateAddViewMenuOpen(false)
            actions.addStatisticalGraph()
          })}
        >
          {renderLucideIcon(Activity, `elce-carousel-graph-add-icon-${carouselBdcId}`)}
          <span
            id={`elce-carousel-graph-add-label-${carouselBdcId}`}
            className="elce-add-content-action__label"
          >
            Graphe
          </span>
        </button>
      </div>
    </div>
    <div
      id={`elce-carousel-view-trash-${carouselBdcId}`}
      className={trashClassNames.join(' ')}
      role="region"
      aria-label={trashLabel}
      aria-disabled={!canRemoveView}
      title={trashLabel}
      mix={[
        on<HTMLElement, 'dragover'>('dragover', (event) => {
          if (!canRemoveView || !isCarouselViewDrag(event, state)) return
          event.preventDefault()
          event.stopPropagation()
          if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move'
          state.updateCatalogDropTarget(false)
          state.updateTrashDropTarget(true)
        }),
        on<HTMLElement, 'dragleave'>('dragleave', () => state.updateTrashDropTarget(false)),
        on<HTMLElement, 'drop'>('drop', (event) => dropCarouselViewOnTrash(
          event,
          orderedViews,
          selectedCardBdcId ?? selected?.bdc.id ?? null,
          canRemoveView,
          actions,
          state,
        )),
      ]}
    >
      <span
        key={state.trashAnimationToken()}
        id={`elce-carousel-view-trash-icon-${carouselBdcId}`}
        className={state.trashAnimationToken() === 0
          ? 'elce-carousel-editor__view-trash-icon'
          : 'elce-carousel-editor__view-trash-icon elce-carousel-editor__view-trash-icon--success'}
        aria-hidden={true}
      >
        {renderLucideIcon(Trash2, `elce-carousel-view-trash-symbol-${carouselBdcId}`)}
      </span>
    </div>
    <div
      id={`elce-carousel-view-catalog-${carouselBdcId}`}
      className={catalogClassNames.join(' ')}
      role="region"
      aria-label={catalogLabel}
      aria-disabled={!canRemoveView}
      title={catalogLabel}
      mix={[
        on<HTMLElement, 'dragover'>('dragover', (event) => {
          if (!canRemoveView || !isCarouselViewDrag(event, state)) return
          event.preventDefault()
          event.stopPropagation()
          if (event.dataTransfer !== null) event.dataTransfer.dropEffect = 'move'
          state.updateTrashDropTarget(false)
          state.updateCatalogDropTarget(true)
        }),
        on<HTMLElement, 'dragleave'>('dragleave', () => state.updateCatalogDropTarget(false)),
        on<HTMLElement, 'drop'>('drop', (event) => dropCarouselViewOnCatalog(
          event,
          orderedViews,
          canRemoveView,
          onReturnBdcToCatalog,
          state,
        )),
      ]}
    >
      <span
        id={`elce-carousel-view-catalog-icon-${carouselBdcId}`}
        className="elce-carousel-editor__view-catalog-icon"
        aria-hidden={true}
      >
        {renderLucideIcon(Library, `elce-carousel-view-catalog-symbol-${carouselBdcId}`)}
      </span>
    </div>
  </div>
}

/** Accepts only a local Carousel view drag while a removable view remains. */
function isCarouselViewDrag(event: DragEvent, state: CarouselEditorTransientState): boolean {
  const transfer = event.dataTransfer
  return transfer !== null
    && (Array.from(transfer.types).includes(CAROUSEL_CONFIG.cardDragMimeType) || state.draggedCardBdcId() !== null)
}

/** Removes the dragged Carousel child through its existing typed facade action. */
function dropCarouselViewOnTrash(
  event: DragEvent,
  orderedViews: readonly Readonly<{
    entry: ElceCarouselEditorProps['content']['cards'][number]
    bdc: ResourceBdc
  }>[],
  selectedCardBdcId: string | null,
  canRemoveView: boolean,
  actions: ElceCarouselEditorProps['actions'],
  state: CarouselEditorTransientState,
): void {
  if (!canRemoveView || !isCarouselViewDrag(event, state) || event.dataTransfer === null) {
    state.updateTrashDropTarget(false)
    state.clearDraggedCard()
    return
  }
  const draggedBdcId = event.dataTransfer.getData(CAROUSEL_CONFIG.cardDragMimeType) || state.draggedCardBdcId()
  const draggedView = orderedViews.find(({ bdc }) => bdc.id === draggedBdcId)
  if (draggedView === undefined) {
    state.updateTrashDropTarget(false)
    state.clearDraggedCard()
    return
  }
  event.preventDefault()
  if (draggedView.bdc.type === 'card') actions.removeCard(draggedView.bdc.id, selectedCardBdcId)
  if (draggedView.bdc.type === 'statistical-graph') actions.removeStatisticalGraph(draggedView.bdc.id, selectedCardBdcId)
  state.updateTrashDropTarget(false)
  state.clearDraggedCard()
  state.animateTrashDropSuccess()
}

/** Returns the dragged Carousel child through Learning's existing catalog command. */
function dropCarouselViewOnCatalog(
  event: DragEvent,
  orderedViews: readonly Readonly<{
    entry: ElceCarouselEditorProps['content']['cards'][number]
    bdc: ResourceBdc
  }>[],
  canRemoveView: boolean,
  onReturnBdcToCatalog: ElceCarouselEditorProps['onReturnBdcToCatalog'],
  state: CarouselEditorTransientState,
): void {
  if (!canRemoveView || !isCarouselViewDrag(event, state) || event.dataTransfer === null) {
    state.updateCatalogDropTarget(false)
    state.clearDraggedCard()
    return
  }
  const draggedBdcId = event.dataTransfer.getData(CAROUSEL_CONFIG.cardDragMimeType) || state.draggedCardBdcId()
  const draggedView = orderedViews.find(({ bdc }) => bdc.id === draggedBdcId)
  if (draggedView === undefined) {
    state.updateCatalogDropTarget(false)
    state.clearDraggedCard()
    return
  }
  event.preventDefault()
  event.stopPropagation()
  onReturnBdcToCatalog(draggedView.bdc.id)
  state.updateCatalogDropTarget(false)
  state.clearDraggedCard()
}

/** Renders Carousel playback, timing, transition and ratio controls. */
function renderCarouselSettings(props: ElceCarouselEditorProps): RemixNode {
  const { bdcId, content, actions } = props
  const hasWordAssociations = content.cards.some((entry) => entry.cue !== undefined)
  return <section
    id={`elce-carousel-settings-panel-${bdcId}`}
    className="elce-carousel-editor__settings-panel"
  >
    <div
      id={`elce-carousel-settings-${bdcId}`}
      className="elce-carousel-editor__settings"
    >
      <label
        id={`elce-carousel-playback-label-${bdcId}`}
        className="elce-carousel-editor__setting"
      >
        <span
          id={`elce-carousel-playback-caption-${bdcId}`}
        >
          Lecture
        </span>
        <select
          id={`elce-carousel-playback-${bdcId}`}
          aria-label="Mode de lecture du Carousel"
          mix={on<HTMLSelectElement, 'change'>('change', (event) => actions.setPlaybackMode(event.currentTarget.value as typeof content.playbackMode))}
        >
          {CAROUSEL_PLAYBACK_MODE_OPTIONS.map((option) => <option
            id={`elce-carousel-playback-option-${bdcId}-${option.value}`}
            key={option.value}
            value={option.value}
            selected={option.value === content.playbackMode}
          >
            {option.label}
          </option>)}
        </select>
      </label>
      {hasWordAssociations ? null : <>
        {content.playbackMode === CAROUSEL_PLAYBACK_MODE.AUTOMATIC
          ? <label
            id={`elce-carousel-repeat-label-${bdcId}`}
            className="elce-carousel-editor__setting elce-carousel-editor__setting--repeat"
          >
            <span
              id={`elce-carousel-repeat-caption-${bdcId}`}
            >
              Répéter
            </span>
            <input
              id={`elce-carousel-repeat-${bdcId}`}
              type="number"
              min={CAROUSEL_CONFIG.minimumRepeatCount}
              max={CAROUSEL_CONFIG.maximumRepeatCount}
              step="1"
              aria-label="Nombre de répétitions du Carousel"
              value={content.repeatCount ?? CAROUSEL_CONFIG.defaultRepeatCount}
              mix={on<HTMLInputElement, 'input'>('input', (event) => submitRepeatCount(event.currentTarget.valueAsNumber, actions.setRepeatCount))}
            />
            <span
              id={`elce-carousel-repeat-unit-${bdcId}`}
            >
              fois
            </span>
          </label>
          : null}
        <label
          id={`elce-carousel-duration-label-${bdcId}`}
          className="elce-carousel-editor__setting"
        >
          <span
            id={`elce-carousel-duration-caption-${bdcId}`}
          >
            Durée par vue
          </span>
          <div
            id={`elce-carousel-duration-control-${bdcId}`}
            className="elce-carousel-editor__duration-control"
          >
            <input
              id={`elce-carousel-duration-${bdcId}`}
              type="range"
              min={CAROUSEL_CONFIG.minimumViewDurationSeconds}
              max={CAROUSEL_CONFIG.maximumViewDurationSeconds}
              step="1"
              aria-label="Durée par défaut d’une vue en secondes"
              value={content.defaultViewDurationMs / 1000}
              mix={on<HTMLInputElement, 'input'>('input', (event) => submitPositiveNumber(event.currentTarget.valueAsNumber, actions.setDefaultViewDurationSeconds))}
            />
            <output
              id={`elce-carousel-duration-value-${bdcId}`}
            >
              {`${content.defaultViewDurationMs / 1000} s`}
            </output>
          </div>
        </label>
      </>}
      <label
        id={`elce-carousel-transition-label-${bdcId}`}
        className="elce-carousel-editor__setting"
      >
        <span
          id={`elce-carousel-transition-caption-${bdcId}`}
        >
          Transition
        </span>
        <select
          id={`elce-carousel-transition-${bdcId}`}
          aria-label="Transition entre les vues"
          mix={on<HTMLSelectElement, 'change'>('change', (event) => {
            if (event.currentTarget.value !== '') actions.setTransition(event.currentTarget.value as NonNullable<typeof actions.transitionPreset>)
          })}
        >
          {[
            actions.transitionPreset === null
              ? <option
                id={`elce-carousel-transition-option-custom-${bdcId}`}
                key="custom"
                value=""
                disabled={true}
                selected={true}
              >
                Personnalisée
              </option>
              : null,
            ...CAROUSEL_TRANSITION_OPTIONS.map((option) => <option
              id={`elce-carousel-transition-option-${bdcId}-${option.value}`}
              key={option.value}
              value={option.value}
              selected={option.value === actions.transitionPreset}
            >
              {option.label}
            </option>),
          ]}
        </select>
      </label>
      <label
        id={`elce-carousel-ratio-label-${bdcId}`}
        className="elce-carousel-editor__setting"
      >
        <span
          id={`elce-carousel-ratio-caption-${bdcId}`}
        >
          Ratio
        </span>
        <select
          id={`elce-carousel-ratio-${bdcId}`}
          aria-label="Ratio du Carousel"
          mix={on<HTMLSelectElement, 'change'>('change', (event) => submitAspectRatio(event.currentTarget.value, actions.setAspectRatio))}
        >
          {[
            aspectRatioOptionValue(content.aspectRatio) === LEGACY_RATIO_OPTION
              ? <option
                id={`elce-carousel-ratio-option-legacy-${bdcId}`}
                key={LEGACY_RATIO_OPTION}
                value={LEGACY_RATIO_OPTION}
                disabled={true}
                selected={true}
              >
                {`Ratio actuel (${content.aspectRatio.width}:${content.aspectRatio.height})`}
              </option>
              : null,
            ...CAROUSEL_ASPECT_RATIO_OPTIONS.map((option) => <option
              id={`elce-carousel-ratio-option-${bdcId}-${option.value}`}
              key={option.value}
              value={option.value}
              selected={option.value === aspectRatioOptionValue(content.aspectRatio)}
            >
              {option.label}
            </option>),
          ]}
        </select>
      </label>
    </div>
  </section>
}

/** Renders one selectable view tab that can also reorder its Carousel BDC. */
function renderCardTab(
  carouselBdcId: string,
  bdc: ResourceBdc,
  index: number,
  selected: boolean,
  actions: ElceCarouselEditorProps['actions'],
  state: CarouselEditorTransientState,
): RemixNode {
  return <button
    key={bdc.id}
    id={`elce-carousel-card-tab-${bdc.id}`}
    className={selected ? 'elce-carousel-editor__view-tab is-active' : 'elce-carousel-editor__view-tab'}
    type="button"
    role="tab"
    aria-selected={selected}
    draggable={true}
    mix={[
      on<HTMLButtonElement, 'click'>('click', () => actions.selectCard(bdc.id)),
      on<HTMLButtonElement, 'dragstart'>('dragstart', (event) => startCardDrag(event, bdc.id, state)),
      on<HTMLButtonElement, 'dragover'>('dragover', (event) => {
        const transfer = event.dataTransfer
        if (transfer !== null && Array.from(transfer.types).includes(CAROUSEL_CONFIG.cardDragMimeType)) event.preventDefault()
      }),
      on<HTMLButtonElement, 'drop'>('drop', (event) => dropCard(event, index, actions, state)),
      on<HTMLButtonElement, 'dragend'>('dragend', state.clearDraggedCard),
    ]}
    data-carousel-id={carouselBdcId}
  >
    {renderLucideIcon(GripVertical, `elce-carousel-card-tab-drag-icon-${bdc.id}`)}
    <span
      id={`elce-carousel-card-tab-number-${bdc.id}`}
    >
      {String(index + 1)}
    </span>
  </button>
}

/** Starts a child BDC reorder using the existing Carousel MIME type. */
function startCardDrag(event: DragEvent, bdcId: string, state: CarouselEditorTransientState): void {
  const transfer = event.dataTransfer
  if (transfer === null) return
  state.beginCardDrag(bdcId)
  transfer.effectAllowed = 'move'
  transfer.setData(CAROUSEL_CONFIG.cardDragMimeType, bdcId)
}

/** Moves the dragged Carousel BDC to its target index through the Carousel facade. */
function dropCard(event: DragEvent, index: number, actions: ElceCarouselEditorProps['actions'], state: CarouselEditorTransientState): void {
  const transfer = event.dataTransfer
  if (transfer === null) return
  const bdcId = transfer.getData(CAROUSEL_CONFIG.cardDragMimeType) || state.draggedCardBdcId()
  if (bdcId === null || bdcId.length === 0) return
  event.preventDefault()
  actions.moveCard(bdcId, index)
  state.clearDraggedCard()
}

/** Renders the selected Card or Graph editor and its per-view duration. */
function renderSelectedCard(
  props: ElceCarouselEditorProps,
  selected: { readonly entry: ElceCarouselEditorProps['content']['cards'][number]; readonly bdc: ResourceBdc },
): RemixNode {
  const { content, mediaById, actions } = props
  const cardIndex = content.cards.findIndex((entry) => entry.bdcId === selected.bdc.id)
  const wordAssociation = selected.entry.cue?.word
  const take = props.avatar?.avatar?.take
  const associatedWord = take == null || wordAssociation === undefined
    || wordAssociation.avatarBdcId !== props.avatar?.id || wordAssociation.takeId !== take.id
    ? undefined
    : take.words[wordAssociation.wordIndex]
  const durationControl = <label
    id={`elce-carousel-card-duration-label-${selected.bdc.id}`}
    className={associatedWord === undefined ? 'elce-carousel-editor__view-duration' : 'elce-carousel-editor__view-duration elce-carousel-editor__view-duration--word'}
  >
    <span id={`elce-carousel-card-duration-caption-${selected.bdc.id}`}>
      {associatedWord !== undefined ? 'Mot associé' : 'Durée (sec.)'}
    </span>
    {associatedWord !== undefined
      ? <input
        id={`elce-carousel-card-duration-${selected.bdc.id}`}
        type="text"
        readOnly={true}
        aria-label="Mot choisi pour cette vue"
        value={associatedWord.text}
      />
      : <input
        id={`elce-carousel-card-duration-${selected.bdc.id}`}
        type="number"
        min="0.1"
        step="0.1"
        placeholder={String(content.defaultViewDurationMs / 1000)}
        aria-label="Durée particulière de cette vue en secondes"
        value={selected.entry.durationMs === null ? '' : selected.entry.durationMs / 1000}
        mix={on<HTMLInputElement, 'input'>('input', (event) => submitOptionalPositiveNumber(event.currentTarget.value, selected.bdc.id, actions.setCardDurationSeconds))}
      />}
  </label>
  return <div
    id={`elce-carousel-card-editor-${selected.bdc.id}`}
    className="elce-carousel-editor__view-content"
    role="tabpanel"
  >
    {selected.bdc.type === 'card'
      ? <>
        <header
          id={`elce-carousel-card-heading-${selected.bdc.id}`}
          className="elce-carousel-editor__view-heading"
        >
          <h3 id={`elce-carousel-card-heading-title-${selected.bdc.id}`} className="elce-carousel-editor__view-heading-title">
            Carte
          </h3>
          <div
            id={`elce-carousel-card-header-actions-${selected.bdc.id}`}
            className="elce-bdc-header-actions"
          >
            {renderAppearanceTrigger({
              id: `elce-carousel-card-style-${selected.bdc.id}`,
              target: { kind: 'bdc', bdcId: selected.bdc.id },
              label: `Ouvrir le style de la carte ${selected.bdc.card == null ? '' : authoredTextToPlainText(selected.bdc.card.title).trim()}`,
              onOpen: props.onOpenAppearanceTarget,
            })}
          </div>
        </header>
        <RemixCardEditorFields
          bdc={selected.bdc}
          mediaById={mediaById}
          actions={actions}
          idPrefix="elce-carousel"
          imageAspectRatio={content.aspectRatio}
          textFieldAttributes={props.textFieldAttributes}
          textFieldFeature={props.textFieldFeature}
          allowMultipleMediaFiles={true}
          importMediaFiles={actions.importMediaFiles}
          toolbarContent={durationControl}
          belowToolbarContent={renderTranscriptAssociation(props, selected, cardIndex)}
        />
      </>
      : selected.bdc.type === 'statistical-graph' && selected.bdc.statisticalGraph != null
        ? renderRemixStatisticalGraphEditor(
          selected.bdc,
          props.createStatisticalGraphActions(selected.bdc.id, selected.bdc.statisticalGraph),
          undefined,
          durationControl,
          renderAppearanceTrigger({
            id: `elce-carousel-graph-style-${selected.bdc.id}`,
            target: { kind: 'bdc', bdcId: selected.bdc.id },
            label: 'Ouvrir le style du graphe',
            onOpen: props.onOpenAppearanceTarget,
          }),
          props.textFieldAttributes,
          props.textFieldFeature,
        )
        : null}
  </div>
}

/** Accepts only finite positive author-entered values. */
function submitPositiveNumber(value: number, submit: (value: number) => void): void {
  if (Number.isFinite(value) && value > 0) submit(value)
}

/** Accepts whole repetition counts inside the configured range. */
function submitRepeatCount(value: number, submit: (repeatCount: number) => void): void {
  if (Number.isInteger(value) && value >= CAROUSEL_CONFIG.minimumRepeatCount && value <= CAROUSEL_CONFIG.maximumRepeatCount) {
    submit(value)
  }
}

/** Converts an empty duration field back to inherited default timing. */
function submitOptionalPositiveNumber(value: string, bdcId: string, submit: (bdcId: string, seconds: number | null) => void): void {
  if (value === '') {
    submit(bdcId, null)
  } else {
    submitPositiveNumber(Number(value), (seconds) => submit(bdcId, seconds))
  }
}

/** Maps a configured ratio option to its métier value. */
function submitAspectRatio(value: string, submit: (ratio: CarouselAspectRatio) => void): void {
  const option = CAROUSEL_ASPECT_RATIO_OPTIONS.find((candidate) => candidate.value === value)
  if (option !== undefined) submit(option.ratio)
}

/** Keeps a saved custom ratio visible until the author selects a configured ratio. */
function aspectRatioOptionValue(ratio: CarouselAspectRatio): CarouselAspectRatioId | typeof LEGACY_RATIO_OPTION {
  return CAROUSEL_ASPECT_RATIO_OPTIONS.find((option) => option.ratio.width === ratio.width && option.ratio.height === ratio.height)?.value
    ?? LEGACY_RATIO_OPTION
}

const LEGACY_RATIO_OPTION = 'current-custom-ratio' as const
