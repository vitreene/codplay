import { Clock, GripVertical, Plus, Settings2, Trash2 } from 'lucide-static'
import { on, type RemixNode } from 'remix/component'
import type { ListContent, ListPrefix, ListRow } from '../domain/list-types'
import { ListService } from '../domain/list-service'
import { CAROUSEL_TRANSITION_OPTIONS } from '../../revelation/revelation-config'
import { parseListPaste } from './list-paste-parser'
import { renderLucideIcon } from '../../../core/authoring/lucide-static-icon'

const ROW_DRAG_MIME_TYPE = 'application/x-elce-list-row+json'
const PREFIX_OPTIONS: readonly Readonly<{ value: ListPrefix; label: string }>[] = [
  { value: 'none', label: 'Aucun' },
  { value: 'disc', label: '•' },
  { value: 'square', label: '▪' },
  { value: 'dash', label: '–' },
  { value: 'lower-alpha', label: 'a.' },
  { value: 'decimal', label: '1.' },
  { value: 'lower-roman', label: 'i.' },
]

export interface ListEditorProps {
  readonly list: ListContent
  readonly idPrefix: string
  readonly createId: () => string
  readonly onChange: (list: ListContent) => void
  readonly onShowView?: () => void
}

/** Renders the reusable List editor without depending on its hosting resource. */
export function renderListEditor(props: ListEditorProps): RemixNode {
  const service = new ListService()
  const { list } = props
  const prefixOptions = [
    ...PREFIX_OPTIONS,
    { value: 'custom' as const, label: `${list.customMarker} Personnalisé` },
  ]
  const showsStart = isOrderedPrefix(list.prefix)
  return <section
    id={`${props.idPrefix}-list-editor`}
    className={props.onShowView === undefined ? 'elce-list-editor' : 'elce-list-editor elce-list-bdc-frame'}
    aria-label={props.onShowView === undefined ? 'Liste à points' : 'Liste à points — mode édition'}
  >
    {props.onShowView === undefined ? null : renderListModeHeader(props.idPrefix, 'Passer en mode vue', 'Mode vue', props.onShowView)}
    <div id={`${props.idPrefix}-list-settings`} className="elce-list-editor__settings">
      <label id={`${props.idPrefix}-list-prefix-label`} className="elce-list-editor__setting">
        <span id={`${props.idPrefix}-list-prefix-caption`}>Préfixe</span>
        <select
          id={`${props.idPrefix}-list-prefix`}
          aria-label="Préfixe de la liste"
          mix={on<HTMLSelectElement, 'change'>('change', (event) => props.onChange(service.setPresentation(list, { prefix: event.currentTarget.value as ListPrefix })))}
        >
          {prefixOptions.map((option) => <option id={`${props.idPrefix}-list-prefix-${option.value}`} key={option.value} value={option.value} selected={option.value === list.prefix}>{option.label}</option>)}
        </select>
      </label>
      {showsStart
        ? <label id={`${props.idPrefix}-list-start-label`} className="elce-list-editor__setting elce-list-editor__setting--start">
          <span id={`${props.idPrefix}-list-start-caption`}>Départ</span>
          <input
            id={`${props.idPrefix}-list-start`}
            type="number"
            min={1}
            step={1}
            value={list.start}
            aria-label="Numéro de départ"
            mix={on<HTMLInputElement, 'input'>('input', (event) => {
              const start = Number(event.currentTarget.value)
              if (Number.isInteger(start) && start >= 1) props.onChange(service.setPresentation(list, { start }))
            })}
          />
        </label>
        : null}
      {list.prefix === 'custom'
        ? <label id={`${props.idPrefix}-list-marker-label`} className="elce-list-editor__setting">
          <span id={`${props.idPrefix}-list-marker-caption`}>Marqueur</span>
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
      <label id={`${props.idPrefix}-list-transition-label`} className="elce-list-editor__setting">
        <span id={`${props.idPrefix}-list-transition-caption`}>Transition</span>
        <select
          id={`${props.idPrefix}-list-transition`}
          aria-label="Transition d’apparition des items"
          mix={on<HTMLSelectElement, 'change'>('change', (event) => props.onChange(service.setPresentation(list, { transition: event.currentTarget.value as ListContent['transition'] })))}
        >
          {CAROUSEL_TRANSITION_OPTIONS.map((option) => <option
            id={`${props.idPrefix}-list-transition-option-${option.value}`}
            key={option.value}
            value={option.value}
            selected={option.value === list.transition}
          >{option.label}</option>)}
        </select>
      </label>
      <label id={`${props.idPrefix}-list-interval-label`} className="elce-list-editor__setting">
        <span id={`${props.idPrefix}-list-interval-caption`}>Délai</span>
        <input
          id={`${props.idPrefix}-list-interval`}
          type="number"
          min={0}
          step={0.1}
          value={list.intervalMs / 1000}
          aria-label="Délai entre les lignes en secondes"
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
      className="elce-list-editor__add elce-bdc-icon-button"
      type="button"
      aria-label="Ajouter une ligne"
      title="Ajouter une ligne"
      mix={on<HTMLButtonElement, 'click'>('click', () => props.onChange(service.addRow(list, props.createId())))}
    >
      {renderLucideIcon(Plus, `${props.idPrefix}-list-add-icon`)}
    </button>
  </section>
}

/** Renders the authored List in place without exposing its configuration controls. */
export function renderListView(
  list: ListContent,
  idPrefix: string,
  onEdit: () => void,
): RemixNode {
  const ordered = isOrderedPrefix(list.prefix)
  const ListTag = ordered ? 'ol' : 'ul'
  const listStyleType = ordered
    ? list.prefix === 'lower-alpha' ? 'lower-alpha' : list.prefix === 'lower-roman' ? 'lower-roman' : 'decimal'
    : list.prefix === 'disc' || list.prefix === 'square' ? list.prefix : 'none'
  const orderedType = list.prefix === 'lower-alpha' ? 'a' : list.prefix === 'lower-roman' ? 'i' : '1'
  return <section
    id={`${idPrefix}-list-view`}
    className="elce-list-bdc-frame elce-list-bdc-view"
    aria-label="Liste à points — mode affichage"
  >
    {renderListModeHeader(idPrefix, 'Modifier la liste à points', 'Modifier', onEdit)}
    <ListTag
      id={`${idPrefix}-list-preview`}
      className={`elce-list-bdc-view__rows elce-list-bdc-view__rows--${list.prefix}`}
      start={ordered ? list.start : undefined}
      type={ordered ? orderedType : undefined}
      style={{ listStyleType }}
    >
      {list.rows.map((row) => <li
        id={`${idPrefix}-list-preview-row-${row.id}`}
        key={row.id}
        className="elce-list-bdc-view__row"
      >
        {list.prefix === 'dash' || list.prefix === 'custom'
          ? <>
            <span id={`${idPrefix}-list-preview-marker-${row.id}`} className="elce-list-bdc-view__marker" aria-hidden="true">
              {list.prefix === 'dash' ? '–' : list.customMarker}
            </span>
            <span id={`${idPrefix}-list-preview-text-${row.id}`}>{row.text}</span>
          </>
          : row.text}
      </li>)}
    </ListTag>
  </section>
}

/** Identifies prefixes whose marker is an ordered numeral or letter. */
function isOrderedPrefix(prefix: ListPrefix): boolean {
  return prefix === 'lower-alpha' || prefix === 'decimal' || prefix === 'lower-roman'
}

/** Formats a millisecond value as a concise French-localized seconds label. */
function formatSeconds(milliseconds: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3, useGrouping: false }).format(milliseconds / 1000)
}

