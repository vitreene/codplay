import { useRef } from 'react'
import type { DragEvent } from 'react'
import { GripVertical, ImagePlus, Plus, Trash2, X } from 'lucide-react'
import {
  CAROUSEL_ASPECT_RATIO_OPTIONS,
  CAROUSEL_CARD_PRESET_OPTIONS,
  CAROUSEL_CONFIG,
  CAROUSEL_IMAGE_POSITION_OPTIONS,
  CAROUSEL_PLAYBACK_MODE,
  CAROUSEL_PLAYBACK_MODE_OPTIONS,
  CAROUSEL_TRANSITION_OPTIONS,
  CATALOG_REFERENCE,
  DEFAULT_PRESET_ID,
  MEDIA_FILE_ACCEPT,
  MEDIA_TYPE,
} from '../../config/document-config'
import type { CarouselAspectRatioId, CarouselCardPresetId } from '../../config/document-config-types'
import type { CarouselAspectRatio, CarouselShortText, CarouselView } from '../../domain/carousel-types'
import type { ElceCatalogReference } from '../../domain/catalog-types'
import type { ElceCarouselEditorProps } from '../../domain/carousel-facade-types'
import './carousel-editor.css'

/** Renders one Carousel BDC and routes every edit through its métier facade. */
export function CarouselEditor({ bdcId, content, selectedViewId, mediaById, actions }: ElceCarouselEditorProps) {
  const draggedViewId = useRef<string | null>(null)
  const selectedView = content.views.find((view) => view.id === selectedViewId) ?? content.views[0]

  /** Starts a view reorder gesture using the configured Carousel MIME type. */
  const beginViewDrag = (event: DragEvent<HTMLButtonElement>, viewId: string): void => {
    draggedViewId.current = viewId
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(CAROUSEL_CONFIG.viewDragMimeType, viewId)
  }

  /** Reorders a dragged Carousel view through the facade. */
  const dropView = (event: DragEvent<HTMLButtonElement>, index: number): void => {
    const draggedId = event.dataTransfer.getData(CAROUSEL_CONFIG.viewDragMimeType) || draggedViewId.current
    if (draggedId === null || draggedId === '') return
    event.preventDefault()
    actions.moveView(draggedId, index)
    draggedViewId.current = null
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

      <div id={`elce-carousel-view-tabs-${bdcId}`} className="elce-carousel-editor__views" role="tablist" aria-label="Vues du Carousel">
        {content.views.map((view, index) => (
          <button
            id={`elce-carousel-view-tab-${view.id}`}
            key={view.id}
            className={view.id === selectedView?.id ? 'elce-carousel-editor__view-tab is-active' : 'elce-carousel-editor__view-tab'}
            type="button"
            role="tab"
            aria-selected={view.id === selectedView?.id}
            draggable
            onClick={() => actions.selectView(view.id)}
            onDragStart={(event) => beginViewDrag(event, view.id)}
            onDragOver={(event) => {
              if (Array.from(event.dataTransfer.types).includes(CAROUSEL_CONFIG.viewDragMimeType)) event.preventDefault()
            }}
            onDrop={(event) => dropView(event, index)}
            onDragEnd={() => { draggedViewId.current = null }}
          >
            <GripVertical aria-hidden="true" size={14} />
            <span>{index + 1}</span>
          </button>
        ))}
        <button
          id={`elce-carousel-view-add-${bdcId}`}
          className="elce-carousel-editor__view-add"
          type="button"
          aria-label="Ajouter une vue"
          title="Ajouter une vue"
          onClick={actions.addView}
        ><Plus aria-hidden="true" size={16} /></button>
      </div>

      {selectedView === undefined
        ? <p id={`elce-carousel-empty-${bdcId}`} className="elce-carousel-editor__empty">Ajoutez une vue pour commencer.</p>
        : <div id={`elce-carousel-view-editor-${selectedView.id}`} className="elce-carousel-editor__view-content" role="tabpanel">
            <div id={`elce-carousel-view-toolbar-${selectedView.id}`} className="elce-carousel-editor__view-toolbar">
              <label id={`elce-carousel-view-preset-label-${selectedView.id}`} className="elce-carousel-editor__setting">
                <span>Carte</span>
                <select
                  id={`elce-carousel-view-preset-${selectedView.id}`}
                  aria-label="Carte de cette vue"
                  value={selectedView.presetId}
                  onChange={(event) => actions.setViewPreset(selectedView.id, event.currentTarget.value as CarouselCardPresetId)}
                >
                  {CAROUSEL_CARD_PRESET_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label id={`elce-carousel-view-duration-label-${selectedView.id}`} className="elce-carousel-editor__view-duration">
                <span>Durée de la vue · secondes</span>
                <input
                  id={`elce-carousel-view-duration-${selectedView.id}`}
                  type="number"
                  min="0.1"
                  step="0.1"
                  placeholder={`${content.defaultViewDurationMs / 1000}`}
                  aria-label="Durée particulière de cette vue en secondes"
                  value={selectedView.durationMs === null ? '' : selectedView.durationMs / 1000}
                  onChange={(event) => submitOptionalPositiveNumber(event.currentTarget.value, selectedView.id, actions.setViewDurationSeconds)}
                />
              </label>
              <button
                id={`elce-carousel-view-delete-${selectedView.id}`}
                className="elce-carousel-editor__delete"
                type="button"
                aria-label="Supprimer cette vue"
                title="Supprimer cette vue"
                disabled={content.views.length <= 1}
                onClick={() => actions.removeView(selectedView.id, selectedView.id)}
              ><Trash2 aria-hidden="true" size={15} /></button>
            </div>
            {renderViewContent(selectedView, actions, mediaById, content.aspectRatio)}
          </div>}
    </section>
  )
}

/** Renders editable plain-text fields or the selected view's media zone. */
function renderViewContent(
  view: CarouselView,
  actions: ElceCarouselEditorProps['actions'],
  mediaById: ElceCarouselEditorProps['mediaById'],
  aspectRatio: CarouselAspectRatio,
) {
  switch (view.presetId) {
    case DEFAULT_PRESET_ID.TEXT_SHORT:
      return renderShortTextFields(view.id, view.text, actions)
    case DEFAULT_PRESET_ID.PHOTO:
      return <CarouselMediaEditor view={view} mediaById={mediaById} actions={actions} imageAspectRatio={aspectRatio} />
    case DEFAULT_PRESET_ID.IMAGE_CAPTION:
      return (
        <div id={`elce-carousel-image-caption-fields-${view.id}`} className="elce-carousel-image-caption-fields">
          <CarouselMediaEditor view={view} mediaById={mediaById} actions={actions} imageAspectRatio={aspectRatio} />
          <input id={`elce-carousel-caption-${view.id}`} placeholder="Légende facultative" aria-label="Légende" value={view.text.caption} onChange={(event) => actions.setCaption(view.id, event.currentTarget.value)} />
        </div>
      )
    case DEFAULT_PRESET_ID.TEXT_IMAGE:
      return (
        <div
          id={`elce-carousel-text-image-fields-${view.id}`}
          className={`elce-carousel-text-image-fields elce-carousel-text-image-fields--image-${view.imagePosition}`}
        >
          <label id={`elce-carousel-image-position-label-${view.id}`} className="elce-carousel-editor__setting">
            <span>Position de l’image</span>
            <select
              id={`elce-carousel-image-position-${view.id}`}
              aria-label="Position de l’image"
              value={view.imagePosition}
              onChange={(event) => actions.setImagePosition(view.id, event.currentTarget.value as typeof view.imagePosition)}
            >
              {CAROUSEL_IMAGE_POSITION_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <CarouselMediaEditor view={view} mediaById={mediaById} actions={actions} imageAspectRatio={aspectRatio} />
          {renderShortTextFields(view.id, view.text, actions)}
        </div>
      )
  }
}

/** Renders the shared editable text fields used by both text card presets. */
function renderShortTextFields(
  viewId: string,
  text: CarouselShortText,
  actions: ElceCarouselEditorProps['actions'],
) {
  return (
    <div id={`elce-carousel-text-fields-${viewId}`} className="elce-carousel-text-fields">
      <input id={`elce-carousel-overline-${viewId}`} placeholder="Surtitre" aria-label="Surtitre" value={text.overline} onChange={(event) => actions.setShortText(viewId, 'overline', event.currentTarget.value)} />
      <input id={`elce-carousel-title-${viewId}`} placeholder="Titre" aria-label="Titre" value={text.title} onChange={(event) => actions.setShortText(viewId, 'title', event.currentTarget.value)} />
      <input id={`elce-carousel-description-${viewId}`} placeholder="Description" aria-label="Description" value={text.description} onChange={(event) => actions.setShortText(viewId, 'description', event.currentTarget.value)} />
      <textarea id={`elce-carousel-message-${viewId}`} placeholder="Message" aria-label="Message" maxLength={CAROUSEL_CONFIG.textShortMessageMaxLength} value={text.message} onChange={(event) => actions.setShortText(viewId, 'message', event.currentTarget.value)} />
      <input id={`elce-carousel-note-${viewId}`} placeholder="Note" aria-label="Note" value={text.note} onChange={(event) => actions.setShortText(viewId, 'note', event.currentTarget.value)} />
      <small id={`elce-carousel-message-count-${viewId}`}>{text.message.length} / {CAROUSEL_CONFIG.textShortMessageMaxLength}</small>
    </div>
  )
}

type CarouselMediaEditorProps = Readonly<{
  readonly view: Extract<CarouselView, { mediaId: string | null }>
  readonly mediaById: ElceCarouselEditorProps['mediaById']
  readonly actions: ElceCarouselEditorProps['actions']
  readonly imageAspectRatio: CarouselAspectRatio | null
}>

/** Edits one reusable image or video reference and imports dropped files by command. */
function CarouselMediaEditor({ view, mediaById, actions, imageAspectRatio }: CarouselMediaEditorProps) {
  const media = view.mediaId === null ? undefined : mediaById[view.mediaId]
  const canUseVideo = view.presetId === DEFAULT_PRESET_ID.PHOTO
  const hasVideoPreview = media?.type === MEDIA_TYPE.VIDEO && media.source !== null
  const fileTriggerContent = media?.source === null || media === undefined
    ? <><ImagePlus aria-hidden="true" size={18} />{media?.name ?? (canUseVideo ? 'Déposer une image ou vidéo' : 'Déposer une image')}</>
    : media.type === MEDIA_TYPE.IMAGE
      ? <img id={`elce-carousel-media-image-${view.id}`} className="elce-carousel-media-drop__preview" src={media.source} alt="" />
      : <video id={`elce-carousel-media-video-${view.id}`} className="elce-carousel-media-drop__preview" src={media.source} controls />

  /** Accepts only supported files or reusable media references. */
  const acceptsDrop = (event: DragEvent<HTMLDivElement>): boolean => {
    const types = Array.from(event.dataTransfer.types)
    return types.includes('Files') || types.includes(CATALOG_REFERENCE.MIME_TYPE)
  }

  /** Routes a media file or catalogue reference through the facade. */
  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    const file = event.dataTransfer.files[0]
    if (file !== undefined) {
      event.preventDefault()
      if (!acceptsFile(view.presetId, file)) return
      actions.importMediaFile(view.id, file)
      return
    }
    const reference = parseCatalogReference(event.dataTransfer.getData(CATALOG_REFERENCE.MIME_TYPE))
    switch (reference) {
      case null:
        return
      default:
        switch (reference.kind) {
          case CATALOG_REFERENCE.MEDIA:
            if (!acceptsCatalogMedia(view.presetId, mediaById[reference.mediaId]?.type)) {
              event.preventDefault()
              return
            }
            event.preventDefault()
            actions.attachCatalogReference(view.id, reference)
            return
          case CATALOG_REFERENCE.BDC:
            return
        }
    }
  }

  return (
    <div
      id={`elce-carousel-media-drop-${view.id}`}
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
        id={`elce-carousel-media-file-${view.id}`}
        className="elce-visually-hidden"
        type="file"
        accept={canUseVideo ? MEDIA_FILE_ACCEPT.IMAGE_AND_VIDEO : MEDIA_FILE_ACCEPT.IMAGE}
        aria-label={canUseVideo ? 'Choisir une image ou vidéo' : 'Choisir une image'}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          if (file !== undefined && acceptsFile(view.presetId, file)) actions.importMediaFile(view.id, file)
          event.currentTarget.value = ''
        }}
      />
      {hasVideoPreview
        ? <div
            id={`elce-carousel-media-select-${view.id}`}
            className="elce-carousel-media-drop__file-trigger"
          >{fileTriggerContent}</div>
        : <label
            id={`elce-carousel-media-select-${view.id}`}
            className="elce-carousel-media-drop__file-trigger"
            htmlFor={`elce-carousel-media-file-${view.id}`}
            title={media === undefined ? 'Cliquer pour choisir un fichier ou le déposer' : 'Cliquer pour remplacer le média'}
          >{fileTriggerContent}</label>}
      {media !== undefined && <button
        id={`elce-carousel-media-clear-${view.id}`}
        className="elce-carousel-editor__media-clear"
        type="button"
        aria-label="Retirer le média de cette vue"
        title="Retirer le média"
        onClick={() => actions.clearMedia(view.id)}
      ><X aria-hidden="true" size={15} /></button>}
    </div>
  )
}

