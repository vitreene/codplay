import type { DecorEditorController } from './controller'
import type { PanelField, PanelId } from './palette-panel'
import { findPanel } from './palette-panel'
import { hexToCssOklch, cssOklchComponentsToHex } from './color-adapter'
import { formatNumberForCssProperty, parseNumberFromCssValue } from './css-value-format'
import { iconSvg } from './icons'

// ─── Palette shell ───────────────────────────────────────────────────────────
//
// Couche de RENDU — dupliquable/adaptable sans toucher au contrat (domaine,
// machine, contrôleur). Cf docs/formalisation/2026-07-07-dedit-palette-panels-plan.md

export interface DecorEditorPaletteHandle {
  element: HTMLElement
  render(): void
  destroy(): void
}

export function createDecorEditorPalette(controller: DecorEditorController): DecorEditorPaletteHandle {
  const el = document.createElement('div')
  el.classList.add('dedit-palette', 'dedit-palette--hidden')

  const tabs = document.createElement('div')
  tabs.classList.add('dedit-tabs')
  el.appendChild(tabs)

  const panel = document.createElement('div')
  panel.classList.add('dedit-panel')
  el.appendChild(panel)

  // Rebuild uniquement quand la structure change (item, panneau actif, multi) —
  // sinon une mise à jour de valeurs recréerait les <input>, ce qui coupe le
  // picker couleur natif du navigateur en plein geste (voir retour utilisateur).
  let lastStructureKey = ''
  let currentUpdateValues: (() => void) | null = null

  function render(): void {
    const snapshot = controller.getSnapshot()
    const active = snapshot.value === 'active'
    el.classList.toggle('dedit-palette--hidden', !active)
    if (!active) return

    const config = controller.getPaletteConfig()
    const panelIds = controller.getPanelsForCurrentItems()
    const activePanelId = snapshot.context.activePanelId
    const multi = snapshot.context.items.length > 1
    const itemIds = snapshot.context.items.map(i => i.itemId).join(',')

    const structureKey = `${itemIds}|${activePanelId}|${panelIds.join(',')}`
    if (structureKey !== lastStructureKey) {
      lastStructureKey = structureKey
      renderTabs(tabs, config, panelIds, activePanelId, id => controller.selectPanel(id))
      currentUpdateValues = renderActivePanel(panel, controller, config, activePanelId, multi)
    }
    // Toujours peupler les valeurs après (re)construction — sinon un champ garde
    // la valeur par défaut du navigateur jusqu'au prochain événement de la machine.
    currentUpdateValues?.()
  }

  const unsubscribe = controller.subscribe(() => render())

  return {
    element: el,
    render,
    destroy(): void {
      unsubscribe()
    },
  }
}

function renderTabs(
  container: HTMLElement,
  config: ReturnType<DecorEditorController['getPaletteConfig']>,
  panelIds: PanelId[],
  active: PanelId,
  onSelect: (panelId: PanelId) => void,
): void {
  container.innerHTML = ''
  for (const id of panelIds) {
    const panelDef = findPanel(config, id)
    if (!panelDef) continue
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.classList.add('dedit-tab')
    if (id === active) btn.classList.add('dedit-tab--active')
    btn.textContent = panelDef.label
    btn.addEventListener('click', () => onSelect(id))
    container.appendChild(btn)
  }
}

type FieldUpdater = () => void

/** Reconstruit la structure du panneau actif et retourne une fonction de mise à jour des valeurs seules. */
function renderActivePanel(
  container: HTMLElement,
  controller: DecorEditorController,
  config: ReturnType<DecorEditorController['getPaletteConfig']>,
  panelId: PanelId,
  multi: boolean,
): FieldUpdater {
  container.innerHTML = ''
  const panelDef = findPanel(config, panelId)
  if (!panelDef) return () => {}

  if (panelDef.kind === 'custom-code') {
    return renderCustomCodePanel(container, controller)
  }

  if (panelDef.kind === 'preset-list') {
    return renderPresetListPanel(container, controller)
  }

  const updates = panelDef.fields.map(field => renderField(container, controller, field, multi))
  return () => updates.forEach(u => u())
}

// ─── Generic field row (état mixte §7 bis, marqueur d'écart §3.1) ──────────

