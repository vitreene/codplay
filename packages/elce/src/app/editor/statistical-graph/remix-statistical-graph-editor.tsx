import { on, type RemixNode } from 'remix/ui'
import { Columns3, Eye, Pencil, Rows3, Trash2, X } from 'lucide-static'
import { ElceStatisticalGraphSceneBuilder } from '../../../builders/statistical-graph/statistical-graph-scene-builder'
import { BDC_TYPE, DEFAULT_PRESET_ID, STATISTICAL_GRAPH_RENDERING } from '../../../config/document-config'
import type { StatisticalGraphLayoutId, StatisticalGraphRendering } from '../../../config/document-config-types'
import type { Bdc } from '../../../domain/document/document-types'
import type { StatisticalGraphContent } from '../../../domain/statistical-graph/statistical-graph-types'
import type { StatisticalGraphEditorActions } from '../../facades/statistical-graph/statistical-graph-facade-types'
import { renderLucideIcon } from '../../remix/lucide-static-icon'

const renderingOptions = [
  { value: STATISTICAL_GRAPH_RENDERING.BAR, label: 'Barres' },
  { value: STATISTICAL_GRAPH_RENDERING.LINE, label: 'Courbes' },
  { value: STATISTICAL_GRAPH_RENDERING.PIE, label: 'Secteurs' },
  { value: STATISTICAL_GRAPH_RENDERING.TABLE, label: 'Tableau' },
] as const

const layoutOptions = [
  { value: DEFAULT_PRESET_ID.STATISTICAL_GRAPH_ABOVE_TEXT, label: 'Graphe au-dessus du texte' },
  { value: DEFAULT_PRESET_ID.STATISTICAL_GRAPH_SIDE_BY_SIDE, label: 'Graphe à côté du texte' },
] as const

const statisticalGraphSceneBuilder = new ElceStatisticalGraphSceneBuilder()

type GridPosition = Readonly<{ rowIndex: number; columnIndex: number }>

/** Keeps the active grid cell selected while document commands rerender the editor. */
const selectedGridPositionByBdcId = new Map<string, GridPosition>()