/** Parses the catalogue payload while rejecting a unique BDC as media. */
function parseCatalogReference(value: string): ElceCatalogReference | null {
  try {
    const reference = JSON.parse(value) as ElceCatalogReference
    switch (reference.kind) {
      case CATALOG_REFERENCE.MEDIA:
        return reference
      case CATALOG_REFERENCE.BDC:
        return null
      default:
        return null
    }
  } catch {
    return null
  }
}

/** Sends only finite positive author-entered values to the document model. */
function submitPositiveNumber(value: number, submit: (value: number) => void): void {
  switch (Number.isFinite(value) && value > 0) {
    case true:
      submit(value)
      break
    case false:
      break
  }
}

/** Sends only whole repeat counts inside the configured authoring range. */
function submitRepeatCount(value: number, submit: (value: number) => void): void {
  switch (Number.isInteger(value)
    && value >= CAROUSEL_CONFIG.minimumRepeatCount
    && value <= CAROUSEL_CONFIG.maximumRepeatCount) {
    case true:
      submit(value)
      break
    case false:
      break
  }
}

/** Converts an empty per-view duration field back to inheritance. */
function submitOptionalPositiveNumber(value: string, viewId: string, submit: (viewId: string, seconds: number | null) => void): void {
  switch (value) {
    case '':
      submit(viewId, null)
      return
    default:
      submitPositiveNumber(Number(value), (seconds) => submit(viewId, seconds))
  }
}