/** Hides a timing input as soon as it loses focus. */
function closeTimingInputOnBlur(input: HTMLInputElement): void {
  const details = input.closest('details')
  if (details === null) return
  details.open = false
}

/** Places the shared circular mode button in the List BDC header. */
function renderListModeHeader(idPrefix: string, label: string, title: string, onClick: () => void): RemixNode {
  return <div id={`${idPrefix}-list-mode-header`} className="elce-list-bdc-frame__header">
    <span
      id={`${idPrefix}-list-drag-handle`}
      className="elce-bdc-drag-handle elce-list-bdc-drag-handle"
      draggable={true}
      role="button"
      aria-label="Déplacer la liste à points"
      title="Glisser pour déplacer"
    >↕</span>
    <button
      id={`${idPrefix}-list-mode-toggle`}
      className="elce-bdc-mode-toggle"
      type="button"
      aria-label={label}
      title={title}
      mix={on<HTMLButtonElement, 'click'>('click', onClick)}
    >{renderLucideIcon(Settings2, `${idPrefix}-list-mode-icon`)}</button>
  </div>
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
        if (event.dataTransfer === null || !Array.from(event.dataTransfer.types).includes(ROW_DRAG_MIME_TYPE)) return
        event.preventDefault()
        setListDropTarget(event.currentTarget, getListDropPosition(event.currentTarget, event.clientY))
      }),
      on<HTMLLIElement, 'dragleave'>('dragleave', (event) => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return
        event.currentTarget.removeAttribute('data-drop-position')
      }),
      on<HTMLLIElement, 'drop'>('drop', (event) => {
        const sourceId = event.dataTransfer?.getData(ROW_DRAG_MIME_TYPE)
        if (sourceId === undefined || sourceId.length === 0) return
        event.preventDefault()
        const position = getListDropPosition(event.currentTarget, event.clientY)
        clearListDropTargets(event.currentTarget.parentElement)
        props.onChange(service.moveRow(props.list, sourceId, index + (position === 'after' ? 1 : 0)))
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
      mix={[
        on<HTMLButtonElement, 'dragstart'>('dragstart', (event) => {
          if (event.dataTransfer === null) return
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData(ROW_DRAG_MIME_TYPE, row.id)
        }),
        on<HTMLButtonElement, 'dragend'>('dragend', (event) => clearListDropTargets(event.currentTarget.closest('ol'))),
      ]}
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
    <details id={`${props.idPrefix}-list-row-delay-details-${row.id}`} className="elce-list-editor__timing">
      <summary
        id={`${props.idPrefix}-list-row-delay-toggle-${row.id}`}
        className="elce-bdc-icon-button elce-list-editor__clock"
        data-customized={row.delayMs !== null}
        aria-label={`Afficher le délai de la ligne ${rowNumber}`}
        title={row.delayMs === null
          ? `Ligne ${rowNumber} : intervalle (${formatSeconds(props.list.intervalMs)} s)`
          : `Délai ligne ${rowNumber} : ${formatSeconds(row.delayMs)} s`}
      >{renderLucideIcon(Clock, `${props.idPrefix}-list-row-delay-icon-${row.id}`)}</summary>
      <input
        id={`${props.idPrefix}-list-row-delay-${row.id}`}
        className="elce-list-editor__delay"
        type="number"
        min={0}
        step={0.1}
        value={row.delayMs === null ? '' : row.delayMs / 1000}
        aria-label={`Délai avant la ligne ${rowNumber} en secondes, vide pour le comportement par défaut`}
        mix={[
          on<HTMLInputElement, 'input'>('input', (event) => {
            const value = event.currentTarget.value
            const delayMs = value === '' ? null : Number(value) * 1000
            if (delayMs === null || Number.isFinite(delayMs) && delayMs >= 0) props.onChange(service.setRowDelay(props.list, row.id, delayMs))
          }),
          on<HTMLInputElement, 'blur'>('blur', (event) => closeTimingInputOnBlur(event.currentTarget)),
          on<HTMLInputElement, 'keydown'>('keydown', (event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            event.currentTarget.blur()
          }),
        ]}
      />
    </details>
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

/** Resolves whether a row's leading or trailing edge is the active insertion target. */
function getListDropPosition(row: HTMLLIElement, clientY: number): 'before' | 'after' {
  const bounds = row.getBoundingClientRect()
  return clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
}

/** Displays a single insertion line for the row currently under the dragged item. */
function setListDropTarget(row: HTMLLIElement, position: 'before' | 'after'): void {
  clearListDropTargets(row.parentElement)
  row.dataset.dropPosition = position
}

/** Removes insertion lines when a drag leaves or completes in a List editor. */
function clearListDropTargets(list: Element | null): void {
  list?.querySelectorAll('.elce-list-editor__row[data-drop-position]').forEach((row) => row.removeAttribute('data-drop-position'))
}

/** Counts user-perceived characters for the one-character custom marker field. */
function graphemeCount(value: string): number {
  if (typeof Intl.Segmenter === 'function') return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)).length
  return Array.from(value).length
}