/** Renders the Statistical Graph authoring form and its replace-on-paste table editor. */
export function renderRemixStatisticalGraphEditor(
  bdc: Bdc,
  actions: StatisticalGraphEditorActions,
  onDelete?: () => void,
  toolbarContent?: RemixNode,
  appearanceTrigger?: RemixNode,
): RemixNode {
  if (bdc.type !== BDC_TYPE.STATISTICAL_GRAPH || bdc.statisticalGraph == null) return null
  const content = bdc.statisticalGraph
  const deleteButton = onDelete === undefined ? null : <button
    id={`elce-statistical-graph-delete-${bdc.id}`}
    className="elce-bdc-icon-button elce-bdc-icon-button--danger"
    type="button"
    aria-label="Supprimer le graphe de cette page"
    title="Supprimer le graphe de cette page"
    mix={on<HTMLButtonElement, 'click'>('click', onDelete)}
  >
    {renderLucideIcon(Trash2, `elce-statistical-graph-delete-icon-${bdc.id}`)}
  </button>

  /** Opens a preview of this graph BDC using its existing scene builder. */
  const openGraphPreview = (): void => {
    const dialog = document.getElementById(`elce-statistical-graph-preview-dialog-${bdc.id}`) as HTMLDialogElement | null
    const preview = document.getElementById(`elce-statistical-graph-preview-content-${bdc.id}`)
    if (dialog === null || preview === null) return
    preview.innerHTML = statisticalGraphSceneBuilder.buildContent(
      content,
      bdc.presetId,
      `elce-statistical-graph-preview-${bdc.id}`,
    ).markup
    if (!dialog.open) dialog.showModal()
  }

  /** Closes this graph's native modal preview. */
  const closeGraphPreview = (): void => {
    const dialog = document.getElementById(`elce-statistical-graph-preview-dialog-${bdc.id}`) as HTMLDialogElement | null
    if (dialog?.open === true) dialog.close()
  }

  return <section
    id={`elce-statistical-graph-editor-${bdc.id}`}
    className="elce-statistical-graph-editor"
    aria-label="Éditeur de graphe"
  >
    <header
      id={`elce-statistical-graph-editor-heading-${bdc.id}`}
      className="elce-statistical-graph-editor__header"
    >
      <h3
        id={`elce-statistical-graph-editor-title-${bdc.id}`}
      >
        Graphe
      </h3>
      <div
        id={`elce-statistical-graph-editor-header-actions-${bdc.id}`}
        className="elce-statistical-graph-editor__header-actions"
      >
        <button
          id={`elce-statistical-graph-preview-open-${bdc.id}`}
          className="elce-statistical-graph-editor__preview-button"
          type="button"
          aria-label="Prévisualiser le graphe"
          aria-haspopup="dialog"
          aria-controls={`elce-statistical-graph-preview-dialog-${bdc.id}`}
          mix={on<HTMLButtonElement, 'click'>('click', openGraphPreview)}
        >
          {renderLucideIcon(Eye, `elce-statistical-graph-preview-icon-${bdc.id}`)}
          Aperçu
        </button>
        {appearanceTrigger}
        {deleteButton}
      </div>
    </header>
    <label
      id={`elce-statistical-graph-layout-label-${bdc.id}`}
      className="elce-statistical-graph-editor__field elce-statistical-graph-editor__layout"
    >
      Disposition
      <select
        id={`elce-statistical-graph-layout-${bdc.id}`}
        mix={on<HTMLSelectElement, 'change'>('change', (event) => actions.setLayout(event.currentTarget.value as StatisticalGraphLayoutId))}
      >
        {layoutOptions.map((option) => <option
          id={`elce-statistical-graph-layout-option-${bdc.id}-${option.value}`}
          key={option.value}
          value={option.value}
          selected={bdc.presetId === option.value}
        >
          {option.label}
        </option>)}
      </select>
    </label>
    <fieldset
      id={`elce-statistical-graph-editor-meta-${bdc.id}`}
      className="elce-statistical-graph-editor__panel"
    >
      <legend
        id={`elce-statistical-graph-editor-copy-legend-${bdc.id}`}
      >
        Titres et commentaire
      </legend>
      <div
        id={`elce-statistical-graph-editor-meta-fields-${bdc.id}`}
        className="elce-statistical-graph-editor__meta-fields"
      >
        {renderTextField(bdc.id, 'Surtitre', 'overline', content.overline, actions)}
        {renderTextField(bdc.id, 'Titre', 'title', content.title, actions)}
        {renderTextField(bdc.id, 'Commentaire éditorial', 'editorialText', content.editorialText, actions, true)}
      </div>
    </fieldset>
    <fieldset
      id={`elce-statistical-graph-editor-representation-${bdc.id}`}
      className="elce-statistical-graph-editor__panel"
    >
      <legend
        id={`elce-statistical-graph-editor-representation-legend-${bdc.id}`}
      >
        Représentation et libellés
      </legend>
      <div
        id={`elce-statistical-graph-editor-settings-${bdc.id}`}
        className="elce-statistical-graph-editor__toolbar"
      >
        <label
          id={`elce-statistical-graph-rendering-label-${bdc.id}`}
          className="elce-statistical-graph-editor__field"
        >
          Représentation
          <select
            id={`elce-statistical-graph-rendering-${bdc.id}`}
            aria-label="Représentation du graphe"
            mix={on<HTMLSelectElement, 'change'>('change', (event) => actions.setRendering(event.currentTarget.value as StatisticalGraphRendering))}
          >
            {renderingOptions.map((option) => <option
              id={`elce-statistical-graph-rendering-option-${bdc.id}-${option.value}`}
              key={option.value}
              value={option.value}
              selected={content.rendering === option.value}
            >
              {option.label}
            </option>)}
          </select>
        </label>
        <label
          id={`elce-statistical-graph-transpose-label-${bdc.id}`}
          className="elce-statistical-graph-editor__transpose-toggle"
        >
          <input
            id={`elce-statistical-graph-transpose-${bdc.id}`}
            type="checkbox"
            checked={content.transposeEnabled ?? true}
            aria-label="Transposer les catégories et les séries dans le rendu"
            mix={on<HTMLInputElement, 'change'>('change', (event) => actions.setTranspose(event.currentTarget.checked))}
          />
          <span id={`elce-statistical-graph-transpose-text-${bdc.id}`}>
            Transposer catégories et séries
          </span>
        </label>
        {content.rendering === STATISTICAL_GRAPH_RENDERING.PIE
          ? content.transposeEnabled !== false
            ? renderPieCategorySelect(bdc.id, content, actions)
            : renderPieSeriesSelect(bdc.id, content, actions)
          : null}
        {toolbarContent}
      </div>
      <div
        id={`elce-statistical-graph-editor-axes-${bdc.id}`}
        className="elce-statistical-graph-editor__axis-fields"
      >
        {renderTextField(bdc.id, 'Libellé des catégories', 'categoryAxisLabel', content.categoryAxisLabel, actions)}
        {renderTextField(bdc.id, 'Libellé des séries', 'seriesAxisLabel', content.seriesAxisLabel, actions)}
      </div>
    </fieldset>
    {renderGridEditor(bdc.id, content, actions)}
    <dialog
      id={`elce-statistical-graph-preview-dialog-${bdc.id}`}
      className="elce-statistical-graph-preview-dialog"
      aria-labelledby={`elce-statistical-graph-preview-title-${bdc.id}`}
    >
      <header
        id={`elce-statistical-graph-preview-header-${bdc.id}`}
        className="elce-statistical-graph-preview-dialog__header"
      >
        <h2 id={`elce-statistical-graph-preview-title-${bdc.id}`}>
          Aperçu du graphe
        </h2>
        <button
          id={`elce-statistical-graph-preview-close-${bdc.id}`}
          className="elce-statistical-graph-preview-dialog__close"
          type="button"
          aria-label="Fermer l’aperçu du graphe"
          title="Fermer l’aperçu du graphe"
          mix={on<HTMLButtonElement, 'click'>('click', closeGraphPreview)}
        >
          {renderLucideIcon(X, `elce-statistical-graph-preview-close-icon-${bdc.id}`)}
        </button>
      </header>
      <div
        id={`elce-statistical-graph-preview-content-${bdc.id}`}
        className="elce-statistical-graph-preview-dialog__content"
      />
    </dialog>
  </section>
}

