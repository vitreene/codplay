import { GripVertical, Plus, Trash2 } from 'lucide-static'
import { on, type RemixNode } from 'remix/component'
import type { ListContent, ListPrefix, ListRow } from '../domain/list-types'
import { ListService } from '../domain/list-service'
import { parseListPaste } from './list-paste-parser'
import { renderLucideIcon } from '../../../core/authoring/lucide-static-icon'

const ROW_DRAG_MIME_TYPE = 'application/x-elce-list-row+json'
const PREFIX_OPTIONS: readonly Readonly<{ value: ListPrefix; label: string }>[] = [
  { value: 'none', label: 'Aucun' },
  { value: 'disc', label: 'Disque' },
  { value: 'square', label: 'Carré' },
  { value: 'dash', label: 'Tiret' },
  { value: 'lower-alpha', label: 'Lettre (a.)' },
  { value: 'decimal', label: 'Numéro arabe' },
  { value: 'lower-roman', label: 'Numéro romain' },
  { value: 'custom', label: 'Caractère personnalisé' },
]

export interface ListEditorProps {
  readonly list: ListContent
  readonly idPrefix: string
  readonly createId: () => string
  readonly onChange: (list: ListContent) => void
}

/** Renders the reusable List editor without depending on its hosting resource. */
export function renderListEditor(props: ListEditorProps): RemixNode {
  const service = new ListService()
  const { list } = props
  return <section id={`${props.idPrefix}-list-editor`} className="elce-list-editor" aria-label="Liste à points">
    <div id={`${props.idPrefix}-list-settings`} className="elce-list-editor__settings">
      <label id={`${props.idPrefix}-list-prefix-label`} className="elce-list-editor__setting">
        <span id={`${props.idPrefix}-list-prefix-caption`}>Préfixe</span>
        <select
          id={`${props.idPrefix}-list-prefix`}
          aria-label="Préfixe des lignes"
          mix={on<HTMLSelectElement, 'change'>('change', (event) => props.onChange(service.setPresentation(list, { prefix: event.currentTarget.value as ListPrefix })))}
        >
          {PREFIX_OPTIONS.map((option) => <option id={`${props.idPrefix}-list-prefix-${option.value}`} key={option.value} value={option.value} selected={option.value === list.prefix}>{option.label}</option>)}
        </select>
      </label>
      {list.prefix === 'decimal' || list.prefix === 'lower-roman'
        ? <label id={`${props.idPrefix}-list-start-label`} className="elce-list-editor__setting">
          <span id={`${props.idPrefix}-list-start-caption`}>Début</span>
          <input
            id={`${props.idPrefix}-list-start`}
            type="number"
            min={1}
            step={1}
            value={list.start}
            aria-label="Début de la numérotation"
            mix={on<HTMLInputElement, 'input'>('input', (event) => {
              const start = Number(event.currentTarget.value)
              if (Number.isInteger(start) && start >= 1) props.onChange(service.setPresentation(list, { start }))
            })}
          />
        </label>
        : null}
      {list.prefix === 'custom'
        ? <label id={`${props.idPrefix}-list-marker-label`} className="elce-list-editor__setting">
          <span id={`${props.idPrefix}-list-marker-caption`}>Caractère de puce</span>
          <input
            id={`${props.idPrefix}-list-marker`}
            type="text"
            value={list.customMarker}
            aria-label="Caractère de puce personnalisé"
            mix={[
              on<HTMLInputElement, 'input'>('input', (event) => {
                const marker = event.currentTarget.value
                if (marker.length === 0) return
                if (graphemeCount(marker) !== 1) {
                  event.currentTarget.value = list.customMarker
                  return
                }
                props.onChange(service.setPresentation(list, { customMarker: marker }))
              }),
              on<HTMLInputElement, 'blur'>('blur', (event) => {
                if (event.currentTarget.value.length === 0) event.currentTarget.value = list.customMarker
              }),
            ]}
          />
        </label>
        : null}
      <label id={`${props.idPrefix}-list-interval-label`} className="elce-list-editor__setting">
        <span id={`${props.idPrefix}-list-interval-caption`}>Intervalle entre les lignes (s)</span>
        <input
          id={`${props.idPrefix}-list-interval`}
          type="number"
          min={0}
          step={0.1}
          value={list.intervalMs / 1000}
          aria-label="Intervalle entre les lignes en secondes"
          mix={on<HTMLInputElement, 'input'>('input', (event) => {
            const intervalMs = Number(event.currentTarget.value) * 1000
            if (Number.isFinite(intervalMs) && intervalMs >= 0) props.onChange(service.setPresentation(list, { intervalMs }))
          })}
        />
      </label>
    </div>
    <ol id={`${props.idPrefix}-list-rows`} className="elce-list-editor__rows">
      {list.rows.map((row, index) => renderListRow(row, index, props, service))}
    </ol>
    <button
      id={`${props.idPrefix}-list-add-row`}
      className="elce-list-editor__add elce-add-content-action"
      type="button"
      aria-label="Ajouter une ligne"
      title="Ajouter une ligne"
      mix={on<HTMLButtonElement, 'click'>('click', () => props.onChange(service.addRow(list, props.createId())))}
    >
      {renderLucideIcon(Plus, `${props.idPrefix}-list-add-icon`)}
      <span id={`${props.idPrefix}-list-add-label`} className="elce-add-content-action__label">Ligne</span>
    </button>
  </section>
}

