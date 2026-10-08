import { GripVertical, Plus, Trash2 } from 'lucide-static'
import {
  CAROUSEL_ASPECT_RATIO_OPTIONS,
  CAROUSEL_CONFIG,
  CAROUSEL_PLAYBACK_MODE,
  CAROUSEL_PLAYBACK_MODE_OPTIONS,
  CAROUSEL_TRANSITION_OPTIONS,
} from '../../../config/document-config'
import type { CarouselAspectRatioId } from '../../../config/document-config-types'
import type { CarouselAspectRatio } from '../../../domain/carousel/carousel-types'
import type { Bdc } from '../../../domain/document/document-types'
import { on, type Handle, type RemixNode } from 'remix/ui'
import { jsx } from 'remix/ui/jsx-runtime'
import type { ElceCarouselEditorProps } from '../../facades/carousel/carousel-facade-types'
import { renderLucideIcon } from '../../remix/lucide-static-icon'
import { RemixCardEditorFields } from '../card/remix-card-editor-fields'

/** Renders Carousel settings and ordered child Cards in the Remix runtime. */
export function RemixCarouselEditor(handle: Handle<ElceCarouselEditorProps>) {
  let draggedCardBdcId: string | null = null
  return () => renderCarouselEditor(handle.props, {
    beginCardDrag: (bdcId) => { draggedCardBdcId = bdcId },
    draggedCardBdcId: () => draggedCardBdcId,
    clearDraggedCard: () => { draggedCardBdcId = null },
  })
}

interface CarouselEditorTransientState {
  readonly beginCardDrag: (bdcId: string) => void
  readonly draggedCardBdcId: () => string | null
  readonly clearDraggedCard: () => void
}

/** Builds settings, tab order and the selected Card editor from one snapshot. */
function renderCarouselEditor(props: ElceCarouselEditorProps, state: CarouselEditorTransientState): RemixNode {
  const { bdcId, content, cards, selectedCardBdcId, actions } = props
  const cardById = new Map(cards.map((bdc) => [bdc.id, bdc]))
  const orderedCards = content.cards.flatMap((entry) => {
    const bdc = cardById.get(entry.bdcId)
    return bdc === undefined ? [] : [{ entry, bdc }]
  })
  const selected = orderedCards.find(({ bdc }) => bdc.id === selectedCardBdcId) ?? orderedCards[0]

  return jsx('section', {
    id: `elce-carousel-editor-${bdcId}`,
    className: 'elce-carousel-editor',
    'aria-label': 'Éditeur Carousel',
    children: [
      jsx('header', {
        id: `elce-carousel-header-${bdcId}`,
        className: 'elce-carousel-editor__header',
        children: [
          jsx('h3', { id: `elce-carousel-title-${bdcId}`, className: 'elce-carousel-editor__title', children: 'Carousel' }),
          jsx('button', {
            id: `elce-carousel-delete-${bdcId}`,
            className: 'elce-carousel-editor__delete-bdc',
            type: 'button',
            'aria-label': 'Supprimer le bloc Carousel',
            title: 'Supprimer le bloc Carousel',
            mix: on<HTMLButtonElement, 'click'>('click', actions.deleteCarousel),
            children: renderLucideIcon(Trash2, `elce-carousel-delete-icon-${bdcId}`, 14),
          }),
        ],
      }),
      renderCarouselSettings(props),
      jsx('div', {
        id: `elce-carousel-card-tabs-${bdcId}`,
        className: 'elce-carousel-editor__views',
        role: 'tablist',
        'aria-label': 'Cartes du Carousel',
        children: [
          ...orderedCards.map(({ bdc }, index) => renderCardTab(bdcId, bdc, index, bdc.id === selected?.bdc.id, actions, state)),
          jsx('button', {
            id: `elce-carousel-card-add-${bdcId}`,
            className: 'elce-carousel-editor__view-add',
            type: 'button',
            'aria-label': 'Ajouter une carte',
            title: 'Ajouter une carte',
            mix: on<HTMLButtonElement, 'click'>('click', actions.addCard),
            children: renderLucideIcon(Plus, `elce-carousel-card-add-icon-${bdcId}`, 16),
          }),
        ],
      }),
      selected === undefined
        ? jsx('p', { id: `elce-carousel-empty-${bdcId}`, className: 'elce-carousel-editor__empty', children: 'Ajoutez une carte pour commencer.' })
        : renderSelectedCard(props, selected, selectedCardBdcId),
    ],
  })
}

