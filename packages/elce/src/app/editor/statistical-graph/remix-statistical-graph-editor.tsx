import { on, type RemixNode } from 'remix/ui'
import { Minus, Plus, Trash2 } from 'lucide-static'
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

/** Renders the Statistical Graph authoring form and its replace-on-paste table editor. */
export function renderRemixStatisticalGraphEditor(
  bdc: Bdc,
  actions: StatisticalGraphEditorActions,
  onDelete?: () => void,
  toolbarContent?: RemixNode,
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
    {renderLucideIcon(Trash2, `elce-statistical-graph-delete-icon-${bdc.id}`, 14)}
  </button>

  return <section
    id={`elce-statistical-graph-editor-${bdc.id}`}
    className="elce-statistical-graph-editor"
    aria-label="Éditeur de graphe statistique"
  >
    <header
      id={`elce-statistical-graph-editor-heading-${bdc.id}`}
      className="elce-statistical-graph-editor__header"
    >
      <h3
        id={`elce-statistical-graph-editor-title-${bdc.id}`}
      >
        Graphe statistique
      </h3>
      {deleteButton}
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
        {content.rendering === STATISTICAL_GRAPH_RENDERING.PIE
          ? renderPieSeriesSelect(bdc.id, content, actions)
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
        mix={on<HTMLTextAreaElement, 'input'>('input', (event) => actions.setText(field, event.currentTarget.value))}
      />
      : <input
        id={id}
        type="text"
        aria-label={label}
        value={value}
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

/** Renders the editable 2D matrix and rejects oversized clipboard replacement as one operation. */
function renderGridEditor(bdcId: string, content: StatisticalGraphContent, actions: StatisticalGraphEditorActions): RemixNode {
  const cellValueByKey = new Map(content.values.map((entry) => [`${entry.categoryId}\u0000${entry.seriesId}`, entry.value]))
  const onPaste = (event: ClipboardEvent): void => {
    const text = event.clipboardData?.getData('text/plain')
    if (text === undefined || text.length === 0) return
    event.preventDefault()
    const host = event.currentTarget
    try {
      actions.replaceTable(text)
      host instanceof HTMLElement && setPasteMessage(host, '')
    } catch (error) {
      host instanceof HTMLElement && setPasteMessage(host, error instanceof Error ? error.message : 'Le tableau collé ne peut pas remplacer la grille.')
    }
  }
  const onGridPaste = on<HTMLTableElement, 'paste'>('paste', (event) => onPaste(event))
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
      Coller un tableau remplace la grille par le tableau collé (41 lignes et colonnes maximum, en-têtes compris).
    </p>
    <div
      id={`elce-statistical-graph-grid-layout-${bdcId}`}
      className="elce-statistical-graph-editor__grid-layout"
    >
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
            Catégories en lignes, séries en colonnes
          </caption>
          <thead
            id={`elce-statistical-graph-grid-head-${bdcId}`}
          >
            <tr
              id={`elce-statistical-graph-grid-head-row-${bdcId}`}
            >
              <th
                id={`elce-statistical-graph-grid-corner-${bdcId}`}
                scope="col"
              >
                <span className="elce-visually-hidden">Catégorie ; série</span>
              </th>
              {content.series.map((series, index) => <th
                key={series.id}
                id={`elce-statistical-graph-grid-series-heading-${series.id}`}
                scope="col"
              >
                <div
                  id={`elce-statistical-graph-series-control-${series.id}`}
                  className="elce-statistical-graph-editor__grid-heading-control"
                >
                  <input
                    id={`elce-statistical-graph-series-label-${series.id}`}
                    type="text"
                    aria-label={`Nom de la série ${index + 1}`}
                    placeholder={`Série ${index + 1}`}
                    value={series.label}
                    mix={on<HTMLInputElement, 'input'>('input', (event) => actions.setSeriesLabel(series.id, event.currentTarget.value))}
                  />
                  <button
                    id={`elce-statistical-graph-series-remove-${series.id}`}
                    className="elce-bdc-icon-button elce-bdc-icon-button--danger"
                    type="button"
                    aria-label={`Supprimer la série ${index + 1}`}
                    title={`Supprimer la série ${index + 1}`}
                    disabled={content.series.length <= 1}
                    mix={on<HTMLButtonElement, 'click'>('click', () => actions.removeSeries(series.id))}
                  >
                    {renderLucideIcon(Minus, `elce-statistical-graph-series-remove-icon-${series.id}`, 14)}
                  </button>
                </div>
              </th>)}
            </tr>
          </thead>
          <tbody
            id={`elce-statistical-graph-grid-body-${bdcId}`}
          >
            {content.categories.map((category, categoryIndex) => <tr
              key={category.id}
              id={`elce-statistical-graph-grid-row-${category.id}`}
            >
              <th
                id={`elce-statistical-graph-grid-category-heading-${category.id}`}
                scope="row"
              >
                <div
                  id={`elce-statistical-graph-category-control-${category.id}`}
                  className="elce-statistical-graph-editor__grid-heading-control"
                >
                  <input
                    id={`elce-statistical-graph-category-label-${category.id}`}
                    type="text"
                    aria-label={`Nom de la catégorie ${categoryIndex + 1}`}
                    placeholder={`Catégorie ${categoryIndex + 1}`}
                    value={category.label}
                    mix={on<HTMLInputElement, 'input'>('input', (event) => actions.setCategoryLabel(category.id, event.currentTarget.value))}
                  />
                  <button
                    id={`elce-statistical-graph-category-remove-${category.id}`}
                    className="elce-bdc-icon-button elce-bdc-icon-button--danger"
                    type="button"
                    aria-label={`Supprimer la catégorie ${categoryIndex + 1}`}
                    title={`Supprimer la catégorie ${categoryIndex + 1}`}
                    disabled={content.categories.length <= 1}
                    mix={on<HTMLButtonElement, 'click'>('click', () => actions.removeCategory(category.id))}
                  >
                    {renderLucideIcon(Minus, `elce-statistical-graph-category-remove-icon-${category.id}`, 14)}
                  </button>
                </div>
              </th>
              {content.series.map((series, seriesIndex) => <td
                key={series.id}
                id={`elce-statistical-graph-grid-cell-${category.id}-${series.id}`}
              >
                <input
                  id={`elce-statistical-graph-value-${category.id}-${series.id}`}
                  type="text"
                  inputMode="decimal"
                  aria-label={`Valeur catégorie ${categoryIndex + 1}, série ${seriesIndex + 1}`}
                  value={cellValueByKey.has(`${category.id}\u0000${series.id}`)
                    ? String(cellValueByKey.get(`${category.id}\u0000${series.id}`))
                    : ''}
                  mix={on<HTMLInputElement, 'input'>('input', (event) => actions.setCell(category.id, series.id, event.currentTarget.value))}
                />
              </td>)}
            </tr>)}
          </tbody>
        </table>
      </div>
      <div
        id={`elce-statistical-graph-series-actions-${bdcId}`}
        className="elce-statistical-graph-editor__axis-actions elce-statistical-graph-editor__axis-actions--series"
      >
        <button
          id={`elce-statistical-graph-add-series-${bdcId}`}
          className="elce-statistical-graph-editor__add-control"
          type="button"
          aria-label="Ajouter une colonne"
          title="Ajouter une colonne"
          disabled={content.series.length >= 40}
          mix={on<HTMLButtonElement, 'click'>('click', actions.addSeries)}
        >
          {renderLucideIcon(Plus, `elce-statistical-graph-add-series-icon-${bdcId}`, 14)}
        </button>
      </div>
      <div
        id={`elce-statistical-graph-category-actions-${bdcId}`}
        className="elce-statistical-graph-editor__axis-actions elce-statistical-graph-editor__axis-actions--categories"
      >
        <button
          id={`elce-statistical-graph-add-category-${bdcId}`}
          className="elce-statistical-graph-editor__add-control"
          type="button"
          aria-label="Ajouter une ligne"
          title="Ajouter une ligne"
          disabled={content.categories.length >= 40}
          mix={on<HTMLButtonElement, 'click'>('click', actions.addCategory)}
        >
          {renderLucideIcon(Plus, `elce-statistical-graph-add-category-icon-${bdcId}`, 14)}
        </button>
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

/** Shows paste errors in the existing graph editor without changing the authored document. */
function setPasteMessage(host: HTMLElement, message: string): void {
  const error = host.closest('[id^="elce-statistical-graph-grid-host-"]')?.querySelector<HTMLElement>('[role="alert"]')
  if (error != null) error.textContent = message
}