/** Renders an editable row with stable identity, optional delay and reorder controls. */
function renderListRow(row: ListRow, index: number, props: ListEditorProps, service: ListService): RemixNode {
  const rowNumber = index + 1
  return <li
    key={row.id}
    id={`${props.idPrefix}-list-row-${row.id}`}
    className="elce-list-editor__row"
    mix={[
      on<HTMLLIElement, 'dragover'>('dragover', (event) => {
        if (event.dataTransfer !== null && Array.from(event.dataTransfer.types).includes(ROW_DRAG_MIME_TYPE)) event.preventDefault()
      }),
      on<HTMLLIElement, 'drop'>('drop', (event) => {
        const sourceId = event.dataTransfer?.getData(ROW_DRAG_MIME_TYPE)
        if (sourceId === undefined || sourceId.length === 0) return
        event.preventDefault()
        props.onChange(service.moveRow(props.list, sourceId, index))
      }),
    ]}
  >
    <button
      id={`${props.idPrefix}-list-row-drag-${row.id}`}
      className="elce-list-editor__drag elce-bdc-icon-button"
      type="button"
      draggable={true}
      aria-label={`Réordonner la ligne ${rowNumber}`}
      title="Glisser pour réordonner"
      mix={on<HTMLButtonElement, 'dragstart'>('dragstart', (event) => {
        if (event.dataTransfer === null) return
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData(ROW_DRAG_MIME_TYPE, row.id)
      })}
    >{renderLucideIcon(GripVertical, `${props.idPrefix}-list-row-drag-icon-${row.id}`)}</button>
    <input
      id={`${props.idPrefix}-list-row-text-${row.id}`}
      type="text"
      aria-label={`Ligne ${rowNumber}`}
      placeholder={`Ligne ${rowNumber}`}
      value={row.text}
      mix={[
        on<HTMLInputElement, 'input'>('input', (event) => props.onChange(service.setRowText(props.list, row.id, event.currentTarget.value))),
        on<HTMLInputElement, 'paste'>('paste', (event) => {
          const clipboard = event.clipboardData
          if (clipboard === null) return
          const parsed = parseListPaste(clipboard.getData('text/html'), clipboard.getData('text/plain'))
          if (parsed === null) return
          event.preventDefault()
          props.onChange(service.replaceRowText(props.list, row.id, parsed, props.createId))
        }),
      ]}
    />
    <input
      id={`${props.idPrefix}-list-row-delay-${row.id}`}
      className="elce-list-editor__delay"
      type="number"
      min={0}
      step={0.1}
      value={row.delayMs === null ? '' : row.delayMs / 1000}
      aria-label={`Délai avant la ligne ${rowNumber} en secondes, vide pour le comportement par défaut`}
      title={rowNumber === 1 ? 'Délai (s). Vide : la première ligne apparaît à l’entrée.' : 'Délai (s). Vide : utilise l’intervalle commun.'}
      mix={on<HTMLInputElement, 'input'>('input', (event) => {
        const value = event.currentTarget.value
        const delayMs = value === '' ? null : Number(value) * 1000
        if (delayMs === null || Number.isFinite(delayMs) && delayMs >= 0) props.onChange(service.setRowDelay(props.list, row.id, delayMs))
      })}
    />
    <button
      id={`${props.idPrefix}-list-row-delete-${row.id}`}
      className="elce-list-editor__delete elce-bdc-icon-button elce-bdc-icon-button--danger"
      type="button"
      aria-label={`Supprimer la ligne ${rowNumber}`}
      title="Supprimer la ligne"
      mix={on<HTMLButtonElement, 'click'>('click', () => props.onChange(service.removeRow(props.list, row.id)))}
    >{renderLucideIcon(Trash2, `${props.idPrefix}-list-row-delete-icon-${row.id}`)}</button>
  </li>
}

/** Counts user-perceived characters for the one-character custom marker field. */
function graphemeCount(value: string): number {
  if (typeof Intl.Segmenter === 'function') return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)).length
  return Array.from(value).length
}