/** Renders one authored text value and commits its plain text to the graph command. */
function renderTextField(
  bdcId: string,
  label: string,
  field: 'overline' | 'title' | 'categoryAxisLabel' | 'seriesAxisLabel' | 'editorialText',
  value: string,
  actions: StatisticalGraphEditorActions,
  multiline = false,
): RemixNode {
  const id = `elce-statistical-graph-${field}-${bdcId}`
  return <label
    id={`${id}-label`}
    className={multiline
      ? 'elce-statistical-graph-editor__field elce-statistical-graph-editor__field--wide'
      : 'elce-statistical-graph-editor__field'}
  >
    {label}
    {multiline
      ? <textarea
        id={id}
        aria-label={label}
        value={value}
        data-elce-profile-token-target="true"
        mix={on<HTMLTextAreaElement, 'input'>('input', (event) => actions.setText(field, event.currentTarget.value))}
      />
      : <input
        id={id}
        type="text"
        aria-label={label}
        value={value}
        data-elce-profile-token-target="true"
        mix={on<HTMLInputElement, 'input'>('input', (event) => actions.setText(field, event.currentTarget.value))}
      />}
  </label>
}

/** Selects the one data series used by a sector chart. */
function renderPieSeriesSelect(bdcId: string, content: StatisticalGraphContent, actions: StatisticalGraphEditorActions): RemixNode {
  return <label
    id={`elce-statistical-graph-pie-series-label-${bdcId}`}
    className="elce-statistical-graph-editor__field"
  >
    Série affichée
    <select
      id={`elce-statistical-graph-pie-series-${bdcId}`}
      aria-label="Série affichée dans le graphe en secteurs"
      mix={on<HTMLSelectElement, 'change'>('change', (event) => actions.setPieSeries(event.currentTarget.value))}
    >
      {content.series.map((series) => <option
        id={`elce-statistical-graph-pie-series-option-${bdcId}-${series.id}`}
        key={series.id}
        value={series.id}
        selected={series.id === content.pieSeriesId}
      >
        {series.label || 'Série sans nom'}
      </option>)}
    </select>
  </label>
}