/** Maps the selected fixed ratio preset to its métier value. */
function submitAspectRatio(value: string, submit: (ratio: CarouselAspectRatio) => void): void {
  const option = CAROUSEL_ASPECT_RATIO_OPTIONS.find((candidate) => candidate.value === value)
  if (option !== undefined) submit(option.ratio)
}

/** Keeps a saved custom ratio visible until the author chooses a supported preset. */
function aspectRatioOptionValue(ratio: CarouselAspectRatio): CarouselAspectRatioId | typeof LEGACY_RATIO_OPTION {
  return CAROUSEL_ASPECT_RATIO_OPTIONS.find((option) => option.ratio.width === ratio.width && option.ratio.height === ratio.height)?.value
    ?? LEGACY_RATIO_OPTION
}

/** Accepts video only for the full-frame Photo card; other media cards use images. */
function acceptsFile(presetId: CarouselCardPresetId, file: File): boolean {
  if (file.type.startsWith('image/')) return acceptsCatalogMedia(presetId, MEDIA_TYPE.IMAGE)
  if (file.type.startsWith('video/')) return acceptsCatalogMedia(presetId, MEDIA_TYPE.VIDEO)
  return false
}

/** Applies the media whitelist declared by each Carousel card type. */
function acceptsCatalogMedia(presetId: CarouselCardPresetId, mediaType: typeof MEDIA_TYPE[keyof typeof MEDIA_TYPE] | undefined): boolean {
  switch (presetId) {
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
