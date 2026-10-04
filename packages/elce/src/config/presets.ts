import type { CardPreset } from './card-preset-types'
import { DEFAULT_PRESET_ID, EVALUATION_RESULT_BRANCH, EVALUATION_RESULT_CONFIG } from './document-config'

/** Explicit preset configuration kept ready for a later preset editor. */
export const CARD_PRESETS: Readonly<Record<string, CardPreset>> = {
  [DEFAULT_PRESET_ID.CAROUSEL]: {
    id: DEFAULT_PRESET_ID.CAROUSEL,
    label: 'Carousel',
    allowedContent: ['bdc'],
    markupTemplate: `
      <section id="{{rootId}}" class="elce-card elce-card--carousel" data-part="{{partPrefix}}:root">
        <div id="{{rootId}}-frame" class="elce-carousel__frame" data-part="{{partPrefix}}:frame">{{content:frame}}</div>
        <nav id="{{rootId}}-navigation" class="elce-carousel__navigation" data-part="{{partPrefix}}:navigation" aria-label="Vues du carousel">{{content:navigation}}</nav>
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
    allowedContent: ['text', 'bdc'],
    markupTemplate: `
      <section id="{{rootId}}" class="elce-card elce-card--section" data-part="{{partPrefix}}:root">
        <div id="{{rootId}}-title-host" data-part="{{partPrefix}}:title"></div>
        <div id="{{rootId}}-body" data-part="{{partPrefix}}:body">{{content:body}}</div>
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
    allowedContent: ['text', 'media', 'bdc'],
    markupTemplate: `
      <article id="{{rootId}}" class="elce-card elce-card--question" data-part="{{partPrefix}}:root">
        <header id="{{rootId}}-title-host" data-part="{{partPrefix}}:title"></header>
        <div id="{{rootId}}-illustration" data-part="{{partPrefix}}:illustration"></div>
        <form id="{{rootId}}-form">
          <fieldset id="{{rootId}}-fieldset">
            <legend id="{{rootId}}-question" data-part="{{partPrefix}}:question"></legend>
            <div id="{{rootId}}-answers" data-part="{{partPrefix}}:answers"></div>
          </fieldset>
          <div id="{{rootId}}-validation" data-part="{{partPrefix}}:validation"></div>
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
    allowedContent: ['text', 'bdc'],
    markupTemplate: `
      <article id="{{rootId}}" class="elce-card elce-card--evaluation-result" data-part="{{partPrefix}}:root">
        <section id="{{rootId}}-success" class="elce-evaluation-result__branch elce-evaluation-result__branch--success" data-part="{{partPrefix}}:success">
          <h2 id="{{rootId}}-success-title">${EVALUATION_RESULT_CONFIG[EVALUATION_RESULT_BRANCH.SUCCESS].label}</h2>
          <p id="{{rootId}}-success-message" data-part="{{partPrefix}}:success-message"></p>
          <div id="{{rootId}}-success-action" data-part="{{partPrefix}}:success-action"></div>
        </section>
        <section id="{{rootId}}-failure" class="elce-evaluation-result__branch elce-evaluation-result__branch--failure" data-part="{{partPrefix}}:failure">
          <h2 id="{{rootId}}-failure-title">${EVALUATION_RESULT_CONFIG[EVALUATION_RESULT_BRANCH.FAILURE].label}</h2>
          <p id="{{rootId}}-failure-message" data-part="{{partPrefix}}:failure-message"></p>
          <div id="{{rootId}}-failure-action" data-part="{{partPrefix}}:failure-action"></div>
        </section>
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
    allowedContent: ['text', 'media'],
    markupTemplate: `
      <article id="{{rootId}}" class="elce-card elce-card--image-caption" data-part="{{partPrefix}}:root">
        <div id="{{rootId}}-image" data-part="{{partPrefix}}:image"></div>
        <p id="{{rootId}}-caption" data-part="{{partPrefix}}:caption"></p>
      </article>
    `,
    zones: [
      { id: 'image', label: 'Image', required: true, content: 'media' },
      { id: 'caption', label: 'Légende', required: false, content: 'text' },
    ],
  },
  [DEFAULT_PRESET_ID.PHOTO]: {
    id: DEFAULT_PRESET_ID.PHOTO,
    label: 'Photo ou vidéo plein cadre',
    allowedContent: ['media'],
    markupTemplate: `
      <article id="{{rootId}}" class="elce-card elce-card--photo" data-part="{{partPrefix}}:root">
        <div id="{{rootId}}-media" class="elce-carousel-photo__media" data-part="{{partPrefix}}:media"></div>
      </article>
    `,
    zones: [{ id: 'media', label: 'Photo ou vidéo', required: true, content: 'media' }],
  },
  [DEFAULT_PRESET_ID.TEXT_SHORT]: {
    id: DEFAULT_PRESET_ID.TEXT_SHORT,
    label: 'Texte court',
    allowedContent: ['text'],
    markupTemplate: `
      <article id="{{rootId}}" class="elce-card elce-card--text-short" data-part="{{partPrefix}}:root">
        <p id="{{rootId}}-overline" data-part="{{partPrefix}}:overline"></p>
        <h2 id="{{rootId}}-title" data-part="{{partPrefix}}:title"></h2>
        <p id="{{rootId}}-description" data-part="{{partPrefix}}:description"></p>
        <p id="{{rootId}}-message" data-part="{{partPrefix}}:message"></p>
        <footer id="{{rootId}}-note" data-part="{{partPrefix}}:note"></footer>
      </article>
    `,
    zones: [
      { id: 'overline', label: 'Surtitre', required: false, content: 'text' },
      { id: 'title', label: 'Titre', required: false, content: 'text' },
      { id: 'description', label: 'Description', required: false, content: 'text' },
      { id: 'message', label: 'Message', required: false, content: 'text' },
      { id: 'note', label: 'Note', required: false, content: 'text' },
    ],
  },
  [DEFAULT_PRESET_ID.TEXT_IMAGE]: {
    id: DEFAULT_PRESET_ID.TEXT_IMAGE,
    label: 'Texte avec image',
    allowedContent: ['text', 'media'],
    markupTemplate: `
      <article id="{{rootId}}" class="elce-card elce-card--text-image" data-part="{{partPrefix}}:root">
        <div id="{{rootId}}-image" class="elce-carousel-text-image__image" data-part="{{partPrefix}}:image"></div>
        <div id="{{rootId}}-content" class="elce-carousel-text-image__content" data-part="{{partPrefix}}:content">
          <p id="{{rootId}}-overline" data-part="{{partPrefix}}:overline"></p>
          <h2 id="{{rootId}}-title" data-part="{{partPrefix}}:title"></h2>
          <p id="{{rootId}}-description" data-part="{{partPrefix}}:description"></p>
          <p id="{{rootId}}-message" data-part="{{partPrefix}}:message"></p>
          <footer id="{{rootId}}-note" data-part="{{partPrefix}}:note"></footer>
        </div>
      </article>
    `,
    zones: [
      { id: 'image', label: 'Image', required: true, content: 'media' },
      { id: 'overline', label: 'Surtitre', required: false, content: 'text' },
      { id: 'title', label: 'Titre', required: false, content: 'text' },
      { id: 'description', label: 'Description', required: false, content: 'text' },
      { id: 'message', label: 'Message', required: false, content: 'text' },
      { id: 'note', label: 'Note', required: false, content: 'text' },
    ],
  },
  [DEFAULT_PRESET_ID.MESSAGE]: {
    id: DEFAULT_PRESET_ID.MESSAGE,
    label: 'Message',
    allowedContent: ['text', 'media'],
    markupTemplate: `
      <article id="{{rootId}}" class="elce-card elce-card--message" data-part="{{partPrefix}}:root">
        <header id="{{rootId}}-header">
          <p id="{{rootId}}-overline" data-part="{{partPrefix}}:overline"></p>
          <h2 id="{{rootId}}-title" data-part="{{partPrefix}}:title"></h2>
          <p id="{{rootId}}-subtitle" data-part="{{partPrefix}}:subtitle"></p>
        </header>
        <div id="{{rootId}}-body" data-part="{{partPrefix}}:body"></div>
        <footer id="{{rootId}}-footer" data-part="{{partPrefix}}:footer"></footer>
      </article>
    `,
    zones: [
      { id: 'overline', label: 'Sur-titre', required: false, content: 'text' },
      { id: 'title', label: 'Titre', required: false, content: 'text' },
      { id: 'subtitle', label: 'Sous-titre', required: false, content: 'text' },
      { id: 'body', label: 'Message', required: false, content: 'text' },
      { id: 'footer', label: 'Note', required: false, content: 'text' },
    ],
  },
} as const
