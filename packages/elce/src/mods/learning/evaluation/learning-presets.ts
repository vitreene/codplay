import type { CardPreset } from '../../../core/presets/card-preset-types'
import { EVALUATION_RESULT_PRESET_ID } from './learning-evaluation-config'

export const LEARNING_EVALUATION_PRESETS: Readonly<Record<string, CardPreset>> = {
  [EVALUATION_RESULT_PRESET_ID]: {
    id: EVALUATION_RESULT_PRESET_ID,
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
} as const
