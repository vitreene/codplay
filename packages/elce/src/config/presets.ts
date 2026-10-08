import type { CardPreset } from './card-preset-types'
import { DEFAULT_PRESET_ID } from './document-config'

/** Explicit preset configuration kept ready for a later preset editor. */
export const CARD_PRESETS: Readonly<Record<string, CardPreset>> = {
  [DEFAULT_PRESET_ID.CAROUSEL]: {
    id: DEFAULT_PRESET_ID.CAROUSEL,
    label: 'Carousel',
    rootClassName: 'elce-card elce-card--carousel',
    allowedContent: ['bdc'],
    markupTemplate: `
      <section id="{{rootId}}" class="{{rootClassName}}">
        <!-- data-part="{{partPrefix}}:frame" -->{{content:frame}}
        <nav id="{{rootId}}-navigation" class="elce-carousel__navigation" aria-label="Vues du carousel"><!-- data-part="{{partPrefix}}:navigation" -->{{content:navigation}}</nav>
      </section>
    `,
    zones: [
      { id: 'frame', label: 'Vues', required: true, content: 'bdc' },
      { id: 'navigation', label: 'Navigation', required: true, content: 'bdc' },
    ],
  },
  [DEFAULT_PRESET_ID.SECTION]: {
    id: DEFAULT_PRESET_ID.SECTION,
    label: 'Section',
    rootClassName: 'elce-card elce-card--section',
    allowedContent: ['text', 'bdc'],
    markupTemplate: `
      <section id="{{rootId}}" class="{{rootClassName}}">
        <!-- data-part="{{partPrefix}}:title" -->
        <div id="{{rootId}}-body"><!-- data-part="{{partPrefix}}:body" -->{{content:body}}</div>
      </section>
    `,
    zones: [
      { id: 'title', label: 'Titre', required: false, content: 'text' },
      { id: 'body', label: 'Texte', required: true, content: 'text' },
    ],
  },
  [DEFAULT_PRESET_ID.QUESTION]: {
    id: DEFAULT_PRESET_ID.QUESTION,
    label: 'Question',
    rootClassName: 'elce-card elce-card--question',
    allowedContent: ['text', 'media', 'bdc'],
    markupTemplate: `
      <article id="{{rootId}}" class="{{rootClassName}}">
        {{content:title}}{{content:illustration}}
        <form id="{{rootId}}-form">
          <fieldset id="{{rootId}}-fieldset">
            <!-- data-part="{{partPrefix}}:question" -->
            <div id="{{rootId}}-answers" class="elce-question-answers"><!-- data-part="{{partPrefix}}:answers" --></div>
          </fieldset>
          <!-- data-part="{{partPrefix}}:validation" -->
        </form>
      </article>
    `,
    zones: [
      { id: 'title', label: 'Titre', required: false, content: 'text' },
      { id: 'illustration', label: 'Illustration', required: false, content: 'media' },
      { id: 'question', label: 'Question', required: true, content: 'text' },
      { id: 'answers', label: 'Réponses', required: true, content: 'bdc' },
      { id: 'validation', label: 'Validation', required: true, content: 'bdc' },
    ],
  },
  [DEFAULT_PRESET_ID.EVALUATION_RESULT]: {
    id: DEFAULT_PRESET_ID.EVALUATION_RESULT,
    label: 'Résultat d’évaluation',
    rootClassName: 'elce-card elce-card--evaluation-result',
    allowedContent: ['text', 'bdc'],
    markupTemplate: `
      <article id="{{rootId}}" class="{{rootClassName}}">
        {{content:branch}}
      </article>
    `,
    zones: [
      { id: 'success-message', label: 'Message de réussite', required: false, content: 'text' },
      { id: 'success-action', label: 'Action de réussite', required: false, content: 'bdc' },
      { id: 'failure-message', label: 'Message d’échec', required: false, content: 'text' },
      { id: 'failure-action', label: 'Action d’échec', required: false, content: 'bdc' },
    ],
  },
  [DEFAULT_PRESET_ID.IMAGE_CAPTION]: {
    id: DEFAULT_PRESET_ID.IMAGE_CAPTION,
    label: 'Image avec légende',
    rootClassName: 'elce-card elce-card--image-caption',
    allowedContent: ['text', 'media'],
    markupTemplate: `
      <article id="{{rootId}}" class="{{rootClassName}}">
        <!-- data-part="{{partPrefix}}:root" -->
        <div id="{{rootId}}-image" class="elce-card-image-caption__image"><!-- data-part="{{partPrefix}}:image" --></div>
        <!-- data-part="{{partPrefix}}:caption" -->
      </article>
    `,
    zones: [
      { id: 'image', label: 'Image', required: true, content: 'media' },
      { id: 'caption', label: 'Légende', required: false, content: 'text', className: 'elce-card-image-caption__caption' },
    ],
  },
  [DEFAULT_PRESET_ID.PHOTO]: {
    id: DEFAULT_PRESET_ID.PHOTO,
    label: 'Photo ou vidéo plein cadre',
    rootClassName: 'elce-card elce-card--photo',
    allowedContent: ['media'],
    markupTemplate: `
      <article id="{{rootId}}" class="{{rootClassName}}">
        <!-- data-part="{{partPrefix}}:root" -->
        <div id="{{rootId}}-media" class="elce-carousel-photo__media"><!-- data-part="{{partPrefix}}:media" --></div>
      </article>
    `,
    zones: [{ id: 'media', label: 'Photo ou vidéo', required: true, content: 'media' }],
  },
  [DEFAULT_PRESET_ID.TEXT_SHORT]: {
    id: DEFAULT_PRESET_ID.TEXT_SHORT,
    label: 'Texte court',
    rootClassName: 'elce-card elce-card--text-short',
    allowedContent: ['text'],
    markupTemplate: `
      <article id="{{rootId}}" class="{{rootClassName}}">
        <!-- data-part="{{partPrefix}}:root" -->
        <!-- data-part="{{partPrefix}}:overline" -->
        <!-- data-part="{{partPrefix}}:title" -->
        <!-- data-part="{{partPrefix}}:description" -->
        <!-- data-part="{{partPrefix}}:message" -->
        <!-- data-part="{{partPrefix}}:note" -->
      </article>
    `,
    zones: [
      { id: 'overline', label: 'Surtitre', required: false, content: 'text', className: 'elce-card-text-short__overline' },
      { id: 'title', label: 'Titre', required: false, content: 'text', className: 'elce-card-text-short__title' },
      { id: 'description', label: 'Description', required: false, content: 'text', className: 'elce-card-text-short__description' },
      { id: 'message', label: 'Message', required: false, content: 'text', className: 'elce-card-text-short__message' },
      { id: 'note', label: 'Note', required: false, content: 'text', className: 'elce-card-text-short__note' },
    ],
  },
  [DEFAULT_PRESET_ID.TEXT_IMAGE]: {
    id: DEFAULT_PRESET_ID.TEXT_IMAGE,
    label: 'Texte avec image',
    rootClassName: 'elce-card elce-card--text-image',
    allowedContent: ['text', 'media'],
    markupTemplate: `
      <article id="{{rootId}}" class="{{rootClassName}}">
        <!-- data-part="{{partPrefix}}:root" -->
        <div id="{{rootId}}-image" class="elce-carousel-text-image__image"><!-- data-part="{{partPrefix}}:image" --></div>
        <div id="{{rootId}}-content" class="elce-carousel-text-image__content"><!-- data-part="{{partPrefix}}:content" -->
          <!-- data-part="{{partPrefix}}:overline" -->
          <!-- data-part="{{partPrefix}}:title" -->
          <!-- data-part="{{partPrefix}}:description" -->
          <!-- data-part="{{partPrefix}}:message" -->
          <!-- data-part="{{partPrefix}}:note" -->
        </div>
      </article>
    `,
    zones: [
      { id: 'image', label: 'Image', required: true, content: 'media' },
      { id: 'overline', label: 'Surtitre', required: false, content: 'text', className: 'elce-card-text-image__overline' },
      { id: 'title', label: 'Titre', required: false, content: 'text', className: 'elce-card-text-image__title' },
      { id: 'description', label: 'Description', required: false, content: 'text', className: 'elce-card-text-image__description' },
      { id: 'message', label: 'Message', required: false, content: 'text', className: 'elce-card-text-image__message' },
      { id: 'note', label: 'Note', required: false, content: 'text', className: 'elce-card-text-image__note' },
    ],
  },
} as const
