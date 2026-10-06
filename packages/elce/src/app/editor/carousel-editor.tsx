import { useRef } from 'react'
import type { DragEvent } from 'react'
import { GripVertical, ImagePlus, Plus, Trash2, X } from 'lucide-react'
import {
  CAROUSEL_ASPECT_RATIO_OPTIONS,
  CARD_LAYOUT_OPTIONS,
  CAROUSEL_CONFIG,
  CAROUSEL_IMAGE_POSITION_OPTIONS,
  CAROUSEL_PLAYBACK_MODE,
  CAROUSEL_PLAYBACK_MODE_OPTIONS,
  CAROUSEL_TRANSITION_OPTIONS,
  CARD_IMAGE_FIT,
  CARD_IMAGE_FIT_OPTIONS,
  CATALOG_REFERENCE,
  DEFAULT_PRESET_ID,
  MEDIA_FILE_ACCEPT,
  MEDIA_TYPE,
} from '../../config/document-config'
import type { CardLayoutId, CarouselAspectRatioId } from '../../config/document-config-types'
import type { CarouselAspectRatio } from '../../domain/carousel-types'
import type { Bdc } from '../../domain/document-types'
import type { CardContent } from '../../domain/card/card-types'
import type { ElceCatalogReference } from '../../domain/catalog-types'
import type { ElceCarouselEditorProps } from '../../domain/carousel-facade-types'
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
            value={content.transition}
            onChange={(event) => actions.setTransition(event.currentTarget.value as typeof content.transition)}
          >
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
            <div
              id={`elce-carousel-card-toolbar-${selected.bdc.id}`}
              className={cardToolbarClassName(selected.bdc.presetId)}
            >
              <label id={`elce-carousel-card-layout-label-${selected.bdc.id}`} className="elce-carousel-editor__setting elce-carousel-editor__setting--card-layout">
                <span>Représentation</span>
                <select
                  id={`elce-carousel-card-layout-${selected.bdc.id}`}
                  aria-label="Représentation de cette carte"
                  value={selected.bdc.presetId}
                  onChange={(event) => actions.setCardLayout(selected.bdc.id, event.currentTarget.value as CardLayoutId)}
                >
                  {CARD_LAYOUT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
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
              {renderCardPresentationSettings(selected.bdc, mediaById, actions)}
              <button
                id={`elce-carousel-card-delete-${selected.bdc.id}`}
                className="elce-carousel-editor__delete"
                type="button"
                aria-label="Supprimer cette carte"
                title="Supprimer cette carte"
                disabled={content.cards.length <= 1}
                onClick={() => actions.removeCard(selected.bdc.id, selectedCardBdcId)}
              ><Trash2 aria-hidden="true" size={15} /></button>
            </div>
            {renderCardContent(selected.bdc, mediaById, content.aspectRatio, actions)}
          </div>}
    </section>
  )
}

/** Chooses a compact one-row toolbar for the settings projected by a Card layout. */
function cardToolbarClassName(presetId: CardLayoutId): string {
  const baseClassName = 'elce-carousel-editor__view-toolbar'
  if (presetId === DEFAULT_PRESET_ID.TEXT_SHORT) return `${baseClassName} ${baseClassName}--text-only`
  if (presetId === DEFAULT_PRESET_ID.TEXT_IMAGE) return `${baseClassName} ${baseClassName}--image-position`
  return `${baseClassName} ${baseClassName}--image`
}

