import type { CardPreset } from '../../../core/presets/card-preset-types'
import { CAROUSEL_PRESET_ID } from './carousel-config'

export const CAROUSEL_PRESETS: Readonly<Record<string, CardPreset>> = {
  [CAROUSEL_PRESET_ID]: {
    id: CAROUSEL_PRESET_ID,
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
} as const