/** Renders Carousel playback, timing, transition and ratio controls. */
function renderCarouselSettings(props: ElceCarouselEditorProps): RemixNode {
  const { bdcId, content, actions } = props
  return jsx('div', {
    id: `elce-carousel-settings-${bdcId}`,
    className: 'elce-carousel-editor__settings',
    children: [
      jsx('label', {
        id: `elce-carousel-playback-label-${bdcId}`,
        className: 'elce-carousel-editor__setting',
        children: [
          jsx('span', { id: `elce-carousel-playback-caption-${bdcId}`, children: 'Lecture' }),
          jsx('select', {
            id: `elce-carousel-playback-${bdcId}`,
            'aria-label': 'Mode de lecture du Carousel',
            mix: on<HTMLSelectElement, 'change'>('change', (event) => actions.setPlaybackMode(event.currentTarget.value as typeof content.playbackMode)),
            children: CAROUSEL_PLAYBACK_MODE_OPTIONS.map((option) => jsx('option', {
              value: option.value,
              selected: option.value === content.playbackMode,
              children: option.label,
            }, option.value)),
          }),
        ],
      }),
      content.playbackMode === CAROUSEL_PLAYBACK_MODE.AUTOMATIC
        ? jsx('label', {
            id: `elce-carousel-repeat-label-${bdcId}`,
            className: 'elce-carousel-editor__setting elce-carousel-editor__setting--repeat',
            children: [
              jsx('span', { id: `elce-carousel-repeat-caption-${bdcId}`, children: 'Répéter' }),
              jsx('input', {
                id: `elce-carousel-repeat-${bdcId}`,
                type: 'number',
                min: CAROUSEL_CONFIG.minimumRepeatCount,
                max: CAROUSEL_CONFIG.maximumRepeatCount,
                step: '1',
                'aria-label': 'Nombre de répétitions du Carousel',
                value: content.repeatCount ?? CAROUSEL_CONFIG.defaultRepeatCount,
                mix: on<HTMLInputElement, 'input'>('input', (event) => submitRepeatCount(event.currentTarget.valueAsNumber, actions.setRepeatCount)),
              }),
              jsx('span', { id: `elce-carousel-repeat-unit-${bdcId}`, children: 'fois' }),
            ],
          })
        : null,
      jsx('label', {
        id: `elce-carousel-duration-label-${bdcId}`,
        className: 'elce-carousel-editor__setting',
        children: [
          jsx('span', { id: `elce-carousel-duration-caption-${bdcId}`, children: 'Durée par vue' }),
          jsx('div', {
            id: `elce-carousel-duration-control-${bdcId}`,
            className: 'elce-carousel-editor__duration-control',
            children: [
              jsx('input', {
                id: `elce-carousel-duration-${bdcId}`,
                type: 'range',
                min: CAROUSEL_CONFIG.minimumViewDurationSeconds,
                max: CAROUSEL_CONFIG.maximumViewDurationSeconds,
                step: '1',
                'aria-label': 'Durée par défaut d’une vue en secondes',
                value: content.defaultViewDurationMs / 1000,
                mix: on<HTMLInputElement, 'input'>('input', (event) => submitPositiveNumber(event.currentTarget.valueAsNumber, actions.setDefaultViewDurationSeconds)),
              }),
              jsx('output', { id: `elce-carousel-duration-value-${bdcId}`, children: `${content.defaultViewDurationMs / 1000} s` }),
            ],
          }),
        ],
      }),
      jsx('label', {
        id: `elce-carousel-transition-label-${bdcId}`,
        className: 'elce-carousel-editor__setting',
        children: [
          jsx('span', { id: `elce-carousel-transition-caption-${bdcId}`, children: 'Transition' }),
          jsx('select', {
            id: `elce-carousel-transition-${bdcId}`,
            'aria-label': 'Transition entre les vues',
            mix: on<HTMLSelectElement, 'change'>('change', (event) => {
              if (event.currentTarget.value !== '') actions.setTransition(event.currentTarget.value as NonNullable<typeof actions.transitionPreset>)
            }),
            children: [
              actions.transitionPreset === null
                ? jsx('option', { value: '', disabled: true, selected: true, children: 'Personnalisée' }, 'custom')
                : null,
              ...CAROUSEL_TRANSITION_OPTIONS.map((option) => jsx('option', {
                value: option.value,
                selected: option.value === actions.transitionPreset,
                children: option.label,
              }, option.value)),
            ],
          }),
        ],
      }),
      jsx('label', {
        id: `elce-carousel-ratio-label-${bdcId}`,
        className: 'elce-carousel-editor__setting',
        children: [
          jsx('span', { id: `elce-carousel-ratio-caption-${bdcId}`, children: 'Ratio' }),
          jsx('select', {
            id: `elce-carousel-ratio-${bdcId}`,
            'aria-label': 'Ratio du Carousel',
            mix: on<HTMLSelectElement, 'change'>('change', (event) => submitAspectRatio(event.currentTarget.value, actions.setAspectRatio)),
            children: [
              aspectRatioOptionValue(content.aspectRatio) === LEGACY_RATIO_OPTION
                ? jsx('option', {
                    value: LEGACY_RATIO_OPTION,
                    disabled: true,
                    selected: true,
                    children: `Ratio actuel (${content.aspectRatio.width}:${content.aspectRatio.height})`,
                  }, LEGACY_RATIO_OPTION)
                : null,
              ...CAROUSEL_ASPECT_RATIO_OPTIONS.map((option) => jsx('option', {
                value: option.value,
                selected: option.value === aspectRatioOptionValue(content.aspectRatio),
                children: option.label,
              }, option.value)),
            ],
          }),
        ],
      }),
    ],
  })
}