function fieldRow(
  container: HTMLElement,
  label: string,
  path: string,
  multi: boolean,
  controller: DecorEditorController,
  buildControl: (control: HTMLElement) => FieldUpdater,
  showLabel = true,
): FieldUpdater {
  const row = document.createElement('div')
  row.classList.add('dedit-field')

  if (showLabel) {
    const labelEl = document.createElement('span')
    labelEl.classList.add('dedit-field__label')
    labelEl.textContent = label
    row.appendChild(labelEl)
  }

  const control = document.createElement('div')
  control.classList.add('dedit-field__control')
  row.appendChild(control)
  const updateControl = buildControl(control)

  // Contrôle « hériter » (spec §3.1) — discret, visible seulement s'il y a un écart
  // explicite sur cette propriété ; masqué en multi-sélection (spec §7 bis).
  let stripBtn: HTMLButtonElement | null = null
  if (!multi) {
    stripBtn = document.createElement('button')
    stripBtn.type = 'button'
    stripBtn.classList.add('dedit-strip-btn', 'dedit-strip-btn--hidden')
    stripBtn.title = 'Hériter'
    stripBtn.textContent = '+'
    stripBtn.addEventListener('click', () => controller.stripInherited(path))
    row.appendChild(stripBtn)
  }

  container.appendChild(row)

  return () => {
    updateControl()
    if (stripBtn) stripBtn.classList.toggle('dedit-strip-btn--hidden', !controller.hasOwnPatch(path))
  }
}

/** Dispatch générique sur `field.kind` — point d'entrée unique, aucune fonction dédiée par panneau. */
function renderField(
  container: HTMLElement,
  controller: DecorEditorController,
  field: PanelField,
  multi: boolean,
): FieldUpdater {
  switch (field.kind) {
    case 'color':
      return renderColorField(container, controller, field, multi)
    case 'number':
      return renderNumberField(container, controller, field, multi)
    case 'slider':
      return renderSliderField(container, controller, field, multi)
    case 'boolean':
      return renderBooleanField(container, controller, field, multi)
    case 'select':
      return renderSelectField(container, controller, field, multi)
    case 'icon-select':
      return renderIconSelectField(container, controller, field, multi)
    case 'text':
      return renderTextField(container, controller, field, multi)
  }
}

/**
 * Nom de propriété CSS ciblé par un chemin "style.<propriete>" — utilisé uniquement pour
 * choisir la règle de formatage numérique (`css-value-format.ts`), qui n'a de sens que pour
 * `style.*`. N'intervient pas dans l'écriture du patch (générique, cf `applyPathPatch`).
 */
function cssPropertyOf(path: string): string {
  return path.split('.').slice(1).join('.')
}

// ─── Field kinds ─────────────────────────────────────────────────────────────
//
// Chaque contrôle produit une chaîne CSS finale avant d'écrire dans le décor
// (jamais de valeur intermédiaire stockée) — cf spec §3.2 et le principe posé
// par l'utilisateur : "la palette est responsable de produire la chaîne CSS
// finale complète".

function renderColorField(
  container: HTMLElement,
  controller: DecorEditorController,
  field: PanelField,
  multi: boolean,
): FieldUpdater {
  const { path } = field
  return fieldRow(container, field.label, path, multi, controller, control => {
    const input = document.createElement('input')
    input.type = 'color'
    control.appendChild(input)

    // Le picker natif émet 'input' en continu pendant le geste ; on applique le
    // patch sans jamais recréer cet <input> (cf commentaire dans render()) —
    // sinon le navigateur ferme le picker au premier changement de couleur.
    input.addEventListener('input', () => {
      controller.applyPathPatch(path, hexToCssOklch(input.value))
    })

    return () => {
      const state = controller.resolveField<string | undefined>(path)
      const hex = state.kind === 'uniform' && state.value !== undefined ? toHexForPicker(state.value) : '#808080'
      if (input.value.toLowerCase() !== hex.toLowerCase() && document.activeElement !== input) {
        input.value = hex
      }
      control.parentElement?.classList.toggle('dedit-field--mixed', state.kind === 'mixed')
    }
  })
}

function toHexForPicker(cssOklch: string): string {
  const match = cssOklch.match(/oklch\(([\d.]+)\s+([\d.]+)\s+([\d.]+)\)/)
  if (!match) return '#808080'
  const [, l, c, h] = match.map(Number)
  return cssOklchComponentsToHex(l!, c!, h!)
}

