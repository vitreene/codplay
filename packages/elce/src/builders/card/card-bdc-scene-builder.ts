import type { PersoDoc } from 'codplay/scene/types'
import { CARD_IMAGE_FIT, DEFAULT_PRESET_ID, MEDIA_TYPE } from '../../config/document-config'
import type { CardImageFit, MediaType } from '../../config/document-config-types'
import type { MediaId, PageId, Bdc, BdcId } from '../../domain/document/document-types'
import { ElceCardPresetBuilder } from './card-preset-builder'

export interface CardBdcSceneBuildInput {
  readonly pageId: PageId
  readonly containerBdcId: BdcId
  readonly bdc: Bdc
  readonly mediaSources: Readonly<Record<MediaId, string>>
  readonly mediaTypes: Readonly<Record<MediaId, MediaType>>
  readonly photoMediaRoot?: boolean
}

export interface CardBdcSceneBuild {
  readonly markup: string
  readonly rootClassName: string
  readonly zonePartIds: Readonly<Record<string, string>>
  readonly contentPersos: readonly PersoDoc<string>[]
  readonly mediaPersos: readonly PersoDoc<string>[]
}

const cardPresetBuilder = new ElceCardPresetBuilder()

/** Projects one Card BDC's selected layout and data into reusable CodPlay parts. */
export class ElceCardBdcSceneBuilder {
  /** Builds the fixed markup, text persos and compatible media perso for one Card. */
  public build(input: CardBdcSceneBuildInput): CardBdcSceneBuild {
    const { pageId, containerBdcId, bdc } = input
    if (bdc.type !== 'card' || bdc.card == null) throw new Error(`Le bdc ${bdc.id} n’est pas une Carte complète.`)
    const rootId = `${pageId}-${containerBdcId}-card-${bdc.id}`
    const partId = `${pageId}:${containerBdcId}:card:${bdc.id}`
    const layout = cardPresetBuilder.build(bdc.presetId, rootId, partId)
    const photoMediaRoot = input.photoMediaRoot === true && bdc.presetId === DEFAULT_PRESET_ID.PHOTO
    return {
      markup: photoMediaRoot ? createPhotoMediaRootMarkup(rootId, partId) : layout.markup,
      rootClassName: layout.rootClassName,
      zonePartIds: layout.zonePartIds,
      contentPersos: createCardContentPersos(bdc, layout.zonePartIds, layout.zoneClassNames, `${pageId}:${bdc.id}`),
      mediaPersos: createCardMediaPersos(input, partId, bdc.card.imageFit),
    }
  }
}

/** Uses the existing Photo media wrapper as the Capsule view's visual root. */
function createPhotoMediaRootMarkup(rootId: string, partId: string): string {
  return `<div id="${rootId}" class="elce-carousel-photo__media"><!-- data-part="${partId}:root" --><!-- data-part="${partId}:media" --></div>`
}

/** Creates text persos for the fields visible in the selected Card layout. */
function createCardContentPersos(
  bdc: Bdc,
  zonePartIds: Readonly<Record<string, string>>,
  zoneClassNames: Readonly<Record<string, string>>,
  prefix: string,
): readonly PersoDoc<string>[] {
  const card = bdc.card
  if (card == null) throw new Error(`Le bdc Carte ${bdc.id} ne contient pas ses champs.`)
  switch (bdc.presetId) {
    case DEFAULT_PRESET_ID.TEXT_SHORT:
    case DEFAULT_PRESET_ID.TEXT_IMAGE:
      return [
        ...createCardTextPersos(prefix, bdc.id, 'overline', 'p', card.overline, zonePartIds.overline, zoneClassNames.overline),
        ...createCardTextPersos(prefix, bdc.id, 'title', 'h2', card.title, zonePartIds.title, zoneClassNames.title),
        ...createCardTextPersos(prefix, bdc.id, 'description', 'p', card.description, zonePartIds.description, zoneClassNames.description),
        ...createCardTextPersos(prefix, bdc.id, 'message', 'p', card.message, zonePartIds.message, zoneClassNames.message),
        ...createCardTextPersos(prefix, bdc.id, 'note', 'footer', card.note, zonePartIds.note, zoneClassNames.note),
      ]
    case DEFAULT_PRESET_ID.PHOTO:
      return []
    case DEFAULT_PRESET_ID.IMAGE_CAPTION:
      return createCardTextPersos(prefix, bdc.id, 'caption', 'p', card.caption, zonePartIds.caption, zoneClassNames.caption)
    default:
      throw new Error(`Layout de carte non pris en charge : ${bdc.presetId}`)
  }
}

