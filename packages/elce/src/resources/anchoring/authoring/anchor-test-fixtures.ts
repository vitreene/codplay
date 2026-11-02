import { ElceCardPresetBuilder } from '../../../core/presets/card-preset-builder'
import type { CardPreset } from '../../../core/presets/card-preset-types'
import { CARD_PRESET_ID } from '../../bdcs/card/card-config'

const anchorTestPresets: Readonly<Record<string, CardPreset>> = {
  [CARD_PRESET_ID.PHOTO]: {
    id: CARD_PRESET_ID.PHOTO,
    label: 'Photo test',
    rootClassName: 'elce-card elce-card--photo',
    allowedContent: ['media'],
    markupTemplate: '<article id="{{rootId}}" class="{{rootClassName}}"><div id="{{rootId}}-media" class="elce-carousel-photo__media"><!-- data-part="{{partPrefix}}:media" --></div></article>',
    zones: [{ id: 'media', label: 'Media', required: true, content: 'media' }],
  },
  [CARD_PRESET_ID.TEXT_SHORT]: {
    id: CARD_PRESET_ID.TEXT_SHORT,
    label: 'Short text test',
    rootClassName: 'elce-card elce-card--text-short',
    allowedContent: ['text'],
    markupTemplate: '<article id="{{rootId}}" class="{{rootClassName}}"><!-- data-part="{{partPrefix}}:overline" --><!-- data-part="{{partPrefix}}:title" --><!-- data-part="{{partPrefix}}:description" --><!-- data-part="{{partPrefix}}:message" --><!-- data-part="{{partPrefix}}:note" --></article>',
    zones: [
      { id: 'overline', label: 'Overline', required: false, content: 'text', className: 'elce-card__meta elce-card__overline' },
      { id: 'title', label: 'Title', required: false, content: 'text', className: 'elce-card__title' },
      { id: 'description', label: 'Description', required: false, content: 'text', className: 'elce-card__description' },
      { id: 'message', label: 'Message', required: false, content: 'text', className: 'elce-card__message' },
      { id: 'note', label: 'Note', required: false, content: 'text', className: 'elce-card__meta' },
    ],
  },
  [CARD_PRESET_ID.TEXT_IMAGE]: {
    id: CARD_PRESET_ID.TEXT_IMAGE,
    label: 'Text with image test',
    rootClassName: 'elce-card elce-card--text-image',
    allowedContent: ['text', 'media'],
    markupTemplate: '<article id="{{rootId}}" class="{{rootClassName}}"><div id="{{rootId}}-content" class="elce-carousel-text-image__content"><!-- data-part="{{partPrefix}}:overline" --><!-- data-part="{{partPrefix}}:title" --><!-- data-part="{{partPrefix}}:description" --><div id="{{rootId}}-image" class="elce-carousel-text-image__image"><!-- data-part="{{partPrefix}}:image" --></div><!-- data-part="{{partPrefix}}:message" --><!-- data-part="{{partPrefix}}:note" --></div></article>',
    zones: [
      { id: 'overline', label: 'Overline', required: false, content: 'text', className: 'elce-card__meta elce-card__overline' },
      { id: 'title', label: 'Title', required: false, content: 'text', className: 'elce-card__title' },
      { id: 'description', label: 'Description', required: false, content: 'text', className: 'elce-card__description' },
      { id: 'image', label: 'Image', required: true, content: 'media' },
      { id: 'message', label: 'Message', required: false, content: 'text', className: 'elce-card__message' },
      { id: 'note', label: 'Note', required: false, content: 'text', className: 'elce-card__meta' },
    ],
  },
  [CARD_PRESET_ID.IMAGE_CAPTION]: {
    id: CARD_PRESET_ID.IMAGE_CAPTION,
    label: 'Image caption test',
    rootClassName: 'elce-card elce-card--image-caption',
    allowedContent: ['text', 'media'],
    markupTemplate: '<article id="{{rootId}}" class="{{rootClassName}}"><div id="{{rootId}}-image" class="elce-card-image-caption__image"><!-- data-part="{{partPrefix}}:image" --></div><!-- data-part="{{partPrefix}}:caption" --></article>',
    zones: [
      { id: 'image', label: 'Image', required: true, content: 'media' },
      { id: 'caption', label: 'Caption', required: false, content: 'text', className: 'elce-card__caption' },
    ],
  },
  [CARD_PRESET_ID.IMAGE_TITLE]: {
    id: CARD_PRESET_ID.IMAGE_TITLE,
    label: 'Image title test',
    rootClassName: 'elce-card elce-card--image-title',
    allowedContent: ['text', 'media'],
    markupTemplate: '<article id="{{rootId}}" class="{{rootClassName}}"><div id="{{rootId}}-image" class="elce-card__image"><!-- data-part="{{partPrefix}}:image" --></div><!-- data-part="{{partPrefix}}:title" --></article>',
    zones: [
      { id: 'image', label: 'Image', required: false, content: 'media' },
      { id: 'title', label: 'Title', required: false, content: 'text', className: 'elce-card__title' },
    ],
  },
}

/** Creates a test-owned preset registry for anchor rendering cases. */
export function createAnchorTestPresetBuilder(): ElceCardPresetBuilder {
  return new ElceCardPresetBuilder(anchorTestPresets)
}