function renderNumberField(
  container: HTMLElement,
  controller: DecorEditorController,
  field: PanelField,
  multi: boolean,
): FieldUpdater {
  const { path } = field
  const cssProperty = cssPropertyOf(path)
  return fieldRow(container, field.label, path, multi, controller, control => {
    const input = document.createElement('input')
    input.type = 'number'
    control.appendChild(input)
    input.addEventListener('change', () => {
      if (input.value === '') return
      controller.applyPathPatch(path, formatNumberForCssProperty(cssProperty, Number(input.value)))
    })
    return () => {
      if (document.activeElement === input) return
      const state = controller.resolveField<string | undefined>(path)
      const parsed = state.kind === 'uniform' && state.value !== undefined ? parseNumberFromCssValue(cssProperty, state.value) : undefined
      input.value = parsed !== undefined ? String(parsed) : ''
      input.placeholder = state.kind === 'mixed' ? '—' : ''
      control.parentElement?.classList.toggle('dedit-field--mixed', state.kind === 'mixed')
    }
  })
}

function renderSliderField(
  container: HTMLElement,
  controller: DecorEditorController,
  field: PanelField,
  multi: boolean,
): FieldUpdater {
  const { path } = field
  const cssProperty = cssPropertyOf(path)
  const min = field.min ?? 0
  const max = field.max ?? 100
  const step = field.step ?? 1
  return fieldRow(container, field.label, path, multi, controller, control => {
    const input = document.createElement('input')
    input.type = 'range'
    input.min = String(min)
    input.max = String(max)
    input.step = String(step)
    control.appendChild(input)
    input.addEventListener('input', () => {
      controller.applyPathPatch(path, formatNumberForCssProperty(cssProperty, Number(input.value)))
    })
    return () => {
      if (document.activeElement === input) return
      const state = controller.resolveField<string | undefined>(path)
      const parsed = state.kind === 'uniform' && state.value !== undefined ? parseNumberFromCssValue(cssProperty, state.value) : undefined
      if (parsed !== undefined) input.value = String(parsed)
      control.parentElement?.classList.toggle('dedit-field--mixed', state.kind === 'mixed')
    }
  })
}

/**
 * Deux formes exclusives, jamais mélangées (une icône ne porte pas aussi un label texte
 * dupliqué) : bouton-bascule icônisé sans label (ex. "B"/"I") si `field.icon` est fourni,
 * sinon case à cocher classique avec son label (ex. "Auto").
 */
function renderBooleanField(
  container: HTMLElement,
  controller: DecorEditorController,
  field: PanelField,
  multi: boolean,
): FieldUpdater {
  return field.icon
    ? renderIconToggleField(container, controller, field, multi)
    : renderCheckboxField(container, controller, field, multi)
}

function renderIconToggleField(
  container: HTMLElement,
  controller: DecorEditorController,
  field: PanelField,
  multi: boolean,
): FieldUpdater {
  const { path, icon } = field
  const trueValue: string | boolean = field.trueValue ?? true
  const falseValue: string | boolean = field.falseValue ?? false
  return fieldRow(container, field.label, path, multi, controller, control => {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.classList.add('dedit-toggle-btn')
    btn.innerHTML = iconSvg(icon!)
    btn.title = field.label
    control.appendChild(btn)
    btn.addEventListener('click', () => {
      const state = controller.resolveField<string | boolean | undefined>(path)
      const isActive = state.kind === 'uniform' && state.value === trueValue
      controller.applyPathPatch(path, isActive ? falseValue : trueValue)
    })
    return () => {
      const state = controller.resolveField<string | boolean | undefined>(path)
      btn.classList.toggle('dedit-toggle-btn--active', state.kind === 'uniform' && state.value === trueValue)
      btn.classList.toggle('dedit-toggle-btn--mixed', state.kind === 'mixed')
    }
  }, false)
}

function renderCheckboxField(
  container: HTMLElement,
  controller: DecorEditorController,
  field: PanelField,
  multi: boolean,
): FieldUpdater {
  const { path } = field
  const trueValue: string | boolean = field.trueValue ?? true
  const falseValue: string | boolean = field.falseValue ?? false
  return fieldRow(container, field.label, path, multi, controller, control => {
    const input = document.createElement('input')
    input.type = 'checkbox'
    control.appendChild(input)
    input.addEventListener('change', () => {
      controller.applyPathPatch(path, input.checked ? trueValue : falseValue)
    })
    return () => {
      const state = controller.resolveField<string | boolean | undefined>(path)
      input.checked = state.kind === 'uniform' && state.value === trueValue
      input.indeterminate = state.kind === 'mixed'
      control.parentElement?.classList.toggle('dedit-field--mixed', state.kind === 'mixed')
    }
  }, true)
}

