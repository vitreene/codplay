import { ImagePlus, X } from 'lucide-static'
import { on, type Handle, type RemixNode } from 'remix/ui'

import {
  BDC_TYPE,
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
import type { CardLayoutId, MediaType } from '../../../config/document-config-types'
import type { CardContent, CardTextField } from '../../../domain/card/card-types'
import type { Bdc, BdcId } from '../../../domain/document/document-types'
import type { ElceCardEditorActions } from '../../facades/card/card-facade-types'
import { cardLayoutAcceptsFile, cardLayoutAcceptsMedia, cardToolbarClassName, parseCardMediaReference } from './card-editor-rules'
import { renderLucideIcon } from '../../remix/lucide-static-icon'

export interface RemixCardEditorFieldsProps {
  readonly bdc: Bdc
  readonly mediaById: Readonly<Record<string, Readonly<{ name: string; type: MediaType; source: string | null }>>>
  readonly actions: ElceCardEditorActions
  readonly idPrefix: string
  readonly imageAspectRatio: Readonly<{ width: number; height: number }> | null
  readonly allowMultipleMediaFiles?: boolean
  readonly importMediaFiles?: (bdcId: BdcId, files: readonly File[]) => void
  readonly toolbarContent?: RemixNode
  readonly toolbarEnd?: RemixNode
}

/** Renders the shared Card fields in the Remix runtime. */
export function RemixCardEditorFields(handle: Handle<RemixCardEditorFieldsProps>) {
  return () => {
    const { bdc, mediaById, actions, idPrefix, imageAspectRatio, allowMultipleMediaFiles, importMediaFiles, toolbarContent, toolbarEnd } = handle.props
    switch (bdc.type) {
      case BDC_TYPE.CARD:
        switch (bdc.card) {
          case null:
          case undefined:
            return null
          default:
            return renderCardFields(
              bdc.id,
              bdc.presetId,
              bdc.card,
              mediaById,
              actions,
              idPrefix,
              imageAspectRatio,
              allowMultipleMediaFiles === true,
              importMediaFiles,
              toolbarContent,
              toolbarEnd,
            )
        }
      default:
        return null
    }
  }
}

/** Builds toolbar and content for the current Card preset. */
function renderCardFields(
  bdcId: BdcId,
  presetId: string,
  card: CardContent,
  mediaById: RemixCardEditorFieldsProps['mediaById'],
  actions: ElceCardEditorActions,
  idPrefix: string,
  imageAspectRatio: RemixCardEditorFieldsProps['imageAspectRatio'],
  allowMultipleMediaFiles: boolean,
  importMediaFiles: RemixCardEditorFieldsProps['importMediaFiles'],
  toolbarContent: RemixCardEditorFieldsProps['toolbarContent'],
  toolbarEnd: RemixCardEditorFieldsProps['toolbarEnd'],
): RemixNode {
  return <div
    id={`${idPrefix}-card-fields-${bdcId}`}
  >
    <div
      id={`${idPrefix}-card-toolbar-${bdcId}`}
      className={cardToolbarClassName(presetId)}
    >
      {[
        renderCardLayoutSelect(bdcId, presetId, actions, idPrefix),
        toolbarContent,
        ...renderCardPresentationSettings(bdcId, presetId, card, mediaById, actions, idPrefix),
        toolbarEnd,
      ]}
    </div>
    {renderCardContent(bdcId, presetId, card, mediaById, actions, idPrefix, imageAspectRatio, allowMultipleMediaFiles, importMediaFiles)}
  </div>
}

/** Renders the layout selector for one identified Card BDC. */
function renderCardLayoutSelect(bdcId: BdcId, presetId: string, actions: ElceCardEditorActions, idPrefix: string): RemixNode {
  return <label
    id={`${idPrefix}-card-layout-label-${bdcId}`}
    className="elce-carousel-editor__setting elce-carousel-editor__setting--card-layout"
  >
    <span
      id={`${idPrefix}-card-layout-caption-${bdcId}`}
    >
      Représentation
    </span>
    <select
      id={`${idPrefix}-card-layout-${bdcId}`}
      aria-label="Représentation de cette carte"
      mix={on<HTMLSelectElement, 'change'>('change', (event) => actions.setCardLayout(bdcId, event.currentTarget.value as CardLayoutId))}
    >
      {CARD_LAYOUT_OPTIONS.map((option) => <option
        id={`${idPrefix}-card-layout-option-${bdcId}-${option.value}`}
        key={option.value}
        value={option.value}
        selected={option.value === presetId}
      >
        {option.label}
      </option>)}
    </select>
  </label>
}

/** Renders image fit and placement settings supported by the active layout. */
function renderCardPresentationSettings(
  bdcId: BdcId,
  presetId: string,
  card: CardContent,
  mediaById: RemixCardEditorFieldsProps['mediaById'],
  actions: ElceCardEditorActions,
  idPrefix: string,
): RemixNode[] {
  const media = card.mediaId === null ? undefined : mediaById[card.mediaId]
  switch (media?.type) {
    case MEDIA_TYPE.VIDEO:
      switch (presetId) {
        case DEFAULT_PRESET_ID.TEXT_IMAGE:
          return [renderImagePositionSetting(bdcId, card, actions, idPrefix)]
        default:
          return []
      }
    default:
      switch (presetId) {
        case DEFAULT_PRESET_ID.PHOTO:
        case DEFAULT_PRESET_ID.IMAGE_CAPTION:
          return [renderImageFitSetting(bdcId, card, actions, idPrefix)]
        case DEFAULT_PRESET_ID.TEXT_IMAGE:
          return [
            renderImageFitSetting(bdcId, card, actions, idPrefix),
            renderImagePositionSetting(bdcId, card, actions, idPrefix),
          ]
        default:
          return []
      }
  }
}

/** Renders the image-fit control shared by image layouts. */
function renderImageFitSetting(bdcId: BdcId, card: CardContent, actions: ElceCardEditorActions, idPrefix: string): RemixNode {
  return <label
    id={`${idPrefix}-image-fit-label-${bdcId}`}
    className="elce-carousel-editor__setting elce-carousel-editor__setting--image-fit"
  >
    <span
      id={`${idPrefix}-image-fit-caption-${bdcId}`}
    >
      Ajustement de l’image
    </span>
    <select
      id={`${idPrefix}-image-fit-${bdcId}`}
      aria-label="Ajustement de l’image"
      mix={on<HTMLSelectElement, 'change'>('change', (event) => actions.setImageFit(bdcId, event.currentTarget.value as typeof card.imageFit))}
    >
      {CARD_IMAGE_FIT_OPTIONS.map((option) => <option
        id={`${idPrefix}-image-fit-option-${bdcId}-${option.value}`}
        key={option.value}
        value={option.value}
        selected={option.value === card.imageFit}
      >
        {option.label}
      </option>)}
    </select>
  </label>
}

/** Renders the image-position control used by the Text with image layout. */
function renderImagePositionSetting(bdcId: BdcId, card: CardContent, actions: ElceCardEditorActions, idPrefix: string): RemixNode {
  return <label
    id={`${idPrefix}-image-position-label-${bdcId}`}
    className="elce-carousel-editor__setting elce-carousel-editor__setting--image-position"
  >
    <span
      id={`${idPrefix}-image-position-caption-${bdcId}`}
    >
      Position de l’image
    </span>
    <select
      id={`${idPrefix}-image-position-${bdcId}`}
      aria-label="Position de l’image"
      mix={on<HTMLSelectElement, 'change'>('change', (event) => actions.setImagePosition(bdcId, event.currentTarget.value as typeof card.imagePosition))}
    >
      {CAROUSEL_IMAGE_POSITION_OPTIONS.map((option) => <option
        id={`${idPrefix}-image-position-option-${bdcId}-${option.value}`}
        key={option.value}
        value={option.value}
        selected={option.value === card.imagePosition}
      >
        {option.label}
      </option>)}
    </select>
  </label>
}

/** Renders fields selected by the active Card layout without dropping hidden data. */
function renderCardContent(
  bdcId: BdcId,
  presetId: string,
  card: CardContent,
  mediaById: RemixCardEditorFieldsProps['mediaById'],
  actions: ElceCardEditorActions,
  idPrefix: string,
  imageAspectRatio: RemixCardEditorFieldsProps['imageAspectRatio'],
  allowMultipleMediaFiles: boolean,
  importMediaFiles: RemixCardEditorFieldsProps['importMediaFiles'],
): RemixNode {
  switch (presetId) {
    case DEFAULT_PRESET_ID.TEXT_SHORT:
      return renderShortTextFields(bdcId, card, actions, idPrefix)
    case DEFAULT_PRESET_ID.PHOTO:
      return renderCardMediaEditor(bdcId, presetId, card, mediaById, actions, idPrefix, imageAspectRatio, allowMultipleMediaFiles, importMediaFiles)
    case DEFAULT_PRESET_ID.IMAGE_CAPTION:
      return <div
        id={`${idPrefix}-image-caption-fields-${bdcId}`}
        className="elce-carousel-image-caption-fields"
      >
        {renderCardMediaEditor(bdcId, presetId, card, mediaById, actions, idPrefix, imageAspectRatio, allowMultipleMediaFiles, importMediaFiles)}
        <input
          id={`${idPrefix}-caption-${bdcId}`}
          placeholder="Légende facultative"
          aria-label="Légende"
          value={card.caption}
          mix={on<HTMLInputElement, 'input'>('input', (event) => actions.setCaption(bdcId, event.currentTarget.value))}
        />
      </div>
    case DEFAULT_PRESET_ID.TEXT_IMAGE:
      return <div
        id={`${idPrefix}-text-image-fields-${bdcId}`}
        className={`elce-carousel-text-image-fields elce-carousel-text-image-fields--image-${card.imagePosition}`}
      >
        {renderCardMediaEditor(bdcId, presetId, card, mediaById, actions, idPrefix, imageAspectRatio, allowMultipleMediaFiles, importMediaFiles)}
        {renderShortTextFields(bdcId, card, actions, idPrefix)}
      </div>
    default:
      throw new Error(`Représentation de carte inconnue : ${presetId}`)
  }
}

/** Renders every text field of a short-text Card. */
function renderShortTextFields(bdcId: BdcId, card: CardContent, actions: ElceCardEditorActions, idPrefix: string): RemixNode {
  const fields: readonly Readonly<{ field: CardTextField; label: string }>[] = [
    { field: 'overline', label: 'Surtitre' },
    { field: 'title', label: 'Titre' },
    { field: 'description', label: 'Description' },
    { field: 'message', label: 'Message' },
    { field: 'note', label: 'Note' },
  ]
  return <div
    id={`${idPrefix}-text-fields-${bdcId}`}
    className="elce-carousel-text-fields"
  >
    {[
      ...fields.map(({ field, label }) => field === 'message'
        ? <textarea
          key={field}
          id={`${idPrefix}-${field}-${bdcId}`}
          placeholder={label}
          aria-label={label}
          maxLength={CAROUSEL_CONFIG.textShortMessageMaxLength}
          value={card[field]}
          mix={on<HTMLTextAreaElement, 'input'>('input', (event) => actions.setCardText(bdcId, field, event.currentTarget.value))}
        />
        : <input
          key={field}
          id={`${idPrefix}-${field}-${bdcId}`}
          placeholder={label}
          aria-label={label}
          value={card[field]}
          mix={on<HTMLInputElement, 'input'>('input', (event) => actions.setCardText(bdcId, field, event.currentTarget.value))}
        />),
      <small
        id={`${idPrefix}-message-count-${bdcId}`}
      >
        {`${card.message.length} / ${CAROUSEL_CONFIG.textShortMessageMaxLength}`}
      </small>,
    ]}
  </div>
}

/** Renders the media selector, native file input, preview and catalogue drop target. */
function renderCardMediaEditor(
  bdcId: BdcId,
  presetId: string,
  card: CardContent,
  mediaById: RemixCardEditorFieldsProps['mediaById'],
  actions: ElceCardEditorActions,
  idPrefix: string,
  imageAspectRatio: RemixCardEditorFieldsProps['imageAspectRatio'],
  allowMultipleMediaFiles: boolean,
  importMediaFiles: RemixCardEditorFieldsProps['importMediaFiles'],
): RemixNode {
  const media = card.mediaId === null ? undefined : mediaById[card.mediaId]
  const canUseVideo = presetId === DEFAULT_PRESET_ID.PHOTO
  const multiple = allowMultipleMediaFiles && importMediaFiles !== undefined
  const acceptedTypes = canUseVideo ? MEDIA_FILE_ACCEPT.IMAGE_AND_VIDEO : MEDIA_FILE_ACCEPT.IMAGE
  const pickerLabel = canUseVideo ? 'Choisir une ou plusieurs images ou vidéos' : 'Choisir une ou plusieurs images'
  const isVideoPreview = media?.type === MEDIA_TYPE.VIDEO && media.source !== null
  const fileTriggerContent = renderFileTriggerContent(bdcId, card, media, canUseVideo, idPrefix)

  /** Imports only media accepted by the active layout through its Card actions. */
  const importFiles = (files: readonly File[]): void => {
    const acceptedFiles = files.filter((file) => cardLayoutAcceptsFile(presetId as CardLayoutId, file))
    switch (acceptedFiles.length) {
      case 0:
        return
      default:
        switch (multiple && acceptedFiles.length > 1) {
          case true:
            switch (importMediaFiles) {
              case undefined:
                actions.importMediaFile(bdcId, acceptedFiles[0]!)
                return
              default:
                importMediaFiles(bdcId, acceptedFiles)
                return
            }
          default:
            actions.importMediaFile(bdcId, acceptedFiles[0]!)
        }
    }
  }

  /** Routes a native file or catalogue media drop through existing Card actions. */
  const handleDrop = (event: DragEvent): void => {
    switch (event.dataTransfer) {
      case null:
        return
      default: {
        const files = Array.from(event.dataTransfer.files)
        switch (files.length) {
          case 0: {
            const reference = parseCardMediaReference(event.dataTransfer.getData(CATALOG_REFERENCE.MIME_TYPE))
            switch (reference?.kind) {
              case CATALOG_REFERENCE.MEDIA:
                switch (cardLayoutAcceptsMedia(presetId as CardLayoutId, mediaById[reference.mediaId]?.type)) {
                  case true:
                    event.preventDefault()
                    actions.attachCatalogReference(bdcId, reference)
                    return
                  default:
                    event.preventDefault()
                    return
                }
              default:
                return
            }
          }
          default:
            event.preventDefault()
            importFiles(files)
        }
      }
    }
  }

  return <div
    id={`${idPrefix}-media-editor-${bdcId}`}
    className="elce-carousel-media-editor"
  >
    <div
      id={`${idPrefix}-media-drop-${bdcId}`}
      className={imageAspectRatio === null
        ? 'elce-carousel-media-drop'
        : 'elce-carousel-media-drop elce-carousel-media-drop--proportional'}
      style={imageAspectRatio === null ? undefined : { aspectRatio: `${imageAspectRatio.width} / ${imageAspectRatio.height}` }}
      mix={[
        on<HTMLDivElement, 'dragover'>('dragover', (event) => {
          switch (event.dataTransfer) {
            case null:
              return
            default:
              {
                const types = Array.from(event.dataTransfer.types)
                switch (types.includes('Files') || types.includes(CATALOG_REFERENCE.MIME_TYPE)) {
                  case true:
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'copy'
                    return
                  default:
                    return
                }
              }
          }
        }),
        on<HTMLDivElement, 'drop'>('drop', handleDrop),
      ]}
    >
      <input
        id={`${idPrefix}-media-file-${bdcId}`}
        className="elce-visually-hidden"
        type="file"
        multiple={multiple}
        accept={acceptedTypes}
        aria-label={multiple ? pickerLabel : canUseVideo ? 'Choisir une image ou une vidéo' : 'Choisir une image'}
        mix={on<HTMLInputElement, 'change'>('change', (event) => {
          importFiles(Array.from(event.currentTarget.files ?? []))
          event.currentTarget.value = ''
        })}
      />
      {isVideoPreview
        ? <div
          id={`${idPrefix}-media-video-wrap-${bdcId}`}
          className="elce-carousel-media-drop__video-wrap"
        >
          {fileTriggerContent}
          {presetId === DEFAULT_PRESET_ID.PHOTO
            ? null
            : <small
              id={`${idPrefix}-media-hidden-${bdcId}`}
            >
              Vidéo conservée, masquée par cette représentation.
            </small>}
          <label
            id={`${idPrefix}-media-select-${bdcId}`}
            className="elce-carousel-media-drop__file-trigger"
            htmlFor={`${idPrefix}-media-file-${bdcId}`}
            title="Cliquer pour remplacer le média"
          >
            Remplacer le média
          </label>
        </div>
        : <label
          id={`${idPrefix}-media-select-${bdcId}`}
          className="elce-carousel-media-drop__file-trigger"
          htmlFor={`${idPrefix}-media-file-${bdcId}`}
          title={media === undefined ? 'Cliquer pour choisir un fichier ou le déposer' : 'Cliquer pour remplacer le média'}
        >
          {fileTriggerContent}
        </label>}
      {media === undefined
        ? null
        : <button
          id={`${idPrefix}-media-clear-${bdcId}`}
          className="elce-carousel-editor__media-clear"
          type="button"
          aria-label="Retirer le média de cette carte"
          title="Retirer le média"
          mix={on<HTMLButtonElement, 'click'>('click', () => actions.clearMedia(bdcId))}
        >
          {renderLucideIcon(X, `${idPrefix}-media-clear-icon-${bdcId}`, 15)}
        </button>}
    </div>
  </div>
}

/** Renders a preview or the icon and prompt inside a native file-input label. */
function renderFileTriggerContent(
  bdcId: BdcId,
  card: CardContent,
  media: RemixCardEditorFieldsProps['mediaById'][string] | undefined,
  canUseVideo: boolean,
  idPrefix: string,
): RemixNode {
  switch (media) {
    case undefined:
      return [
        renderLucideIcon(ImagePlus, `${idPrefix}-media-add-icon-${bdcId}`, 18),
        canUseVideo ? 'Déposer des images ou vidéos' : 'Déposer des images',
      ]
    default:
      switch (media.source) {
        case null:
          return [
            renderLucideIcon(ImagePlus, `${idPrefix}-media-add-icon-${bdcId}`, 18),
            media.name,
          ]
        default:
          switch (media.type) {
            case MEDIA_TYPE.IMAGE:
              return <img
                id={`${idPrefix}-media-image-${bdcId}`}
                className={card.imageFit === CARD_IMAGE_FIT.CONTAIN
                  ? 'elce-carousel-media-drop__preview elce-carousel-media-drop__preview--contain'
                  : 'elce-carousel-media-drop__preview'}
                src={media.source}
                alt=""
              />
            default:
              return <video
                id={`${idPrefix}-media-video-${bdcId}`}
                className="elce-carousel-media-drop__preview"
                src={media.source}
                controls={true}
              />
          }
      }
  }
}
