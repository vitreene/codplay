import './decor-editor.css'

import { DecorEditorController } from './controller'
import { createDecorEditorPalette } from './render'
import type { DecorEditorCatalogs } from './controller'
import type { PaletteConfig } from './palette-panel'
import type { ResolvedDecor } from './types'

const FONT_FAMILIES = [
  'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
  'Merriweather', 'Playfair Display', 'Source Serif Pro', 'PT Serif', 'Lora',
]

/** Style de base de l'item de démo, reposé à chaque réapplication du décor résolu (§ applyResolvedDecor). */
const BASE_ITEM_STYLE = 'padding:24px;max-width:60%;min-height:60px;border:1px dashed #4b5563;color:#f9fafb;overflow-wrap:break-word;'

/**
 * Configuration de palette : un exemple d'usage du moteur de panneaux, PAS une
 * norme imposée par dedit (cf docs/formalisation/2026-07-07-dedit-palette-panels-plan.md).
 * `style` est une carte OUVERTE de propriétés CSS (spec §3.2) — un panneau ne
 * fait que choisir QUELLES propriétés il expose, dans quel ordre, avec quel
 * contrôle. "Forme" regroupe fond, bord (couleur/épaisseur/rayon) et padding —
 * un regroupement purement thématique, sans rapport avec une structure du décor.
 */
const PALETTE_CONFIG: PaletteConfig = {
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
    { id: 'custom', label: 'Custom', kind: 'custom-code' },
    { id: 'presets', label: 'Presets', kind: 'preset-list' },
  ],
  panelsByItemType: {
    text: ['shape', 'typo', 'dimensions', 'custom', 'presets'],
    image: ['shape', 'dimensions', 'custom', 'presets'],
    media: ['shape', 'dimensions', 'custom', 'presets'],
    video: ['shape', 'dimensions', 'custom', 'presets'],
    capsule: ['shape', 'dimensions', 'custom', 'presets'],
  },
}

/**
 * Démo isolée de dedit (spec §10, phase 3) : un item factice (texte), l'écart émis
 * par la palette est appliqué en style inline sur le nœud de démonstration —
 * visualisation seulement, aucun builder codplay impliqué à ce stade.
 */
export function runDecorEditorDemo(): void {
  const app = document.getElementById('app')
  if (!app) return
  app.innerHTML = ''
  app.style.cssText = 'display:grid;width:100%;height:100%;'

  const stage = document.createElement('div')
  stage.style.cssText = 'display:flex;align-items:center;justify-content:center;min-width:0;min-height:0;'
  app.appendChild(stage)

  const itemEl = document.createElement('div')
  itemEl.textContent = 'Le vif renard brun saute par-dessus le chien paresseux.'
  itemEl.style.cssText = BASE_ITEM_STYLE
  stage.appendChild(itemEl)

  const catalogs: DecorEditorCatalogs = {
    presets: [
      { name: 'Étiquette', patch: { style: { 'font-size': '3cqw', 'font-weight': 'bold', 'background-color': 'oklch(0.3 0.05 250)' } } },
    ],
    cards: [],
    palette: PALETTE_CONFIG,
  }

  const controller = new DecorEditorController(catalogs)

  const defaults: ResolvedDecor = { style: { 'font-size': '4cqw' } }
  controller.attachItems([{
    itemId: 'demo-item',
    itemType: 'text',
    defaults,
    chain: [],
    patch: {},
    zones: [],
    context: 'horizontal',
  }])

  // Décor RÉSOLU complet (défauts ⊕ chaîne ⊕ écart), pas l'écart brut : dedit et
  // l'item partagent les mêmes propriétés dès l'attache (pas de saut initial), et
  // une propriété retirée par « hériter » disparaît bien de l'item (l'écart émis
  // par onDecorChange ne porte plus cette clé, donc appliquer seulement l'écart
  // ne peut jamais retirer une valeur déjà posée en style inline).
  applyResolvedDecor(itemEl, controller.getResolvedDecors()[0]!)
  controller.subscribe(() => applyResolvedDecor(itemEl, controller.getResolvedDecors()[0]!))

  const palette = createDecorEditorPalette(controller)
  palette.element.style.top = '24px'
  palette.element.style.left = '24px'
  app.appendChild(palette.element)
  palette.render()
  groupTypoIconFields(palette.element)
  controller.subscribe(() => groupTypoIconFields(palette.element))
}

/**
 * Ad hoc à la démo (pas de framework de layout dans le moteur, cf plan de
 * conception) : regroupe B/I/Alignement — les 3 champs sans label du panneau
 * Typo — sur une ligne flex commune, avec un séparateur entre I et les icônes
 * d'alignement. Ré-exécuté après chaque render : sans effet si le panneau actif
 * n'est pas Typo, ou si le regroupement est déjà en place (idempotent).
 */
function groupTypoIconFields(paletteEl: HTMLElement): void {
  const panel = paletteEl.querySelector('.dedit-panel')
  if (!panel) return
  const rows = Array.from(panel.querySelectorAll<HTMLElement>(':scope > .dedit-field'))
  const unlabeled = rows.filter(row => !row.querySelector('.dedit-field__label'))
  if (unlabeled.length < 3) return // pas le panneau Typo (ou déjà regroupé)

  const [bold, italic, align] = unlabeled
  if (!bold || !italic || !align) return

  const wrapper = document.createElement('div')
  wrapper.classList.add('dedit-icon-row')
  bold.before(wrapper)
  wrapper.append(bold, italic)

  const separator = document.createElement('div')
  separator.classList.add('dedit-icon-row__separator')
  wrapper.append(separator, align)
}

/**
 * Visualisation seulement — écrit le décor RÉSOLU (défauts ⊕ chaîne ⊕ écart) sur
 * le nœud DOM (le futur builder résoudra les propriétés non interpolables pour un
 * vrai rendu codplay). Le style géré par dedit est entièrement réinitialisé avant
 * réapplication : `style` étant une carte ouverte propriété-CSS → valeur-CSS, un
 * simple `setProperty` ne peut jamais RETIRER une propriété qui a disparu de
 * l'écart résolu (ex. après un « hériter » qui retombe sur un défaut absent).
 */
function applyResolvedDecor(el: HTMLElement, decor: ResolvedDecor): void {
  el.style.cssText = BASE_ITEM_STYLE
  if (decor.style) {
    for (const [prop, value] of Object.entries(decor.style)) {
      el.style.setProperty(prop, value)
    }
  }
  if (decor.custom !== undefined) el.style.cssText += `;${decor.custom}`
}