/** Selects the one category used by a transposed sector chart. */
function renderPieCategorySelect(bdcId: string, content: StatisticalGraphContent, actions: StatisticalGraphEditorActions): RemixNode {
  return <label
    id={`elce-statistical-graph-pie-category-label-${bdcId}`}
    className="elce-statistical-graph-editor__field"
  >
    Catégorie affichée
    <select
      id={`elce-statistical-graph-pie-category-${bdcId}`}
      aria-label="Catégorie affichée dans le graphe en secteurs transposé"
      mix={on<HTMLSelectElement, 'change'>('change', (event) => actions.setPieCategory(event.currentTarget.value))}
    >
      {content.categories.map((category) => <option
        id={`elce-statistical-graph-pie-category-option-${bdcId}-${category.id}`}
        key={category.id}
        value={category.id}
        selected={category.id === (content.pieCategoryId ?? content.categories[0]?.id)}
      >
        {category.label || 'Catégorie sans nom'}
      </option>)}
    </select>
  </label>
}

/** Renders the data-sized grid, heading toggles, selected-cell editor, and paste handler. */
function renderGridEditor(bdcId: string, content: StatisticalGraphContent, actions: StatisticalGraphEditorActions): RemixNode {
  const cellValueByKey = new Map(content.values.map((entry) => [`${entry.categoryId}\u0000${entry.seriesId}`, entry.value]))
  const hasColumnLabels = content.columnLabelsEnabled ?? true
  const hasRowLabels = content.rowLabelsEnabled ?? true
  const headerRowOffset = Number(hasColumnLabels)
  const headerColumnOffset = Number(hasRowLabels)
  const savedSelection = selectedGridPositionByBdcId.get(bdcId) ?? {
    rowIndex: headerRowOffset,
    columnIndex: headerColumnOffset,
  }
  const selected = {
    rowIndex: Math.min(savedSelection.rowIndex, content.categories.length + headerRowOffset),
    columnIndex: Math.min(savedSelection.columnIndex, content.series.length + headerColumnOffset),
  }
  if (hasColumnLabels && hasRowLabels && selected.rowIndex === 0 && selected.columnIndex === 0) {
    selected.rowIndex = headerRowOffset
    selected.columnIndex = headerColumnOffset
  }
  selectedGridPositionByBdcId.set(bdcId, selected)
  const rowCount = content.categories.length + headerRowOffset + 1
  const columnCount = content.series.length + headerColumnOffset + 1
  const selectedValue = gridCellValue(content, cellValueByKey, selected.rowIndex, selected.columnIndex)

  /** Updates the current cell and its visible highlight without a document command. */
  const selectPosition = (position: GridPosition, value: string): void => {
    selectedGridPositionByBdcId.set(bdcId, position)
    const field = document.getElementById(`elce-statistical-graph-selected-cell-${bdcId}`) as HTMLInputElement | null
    if (field !== null) field.value = value
    document.querySelectorAll<HTMLElement>(`#elce-statistical-graph-grid-${bdcId} [data-grid-cell="true"]`).forEach((cell) => {
      cell.classList.toggle('elce-statistical-graph-editor__grid-cell--selected', cell.id === gridCellId(bdcId, position.rowIndex, position.columnIndex))
    })
  }

  /** Commits the active cell and moves selection according to the spreadsheet keys. */
  const moveSelection = (event: KeyboardEvent, position: GridPosition): void => {
    const horizontalStep = event.key === 'Tab' ? (event.shiftKey ? -1 : 1) : 0
    let rowIndex = position.rowIndex
    let columnIndex = position.columnIndex
    if (horizontalStep !== 0) columnIndex += horizontalStep
    else if (event.key === 'Enter' || event.key === 'Return' || event.key === 'ArrowDown') rowIndex += 1
    else if (event.key === 'ArrowUp') rowIndex -= 1
    else if (event.key === 'ArrowLeft') columnIndex -= 1
    else if (event.key === 'ArrowRight') columnIndex += 1
    else return

    event.preventDefault()
    if (event.currentTarget instanceof HTMLInputElement) {
      actions.setGridCell(position.rowIndex, position.columnIndex, event.currentTarget.value)
    }
    rowIndex = Math.min(rowIndex, rowCount - 1)
    columnIndex = Math.min(columnIndex, columnCount - 1)
    if (rowIndex < 0 || columnIndex < 0
      || (hasColumnLabels && hasRowLabels && rowIndex === 0 && columnIndex === 0)) return
    const nextPosition = { rowIndex, columnIndex }
    const value = gridCellValue(content, cellValueByKey, rowIndex, columnIndex)
    selectPosition(nextPosition, value)
    const nextCell = document.getElementById(gridCellId(bdcId, rowIndex, columnIndex))
    const nextInput = nextCell?.querySelector<HTMLInputElement>('input')
    if (nextInput !== null && nextInput !== undefined) nextInput.focus()
    else document.getElementById(`elce-statistical-graph-selected-cell-${bdcId}`)?.focus()
  }

  /** Creates the keyboard-navigation event for one grid coordinate. */
  const onGridKeydown = (position: GridPosition) => on<HTMLInputElement, 'keydown'>('keydown', (event) => moveSelection(event, position))
  /** Creates the input event that commits one grid coordinate. */
  const onGridInput = (position: GridPosition) => on<HTMLInputElement, 'input'>('input', (event) => {
    const value = event.currentTarget.value
    selectPosition(position, value)
    actions.setGridCell(position.rowIndex, position.columnIndex, value)
  })
  /** Creates the focus event that selects one grid coordinate. */
  const onGridFocus = (position: GridPosition) => on<HTMLInputElement, 'focus'>('focus', (event) => selectPosition(position, event.currentTarget.value))

  /** Changes a heading option while committing the selected cell atomically. */
  const updateHeading = (heading: 'columnLabelsEnabled' | 'rowLabelsEnabled', enabled: boolean): void => {
    const position = selectedGridPositionByBdcId.get(bdcId) ?? selected
    const field = document.getElementById(`elce-statistical-graph-selected-cell-${bdcId}`) as HTMLInputElement | null
    const value = field?.value ?? gridCellValue(content, cellValueByKey, position.rowIndex, position.columnIndex)
    const nextPosition = { ...position }
    if (heading === 'columnLabelsEnabled') {
      if (enabled && !hasColumnLabels) nextPosition.rowIndex += 1
      else if (!enabled && hasColumnLabels && nextPosition.rowIndex > 0) nextPosition.rowIndex -= 1
    } else if (enabled && !hasRowLabels) nextPosition.columnIndex += 1
    else if (!enabled && hasRowLabels && nextPosition.columnIndex > 0) nextPosition.columnIndex -= 1
    selectedGridPositionByBdcId.set(bdcId, nextPosition)
    actions.setGridCell(position.rowIndex, position.columnIndex, value, { [heading]: enabled })
  }

  /** Replaces the whole grid from clipboard text and reports parser failures in place. */
  const onPaste = (event: ClipboardEvent): void => {
    const text = event.clipboardData?.getData('text/plain')
    if (text === undefined || text.length === 0) return
    event.preventDefault()
    const host = event.currentTarget
    try {
      selectedGridPositionByBdcId.set(bdcId, { rowIndex: Number(hasColumnLabels), columnIndex: Number(hasRowLabels) })
      actions.replaceTable(text)
      host instanceof HTMLElement && setPasteMessage(host, '')
    } catch (error) {
      host instanceof HTMLElement && setPasteMessage(host, error instanceof Error ? error.message : 'Le tableau collé ne peut pas remplacer la grille.')
    }
  }
  const onGridPaste = on<HTMLTableElement, 'paste'>('paste', (event) => onPaste(event))
  const onSelectedCellPaste = on<HTMLInputElement, 'paste'>('paste', (event) => onPaste(event))
  return <fieldset
    id={`elce-statistical-graph-grid-host-${bdcId}`}
    className="elce-statistical-graph-editor__panel elce-statistical-graph-editor__data"
  >
    <legend
      id={`elce-statistical-graph-grid-legend-${bdcId}`}
      className="elce-visually-hidden"
    >
      Tableau de saisie
    </legend>
    <p
      id={`elce-statistical-graph-paste-instructions-${bdcId}`}
      className="elce-visually-hidden"
    >
      Coller un tableau remplace la grille. Les intitulés activés utilisent la première ligne et/ou la première colonne.
      Tab valide et sélectionne la cellule suivante sur la même ligne. Entrée ou Retour valide et sélectionne la cellule suivante dans la même colonne.
      Les touches fléchées déplacent la sélection entre les cellules.
    </p>
    <div
      id={`elce-statistical-graph-grid-layout-${bdcId}`}
      className="elce-statistical-graph-editor__grid-layout"
    >
      <div
        id={`elce-statistical-graph-grid-toolbar-${bdcId}`}
        className="elce-statistical-graph-editor__grid-toolbar"
      >
        <div
          id={`elce-statistical-graph-selected-cell-label-${bdcId}`}
          className="elce-statistical-graph-editor__selected-cell-field"
        >
          {renderLucideIcon(Pencil, `elce-statistical-graph-selected-cell-icon-${bdcId}`)}
          <input
            id={`elce-statistical-graph-selected-cell-${bdcId}`}
            type="text"
            aria-label="Valeur de la cellule sélectionnée"
            value={selectedValue}
            mix={[
              on<HTMLInputElement, 'input'>('input', (event) => {
                const position = selectedGridPositionByBdcId.get(bdcId) ?? selected
                actions.setGridCell(position.rowIndex, position.columnIndex, event.currentTarget.value)
              }),
              on<HTMLInputElement, 'keydown'>('keydown', (event) => moveSelection(event, selectedGridPositionByBdcId.get(bdcId) ?? selected)),
              onSelectedCellPaste,
            ]}
          />
        </div>
        <div
          id={`elce-statistical-graph-grid-heading-toggles-${bdcId}`}
          className="elce-section-toolbar"
          role="group"
          aria-label="Intitulés du tableau"
        >
          <button
            id={`elce-statistical-graph-column-labels-toggle-${bdcId}`}
            type="button"
            aria-label={hasColumnLabels ? 'Masquer les intitulés de colonne' : 'Afficher les intitulés de colonne'}
            aria-pressed={hasColumnLabels}
            data-active={hasColumnLabels}
            title={hasColumnLabels ? 'Masquer les intitulés de colonne' : 'Afficher les intitulés de colonne'}
            mix={on<HTMLButtonElement, 'click'>('click', () => updateHeading('columnLabelsEnabled', !hasColumnLabels))}
          >
            {renderLucideIcon(Columns3, `elce-statistical-graph-column-labels-icon-${bdcId}`)}
          </button>
          <button
            id={`elce-statistical-graph-row-labels-toggle-${bdcId}`}
            type="button"
            aria-label={hasRowLabels ? 'Masquer les intitulés de ligne' : 'Afficher les intitulés de ligne'}
            aria-pressed={hasRowLabels}
            data-active={hasRowLabels}
            title={hasRowLabels ? 'Masquer les intitulés de ligne' : 'Afficher les intitulés de ligne'}
            mix={on<HTMLButtonElement, 'click'>('click', () => updateHeading('rowLabelsEnabled', !hasRowLabels))}
          >
            {renderLucideIcon(Rows3, `elce-statistical-graph-row-labels-icon-${bdcId}`)}
          </button>
        </div>
      </div>
      <div
        id={`elce-statistical-graph-grid-wrap-${bdcId}`}
        className="elce-statistical-graph-editor__grid-wrap"
      >
        <table
          id={`elce-statistical-graph-grid-${bdcId}`}
          className="elce-statistical-graph-editor__grid"
          aria-describedby={`elce-statistical-graph-grid-caption-${bdcId} elce-statistical-graph-paste-instructions-${bdcId}`}
          mix={onGridPaste}
        >
          <caption
            id={`elce-statistical-graph-grid-caption-${bdcId}`}
            className="elce-visually-hidden"
          >
            Tableau de données avec intitulés de ligne et de colonne activables
          </caption>
          {hasColumnLabels ? <thead id={`elce-statistical-graph-grid-head-${bdcId}`}>
            <tr id={`elce-statistical-graph-grid-head-row-${bdcId}`}>
              {hasRowLabels ? <th
                id={`elce-statistical-graph-grid-corner-${bdcId}`}
                className="elce-statistical-graph-editor__grid-corner"
                scope="col"
              >
                <span id={`elce-statistical-graph-grid-corner-label-${bdcId}`} className="elce-visually-hidden">Catégorie ; série</span>
              </th> : null}
              {Array.from({ length: columnCount - headerColumnOffset }, (_unused, index) => {
                const columnIndex = index + headerColumnOffset
                const seriesIndex = columnIndex - headerColumnOffset
                const series = content.series[seriesIndex]
                const value = series?.label ?? ''
                const position = { rowIndex: 0, columnIndex }
                return <th
                  key={columnIndex}
                  id={gridCellId(bdcId, 0, columnIndex)}
                  scope="col"
                  data-grid-cell="true"
                  className={selected.rowIndex === 0 && selected.columnIndex === columnIndex ? 'elce-statistical-graph-editor__grid-cell--selected' : undefined}
                >
                  <input
                    id={`elce-statistical-graph-series-label-${bdcId}-${seriesIndex}`}
                    type="text"
                    aria-label={`Nom de la série ${seriesIndex + 1}`}
                    value={value}
                    data-elce-profile-token-target="true"
                    mix={[onGridFocus(position), onGridInput(position), onGridKeydown(position)]}
                  />
                </th>
              })}
            </tr>
          </thead> : null}
          <tbody
            id={`elce-statistical-graph-grid-body-${bdcId}`}
          >
            {Array.from({ length: rowCount - headerRowOffset }, (_unused, index) => {
              const rowIndex = index + headerRowOffset
              const categoryIndex = rowIndex - headerRowOffset
              const category = content.categories[categoryIndex]
              return <tr key={rowIndex} id={`elce-statistical-graph-grid-row-${bdcId}-${rowIndex}`}>
                {hasRowLabels ? <th
                  id={gridCellId(bdcId, rowIndex, 0)}
                  className={`elce-statistical-graph-editor__grid-row-heading${selected.rowIndex === rowIndex && selected.columnIndex === 0 ? ' elce-statistical-graph-editor__grid-cell--selected' : ''}`}
                  scope="row"
                  data-grid-cell="true"
                >
                  <input
                    id={`elce-statistical-graph-category-label-${bdcId}-${categoryIndex}`}
                    type="text"
                    aria-label={`Nom de la catégorie ${categoryIndex + 1}`}
                    value={category?.label ?? ''}
                    data-elce-profile-token-target="true"
                    mix={[
                      onGridFocus({ rowIndex, columnIndex: 0 }),
                      onGridInput({ rowIndex, columnIndex: 0 }),
                      onGridKeydown({ rowIndex, columnIndex: 0 }),
                    ]}
                  />
                </th> : null}
                {Array.from({ length: columnCount - headerColumnOffset }, (_unusedColumn, columnOffset) => {
                  const columnIndex = columnOffset + headerColumnOffset
                  const seriesIndex = columnIndex - headerColumnOffset
                  const series = content.series[seriesIndex]
                  const value = category === undefined || series === undefined
                    ? ''
                    : cellValueByKey.has(`${category.id}\u0000${series.id}`)
                      ? String(cellValueByKey.get(`${category.id}\u0000${series.id}`))
                      : ''
                  const position = { rowIndex, columnIndex }
                  return <td
                    key={columnIndex}
                    id={gridCellId(bdcId, rowIndex, columnIndex)}
                    data-grid-cell="true"
                    className={selected.rowIndex === rowIndex && selected.columnIndex === columnIndex ? 'elce-statistical-graph-editor__grid-cell--selected' : undefined}
                  >
                    <input
                      id={`elce-statistical-graph-value-${bdcId}-${rowIndex}-${columnIndex}`}
                      type="text"
                      inputMode="decimal"
                      aria-label={`Valeur catégorie ${categoryIndex + 1}, série ${seriesIndex + 1}`}
                      value={value}
                      mix={[onGridFocus(position), onGridInput(position), onGridKeydown(position)]}
                    />
                  </td>
                })}
              </tr>
            })}
          </tbody>
        </table>
      </div>
    </div>
    <p
      id={`elce-statistical-graph-grid-error-${bdcId}`}
      className="elce-statistical-graph-editor__error"
      role="alert"
      aria-live="polite"
    />
  </fieldset>
}

