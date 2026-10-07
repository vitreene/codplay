import { useRef } from 'react'
import type { DragEvent } from 'react'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import {
  CAROUSEL_CONFIG,
  CAROUSEL_PLAYBACK_MODE,
  CAROUSEL_PLAYBACK_MODE_OPTIONS,
  CAROUSEL_TRANSITION_OPTIONS,
} from '../../../config/document-config'
import { CAROUSEL_ASPECT_RATIO_OPTIONS } from '../../../config/document-config'
import type { CarouselAspectRatioId } from '../../../config/document-config-types'
import type { CarouselAspectRatio } from '../../../domain/carousel/carousel-types'
import type { ElceCarouselEditorProps } from '../../../domain/carousel/carousel-facade-types'
import { CardBdcEditorFields } from '../card/card-editor-fields'
import './carousel-editor.css'

/** Renders Carousel settings and its ordered child Card BDC editors. */
export function CarouselEditor({ bdcId, content, cards, selectedCardBdcId, mediaById, actions }: ElceCarouselEditorProps) {
  const draggedCardBdcId = useRef<string | null>(null)
  const cardById = new Map(cards.map((bdc) => [bdc.id, bdc]))
  const orderedCards = content.cards.flatMap((entry) => {
    const bdc = cardById.get(entry.bdcId)
    return bdc === undefined ? [] : [{ entry, bdc }]
  })
  const selected = orderedCards.find(({ bdc }) => bdc.id === selectedCardBdcId) ?? orderedCards[0]

  /** Starts reordering a child Card using the configured Carousel MIME type. */
  const beginCardDrag = (event: DragEvent<HTMLButtonElement>, cardBdcId: string): void => {
    draggedCardBdcId.current = cardBdcId
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(CAROUSEL_CONFIG.cardDragMimeType, cardBdcId)
  }

  /** Reorders one child Card through the Carousel facade. */
  const dropCard = (event: DragEvent<HTMLButtonElement>, index: number): void => {
    const draggedId = event.dataTransfer.getData(CAROUSEL_CONFIG.cardDragMimeType) || draggedCardBdcId.current
    if (draggedId === null || draggedId === '') return
    event.preventDefault()
    actions.moveCard(draggedId, index)
    draggedCardBdcId.current = null
  }

  return (
    <section id={`elce-carousel-editor-${bdcId}`} className="elce-carousel-editor" aria-label="Éditeur Carousel">
      <header id={`elce-carousel-header-${bdcId}`} className="elce-carousel-editor__header">
        <h3 id={`elce-carousel-title-${bdcId}`} className="elce-carousel-editor__title">Carousel</h3>
        <button
          id={`elce-carousel-delete-${bdcId}`}
          className="elce-carousel-editor__delete-bdc"
          type="button"
          aria-label="Supprimer le bloc Carousel"
          title="Supprimer le bloc Carousel"
          onClick={actions.deleteCarousel}
        ><Trash2 aria-hidden="true" size={14} /></button>
      </header>
      <div id={`elce-carousel-settings-${bdcId}`} className="elce-carousel-editor__settings">
        <label id={`elce-carousel-playback-label-${bdcId}`} className="elce-carousel-editor__setting">
          <span>Lecture</span>
          <select
            id={`elce-carousel-playback-${bdcId}`}
            aria-label="Mode de lecture du Carousel"
            value={content.playbackMode}
            onChange={(event) => actions.setPlaybackMode(event.currentTarget.value as typeof content.playbackMode)}
          >
            {CAROUSEL_PLAYBACK_MODE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        {content.playbackMode === CAROUSEL_PLAYBACK_MODE.AUTOMATIC
          ? (
            <label id={`elce-carousel-repeat-label-${bdcId}`} className="elce-carousel-editor__setting elce-carousel-editor__setting--repeat">
              <span id={`elce-carousel-repeat-caption-${bdcId}`}>Répéter</span>
              <input
                id={`elce-carousel-repeat-${bdcId}`}
                type="number"
                min={CAROUSEL_CONFIG.minimumRepeatCount}
                max={CAROUSEL_CONFIG.maximumRepeatCount}
                step="1"
                aria-label="Nombre de répétitions du Carousel"
                value={content.repeatCount ?? CAROUSEL_CONFIG.defaultRepeatCount}
                onChange={(event) => submitRepeatCount(event.currentTarget.valueAsNumber, actions.setRepeatCount)}
              />
              <span id={`elce-carousel-repeat-unit-${bdcId}`}>fois</span>
            </label>
          )
          : null}
        <label id={`elce-carousel-duration-label-${bdcId}`} className="elce-carousel-editor__setting">
          <span>Durée par vue</span>
          <div id={`elce-carousel-duration-control-${bdcId}`} className="elce-carousel-editor__duration-control">
            <input
              id={`elce-carousel-duration-${bdcId}`}
              type="range"
              min={CAROUSEL_CONFIG.minimumViewDurationSeconds}
              max={CAROUSEL_CONFIG.maximumViewDurationSeconds}
              step="1"
              aria-label="Durée par défaut d’une vue en secondes"
              value={content.defaultViewDurationMs / 1000}
              onChange={(event) => submitPositiveNumber(event.currentTarget.valueAsNumber, actions.setDefaultViewDurationSeconds)}
            />
            <output id={`elce-carousel-duration-value-${bdcId}`}>{content.defaultViewDurationMs / 1000} s</output>
          </div>
        </label>
        <label id={`elce-carousel-transition-label-${bdcId}`} className="elce-carousel-editor__setting">
          <span>Transition</span>
          <select
            id={`elce-carousel-transition-${bdcId}`}
            aria-label="Transition entre les vues"
            value={actions.transitionPreset ?? ''}
            onChange={(event) => {
              if (event.currentTarget.value !== '') actions.setTransition(event.currentTarget.value as NonNullable<typeof actions.transitionPreset>)
            }}
          >
            {actions.transitionPreset === null ? <option value="" disabled>Personnalisée</option> : null}
            {CAROUSEL_TRANSITION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <label id={`elce-carousel-ratio-label-${bdcId}`} className="elce-carousel-editor__setting">
          <span>Ratio</span>
          <select
            id={`elce-carousel-ratio-${bdcId}`}
            aria-label="Ratio du Carousel"
            value={aspectRatioOptionValue(content.aspectRatio)}
            onChange={(event) => submitAspectRatio(event.currentTarget.value, actions.setAspectRatio)}
          >
            {aspectRatioOptionValue(content.aspectRatio) === LEGACY_RATIO_OPTION
              ? <option value={LEGACY_RATIO_OPTION} disabled>Ratio actuel ({content.aspectRatio.width}:{content.aspectRatio.height})</option>
              : null}
            {CAROUSEL_ASPECT_RATIO_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <div id={`elce-carousel-card-tabs-${bdcId}`} className="elce-carousel-editor__views" role="tablist" aria-label="Cartes du Carousel">
        {orderedCards.map(({ bdc: cardBdc }, index) => (
          <button
            id={`elce-carousel-card-tab-${cardBdc.id}`}
            key={cardBdc.id}
            className={cardBdc.id === selected?.bdc.id ? 'elce-carousel-editor__view-tab is-active' : 'elce-carousel-editor__view-tab'}
            type="button"
            role="tab"
            aria-selected={cardBdc.id === selected?.bdc.id}
            draggable
            onClick={() => actions.selectCard(cardBdc.id)}
            onDragStart={(event) => beginCardDrag(event, cardBdc.id)}
            onDragOver={(event) => {
              if (Array.from(event.dataTransfer.types).includes(CAROUSEL_CONFIG.cardDragMimeType)) event.preventDefault()
            }}
            onDrop={(event) => dropCard(event, index)}
            onDragEnd={() => { draggedCardBdcId.current = null }}
          >
            <GripVertical aria-hidden="true" size={14} />
            <span>{index + 1}</span>
          </button>
        ))}
        <button
          id={`elce-carousel-card-add-${bdcId}`}
          className="elce-carousel-editor__view-add"
          type="button"
          aria-label="Ajouter une carte"
          title="Ajouter une carte"
          onClick={actions.addCard}
        ><Plus aria-hidden="true" size={16} /></button>
      </div>

      {selected === undefined
        ? <p id={`elce-carousel-empty-${bdcId}`} className="elce-carousel-editor__empty">Ajoutez une carte pour commencer.</p>
        : <div id={`elce-carousel-card-editor-${selected.bdc.id}`} className="elce-carousel-editor__view-content" role="tabpanel">
            <CardBdcEditorFields
              bdc={selected.bdc}
              mediaById={mediaById}
              actions={actions}
              idPrefix="elce-carousel"
              imageAspectRatio={content.aspectRatio}
              allowMultipleMediaFiles
              importMediaFiles={actions.importMediaFiles}
              toolbarContent={(
                <label id={`elce-carousel-card-duration-label-${selected.bdc.id}`} className="elce-carousel-editor__view-duration">
                  <span>Durée de la vue · secondes</span>
                  <input
                    id={`elce-carousel-card-duration-${selected.bdc.id}`}
                    type="number"
                    min="0.1"
                    step="0.1"
                    placeholder={`${content.defaultViewDurationMs / 1000}`}
                    aria-label="Durée particulière de cette vue en secondes"
                    value={selected.entry.durationMs === null ? '' : selected.entry.durationMs / 1000}
                    onChange={(event) => submitOptionalPositiveNumber(event.currentTarget.value, selected.bdc.id, actions.setCardDurationSeconds)}
                  />
                </label>
              )}
              toolbarEnd={(
                <button
                  id={`elce-carousel-card-delete-${selected.bdc.id}`}
                  className="elce-carousel-editor__delete"
                  type="button"
                  aria-label="Supprimer cette carte"
                  title="Supprimer cette carte"
                  disabled={content.cards.length <= 1}
                  onClick={() => actions.removeCard(selected.bdc.id, selectedCardBdcId)}
                ><Trash2 aria-hidden="true" size={15} /></button>
              )}
            />
          </div>}
    </section>
  )
}

/** Accepts only finite positive author-entered values. */
function submitPositiveNumber(value: number, submit: (value: number) => void): void {
  if (Number.isFinite(value) && value > 0) submit(value)
}

/** Accepts whole repetition counts inside the configured range. */
function submitRepeatCount(value: number, submit: (value: number) => void): void {
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
