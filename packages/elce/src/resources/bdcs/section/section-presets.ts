import type { CardPreset } from '../../../core/presets/card-preset-types'
import { SECTION_PRESET_ID } from './section-config'

export const SECTION_PRESETS: Readonly<Record<string, CardPreset>> = {
  [SECTION_PRESET_ID]: {
    id: SECTION_PRESET_ID,
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
} as const
