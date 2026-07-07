import './decor-editor.css'

import { computeTextAutoSize, pxToCqw } from '@codplay/text-auto-size'
import { DecorEditorController } from './controller'
import { createDecorEditorPalette } from './render'
import type { DecorEditorCatalogs } from './controller'
import type { PaletteConfig } from './palette-panel'
import type { ResolvedDecor } from './types'

// « Advent Pro » en premier : seule police réellement chargée (index.html) — police variable
// avec axe `wdth`, pour tester l'élargissement font-stretch (spec text-auto-size §2.3). Les
// autres noms sont des placeholders non chargés (défaut navigateur en pratique).
const FONT_FAMILIES = [
  'Advent Pro', 'Inter', 'Roboto', 'Open Sans', 'Lato', 'Montserrat',
  'Merriweather', 'Playfair Display', 'Source Serif Pro', 'PT Serif', 'Lora',
]

/** Style de base de l'item de démo, reposé à chaque réapplication du décor résolu (§ applyResolvedDecor). */
const BASE_ITEM_STYLE = 'box-sizing:border-box;padding:24px;border:1px dashed #4b5563;background-color:#1f2937;color:#f9fafb;overflow-wrap:break-word;overflow:hidden;'

/**
 * Largeur du conteneur de référence pour la conversion cqw ↔ px (spec text-auto-size §3.3,
 * §4) — fixe pour la démo (pas de builder ni de pont position réels ici), déclarée sur
 * `stage` via `container-type: inline-size` pour que les `cqw` écrits par le panneau
 * Dimensions se résolvent réellement (sinon `cqw` sans conteneur de requête ancêtre vaut 0).
 */
const STAGE_REFERENCE_WIDTH_PX = 600

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
        // Case « auto » (spec text-auto-size §5) : un vrai booléen, pas une valeur CSS —
        // possible depuis l'élargissement de trueValue/falseValue (string | boolean).
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

/**
 * Démo isolée de dedit (spec §10, phase 3) : un item factice (texte), l'écart émis
 * par la palette est appliqué en style inline sur le nœud de démonstration —
 * visualisation seulement, aucun builder codplay impliqué à ce stade.
 */
export function runDecorEditorDemo(): void {
  const app = document.getElementById('app')
  if (!app) return
  app.innerHTML = ''
  // Centré explicitement : la palette est en `position:fixed` en haut à gauche
  // (cf plus bas) — sans centrage, le stage (largeur fixe) se collerait au même
  // coin par défaut (`display:grid` sans `justify-items` centre pas un enfant à
  // taille définie) et le recouvrirait entièrement.
  app.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;height:100%;'

  const stage = document.createElement('div')
  // `container-type: inline-size` + largeur fixe : les `cqw` écrits par la palette
  // (Dimensions, mais aussi le résultat du calcul auto-size) se résolvent réellement
  // contre cette largeur — sans conteneur de requête ancêtre, `cqw` vaudrait 0.
  stage.style.cssText = `display:flex;align-items:center;justify-content:center;container-type:inline-size;width:${STAGE_REFERENCE_WIDTH_PX}px;`
  app.appendChild(stage)

  const itemEl = document.createElement('div')
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

  const defaults: ResolvedDecor = {
    style: { 'font-family': 'Advent Pro', 'font-size': '4cqw', width: '40cqw', height: '20cqw' },
    text: 'Le vif renard brun saute par-dessus le chien paresseux.',
    // Coché par défaut : c'est justement la fonctionnalité qu'on teste (spec text-auto-size).
    textAutoSize: { enabled: true },
  }
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
  applyResolvedDecor(itemEl, controller.getResolvedDecors()[0]!, STAGE_REFERENCE_WIDTH_PX)
  controller.subscribe(() => applyResolvedDecor(itemEl, controller.getResolvedDecors()[0]!, STAGE_REFERENCE_WIDTH_PX))

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
 *
 * `textAutoSize` (spec text-auto-size §7) : calculé ici, en direct, sur l'item
 * affiché — jamais persisté (l'écart ne porte que `enabled`). `custom` est ajouté
 * en dernier, donc prime toujours sur le résultat du calcul (§6).
 */
function applyResolvedDecor(el: HTMLElement, decor: ResolvedDecor, referenceWidthPx: number): void {
  el.style.cssText = BASE_ITEM_STYLE
  if (decor.text !== undefined) el.textContent = decor.text
  if (decor.style) {
    for (const [prop, value] of Object.entries(decor.style)) {
      el.style.setProperty(prop, value)
    }
  }
  if (decor.textAutoSize?.enabled) {
    applyTextAutoSize(el, decor, referenceWidthPx)
  }
  if (decor.custom !== undefined) el.style.cssText += `;${decor.custom}`
}

/**
 * Zone de texte réellement disponible (content-box, padding/bordure déduits) — le contrat
 * est que TOUT le texte tienne dans le bloc, padding compris, pas seulement dans sa boîte
 * de bordure. `getComputedStyle().width/height` rapporte la taille selon `box-sizing` tel
 * que déclaré (ex. la boîte de BORDURE avec `box-sizing:border-box`, vérifié empiriquement
 * ici — pas automatiquement le contenu) : padding et bordure sont donc déduits
 * explicitement, via d'autres propriétés calculées — toujours des computed styles, jamais
 * `getBoundingClientRect` (mesure, pas ancrage).
 */
function contentBoxSizePx(cs: CSSStyleDeclaration): { widthPx: number; heightPx: number } {
  const paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
  const paddingY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
  const borderX = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth)
  const borderY = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth)
  return {
    widthPx: parseFloat(cs.width) - paddingX - borderX,
    heightPx: parseFloat(cs.height) - paddingY - borderY,
  }
}

/**
 * La police utilisée pour la mesure doit être EXACTEMENT celle qui sera rendue — y compris
 * son repli (ex. `decor.style['font-family']` absent, comme au tout premier chargement).
 * Un repli codé en dur ici (ex. "Inter") diverge silencieusement du repli réel choisi par
 * le navigateur (une police système quelconque), causant des écarts de mesure minimes qui
 * font parfois basculer le texte sur une ligne de plus — d'où la lecture de la police
 * réellement CALCULÉE sur l'élément, jamais une valeur par défaut devinée.
 */
function applyTextAutoSize(el: HTMLElement, decor: ResolvedDecor, referenceWidthPx: number): void {
  const cs = getComputedStyle(el)
  const { widthPx, heightPx } = contentBoxSizePx(cs)

  const result = computeTextAutoSize({
    text: decor.text ?? '',
    font: {
      family: cs.fontFamily,
      weight: cs.fontWeight,
      style: cs.fontStyle === 'italic' ? 'italic' : 'normal',
    },
    blockWidthCqw: pxToCqw(widthPx, referenceWidthPx),
    blockHeightCqw: pxToCqw(heightPx, referenceWidthPx),
    referenceWidthPx,
  })

  el.style.setProperty('font-size', `${result.fontSizeCqw}cqw`)
  el.style.setProperty('line-height', String(result.lineHeight))
  el.style.setProperty('font-stretch', result.fontStretch)
}
