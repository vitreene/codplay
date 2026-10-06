import type { DragEvent } from 'react'
import { ImagePlus, X } from 'lucide-react'
import {
  CARD_IMAGE_FIT,
  CARD_IMAGE_FIT_OPTIONS,
  CARD_LAYOUT_OPTIONS,
  CAROUSEL_CONFIG,
  CAROUSEL_IMAGE_POSITION_OPTIONS,
  CATALOG_REFERENCE,
  DEFAULT_PRESET_ID,
  MEDIA_FILE_ACCEPT,
  MEDIA_TYPE,
} from '../../../config/document-config'
import type { CardLayoutId } from '../../../config/document-config-types'
import type { Bdc } from '../../../domain/document-types'
import type { ElceCardEditorFieldsProps } from '../../../domain/card/card-facade-types'
import type { CardContent } from '../../../domain/card/card-types'
import type { ElceCatalogReference } from '../../../domain/catalog-types'

/** Renders the selected Card layout and its currently visible authored fields. */
export function CardBdcEditorFields({
  bdc,
  mediaById,
  actions,
  idPrefix,
  imageAspectRatio,
  allowMultipleMediaFiles = false,
  importMediaFiles,
  toolbarContent,
  toolbarEnd,
}: ElceCardEditorFieldsProps) {
  if (bdc.type !== 'card' || bdc.card == null) return null
  return (
    <>
      <div id={`${idPrefix}-card-toolbar-${bdc.id}`} className={cardToolbarClassName(bdc.presetId)}>
        <CardLayoutSelect bdc={bdc} actions={actions} idPrefix={idPrefix} />
        {toolbarContent}
        <CardPresentationSettings bdc={bdc} mediaById={mediaById} actions={actions} idPrefix={idPrefix} />
        {toolbarEnd}
      </div>
      {renderCardContent(bdc, mediaById, imageAspectRatio, actions, idPrefix, allowMultipleMediaFiles, importMediaFiles)}
    </>
  )
}

