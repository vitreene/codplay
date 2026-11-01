import { CAPSULE_TYPE, DEFAULT_AUTO_CAPSULE_CONFIG, GRID_MODE } from '@codplay/capsule-automation'
import type { CapsuleDef, CapsuleKind } from '../app/commands/types'
import { effectiveCapsuleGrid } from './capsule-grid'
import './capsule-editor.css'

export type CapsuleEditorSelection = Readonly<{
  itemId: string
  capsule: CapsuleDef
}>

export type CapsuleDefinitionEditorHandle = Readonly<{
  render(): void
  setDisabled(disabled: boolean): void
  destroy(): void
}>

const CAPSULE_KIND_LABELS: Record<CapsuleKind, string> = {
  [CAPSULE_TYPE.carousel]: 'Carrousel',
  [CAPSULE_TYPE.rangee]: 'Rangée',
  [CAPSULE_TYPE.liste]: 'Liste',
  [CAPSULE_TYPE.grille]: 'Grille',
  [CAPSULE_TYPE.card]: 'Carte',
}

/** Mounts controls for the selected capsule's static CapsuleDef in the existing Decor region. */
export function mountCapsuleDefinitionEditor(
  container: HTMLElement,
  getSelection: () => CapsuleEditorSelection | null,
  onPatch: (itemId: string, patch: Partial<CapsuleDef>) => void,
): CapsuleDefinitionEditorHandle {
  const fieldset = document.createElement('fieldset')
  fieldset.className = 'capsule-editor'
  fieldset.id = 'capsule-definition-editor'
  container.appendChild(fieldset)
  let disabled = false

  /** Rebuilds the capsule controls from the document-owned definition. */
  function render(): void {
    const selected = getSelection()
    container.hidden = selected === null
    if (selected === null) {
      fieldset.replaceChildren()
      return
    }

    const { itemId, capsule } = selected
    fieldset.disabled = disabled
    const kind = capsule.kind
    const grid = effectiveCapsuleGrid(kind, capsule.grid)
    fieldset.replaceChildren()

    const legend = document.createElement('legend')
    legend.id = 'capsule-editor-title'
    legend.textContent = 'Capsule'
    fieldset.appendChild(legend)

    const kindLabel = document.createElement('label')
    kindLabel.className = 'capsule-editor__field'
    kindLabel.textContent = 'Type de capsule'
    const kindSelect = document.createElement('select')
    kindSelect.id = 'capsule-editor-kind'
    for (const capsuleKind of Object.values(CAPSULE_TYPE)) {
      const option = document.createElement('option')
      option.value = capsuleKind
      option.textContent = CAPSULE_KIND_LABELS[capsuleKind]
      option.selected = capsuleKind === kind
      kindSelect.appendChild(option)
    }
    kindSelect.addEventListener('change', () => {
      onPatch(itemId, { kind: kindSelect.value as CapsuleKind })
    })
    kindLabel.appendChild(kindSelect)
    fieldset.appendChild(kindLabel)

    if (DEFAULT_AUTO_CAPSULE_CONFIG.types[kind].gridMode !== GRID_MODE.manual) return

    const gridLabel = document.createElement('p')
    gridLabel.className = 'capsule-editor__label'
    gridLabel.textContent = 'Grille'
    fieldset.appendChild(gridLabel)

    const preview = document.createElement('div')
    preview.className = 'capsule-editor__grid-preview'
    preview.setAttribute('role', 'img')
    preview.setAttribute('aria-label', `Grille de ${grid.rows} lignes et ${grid.cols} colonnes`)
    preview.style.backgroundSize = `${100 / grid.cols}% ${100 / grid.rows}%`
    fieldset.appendChild(preview)

    fieldset.appendChild(createTrackControl('Lignes', grid.rows, (rows) => {
      onPatch(itemId, { grid: gridPatch(capsule, { rows }) })
    }))
    fieldset.appendChild(createTrackControl('Colonnes', grid.cols, (cols) => {
      onPatch(itemId, { grid: gridPatch(capsule, { cols }) })
    }))

    if (grid.rows <= 32 && grid.cols <= 32) {
      const rowGap = grid.gap?.row ?? 0
      const colGap = grid.gap?.col ?? 0
      fieldset.appendChild(createGapControl('Gouttière verticale', rowGap, (value) => {
        onPatch(itemId, { grid: gridPatch(capsule, { gap: { row: value, col: colGap } }) })
      }))
      fieldset.appendChild(createGapControl('Gouttière horizontale', colGap, (value) => {
        onPatch(itemId, { grid: gridPatch(capsule, { gap: { row: rowGap, col: value } }) })
      }))
    }
  }

  /** Applies a one-track change with the capsule's current dimensions and gaps. */
  function gridPatch(capsule: CapsuleDef, change: Partial<NonNullable<CapsuleDef['grid']>>): NonNullable<CapsuleDef['grid']> {
    const current = effectiveCapsuleGrid(capsule.kind, capsule.grid)
    const next = { ...current, ...change }
    if (next.rows > 32 || next.cols > 32) return { rows: next.rows, cols: next.cols }
    const gap = next.gap
    return gap === undefined || gap.row === 0 && gap.col === 0
      ? { rows: next.rows, cols: next.cols }
      : { rows: next.rows, cols: next.cols, gap }
  }

  /** Creates a row control with add/remove buttons and a direct track-count input. */
  function createTrackControl(label: string, initialValue: number, onChange: (value: number) => void): HTMLElement {
    const row = document.createElement('div')
    row.className = 'capsule-editor__field capsule-editor__track-field'
    const caption = document.createElement('span')
    caption.textContent = label
    row.appendChild(caption)
    const controls = document.createElement('span')
    controls.className = 'capsule-editor__stepper'
    const input = document.createElement('input')
    input.type = 'number'
    input.min = '1'
    input.step = '1'
    input.value = String(initialValue)
    input.setAttribute('aria-label', label)
    input.addEventListener('change', () => {
      const value = Math.max(1, Math.floor(Number(input.value)))
      if (Number.isFinite(value)) onChange(value)
    })
    controls.appendChild(createStepButton(`Retirer une piste : ${label.toLowerCase()}`, '−', () => {
      onChange(Math.max(1, initialValue - 1))
    }))
    controls.appendChild(input)
    controls.appendChild(createStepButton(`Ajouter une piste : ${label.toLowerCase()}`, '+', () => {
      onChange(initialValue + 1)
    }))
    row.appendChild(controls)
    return row
  }

  /** Creates a cqw gutter field, keeping its authored unit visible beside the number. */
  function createGapControl(label: string, initialValue: number, onChange: (value: number) => void): HTMLElement {
    const row = document.createElement('label')
    row.className = 'capsule-editor__field'
    row.textContent = label
    const controls = document.createElement('span')
    controls.className = 'capsule-editor__unit-field'
    const input = document.createElement('input')
    input.type = 'number'
    input.min = '0'
    input.step = '0.1'
    input.value = String(initialValue)
    input.setAttribute('aria-label', label)
    input.addEventListener('change', () => {
      const value = Number(input.value)
      if (Number.isFinite(value) && value >= 0) onChange(value)
    })
    const unit = document.createElement('span')
    unit.textContent = 'cqw'
    controls.append(input, unit)
    row.appendChild(controls)
    return row
  }

  /** Creates one compact button used to add or remove a grid track. */
  function createStepButton(label: string, text: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = text
    button.setAttribute('aria-label', label)
    button.title = label
    button.addEventListener('click', onClick)
    return button
  }

  render()
  return {
    render,
    setDisabled(value): void {
      disabled = value
      fieldset.disabled = value
    },
    destroy(): void {
      fieldset.remove()
    },
  }
}
