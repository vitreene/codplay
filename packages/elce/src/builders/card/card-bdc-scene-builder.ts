import type { PersoDoc } from 'codplay/scene/types'
import { CARD_IMAGE_FIT, DEFAULT_PRESET_ID, MEDIA_TYPE } from '../../config/document-config'
import type { CardImageFit, MediaType } from '../../config/document-config-types'
import type { MediaId, PageId, Bdc, BdcId, ElceTextValue } from '../../domain/document/document-types'
import type { AppearanceClassNamesByTarget } from '../scene-style/appearance-class-names.ts'
import { appearanceClassNameForBdc } from '../scene-style/appearance-class-names.ts'
import { appendClassToMarkupElement } from '../scene-style/scene-style-classes'
import { ElceCardPresetBuilder } from './card-preset-builder'
import { plainTextFromValue } from '../../domain/inline-text/inline-text-value'
import { createInlineTextSceneParts, wrapInlineTextSceneParts } from '../inline-text/inline-text-scene'

export interface CardBdcSceneBuildInput {
  readonly pageId: PageId
  readonly containerBdcId: BdcId
  readonly bdc: Bdc
  readonly mediaSources: Readonly<Record<MediaId, string>>
  readonly mediaTypes: Readonly<Record<MediaId, MediaType>>
  readonly photoMediaRoot?: boolean
  readonly appearanceClassNamesByTarget?: AppearanceClassNamesByTarget
}

export interface CardBdcSceneBuild {
  readonly markup: string
  readonly rootClassName: string
  readonly zonePartIds: Readonly<Record<string, string>>
  readonly contentPersos: readonly PersoDoc<string>[]
  readonly mediaPersos: readonly PersoDoc<string>[]
  readonly styleSheet: string
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
    const contentProjection = photoMediaRoot
      ? { markup: layout.markup, persos: [] as readonly PersoDoc<string>[] }
      : createCardContentProjection(bdc, layout, `${pageId}:${bdc.id}`)
    const markup = photoMediaRoot ? createPhotoMediaRootMarkup(rootId, partId) : contentProjection.markup
    const appearanceClassName = appearanceClassNameForBdc(bdc.id, input.appearanceClassNamesByTarget)
    const imagePositionClassName = bdc.presetId === DEFAULT_PRESET_ID.TEXT_IMAGE
      ? `elce-card--image-position-${bdc.card.imagePosition}`
      : ''
    const generatedClassNames = [appearanceClassName, imagePositionClassName].filter(Boolean).join(' ')
    return {
      markup: appendClassToMarkupElement(markup, rootId, generatedClassNames),
      rootClassName: [layout.rootClassName, generatedClassNames].filter(Boolean).join(' '),
      zonePartIds: layout.zonePartIds,
      contentPersos: contentProjection.persos,
      mediaPersos: createCardMediaPersos(input, partId, bdc.card.imageFit),
      styleSheet: '',
    }
  }
}

/** Uses the existing Photo media wrapper as the Capsule view's visual root. */
function createPhotoMediaRootMarkup(rootId: string, partId: string): string {
  return `<div id="${rootId}" class="elce-carousel-photo__media"><!-- data-part="${partId}:root" --><!-- data-part="${partId}:media" --></div>`
}

/** Creates text persos for the fields visible in the selected Card layout. */
type CardTextZone = 'overline' | 'title' | 'description' | 'message' | 'note' | 'caption'

/** Projects the current Card layout and expands rich values into ordered inline targets. */
function createCardContentProjection(
  bdc: Bdc,
  layout: ReturnType<ElceCardPresetBuilder['build']>,
  prefix: string,
): Readonly<{ markup: string; persos: readonly PersoDoc<string>[] }> {
  const card = bdc.card
  if (card == null) throw new Error(`Le bdc Carte ${bdc.id} ne contient pas ses champs.`)
  let markup = layout.markup
  const persos: PersoDoc<string>[] = []
  const addField = (zone: CardTextZone, tag: string, value: ElceTextValue): void => {
    const target = layout.zonePartIds[zone]
    const className = layout.zoneClassNames[zone]
    if (target === undefined || plainTextFromValue(value).length === 0) return
    if (typeof value === 'string') {
      persos.push(...createCardTextPersos(prefix, bdc.id, zone, tag, value, target, className))
      return
    }
    const parts = createInlineTextSceneParts(value, `${prefix}:card:${bdc.id}:${zone}`)
    const wrapper = wrapInlineTextSceneParts(parts, `${prefix}-card-${bdc.id}-${zone}`, tag, className)
    markup = markup.replace(`<!-- data-part="${target}" -->`, wrapper)
    persos.push(...parts.persos)
  }
  switch (bdc.presetId) {
    case DEFAULT_PRESET_ID.TEXT_SHORT:
    case DEFAULT_PRESET_ID.TEXT_IMAGE:
      addField('overline', 'p', card.overline)
      addField('title', 'h2', card.title)
      addField('description', 'p', card.description)
      addField('message', 'p', card.message)
      addField('note', 'footer', card.note)
      return { markup, persos }
    case DEFAULT_PRESET_ID.IMAGE_TITLE:
      addField('title', 'h2', card.title)
      return { markup, persos }
    case DEFAULT_PRESET_ID.PHOTO:
      return { markup, persos }
    case DEFAULT_PRESET_ID.IMAGE_CAPTION:
      addField('caption', 'p', card.caption)
      return { markup, persos }
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
    case DEFAULT_PRESET_ID.IMAGE_TITLE:
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
      sync: 'independent',
      className: 'elce-carousel-media',
      move: { target },
    },
  }
}
