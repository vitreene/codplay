import type { CardPreset } from './card-preset-types'
import { DEFAULT_PRESET_ID } from './document-config'

/** Explicit preset configuration kept ready for a later preset editor. */
export const CARD_PRESETS: Readonly<Record<string, CardPreset>> = {
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
