import { ImagePlus, X } from 'lucide-static'
import { on, type RemixNode } from 'remix/ui'
import type { MediaMetadata } from '../../../domain/document/document-types'
import type { SupportedMediaType } from '../../../domain/media/media-resource-service'
import { CATALOG_REFERENCE } from '../../../config/document-config'
import { renderLucideIcon } from '../../remix/lucide-static-icon'

export interface RemixMediaPickerProps {
  readonly idPrefix: string
  readonly idKey?: string
  readonly className: string
  readonly accept: string
  readonly ariaLabel: string
  readonly promptLabel: string
  readonly emptyHint: string
  readonly removeLabel: string
  readonly media: MediaMetadata | null
  readonly mediaType: SupportedMediaType | null
  readonly mediaSource: string | null
  readonly onImport: (file: File) => void
  readonly onClear: () => void
  readonly onCatalogReference: (reference: string) => void
}

/** Renders the shared file, catalogue, preview and removal interface for media. */
export function renderRemixMediaPicker(props: RemixMediaPickerProps): RemixNode {
  /** Builds stable element identifiers for shared media picker instances. */
  const id = (part: string): string => [props.idPrefix, part, props.idKey].filter(Boolean).join('-')
  const rootId = id('illustration')
  return <label
    id={rootId}
    className={`elce-media-picker ${props.className}`}
    mix={[
      on<HTMLLabelElement, 'dragover'>('dragover', acceptMediaDrag),
      on<HTMLLabelElement, 'drop'>('drop', (event) => dropMedia(event, props.onImport, props.onCatalogReference)),
    ]}
  >
    <input
      id={id('illustration-file')}
      className="elce-visually-hidden"
      type="file"
      accept={props.accept}
      aria-label={props.ariaLabel}
      mix={on<HTMLInputElement, 'change'>('change', (event) => {
        const file = event.currentTarget.files?.[0]
        if (file !== undefined) props.onImport(file)
        event.currentTarget.value = ''
      })}
    />
    {props.media !== null && props.mediaSource !== null
      ? props.mediaType === 'image'
        ? <img
          id={id('media-image')}
          src={props.mediaSource}
          alt=""
        />
        : <video
          id={id('media-video')}
          src={props.mediaSource}
          controls={true}
        />
      : <span
        id={id('illustration-prompt')}
        className="elce-media-add-prompt"
      >
        {renderLucideIcon(ImagePlus, id('illustration-icon'))}
        <span
          id={id('illustration-label')}
          className="elce-media-add-prompt__label"
        >
          {props.promptLabel}
        </span>
        <span
          id={id('illustration-hint')}
          className="elce-media-add-prompt__hint"
        >
          {props.media?.name ?? props.emptyHint}
        </span>
      </span>}
    {props.media === null
      ? null
      : <button
        id={id('media-clear')}
        className="elce-bdc-icon-button elce-media-picker__clear"
        type="button"
        aria-label={props.removeLabel}
        title={props.removeLabel}
        mix={on<HTMLButtonElement, 'click'>('click', (event) => {
          event.preventDefault()
          props.onClear()
        })}
      >
        {renderLucideIcon(X, id('media-clear-icon'))}
      </button>}
  </label>
}

/** Enables file and catalogue drops while showing a copy affordance. */
function acceptMediaDrag(event: DragEvent): void {
  const transfer = event.dataTransfer
  if (transfer === null) return
  const types = Array.from(transfer.types)
  if (types.includes('Files') || types.includes(CATALOG_REFERENCE.MIME_TYPE)) {
    event.preventDefault()
    transfer.dropEffect = 'copy'
  }
}

/** Routes a dropped file or catalogue reference to the owning media target. */
function dropMedia(
  event: DragEvent,
  onImport: RemixMediaPickerProps['onImport'],
  onCatalogReference: RemixMediaPickerProps['onCatalogReference'],
): void {
  const transfer = event.dataTransfer
  if (transfer === null) return
  const file = transfer.files[0]
  if (file !== undefined) {
    event.preventDefault()
    event.stopPropagation()
    onImport(file)
    return
  }
  const reference = transfer.getData(CATALOG_REFERENCE.MIME_TYPE)
  if (reference.length === 0) return
  event.preventDefault()
  event.stopPropagation()
  onCatalogReference(reference)
}