/** Renders one selectable tab that can also reorder its Carousel Card. */
function renderCardTab(
  carouselBdcId: string,
  bdc: Bdc,
  index: number,
  selected: boolean,
  actions: ElceCarouselEditorProps['actions'],
  state: CarouselEditorTransientState,
): RemixNode {
  return jsx('button', {
    id: `elce-carousel-card-tab-${bdc.id}`,
    className: selected ? 'elce-carousel-editor__view-tab is-active' : 'elce-carousel-editor__view-tab',
    type: 'button',
    role: 'tab',
    'aria-selected': selected,
    draggable: true,
    mix: [
      on<HTMLButtonElement, 'click'>('click', () => actions.selectCard(bdc.id)),
      on<HTMLButtonElement, 'dragstart'>('dragstart', (event) => startCardDrag(event, bdc.id, state)),
      on<HTMLButtonElement, 'dragover'>('dragover', (event) => {
        const transfer = event.dataTransfer
        if (transfer !== null && Array.from(transfer.types).includes(CAROUSEL_CONFIG.cardDragMimeType)) event.preventDefault()
      }),
      on<HTMLButtonElement, 'drop'>('drop', (event) => dropCard(event, index, actions, state)),
      on<HTMLButtonElement, 'dragend'>('dragend', state.clearDraggedCard),
    ],
    children: [
      renderLucideIcon(GripVertical, `elce-carousel-card-tab-drag-icon-${bdc.id}`, 14),
      jsx('span', { id: `elce-carousel-card-tab-number-${bdc.id}`, children: String(index + 1) }),
    ],
    'data-carousel-id': carouselBdcId,
  }, bdc.id)
}

/** Starts a Card reorder using the existing Carousel MIME type. */
function startCardDrag(event: DragEvent, bdcId: string, state: CarouselEditorTransientState): void {
  const transfer = event.dataTransfer
  if (transfer === null) return
  state.beginCardDrag(bdcId)
  transfer.effectAllowed = 'move'
  transfer.setData(CAROUSEL_CONFIG.cardDragMimeType, bdcId)
}

/** Moves the dragged Card to its target index through the Carousel facade. */
function dropCard(event: DragEvent, index: number, actions: ElceCarouselEditorProps['actions'], state: CarouselEditorTransientState): void {
  const transfer = event.dataTransfer
  if (transfer === null) return
  const bdcId = transfer.getData(CAROUSEL_CONFIG.cardDragMimeType) || state.draggedCardBdcId()
  if (bdcId === null || bdcId.length === 0) return
  event.preventDefault()
  actions.moveCard(bdcId, index)
  state.clearDraggedCard()
}

/** Renders the shared fields and per-Card duration for the selected child. */
function renderSelectedCard(
  props: ElceCarouselEditorProps,
  selected: { readonly entry: ElceCarouselEditorProps['content']['cards'][number]; readonly bdc: Bdc },
  selectedCardBdcId: string | null,
): RemixNode {
  const { content, mediaById, actions } = props
  return jsx('div', {
    id: `elce-carousel-card-editor-${selected.bdc.id}`,
    className: 'elce-carousel-editor__view-content',
    role: 'tabpanel',
    children: jsx(RemixCardEditorFields, {
      bdc: selected.bdc,
      mediaById,
      actions,
      idPrefix: 'elce-carousel',
      imageAspectRatio: content.aspectRatio,
      allowMultipleMediaFiles: true,
      importMediaFiles: actions.importMediaFiles,
      toolbarContent: jsx('label', {
        id: `elce-carousel-card-duration-label-${selected.bdc.id}`,
        className: 'elce-carousel-editor__view-duration',
        children: [
          jsx('span', { id: `elce-carousel-card-duration-caption-${selected.bdc.id}`, children: 'Durée de la vue · secondes' }),
          jsx('input', {
            id: `elce-carousel-card-duration-${selected.bdc.id}`,
            type: 'number',
            min: '0.1',
            step: '0.1',
            placeholder: String(content.defaultViewDurationMs / 1000),
            'aria-label': 'Durée particulière de cette vue en secondes',
            value: selected.entry.durationMs === null ? '' : selected.entry.durationMs / 1000,
            mix: on<HTMLInputElement, 'input'>('input', (event) => submitOptionalPositiveNumber(event.currentTarget.value, selected.bdc.id, actions.setCardDurationSeconds)),
          }),
        ],
      }),
      toolbarEnd: jsx('button', {
        id: `elce-carousel-card-delete-${selected.bdc.id}`,
        className: 'elce-carousel-editor__delete',
        type: 'button',
        'aria-label': 'Supprimer cette carte',
        title: 'Supprimer cette carte',
        disabled: content.cards.length <= 1,
        mix: on<HTMLButtonElement, 'click'>('click', () => actions.removeCard(selected.bdc.id, selectedCardBdcId)),
        children: renderLucideIcon(Trash2, `elce-carousel-card-delete-icon-${selected.bdc.id}`, 15),
      }),
    }),
  })
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