function renderSelectField(
  container: HTMLElement,
  controller: DecorEditorController,
  field: PanelField,
  multi: boolean,
): FieldUpdater {
  const { path, options = [] } = field
  return fieldRow(container, field.label, path, multi, controller, control => {
    const select = document.createElement('select')
    const blank = document.createElement('option')
    blank.value = ''
    select.appendChild(blank)
    for (const opt of options) {
      const optionEl = document.createElement('option')
      optionEl.value = opt
      optionEl.textContent = opt
      select.appendChild(optionEl)
    }
    control.appendChild(select)
    select.addEventListener('change', () => {
      if (select.value === '') return
      controller.applyPathPatch(path, select.value)
    })
    return () => {
      const state = controller.resolveField<string | undefined>(path)
      blank.textContent = state.kind === 'mixed' ? '(mixte)' : '—'
      if (document.activeElement !== select) {
        select.value = state.kind === 'uniform' && state.value !== undefined ? state.value : ''
      }
      control.parentElement?.classList.toggle('dedit-field--mixed', state.kind === 'mixed')
    }
  })
}

/** Groupe de boutons icônes sans label, exclusifs entre eux (ex. alignement gauche/centre/droite/justifié). */
function renderIconSelectField(
  container: HTMLElement,
  controller: DecorEditorController,
  field: PanelField,
  multi: boolean,
): FieldUpdater {
  const { path } = field
  const options = field.iconOptions ?? []
  return fieldRow(container, field.label, path, multi, controller, control => {
    control.classList.add('dedit-icon-select')
    const buttons = options.map(opt => {
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.classList.add('dedit-toggle-btn')
      btn.innerHTML = iconSvg(opt.icon)
      btn.title = opt.value
      btn.addEventListener('click', () => controller.applyPathPatch(path, opt.value))
      control.appendChild(btn)
      return { btn, value: opt.value }
    })
    return () => {
      const state = controller.resolveField<string | undefined>(path)
      for (const { btn, value } of buttons) {
        btn.classList.toggle('dedit-toggle-btn--active', state.kind === 'uniform' && state.value === value)
        btn.classList.toggle('dedit-toggle-btn--mixed', state.kind === 'mixed')
      }
    }
  }, false)
}

function renderTextField(
  container: HTMLElement,
  controller: DecorEditorController,
  field: PanelField,
  multi: boolean,
): FieldUpdater {
  const { path } = field
  return fieldRow(container, field.label, path, multi, controller, control => {
    const input = document.createElement('input')
    input.type = 'text'
    control.appendChild(input)
    input.addEventListener('change', () => controller.applyPathPatch(path, input.value))
    return () => {
      if (document.activeElement === input) return
      const state = controller.resolveField<string | undefined>(path)
      input.value = state.kind === 'uniform' && state.value !== undefined ? state.value : ''
      input.placeholder = state.kind === 'mixed' ? '(valeurs mixtes)' : ''
      control.parentElement?.classList.toggle('dedit-field--mixed', state.kind === 'mixed')
    }
  })
}

// ─── Custom code panel — cas spécial, pas une liste de PanelField (spec §9) ────

function renderCustomCodePanel(container: HTMLElement, controller: DecorEditorController): FieldUpdater {
  const wrapper = document.createElement('div')
  wrapper.classList.add('dedit-custom')
  const textarea = document.createElement('textarea')
  container.appendChild(wrapper)
  wrapper.appendChild(textarea)

  textarea.addEventListener('change', () => {
    if (textarea.value === '') {
      // Effacer le mini-éditeur revient à l'hérité (spec §3.1) — pas de patch avec
      // chaîne vide, mais un stripInherited (no-op en multi-sélection, cf §7 bis).
      controller.stripInherited('custom')
    } else {
      controller.applyPatch({ custom: textarea.value })
    }
  })

  return () => {
    const state = controller.resolveField<string | undefined>('custom')
    textarea.placeholder = state.kind === 'mixed' ? '(valeurs mixtes)' : ''
    const value = state.kind === 'uniform' && state.value !== undefined ? state.value : ''
    if (document.activeElement !== textarea && textarea.value !== value) textarea.value = value
  }
}

// ─── Preset list panel — cas spécial, une action par preset, pas un PanelField (spec §9) ──

function renderPresetListPanel(container: HTMLElement, controller: DecorEditorController): FieldUpdater {
  const wrapper = document.createElement('div')
  wrapper.classList.add('dedit-preset-list')
  for (const preset of controller.getPresets()) {
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.classList.add('dedit-preset-btn')
    btn.textContent = preset.name
    btn.addEventListener('click', () => controller.applyPreset(preset.name))
    wrapper.appendChild(btn)
  }
  container.appendChild(wrapper)
  return () => {}
}