/** Reads the text at a visual grid coordinate, including optional heading cells. */
function gridCellValue(
  content: StatisticalGraphContent,
  valuesByKey: ReadonlyMap<string, number>,
  rowIndex: number,
  columnIndex: number,
): string {
  const hasColumnLabels = content.columnLabelsEnabled ?? true
  const hasRowLabels = content.rowLabelsEnabled ?? true
  const headerRowOffset = Number(hasColumnLabels)
  const headerColumnOffset = Number(hasRowLabels)
  if (hasColumnLabels && rowIndex === 0) {
    if (hasRowLabels && columnIndex === 0) return ''
    return content.series[columnIndex - headerColumnOffset]?.label ?? ''
  }
  if (hasRowLabels && columnIndex === 0) return content.categories[rowIndex - headerRowOffset]?.label ?? ''
  const category = content.categories[rowIndex - headerRowOffset]
  const series = content.series[columnIndex - headerColumnOffset]
  if (category === undefined || series === undefined) return ''
  const value = valuesByKey.get(`${category.id}\u0000${series.id}`)
  return value === undefined ? '' : String(value)
}

/** Creates a stable element id for a visible row and column position. */
function gridCellId(bdcId: string, rowIndex: number, columnIndex: number): string {
  return `elce-statistical-graph-grid-cell-${bdcId}-${rowIndex}-${columnIndex}`
}

/** Shows paste errors in the existing graph editor without changing the authored document. */
function setPasteMessage(host: HTMLElement, message: string): void {
  const error = host.closest('[id^="elce-statistical-graph-grid-host-"]')?.querySelector<HTMLElement>('[role="alert"]')
  if (error != null) error.textContent = message
}
