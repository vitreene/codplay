import type { CardPreset } from '../../../core/presets/card-preset-types'
import { QUESTION_PRESET_ID } from './question-config'

export const QUESTION_PRESETS: Readonly<Record<string, CardPreset>> = {
  [QUESTION_PRESET_ID]: {
    id: QUESTION_PRESET_ID,
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
} as const