/** Places the selected Card's image presentation controls beside its other settings. */
function renderCardPresentationSettings(
  bdc: Bdc,
  mediaById: ElceCarouselEditorProps['mediaById'],
  actions: ElceCarouselEditorProps['actions'],
) {
  if (bdc.type !== 'card' || bdc.card == null) return null
  const hasImageLayout = bdc.presetId === DEFAULT_PRESET_ID.PHOTO
    || bdc.presetId === DEFAULT_PRESET_ID.IMAGE_CAPTION
    || bdc.presetId === DEFAULT_PRESET_ID.TEXT_IMAGE
  const media = bdc.mediaId === null ? undefined : mediaById[bdc.mediaId]

  return (
    <>
      {hasImageLayout && media?.type !== MEDIA_TYPE.VIDEO && (
        <label id={`elce-carousel-image-fit-label-${bdc.id}`} className="elce-carousel-editor__setting elce-carousel-editor__setting--image-fit">
          <span>Ajustement de l’image</span>
          <select
            id={`elce-carousel-image-fit-${bdc.id}`}
            aria-label="Ajustement de l’image"
            value={bdc.card.imageFit}
            onChange={(event) => actions.setImageFit(bdc.id, event.currentTarget.value as typeof bdc.card.imageFit)}
          >
            {CARD_IMAGE_FIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      )}
      {bdc.presetId === DEFAULT_PRESET_ID.TEXT_IMAGE && (
        <label id={`elce-carousel-image-position-label-${bdc.id}`} className="elce-carousel-editor__setting elce-carousel-editor__setting--image-position">
          <span>Position de l’image</span>
          <select
            id={`elce-carousel-image-position-${bdc.id}`}
            aria-label="Position de l’image"
            value={bdc.card.imagePosition}
            onChange={(event) => actions.setImagePosition(bdc.id, event.currentTarget.value as typeof bdc.card.imagePosition)}
          >
            {CAROUSEL_IMAGE_POSITION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      )}
    </>
  )
}

/** Renders only the fields projected by the selected Card layout. */
function renderCardContent(
  bdc: Bdc,
  mediaById: ElceCarouselEditorProps['mediaById'],
  aspectRatio: CarouselAspectRatio,
  actions: ElceCarouselEditorProps['actions'],
) {
  if (bdc.type !== 'card' || bdc.card == null) return null
  switch (bdc.presetId) {
    case DEFAULT_PRESET_ID.TEXT_SHORT:
      return renderShortTextFields(bdc.id, bdc.card, actions)
    case DEFAULT_PRESET_ID.PHOTO:
      return <CarouselMediaEditor bdc={bdc} mediaById={mediaById} actions={actions} imageAspectRatio={aspectRatio} />
    case DEFAULT_PRESET_ID.IMAGE_CAPTION:
      return (
        <div id={`elce-carousel-image-caption-fields-${bdc.id}`} className="elce-carousel-image-caption-fields">
          <CarouselMediaEditor bdc={bdc} mediaById={mediaById} actions={actions} imageAspectRatio={aspectRatio} />
          <input id={`elce-carousel-caption-${bdc.id}`} placeholder="Légende facultative" aria-label="Légende" value={bdc.card.caption} onChange={(event) => actions.setCaption(bdc.id, event.currentTarget.value)} />
        </div>
      )
    case DEFAULT_PRESET_ID.TEXT_IMAGE:
      return (
        <div
          id={`elce-carousel-text-image-fields-${bdc.id}`}
          className={`elce-carousel-text-image-fields elce-carousel-text-image-fields--image-${bdc.card.imagePosition}`}
        >
          <CarouselMediaEditor bdc={bdc} mediaById={mediaById} actions={actions} imageAspectRatio={aspectRatio} />
          {renderShortTextFields(bdc.id, bdc.card, actions)}
        </div>
      )
    default:
      throw new Error(`Représentation de carte inconnue : ${bdc.presetId}`)
  }
}

/** Renders every editable text field while keeping the unshown fields in the BDC. */
function renderShortTextFields(
  bdcId: string,
  card: CardContent,
  actions: ElceCarouselEditorProps['actions'],
) {
  return (
    <div id={`elce-carousel-text-fields-${bdcId}`} className="elce-carousel-text-fields">
      <input id={`elce-carousel-overline-${bdcId}`} placeholder="Surtitre" aria-label="Surtitre" value={card.overline} onChange={(event) => actions.setCardText(bdcId, 'overline', event.currentTarget.value)} />
      <input id={`elce-carousel-title-${bdcId}`} placeholder="Titre" aria-label="Titre" value={card.title} onChange={(event) => actions.setCardText(bdcId, 'title', event.currentTarget.value)} />
      <input id={`elce-carousel-description-${bdcId}`} placeholder="Description" aria-label="Description" value={card.description} onChange={(event) => actions.setCardText(bdcId, 'description', event.currentTarget.value)} />
      <textarea id={`elce-carousel-message-${bdcId}`} placeholder="Message" aria-label="Message" maxLength={CAROUSEL_CONFIG.textShortMessageMaxLength} value={card.message} onChange={(event) => actions.setCardText(bdcId, 'message', event.currentTarget.value)} />
      <input id={`elce-carousel-note-${bdcId}`} placeholder="Note" aria-label="Note" value={card.note} onChange={(event) => actions.setCardText(bdcId, 'note', event.currentTarget.value)} />
      <small id={`elce-carousel-message-count-${bdcId}`}>{card.message.length} / {CAROUSEL_CONFIG.textShortMessageMaxLength}</small>
    </div>
  )
}

type CarouselMediaEditorProps = Readonly<{
  readonly bdc: Bdc
  readonly mediaById: ElceCarouselEditorProps['mediaById']
  readonly actions: ElceCarouselEditorProps['actions']
  readonly imageAspectRatio: CarouselAspectRatio | null
}>

/** Edits one reusable Card media reference and imports files through the facade. */
function CarouselMediaEditor({ bdc, mediaById, actions, imageAspectRatio }: CarouselMediaEditorProps) {
  if (bdc.type !== 'card' || bdc.card == null) return null
  const media = bdc.mediaId === null ? undefined : mediaById[bdc.mediaId]
  const canUseVideo = bdc.presetId === DEFAULT_PRESET_ID.PHOTO
  const hasVideoPreview = media?.type === MEDIA_TYPE.VIDEO && media.source !== null
  const fileTriggerContent = media?.source === null || media === undefined
    ? <><ImagePlus aria-hidden="true" size={18} />{media?.name ?? (canUseVideo ? 'Déposer des images ou vidéos' : 'Déposer des images')}</>
    : media.type === MEDIA_TYPE.IMAGE
      ? <img
          id={`elce-carousel-media-image-${bdc.id}`}
          className={bdc.card.imageFit === CARD_IMAGE_FIT.CONTAIN
            ? 'elce-carousel-media-drop__preview elce-carousel-media-drop__preview--contain'
            : 'elce-carousel-media-drop__preview'}
          src={media.source}
          alt=""
        />
      : <video id={`elce-carousel-media-video-${bdc.id}`} className="elce-carousel-media-drop__preview" src={media.source} controls />

  /** Accepts supported files or reusable media references. */
  const acceptsDrop = (event: DragEvent<HTMLDivElement>): boolean => {
    const types = Array.from(event.dataTransfer.types)
    return types.includes('Files') || types.includes(CATALOG_REFERENCE.MIME_TYPE)
  }

  /** Imports one accepted file into this Card or routes a selection as a batch. */
  const importFiles = (files: readonly File[]): void => {
    const acceptedFiles = files.filter((file) => acceptsFile(bdc.presetId as CardLayoutId, file))
    if (acceptedFiles.length === 1) actions.importMediaFile(bdc.id, acceptedFiles[0]!)
    else if (acceptedFiles.length > 1) actions.importMediaFiles(bdc.id, acceptedFiles)
  }

  /** Routes a file or catalogue media reference through the Card BDC actions. */
  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    const files = Array.from(event.dataTransfer.files)
    if (files.length > 0) {
      event.preventDefault()
      importFiles(files)
      return
    }
    const reference = parseCatalogReference(event.dataTransfer.getData(CATALOG_REFERENCE.MIME_TYPE))
    if (reference?.kind !== CATALOG_REFERENCE.MEDIA) return
    if (!acceptsCatalogMedia(bdc.presetId as CardLayoutId, mediaById[reference.mediaId]?.type)) {
      event.preventDefault()
      return
    }
    event.preventDefault()
    actions.attachCatalogReference(bdc.id, reference)
  }

  return (
    <div id={`elce-carousel-media-editor-${bdc.id}`} className="elce-carousel-media-editor">
      <div
        id={`elce-carousel-media-drop-${bdc.id}`}
        className={imageAspectRatio === null ? 'elce-carousel-media-drop' : 'elce-carousel-media-drop elce-carousel-media-drop--proportional'}
        style={imageAspectRatio === null ? undefined : { aspectRatio: `${imageAspectRatio.width} / ${imageAspectRatio.height}` }}
        onDragOver={(event) => {
          if (!acceptsDrop(event)) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'copy'
        }}
        onDrop={handleDrop}
      >
        <input
          id={`elce-carousel-media-file-${bdc.id}`}
          className="elce-visually-hidden"
          type="file"
          multiple
          accept={canUseVideo ? MEDIA_FILE_ACCEPT.IMAGE_AND_VIDEO : MEDIA_FILE_ACCEPT.IMAGE}
          aria-label={canUseVideo ? 'Choisir une ou plusieurs images ou vidéos' : 'Choisir une ou plusieurs images'}
          onChange={(event) => {
            importFiles(Array.from(event.currentTarget.files ?? []))
            event.currentTarget.value = ''
          }}
        />
        {hasVideoPreview
          ? <div id={`elce-carousel-media-video-wrap-${bdc.id}`} className="elce-carousel-media-drop__video-wrap">
              {fileTriggerContent}
              {bdc.presetId !== DEFAULT_PRESET_ID.PHOTO && <small id={`elce-carousel-media-hidden-${bdc.id}`}>Vidéo conservée, masquée par cette représentation.</small>}
              <label
                id={`elce-carousel-media-select-${bdc.id}`}
                className="elce-carousel-media-drop__file-trigger"
                htmlFor={`elce-carousel-media-file-${bdc.id}`}
                title="Cliquer pour remplacer le média"
              >Remplacer le média</label>
            </div>
          : <label
              id={`elce-carousel-media-select-${bdc.id}`}
              className="elce-carousel-media-drop__file-trigger"
              htmlFor={`elce-carousel-media-file-${bdc.id}`}
              title={media === undefined ? 'Cliquer pour choisir un ou plusieurs fichiers ou les déposer' : 'Cliquer pour remplacer le média'}
            >{fileTriggerContent}</label>}
        {media !== undefined && <button
          id={`elce-carousel-media-clear-${bdc.id}`}
          className="elce-carousel-editor__media-clear"
          type="button"
          aria-label="Retirer le média de cette carte"
          title="Retirer le média"
          onClick={() => actions.clearMedia(bdc.id)}
        ><X aria-hidden="true" size={15} /></button>}
      </div>
    </div>
  )
}

/** Parses a catalog payload while rejecting a unique BDC as a media reference. */
function parseCatalogReference(value: string): ElceCatalogReference | null {
  try {
    const reference = JSON.parse(value) as ElceCatalogReference
    return reference.kind === CATALOG_REFERENCE.MEDIA ? reference : null
  } catch {
    return null
  }
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

/** Accepts image and video files only where the active layout projects them. */
function acceptsFile(layoutId: CardLayoutId, file: File): boolean {
  if (file.type.startsWith('image/')) return acceptsCatalogMedia(layoutId, MEDIA_TYPE.IMAGE)
  if (file.type.startsWith('video/')) return acceptsCatalogMedia(layoutId, MEDIA_TYPE.VIDEO)
  return false
}

/** Applies layout-specific media selection rules without deleting hidden Card data. */
function acceptsCatalogMedia(layoutId: CardLayoutId, mediaType: typeof MEDIA_TYPE[keyof typeof MEDIA_TYPE] | undefined): boolean {
  switch (layoutId) {
    case DEFAULT_PRESET_ID.PHOTO:
      return mediaType === MEDIA_TYPE.IMAGE || mediaType === MEDIA_TYPE.VIDEO
    case DEFAULT_PRESET_ID.IMAGE_CAPTION:
    case DEFAULT_PRESET_ID.TEXT_IMAGE:
      return mediaType === MEDIA_TYPE.IMAGE
    case DEFAULT_PRESET_ID.TEXT_SHORT:
      return false
  }
}

const LEGACY_RATIO_OPTION = 'current-custom-ratio' as const