/** Renders the layout selector for one identified Card BDC. */
export function CardLayoutSelect({
  bdc,
  actions,
  idPrefix,
}: Pick<ElceCardEditorFieldsProps, 'bdc' | 'actions' | 'idPrefix'>) {
  if (bdc.type !== 'card') return null
  return (
    <label id={`${idPrefix}-card-layout-label-${bdc.id}`} className="elce-carousel-editor__setting elce-carousel-editor__setting--card-layout">
      <span>Représentation</span>
      <select
        id={`${idPrefix}-card-layout-${bdc.id}`}
        aria-label="Représentation de cette carte"
        value={bdc.presetId}
        onChange={(event) => actions.setCardLayout(bdc.id, event.currentTarget.value as CardLayoutId)}
      >
        {CARD_LAYOUT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

/** Places image fit and position controls beside the selected Card layout. */
export function CardPresentationSettings({ bdc, mediaById, actions, idPrefix }: Pick<ElceCardEditorFieldsProps, 'bdc' | 'mediaById' | 'actions' | 'idPrefix'>) {
  if (bdc.type !== 'card' || bdc.card == null) return null
  const hasImageLayout = bdc.presetId === DEFAULT_PRESET_ID.PHOTO
    || bdc.presetId === DEFAULT_PRESET_ID.IMAGE_CAPTION
    || bdc.presetId === DEFAULT_PRESET_ID.TEXT_IMAGE
  const media = bdc.mediaId === null ? undefined : mediaById[bdc.mediaId]
  return (
    <>
      {hasImageLayout && media?.type !== MEDIA_TYPE.VIDEO && (
        <label id={`${idPrefix}-image-fit-label-${bdc.id}`} className="elce-carousel-editor__setting elce-carousel-editor__setting--image-fit">
          <span>Ajustement de l’image</span>
          <select
            id={`${idPrefix}-image-fit-${bdc.id}`}
            aria-label="Ajustement de l’image"
            value={bdc.card.imageFit}
            onChange={(event) => actions.setImageFit(bdc.id, event.currentTarget.value as typeof bdc.card.imageFit)}
          >
            {CARD_IMAGE_FIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      )}
      {bdc.presetId === DEFAULT_PRESET_ID.TEXT_IMAGE && (
        <label id={`${idPrefix}-image-position-label-${bdc.id}`} className="elce-carousel-editor__setting elce-carousel-editor__setting--image-position">
          <span>Position de l’image</span>
          <select
            id={`${idPrefix}-image-position-${bdc.id}`}
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

/** Chooses a compact one-row toolbar for the fields projected by one Card layout. */
export function cardToolbarClassName(presetId: string): string {
  const baseClassName = 'elce-carousel-editor__view-toolbar'
  if (presetId === DEFAULT_PRESET_ID.TEXT_SHORT) return `${baseClassName} ${baseClassName}--text-only`
  if (presetId === DEFAULT_PRESET_ID.TEXT_IMAGE) return `${baseClassName} ${baseClassName}--image-position`
  return `${baseClassName} ${baseClassName}--image`
}

/** Renders only the fields projected by the selected Card layout. */
function renderCardContent(
  bdc: Bdc,
  mediaById: ElceCardEditorFieldsProps['mediaById'],
  imageAspectRatio: ElceCardEditorFieldsProps['imageAspectRatio'],
  actions: ElceCardEditorFieldsProps['actions'],
  idPrefix: string,
  allowMultipleMediaFiles: boolean,
  importMediaFiles: ElceCardEditorFieldsProps['importMediaFiles'],
) {
  if (bdc.type !== 'card' || bdc.card == null) return null
  switch (bdc.presetId) {
    case DEFAULT_PRESET_ID.TEXT_SHORT:
      return renderShortTextFields(idPrefix, bdc.id, bdc.card, actions)
    case DEFAULT_PRESET_ID.PHOTO:
      return <CardMediaEditor bdc={bdc} mediaById={mediaById} actions={actions} idPrefix={idPrefix} imageAspectRatio={imageAspectRatio} allowMultipleMediaFiles={allowMultipleMediaFiles} importMediaFiles={importMediaFiles} />
    case DEFAULT_PRESET_ID.IMAGE_CAPTION:
      return (
        <div id={`${idPrefix}-image-caption-fields-${bdc.id}`} className="elce-carousel-image-caption-fields">
          <CardMediaEditor bdc={bdc} mediaById={mediaById} actions={actions} idPrefix={idPrefix} imageAspectRatio={imageAspectRatio} allowMultipleMediaFiles={allowMultipleMediaFiles} importMediaFiles={importMediaFiles} />
          <input id={`${idPrefix}-caption-${bdc.id}`} placeholder="Légende facultative" aria-label="Légende" value={bdc.card.caption} onChange={(event) => actions.setCaption(bdc.id, event.currentTarget.value)} />
        </div>
      )
    case DEFAULT_PRESET_ID.TEXT_IMAGE:
      return (
        <div
          id={`${idPrefix}-text-image-fields-${bdc.id}`}
          className={`elce-carousel-text-image-fields elce-carousel-text-image-fields--image-${bdc.card.imagePosition}`}
        >
          <CardMediaEditor bdc={bdc} mediaById={mediaById} actions={actions} idPrefix={idPrefix} imageAspectRatio={imageAspectRatio} allowMultipleMediaFiles={allowMultipleMediaFiles} importMediaFiles={importMediaFiles} />
          {renderShortTextFields(idPrefix, bdc.id, bdc.card, actions)}
        </div>
      )
    default:
      throw new Error(`Représentation de carte inconnue : ${bdc.presetId}`)
  }
}

/** Renders every editable text field while keeping unshown fields in the Card. */
function renderShortTextFields(
  idPrefix: string,
  bdcId: string,
  card: CardContent,
  actions: ElceCardEditorFieldsProps['actions'],
) {
  return (
    <div id={`${idPrefix}-text-fields-${bdcId}`} className="elce-carousel-text-fields">
      <input id={`${idPrefix}-overline-${bdcId}`} placeholder="Surtitre" aria-label="Surtitre" value={card.overline} onChange={(event) => actions.setCardText(bdcId, 'overline', event.currentTarget.value)} />
      <input id={`${idPrefix}-title-${bdcId}`} placeholder="Titre" aria-label="Titre" value={card.title} onChange={(event) => actions.setCardText(bdcId, 'title', event.currentTarget.value)} />
      <input id={`${idPrefix}-description-${bdcId}`} placeholder="Description" aria-label="Description" value={card.description} onChange={(event) => actions.setCardText(bdcId, 'description', event.currentTarget.value)} />
      <textarea id={`${idPrefix}-message-${bdcId}`} placeholder="Message" aria-label="Message" maxLength={CAROUSEL_CONFIG.textShortMessageMaxLength} value={card.message} onChange={(event) => actions.setCardText(bdcId, 'message', event.currentTarget.value)} />
      <input id={`${idPrefix}-note-${bdcId}`} placeholder="Note" aria-label="Note" value={card.note} onChange={(event) => actions.setCardText(bdcId, 'note', event.currentTarget.value)} />
      <small id={`${idPrefix}-message-count-${bdcId}`}>{card.message.length} / {CAROUSEL_CONFIG.textShortMessageMaxLength}</small>
    </div>
  )
}

type CardMediaEditorProps = Readonly<{
  readonly bdc: Bdc
  readonly mediaById: ElceCardEditorFieldsProps['mediaById']
  readonly actions: ElceCardEditorFieldsProps['actions']
  readonly idPrefix: string
  readonly imageAspectRatio: ElceCardEditorFieldsProps['imageAspectRatio']
  readonly allowMultipleMediaFiles: boolean
  readonly importMediaFiles: ElceCardEditorFieldsProps['importMediaFiles']
}>

/** Edits one reusable Card media reference and imports files through the Card facade. */
function CardMediaEditor({ bdc, mediaById, actions, idPrefix, imageAspectRatio, allowMultipleMediaFiles, importMediaFiles }: CardMediaEditorProps) {
  if (bdc.type !== 'card' || bdc.card == null) return null
  const media = bdc.mediaId === null ? undefined : mediaById[bdc.mediaId]
  const canUseVideo = bdc.presetId === DEFAULT_PRESET_ID.PHOTO
  const hasVideoPreview = media?.type === MEDIA_TYPE.VIDEO && media.source !== null
  const fileTriggerContent = media?.source === null || media === undefined
    ? <><ImagePlus aria-hidden="true" size={18} />{media?.name ?? (canUseVideo ? 'Déposer des images ou vidéos' : 'Déposer des images')}</>
    : media.type === MEDIA_TYPE.IMAGE
      ? <img
          id={`${idPrefix}-media-image-${bdc.id}`}
          className={bdc.card.imageFit === CARD_IMAGE_FIT.CONTAIN
            ? 'elce-carousel-media-drop__preview elce-carousel-media-drop__preview--contain'
            : 'elce-carousel-media-drop__preview'}
          src={media.source}
          alt=""
        />
      : <video id={`${idPrefix}-media-video-${bdc.id}`} className="elce-carousel-media-drop__preview" src={media.source} controls />

  /** Accepts supported files or reusable media references. */
  const acceptsDrop = (event: DragEvent<HTMLDivElement>): boolean => {
    const types = Array.from(event.dataTransfer.types)
    return types.includes('Files') || types.includes(CATALOG_REFERENCE.MIME_TYPE)
  }

  /** Routes selected image files to this Card or to a Carousel batch import. */
  const importFiles = (files: readonly File[]): void => {
    const acceptedFiles = files.filter((file) => acceptsFile(bdc.presetId as CardLayoutId, file))
    if (acceptedFiles.length === 0) return
    if (allowMultipleMediaFiles && acceptedFiles.length > 1 && importMediaFiles !== undefined) {
      importMediaFiles(bdc.id, acceptedFiles)
      return
    }
    actions.importMediaFile(bdc.id, acceptedFiles[0]!)
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

  const multiple = allowMultipleMediaFiles && importMediaFiles !== undefined
  const accepts = canUseVideo ? MEDIA_FILE_ACCEPT.IMAGE_AND_VIDEO : MEDIA_FILE_ACCEPT.IMAGE
  const chooseLabel = canUseVideo ? 'Choisir une ou plusieurs images ou vidéos' : 'Choisir une ou plusieurs images'
  return (
    <div id={`${idPrefix}-media-editor-${bdc.id}`} className="elce-carousel-media-editor">
      <div
        id={`${idPrefix}-media-drop-${bdc.id}`}
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
          id={`${idPrefix}-media-file-${bdc.id}`}
          className="elce-visually-hidden"
          type="file"
          multiple={multiple}
          accept={accepts}
          aria-label={multiple ? chooseLabel : canUseVideo ? 'Choisir une image ou une vidéo' : 'Choisir une image'}
          onChange={(event) => {
            importFiles(Array.from(event.currentTarget.files ?? []))
            event.currentTarget.value = ''
          }}
        />
        {hasVideoPreview
          ? <div id={`${idPrefix}-media-video-wrap-${bdc.id}`} className="elce-carousel-media-drop__video-wrap">
              {fileTriggerContent}
              {bdc.presetId !== DEFAULT_PRESET_ID.PHOTO && <small id={`${idPrefix}-media-hidden-${bdc.id}`}>Vidéo conservée, masquée par cette représentation.</small>}
              <label
                id={`${idPrefix}-media-select-${bdc.id}`}
                className="elce-carousel-media-drop__file-trigger"
                htmlFor={`${idPrefix}-media-file-${bdc.id}`}
                title="Cliquer pour remplacer le média"
              >Remplacer le média</label>
            </div>
          : <label
              id={`${idPrefix}-media-select-${bdc.id}`}
              className="elce-carousel-media-drop__file-trigger"
              htmlFor={`${idPrefix}-media-file-${bdc.id}`}
              title={media === undefined ? 'Cliquer pour choisir un fichier ou le déposer' : 'Cliquer pour remplacer le média'}
            >{fileTriggerContent}</label>}
        {media !== undefined && <button
          id={`${idPrefix}-media-clear-${bdc.id}`}
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
