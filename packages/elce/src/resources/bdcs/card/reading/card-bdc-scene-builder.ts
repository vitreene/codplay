import type { PersoDoc } from 'codplay/scene/types'
import { CARD_IMAGE_FIT } from '../card-config'
import { CARD_PRESET_ID } from '../card-config'
import { MEDIA_TYPE } from '../../../../core/media/media-config'
import type { CardImageFit } from '../card-config'
import type { MediaType } from '../../../../core/media/media-config'
import type { MediaId, PageId, BdcId } from '../../../../core/document/content-document-types'
import type { ResourceBdc } from '../../../document/resource-document-types'
import type { AppearanceClassNamesByTarget } from '../../../../builders/scene-style/appearance-class-names'
import { appearanceClassNameForBdc } from '../../../../builders/scene-style/appearance-class-names'
import { appendClassToMarkupElement } from '../../../../builders/scene-style/scene-style-classes'
import { ElceCardPresetBuilder } from '../../../../core/presets/card-preset-builder'
import type { ElceTextValue } from '../../../document/rich-text-types'
import { authoredTextToPlainText } from '../../../../core/document/rich-text-utils'
import { wrapResourceInlineTextSceneParts, type ResourceInlineTextSceneFeature } from '../../../document/resource-inline-text-feature'

export interface CardBdcSceneBuildInput {
  readonly pageId: PageId
  readonly containerBdcId: BdcId
  readonly bdc: ResourceBdc
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

/** Projects one Card BDC's selected layout and data into reusable CodPlay parts. */
export class ElceCardBdcSceneBuilder {
  private readonly presetBuilder: ElceCardPresetBuilder
  private readonly inlineTextSceneFeature: ResourceInlineTextSceneFeature | undefined

  /** Creates a Card scene builder with its composed preset engine. */
  public constructor(presetBuilder: ElceCardPresetBuilder, inlineTextSceneFeature?: ResourceInlineTextSceneFeature) {
    this.presetBuilder = presetBuilder
    this.inlineTextSceneFeature = inlineTextSceneFeature
  }

  /** Builds the fixed markup, text persos and compatible media perso for one Card. */
  public build(input: CardBdcSceneBuildInput): CardBdcSceneBuild {
    const { pageId, containerBdcId, bdc } = input
    if (bdc.type !== 'card' || bdc.card == null) throw new Error(`Le bdc ${bdc.id} n’est pas une Carte complète.`)
    const rootId = `${pageId}-${containerBdcId}-card-${bdc.id}`
    const partId = `${pageId}:${containerBdcId}:card:${bdc.id}`
    const layout = this.presetBuilder.build(bdc.presetId, rootId, partId)
    const photoMediaRoot = input.photoMediaRoot === true && bdc.presetId === CARD_PRESET_ID.PHOTO
    const contentProjection = photoMediaRoot
      ? { markup: layout.markup, persos: [] as readonly PersoDoc<string>[] }
      : createCardContentProjection(bdc, layout, `${pageId}:${bdc.id}`, this.inlineTextSceneFeature)
    const markup = photoMediaRoot ? createPhotoMediaRootMarkup(rootId, partId) : contentProjection.markup
    const appearanceClassName = appearanceClassNameForBdc(bdc.id, input.appearanceClassNamesByTarget)
    const imagePositionClassName = bdc.presetId === CARD_PRESET_ID.TEXT_IMAGE
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

/** Names the text fields that can be visible in one Card layout. */
type CardTextZone = 'overline' | 'title' | 'description' | 'message' | 'note' | 'caption'

/** Projects one Card layout and expands promoted values into ordered inline targets. */
function createCardContentProjection(
  bdc: ResourceBdc,
  layout: ReturnType<ElceCardPresetBuilder['build']>,
  prefix: string,
  inlineTextSceneFeature: ResourceInlineTextSceneFeature | undefined,
): Readonly<{ markup: string; persos: readonly PersoDoc<string>[] }> {
  const card = bdc.card
  if (card == null) throw new Error(`Le bdc Carte ${bdc.id} ne contient pas ses champs.`)
  let markup = layout.markup
  const persos: PersoDoc<string>[] = []
  const addField = (zone: CardTextZone, tag: string, value: ElceTextValue): void => {
    const target = layout.zonePartIds[zone]
    const className = layout.zoneClassNames[zone]
    if (target === undefined || authoredTextToPlainText(value).trim().length === 0) return
    if (typeof value === 'string') {
      persos.push(...createCardTextPersos(prefix, bdc.id, zone, tag, value, target, className))
      return
    }
    if (inlineTextSceneFeature === undefined) throw new Error(`Le rendu Tiptap de la Carte ${bdc.id} exige une contribution de texte inline.`)
    const parts = inlineTextSceneFeature.build(value, `${prefix}:card:${bdc.id}:${zone}`)
    markup = markup.replace(`<!-- data-part="${target}" -->`, wrapResourceInlineTextSceneParts(parts, `${prefix}-card-${bdc.id}-${zone}`, tag, className))
    persos.push(...parts.persos)
  }
  switch (bdc.presetId) {
    case CARD_PRESET_ID.TEXT_SHORT:
    case CARD_PRESET_ID.TEXT_IMAGE:
      addField('overline', 'p', card.overline)
      addField('title', 'h2', card.title)
      addField('description', 'p', card.description)
      addField('message', 'p', card.message)
      addField('note', 'footer', card.note)
      return { markup, persos }
    case CARD_PRESET_ID.IMAGE_TITLE:
      addField('title', 'h2', card.title)
      return { markup, persos }
    case CARD_PRESET_ID.PHOTO:
      return { markup, persos }
    case CARD_PRESET_ID.IMAGE_CAPTION:
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
      return bdc.presetId === CARD_PRESET_ID.PHOTO
        ? [createCardVideoPerso(bdc.id, mediaId, source, target)]
        : []
    default:
      return []
  }
}

/** Resolves the media part declared by the selected Card layout. */
function cardMediaPartId(layoutId: string, partId: string): string | null {
  switch (layoutId) {
    case CARD_PRESET_ID.PHOTO:
      return `${partId}:media`
    case CARD_PRESET_ID.IMAGE_CAPTION:
    case CARD_PRESET_ID.TEXT_IMAGE:
    case CARD_PRESET_ID.IMAGE_TITLE:
      return `${partId}:image`
    case CARD_PRESET_ID.TEXT_SHORT:
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
