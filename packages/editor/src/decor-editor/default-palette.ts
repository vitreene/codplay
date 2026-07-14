import type { DecorPreset } from './types'
import type { PaletteConfig } from './palette-panel'

/**
 * Palette réelle de dedit — récupérée depuis `dedit-demo.ts` (démo isolée, supprimée après
 * extraction complète de sa mécanique dans `mount.ts`) plutôt que réinventée : c'était déjà
 * l'exemple de référence du moteur de panneaux (`docs/formalisation/2026-07-07-dedit-palette-
 * panels-plan.md`), pas un contenu jetable. Un exemple d'usage, pas une norme imposée par dedit —
 * `style` est une carte OUVERTE de propriétés CSS (spec §3.2).
 */
const FONT_FAMILIES = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
  'Merriweather', 'Playfair Display', 'Source Serif Pro', 'PT Serif', 'Lora',
]

export const DEFAULT_PALETTE: PaletteConfig = {
  panels: [
    {
      id: 'shape',
      label: 'Forme',
      fields: [
        { path: 'style.background-color', kind: 'color', label: 'Fond' },
        { path: 'style.border-color', kind: 'color', label: 'Bord' },
        { path: 'style.border-width', kind: 'number', label: 'Épaisseur' },
        { path: 'style.border-radius', kind: 'number', label: 'Rayon' },
        { path: 'style.padding', kind: 'number', label: 'Padding' },
      ],
    },
    {
      id: 'typo',
      label: 'Typo',
      fields: [
        { path: 'style.font-family', kind: 'select', label: 'Fonte', options: FONT_FAMILIES },
        { path: 'style.font-size', kind: 'slider', label: 'Taille', min: 1, max: 20, step: 0.5 },
        { path: 'style.font-weight', kind: 'boolean', label: 'B', icon: 'bold', trueValue: 'bold', falseValue: 'normal' },
        { path: 'style.font-style', kind: 'boolean', label: 'I', icon: 'italic', trueValue: 'italic', falseValue: 'normal' },
        {
          path: 'style.text-align',
          kind: 'icon-select',
          label: 'Alignement',
          iconOptions: [
            { value: 'left', icon: 'align-left' },
            { value: 'center', icon: 'align-center' },
            { value: 'right', icon: 'align-right' },
            { value: 'justify', icon: 'align-justify' },
          ],
        },
        { path: 'style.color', kind: 'color', label: 'Texte' },
        { path: 'textAutoSize.enabled', kind: 'boolean', label: 'Auto' },
      ],
    },
    {
      id: 'dimensions',
      label: 'Dimensions',
      fields: [
        { path: 'style.width', kind: 'number', label: 'Largeur' },
        { path: 'style.height', kind: 'number', label: 'Hauteur' },
      ],
    },
    {
      id: 'content',
      label: 'Contenu',
      fields: [{ path: 'text', kind: 'text', label: 'Texte' }],
    },
    { id: 'custom', label: 'Custom', kind: 'custom-code' },
    { id: 'presets', label: 'Presets', kind: 'preset-list' },
  ],
  panelsByItemType: {
    text: ['shape', 'typo', 'dimensions', 'content', 'custom', 'presets'],
    image: ['shape', 'dimensions', 'custom', 'presets'],
    media: ['shape', 'dimensions', 'custom', 'presets'],
    video: ['shape', 'dimensions', 'custom', 'presets'],
    capsule: ['shape', 'dimensions', 'custom', 'presets'],
  },
}

export const DEFAULT_PRESETS: DecorPreset[] = [
  { name: 'Étiquette', patch: { style: { 'font-size': '3cqw', 'font-weight': 'bold', 'background-color': 'oklch(0.3 0.05 250)' } } },
]
