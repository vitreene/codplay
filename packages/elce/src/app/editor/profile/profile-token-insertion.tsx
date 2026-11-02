import { on, type RemixNode } from 'remix/ui'
import type { Page } from '../../../domain/document/document-types'
import type { ProfileProperty } from '../../../domain/summary-profile/summary-profile-types'
import {
  createLocalDateToken,
  createPageLinkToken,
  plainTextFromValue,
  type LocalDateLabelAttributes,
  type PageLinkLabelAttributes,
} from '../../../domain/inline-text/inline-text-value'
import {
  INLINE_TEXT_DRAG_TYPE,
  INLINE_TEXT_LABEL_UPDATE_EVENT,
  PROFILE_TOKEN_INSERT_EVENT,
  type InlineTextInsertDetail,
  type InlineTextLabelSelection,
  type InlineTextLabelUpdateDetail,
} from './profile-token-events'

/** Renders the shared catalog for profile, page-link, and local-date labels. */
export function renderProfileTokenInsertion(
  id: string,
  properties: readonly ProfileProperty[],
  targetId: string,
  pages: readonly Page[] = [],
  selectedLabel: InlineTextLabelSelection | null = null,
): RemixNode {
  const pageLinksAllowed = targetAllowsPageLinks(targetId)
  const activeSelection = selectedLabel?.targetId === targetId ? selectedLabel : null
  return <section id={id} className="elce-inline-text-catalog" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`}>Variables et liens</h2>
    {activeSelection === null ? null : renderSelectedLabelTabs(id)}
    <section
      id={`${id}-create-panel`}
      className="elce-inline-text-catalog__panel"
      role={activeSelection === null ? undefined : 'tabpanel'}
      aria-labelledby={activeSelection === null ? undefined : `${id}-create-tab`}
      hidden={activeSelection !== null}
    >
      {properties.length === 0 ? null : <div id={`${id}-profile-group`} className="elce-inline-text-catalog__group">
        <h3 id={`${id}-profile-title`}>Profil</h3>
        <ul id={`${id}-profile-list`} className="elce-inline-text-catalog__list">
          {properties.map((property) => <li id={`${id}-profile-row-${property.id}`} key={property.id}>
            {renderDraggableLabelButton(
              `${id}-profile-${property.id}`,
              property.label,
              `Insérer ${property.label}`,
              { kind: 'profile', propertyId: property.id },
              `{{profile:${property.id}}}`,
              targetId,
            )}
          </li>)}
        </ul>
      </div>}
      <div id={`${id}-page-group`} className="elce-inline-text-catalog__group">
        <h3 id={`${id}-page-title`}>Liens vers les pages</h3>
        {pageLinksAllowed
          ? <div id={`${id}-page-controls`} className="elce-inline-text-catalog__page-controls">
            {pages.length === 0
              ? <p id={`${id}-page-empty`} className="elce-muted">Aucune page de scénario à lier.</p>
              : <label id={`${id}-page-target-label`} className="elce-inline-text-catalog__field">
                <span id={`${id}-page-target-caption`}>Page cible</span>
                <select
                  id={`${id}-page-target`}
                  defaultValue=""
                  mix={on<HTMLSelectElement, 'change'>('change', () => updatePageLinkButton(id, pages))}
                >
                  <option id={`${id}-page-target-empty`} value="">Choisir une page</option>
                  {pages.map((page) => <option id={`${id}-page-target-${page.id}`} key={page.id} value={page.id}>
                    {plainTextFromValue(page.name)}
                  </option>)}
                </select>
              </label>}
            <label id={`${id}-page-label-label`} className="elce-inline-text-catalog__field">
              <span id={`${id}-page-label-caption`}>Libellé facultatif</span>
              <input id={`${id}-page-label`} type="text" placeholder="Titre de la page" />
            </label>
            <label id={`${id}-page-presentation-label`} className="elce-inline-text-catalog__field">
              <span id={`${id}-page-presentation-caption`}>Présentation</span>
              <select id={`${id}-page-presentation`}>
                <option id={`${id}-page-presentation-text`} value="text" selected={true}>Lien souligné</option>
                <option id={`${id}-page-presentation-button`} value="button">Bouton</option>
              </select>
            </label>
            {pages.length > 0 ? renderPageLinkButton(id, targetId, pages) : null}
          </div>
          : <p id={`${id}-page-links-unavailable`} className="elce-muted">Un bouton de validation ne peut pas contenir un lien de navigation.</p>}
      </div>
      <div id={`${id}-date-group`} className="elce-inline-text-catalog__group">
        <h3 id={`${id}-date-title`}>Dates locales</h3>
        <ul id={`${id}-date-list`} className="elce-inline-text-catalog__list">
          {renderDateEntry(id, targetId, 'today', 0, 'Date du jour')}
          {renderDateEntry(id, targetId, 'time', 0, 'Heure locale')}
          <li id={`${id}-date-row-relative`}>
            <label id={`${id}-date-offset-label`} className="elce-inline-text-catalog__field">
              <span id={`${id}-date-offset-caption`}>Décalage en jours</span>
              <input id={`${id}-date-offset`} type="number" step={1} defaultValue={1} />
            </label>
            {renderDraggableLabelButton(
              `${id}-date-relative`,
              'Date relative',
              'Insérer une date relative',
              { kind: 'local-date', dateKind: 'relative', offsetDays: 1 },
              createLocalDateToken({ kind: 'relative', offsetDays: 1 }),
              targetId,
              () => ({ kind: 'local-date', dateKind: 'relative', offsetDays: readRelativeDayOffset(id) }),
            )}
          </li>
        </ul>
      </div>
    </section>
    <section
      id={`${id}-edit-panel`}
      className="elce-inline-text-catalog__panel"
      role="tabpanel"
      aria-labelledby={`${id}-edit-tab`}
      hidden={activeSelection === null}
    >
      {activeSelection === null ? null : renderSelectedLabelEditor(id, targetId, activeSelection, properties, pages)}
    </section>
  </section>
}

/** Renders separate creation and selected-label editing tabs. */
function renderSelectedLabelTabs(id: string): RemixNode {
  return <div
    id={`${id}-mode-tabs`}
    className="elce-content-catalog-tabs"
    role="tablist"
    aria-label="Création et édition des variables"
  >
    <button
      id={`${id}-create-tab`}
      className="elce-content-catalog-tab"
      type="button"
      role="tab"
      aria-selected={false}
      aria-controls={`${id}-create-panel`}
      mix={on<HTMLButtonElement, 'click'>('click', () => selectProfileTokenCatalogTab(id, 'create'))}
    >
      Créer
    </button>
    <button
      id={`${id}-edit-tab`}
      className="elce-content-catalog-tab elce-content-catalog-tab--active"
      type="button"
      role="tab"
      aria-selected={true}
      aria-controls={`${id}-edit-panel`}
      aria-label="Modifier l’étiquette sélectionnée"
      mix={on<HTMLButtonElement, 'click'>('click', () => selectProfileTokenCatalogTab(id, 'edit'))}
    >
      Modifier
    </button>
  </div>
}

/** Shows the chosen inline-text tab and synchronizes its accessible state. */
function selectProfileTokenCatalogTab(id: string, selectedTab: 'create' | 'edit'): void {
  const createTab = document.getElementById(`${id}-create-tab`)
  const editTab = document.getElementById(`${id}-edit-tab`)
  const createPanel = document.getElementById(`${id}-create-panel`)
  const editPanel = document.getElementById(`${id}-edit-panel`)
  if (!(createTab instanceof HTMLButtonElement)
    || !(editTab instanceof HTMLButtonElement)
    || !(createPanel instanceof HTMLElement)
    || !(editPanel instanceof HTMLElement)) return

  const showCreate = selectedTab === 'create'
  createTab.setAttribute('aria-selected', String(showCreate))
  editTab.setAttribute('aria-selected', String(!showCreate))
  createTab.classList.toggle('elce-content-catalog-tab--active', showCreate)
  editTab.classList.toggle('elce-content-catalog-tab--active', !showCreate)
  createPanel.hidden = !showCreate
  editPanel.hidden = showCreate
}

/** Renders the editable attributes of the atom selected in a rich-text field. */
function renderSelectedLabelEditor(
  id: string,
  targetId: string,
  selection: InlineTextLabelSelection,
  properties: readonly ProfileProperty[],
  pages: readonly Page[],
): RemixNode {
  const formId = `${id}-selected-label`
  const selectionKey = `${targetId}-${selection.position}-${JSON.stringify(selection.label)}`
  const selectedProfilePropertyId = selection.label.kind === 'profile' ? selection.label.propertyId : null
  const editorTitle = selection.label.kind === 'page-link'
    ? 'Modifier le lien vers la page'
    : selection.label.kind === 'profile'
      ? 'Modifier la variable de profil'
      : 'Modifier la date'
  const update = (label: InlineTextInsertDetail): void => {
    updateInlineTextLabel(targetId, { position: selection.position, expected: selection.label, label })
  }
  return <div
    id={`${formId}-editor`}
    className="elce-inline-text-catalog__group elce-inline-text-catalog__edit"
    key={selectionKey}
  >
    <h3 id={`${formId}-title`}>{editorTitle}</h3>
    {selection.label.kind === 'profile'
      ? <div id={`${formId}-profile-fields`} className="elce-inline-text-catalog__page-controls">
        <label id={`${formId}-profile-label`} className="elce-inline-text-catalog__field">
          <span id={`${formId}-profile-caption`}>Variable de profil</span>
          <select id={`${formId}-profile-property`}>
            {selectedProfilePropertyId === null || properties.some((property) => property.id === selectedProfilePropertyId) ? null : <option
              id={`${formId}-profile-missing`}
              value={selectedProfilePropertyId}
              selected={true}
            >
              {selectedProfilePropertyId}
            </option>}
            {properties.map((property) => <option
              id={`${formId}-profile-option-${property.id}`}
              key={property.id}
              value={property.id}
              selected={property.id === selectedProfilePropertyId}
            >
              {property.label}
            </option>)}
          </select>
        </label>
        {renderUpdateLabelButton(formId, () => {
          const property = document.getElementById(`${formId}-profile-property`)
          if (property instanceof HTMLSelectElement && property.value.length > 0) {
            update({ kind: 'profile', propertyId: property.value })
          }
        })}
      </div>
      : null}
    {selection.label.kind === 'page-link'
      ? renderSelectedPageLinkEditor(formId, selection.label, pages, update)
      : null}
    {selection.label.kind === 'local-date'
      ? renderSelectedDateEditor(formId, selection.label, update)
      : null}
  </div>
}

/** Renders page-link attributes for the selected inline link. */
function renderSelectedPageLinkEditor(
  formId: string,
  selected: Extract<InlineTextInsertDetail, { kind: 'page-link' }>,
  pages: readonly Page[],
  update: (label: InlineTextInsertDetail) => void,
): RemixNode {
  const selectedPageExists = pages.some((page) => page.id === selected.pageId)
  return <div id={`${formId}-page-fields`} className="elce-inline-text-catalog__page-controls">
    <label id={`${formId}-page-target-label`} className="elce-inline-text-catalog__field">
      <span id={`${formId}-page-target-caption`}>Page cible</span>
      <select id={`${formId}-page-target`}>
        {selectedPageExists ? null : <option id={`${formId}-page-current`} value={selected.pageId} selected={true}>
          {selected.fallbackLabel}
        </option>}
        {pages.map((page) => <option
          id={`${formId}-page-option-${page.id}`}
          key={page.id}
          value={page.id}
          selected={page.id === selected.pageId}
        >
          {plainTextFromValue(page.name)}
        </option>)}
      </select>
    </label>
    <label id={`${formId}-page-label-label`} className="elce-inline-text-catalog__field">
      <span id={`${formId}-page-label-caption`}>Libellé facultatif</span>
      <input
        id={`${formId}-page-label`}
        type="text"
        placeholder="Titre de la page"
        defaultValue={selected.label ?? ''}
      />
    </label>
    <label id={`${formId}-page-presentation-label`} className="elce-inline-text-catalog__field">
      <span id={`${formId}-page-presentation-caption`}>Présentation</span>
      <select id={`${formId}-page-presentation`}>
        <option id={`${formId}-page-presentation-text`} value="text" selected={selected.presentation === 'text'}>Lien souligné</option>
        <option id={`${formId}-page-presentation-button`} value="button" selected={selected.presentation === 'button'}>Bouton</option>
      </select>
    </label>
    {renderUpdateLabelButton(formId, () => {
      const target = document.getElementById(`${formId}-page-target`)
      const label = document.getElementById(`${formId}-page-label`)
      const presentation = document.getElementById(`${formId}-page-presentation`)
      if (!(target instanceof HTMLSelectElement)
        || !(label instanceof HTMLInputElement)
        || !(presentation instanceof HTMLSelectElement)) return
      const page = pages.find((candidate) => candidate.id === target.value)
      update({
        kind: 'page-link',
        pageId: target.value,
        label: label.value.trim().length === 0 ? null : label.value.trim(),
        fallbackLabel: page === undefined
          ? selected.fallbackLabel
          : plainTextFromValue(page.name),
        presentation: presentation.value === 'button' ? 'button' : 'text',
      })
    })}
  </div>
}

/** Renders date-kind and relative-offset controls for a selected date label. */
function renderSelectedDateEditor(
  formId: string,
  selected: Extract<InlineTextInsertDetail, { kind: 'local-date' }>,
  update: (label: InlineTextInsertDetail) => void,
): RemixNode {
  const offsetLabelId = `${formId}-date-offset-label`
  return <div id={`${formId}-date-fields`} className="elce-inline-text-catalog__page-controls">
    <label id={`${formId}-date-kind-label`} className="elce-inline-text-catalog__field">
      <span id={`${formId}-date-kind-caption`}>Type de date</span>
      <select
        id={`${formId}-date-kind`}
        mix={on<HTMLSelectElement, 'change'>('change', (event) => {
          const offsetField = document.getElementById(offsetLabelId)
          if (offsetField !== null) offsetField.hidden = event.currentTarget.value !== 'relative'
        })}
      >
        <option id={`${formId}-date-kind-today`} value="today" selected={selected.dateKind === 'today'}>Date du jour</option>
        <option id={`${formId}-date-kind-time`} value="time" selected={selected.dateKind === 'time'}>Heure locale</option>
        <option id={`${formId}-date-kind-relative`} value="relative" selected={selected.dateKind === 'relative'}>Date relative</option>
      </select>
    </label>
    <label
      id={offsetLabelId}
      className="elce-inline-text-catalog__field"
      hidden={selected.dateKind !== 'relative'}
    >
      <span id={`${formId}-date-offset-caption`}>Décalage en jours</span>
      <input id={`${formId}-date-offset`} type="number" step={1} defaultValue={selected.offsetDays} />
    </label>
    {renderUpdateLabelButton(formId, () => {
      const kind = document.getElementById(`${formId}-date-kind`)
      const offset = document.getElementById(`${formId}-date-offset`)
      if (!(kind instanceof HTMLSelectElement) || !(offset instanceof HTMLInputElement)) return
      const dateKind = kind.value === 'time' || kind.value === 'relative' ? kind.value : 'today'
      const numericOffset = Number(offset.value)
      update({
        kind: 'local-date',
        dateKind,
        offsetDays: dateKind === 'relative' && Number.isSafeInteger(numericOffset) ? numericOffset : 0,
      })
    })}
  </div>
}

/** Renders the explicit action that applies edited attributes to the selected atom. */
function renderUpdateLabelButton(id: string, onClick: () => void): RemixNode {
  return <button
    id={`${id}-update`}
    className="elce-inline-text-catalog__item elce-inline-text-catalog__edit-action"
    type="button"
    mix={on<HTMLButtonElement, 'click'>('click', onClick)}
  >
    Mettre à jour l’étiquette
  </button>
}

/** Renders one button that can insert by click or carry its token by drag. */
function renderDraggableLabelButton(
  id: string,
  label: string,
  accessibleLabel: string,
  detail: InlineTextInsertDetail,
  token: string,
  targetId: string,
  resolveDetail: () => InlineTextInsertDetail = () => detail,
): RemixNode {
  return <button
    id={id}
    className="elce-inline-text-catalog__item"
    type="button"
    draggable={true}
    aria-label={accessibleLabel}
    title={accessibleLabel}
    mix={[
      on<HTMLButtonElement, 'click'>('click', () => insertInlineText(targetId, resolveDetail(), resolveToken(resolveDetail(), token))),
      on<HTMLButtonElement, 'dragstart'>('dragstart', (event) => {
        const currentDetail = resolveDetail()
        const currentToken = resolveToken(currentDetail, token)
        event.dataTransfer?.setData(INLINE_TEXT_DRAG_TYPE, JSON.stringify(currentDetail))
        event.dataTransfer?.setData('text/plain', currentToken)
        if (event.dataTransfer !== null) event.dataTransfer.effectAllowed = 'copy'
      }),
    ]}
  >
    {label}
  </button>
}

/** Renders the single insert-or-drag action for the selected page destination. */
function renderPageLinkButton(id: string, targetId: string, pages: readonly Page[]): RemixNode {
  return <button
    id={`${id}-page-insert`}
    className="elce-inline-text-catalog__item"
    type="button"
    draggable={true}
    disabled={true}
    aria-label="Insérer un lien vers la page sélectionnée"
    title="Insérer un lien vers la page sélectionnée"
    mix={[
      on<HTMLButtonElement, 'click'>('click', () => {
        const attributes = selectedPageLinkAttributes(id, pages)
        if (attributes === null) return
        const detail: InlineTextInsertDetail = { kind: 'page-link', ...attributes }
        insertInlineText(targetId, detail, createPageLinkToken(attributes))
      }),
      on<HTMLButtonElement, 'dragstart'>('dragstart', (event) => {
        const attributes = selectedPageLinkAttributes(id, pages)
        if (attributes === null || event.dataTransfer === null) return
        const detail: InlineTextInsertDetail = { kind: 'page-link', ...attributes }
        event.dataTransfer.setData(INLINE_TEXT_DRAG_TYPE, JSON.stringify(detail))
        event.dataTransfer.setData('text/plain', createPageLinkToken(attributes))
        event.dataTransfer.effectAllowed = 'copy'
      }),
    ]}
  >
    Insérer le lien
  </button>
}

/** Renders a local-date option with its stable attributes and transient token. */
function renderDateEntry(
  id: string,
  targetId: string,
  kind: LocalDateLabelAttributes['kind'],
  offsetDays: number,
  label: string,
): RemixNode {
  const detail: InlineTextInsertDetail = { kind: 'local-date', dateKind: kind, offsetDays }
  const attributes: LocalDateLabelAttributes = { kind, offsetDays }
  return <li id={`${id}-date-row-${kind}-${offsetDays}`} key={`${kind}-${offsetDays}`}>
    {renderDraggableLabelButton(
      `${id}-date-${kind}-${offsetDays}`,
      label,
      `Insérer ${label.toLocaleLowerCase()}`,
      detail,
      createLocalDateToken(attributes),
      targetId,
    )}
  </li>
}

/** Reads the link label and presentation currently selected in the catalog. */
function readPageLinkAttributes(id: string, pageId: string, fallbackLabel: string): PageLinkLabelAttributes {
  const labelElement = document.getElementById(`${id}-page-label`)
  const presentationElement = document.getElementById(`${id}-page-presentation`)
  const authoredLabel = labelElement instanceof HTMLInputElement ? labelElement.value.trim() : ''
  const presentation = presentationElement instanceof HTMLSelectElement && presentationElement.value === 'button'
    ? 'button'
    : 'text'
  return {
    pageId,
    label: authoredLabel.length === 0 ? null : authoredLabel,
    fallbackLabel,
    presentation,
  }
}

/** Reads the selected destination and its current link presentation settings. */
function selectedPageLinkAttributes(id: string, pages: readonly Page[]): PageLinkLabelAttributes | null {
  const targetElement = document.getElementById(`${id}-page-target`)
  if (!(targetElement instanceof HTMLSelectElement) || targetElement.value.length === 0) return null
  const page = pages.find((candidate) => candidate.id === targetElement.value)
  if (page === undefined) return null
  return readPageLinkAttributes(id, page.id, plainTextFromValue(page.name))
}

/** Enables the unique link action and updates its accessible name after selection. */
function updatePageLinkButton(id: string, pages: readonly Page[]): void {
  const button = document.getElementById(`${id}-page-insert`)
  if (!(button instanceof HTMLButtonElement)) return
  const attributes = selectedPageLinkAttributes(id, pages)
  button.disabled = attributes === null
  const label = attributes === null
    ? 'Insérer un lien vers la page sélectionnée'
    : `Insérer un lien vers ${attributes.fallbackLabel}`
  button.setAttribute('aria-label', label)
  button.title = label
}

/** Reads the signed whole-day offset selected for a relative date label. */
function readRelativeDayOffset(id: string): number {
  const input = document.getElementById(`${id}-date-offset`)
  if (!(input instanceof HTMLInputElement)) return 1
  const offset = Number(input.value)
  return Number.isSafeInteger(offset) ? offset : 0
}

/** Encodes insertion attributes into the transient token used by native fields. */
function resolveToken(detail: InlineTextInsertDetail, fallbackToken: string): string {
  if (detail.kind === 'page-link') return createPageLinkToken({
    pageId: detail.pageId,
    label: detail.label,
    fallbackLabel: detail.fallbackLabel,
    presentation: detail.presentation,
  })
  if (detail.kind === 'local-date') return createLocalDateToken({ kind: detail.dateKind, offsetDays: detail.offsetDays })
  return fallbackToken
}

/** Inserts a typed atom into the active target or promotes a native text field. */
function insertInlineText(targetId: string, detail: InlineTextInsertDetail, token: string): void {
  const target = document.getElementById(targetId)
  if (!(target instanceof HTMLElement) || target.dataset.elceProfileTokenTarget !== 'true') return
  if (detail.kind === 'page-link' && target.dataset.elceAllowPageLinks === 'false') return
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    insertTextToken(target, token)
    return
  }
  if (target.getAttribute('contenteditable') !== 'true') return
  target.dispatchEvent(new CustomEvent<InlineTextInsertDetail>(PROFILE_TOKEN_INSERT_EVENT, { detail }))
}

/** Sends the edited label attributes to the selected rich-text atom. */
function updateInlineTextLabel(targetId: string, detail: InlineTextLabelUpdateDetail): void {
  const target = document.getElementById(targetId)
  if (!(target instanceof HTMLElement)
    || target.dataset.elceProfileTokenTarget !== 'true'
    || target.getAttribute('contenteditable') !== 'true') return
  target.dispatchEvent(new CustomEvent<InlineTextLabelUpdateDetail>(INLINE_TEXT_LABEL_UPDATE_EVENT, {
    bubbles: true,
    detail,
  }))
}

/** Checks whether the active field permits an interactive page link. */
function targetAllowsPageLinks(targetId: string): boolean {
  if (typeof document === 'undefined') return true
  const target = document.getElementById(targetId)
  return target?.dataset.elceAllowPageLinks !== 'false'
}

/** Replaces the current native input selection and notifies its field adapter. */
function insertTextToken(target: HTMLInputElement | HTMLTextAreaElement, token: string): void {
  const start = target.selectionStart ?? target.value.length
  const end = target.selectionEnd ?? start
  target.setRangeText(token, start, end, 'end')
  target.dispatchEvent(new Event('input', { bubbles: true }))
  target.focus()
}