/** Omits an empty optional field or creates its plain-text CodPlay element. */
function createCardTextPersos(
  prefix: string,
  bdcId: BdcId,
  zone: string,
  tag: string,
  content: string,
  target: string | undefined,
  className: string | undefined,
): readonly PersoDoc<string>[] {
  if (content.length === 0) return []
  if (target === undefined) throw new Error(`La zone ${zone} manque à la carte ${bdcId}.`)
  return [{
    id: `${prefix}-card-${bdcId}-${zone}`,
    type: 'tag',
    initial: {
      tag,
      content,
      ...(className === undefined ? {} : { className }),
      move: { target },
    },
  }]
}

/** Creates the compatible image or video perso for one Card media field. */
function createCardMediaPersos(input: CardBdcSceneBuildInput, partId: string, imageFit: CardImageFit): readonly PersoDoc<string>[] {
  const { bdc, mediaSources, mediaTypes } = input
  const mediaId = bdc.card?.mediaId
  if (mediaId == null) return []
  const source = mediaSources[mediaId]
  if (source === undefined) return []
  const type = mediaTypes[mediaId]
  const target = cardMediaPartId(bdc.presetId, partId)
  if (target === null) return []
  switch (type) {
    case MEDIA_TYPE.IMAGE:
      return [createCardImagePerso(bdc.id, mediaId, source, target, imageFit)]
    case MEDIA_TYPE.VIDEO:
      return bdc.presetId === DEFAULT_PRESET_ID.PHOTO
        ? [createCardVideoPerso(bdc.id, mediaId, source, target)]
        : []
    default:
      return []
  }
}

/** Resolves the media part declared by the selected Card layout. */
function cardMediaPartId(layoutId: string, partId: string): string | null {
  switch (layoutId) {
    case DEFAULT_PRESET_ID.PHOTO:
      return `${partId}:media`
    case DEFAULT_PRESET_ID.IMAGE_CAPTION:
    case DEFAULT_PRESET_ID.TEXT_IMAGE:
      return `${partId}:image`
    case DEFAULT_PRESET_ID.TEXT_SHORT:
      return null
    default:
      throw new Error(`Layout de carte non pris en charge : ${layoutId}`)
  }
}

/** Creates the CodPlay image component for a Card layout's media zone. */
function createCardImagePerso(
  bdcId: BdcId,
  mediaId: MediaId,
  source: string,
  target: string,
  imageFit: typeof CARD_IMAGE_FIT[keyof typeof CARD_IMAGE_FIT],
): PersoDoc<string> {
  return {
    id: `card-${bdcId}-media-${mediaId}`,
    type: 'img',
    initial: {
      src: source,
      alt: '',
      className: imageFit === CARD_IMAGE_FIT.CONTAIN
        ? 'elce-carousel-media elce-carousel-media--contain'
        : 'elce-carousel-media',
      move: { target },
    },
  }
}

/** Creates the CodPlay video component for the full-frame Card media zone. */
function createCardVideoPerso(bdcId: BdcId, mediaId: MediaId, source: string, target: string): PersoDoc<string> {
  return {
    id: `card-${bdcId}-media-${mediaId}`,
    type: 'media',
    initial: {
      tag: 'video',
      src: source,
      controls: true,
      media: { style: { display: 'block', width: '100%', height: '100%', objectFit: 'cover' } },
      move: { target },
    },
  }
}
