import { on, type RemixNode } from 'remix/ui'
import { Plus, Trash2 } from 'lucide-static'
import { CATALOG_REFERENCE, MEDIA_FILE_ACCEPT, MEDIA_TYPE, SCENARIO_ENTRY_KIND } from '../../../config/document-config'
import { ELCE_FEATURE_FLAGS } from '../../../config/feature-flags'
import { createStableId } from '../../../domain/document/document-model'
import type { ElceDocument } from '../../../domain/document/document-model'
import { applyDocumentCommand } from '../../../domain/commands/document-commands'
import type { ProfileCondition, ProfileConditionRow, ProfileConstraint, ProfileDefinition, ProfileProperty, ProfilePropertyType, ProfileTarget, ReadingRequirement, SummarySettings } from '../../../domain/summary-profile/summary-profile-types'
import { profilePropertyUsages } from '../../../domain/summary-profile/profile-rules'
import { mediaTypeFromMimeType } from '../../../domain/media/media-resource-service'
import { renderRemixMediaPicker } from '../../editor/media/remix-media-picker'
import type { EditorActionsFacade } from '../../facades/editor-actions-facade'
import { renderLucideIcon } from '../lucide-static-icon'

interface SummaryProfileSettingsProps {
  readonly document: ElceDocument
  readonly mediaSources: Readonly<Record<string, string>>
  readonly actions: EditorActionsFacade
  readonly error: string | null
  readonly summaryProfileEditingEnabled?: boolean
  readonly onClose: () => void
  readonly onError: (error: string | null) => void
}

/** Renders the document-owned Sommaire, profile properties and access rules. */
export function renderSummaryProfileSettings(props: SummaryProfileSettingsProps): RemixNode {
  const summaryProfileEditingEnabled = props.summaryProfileEditingEnabled
    ?? ELCE_FEATURE_FLAGS.summaryProfileEditing
  return <section
    id="elce-summary-profile-settings"
    className="elce-summary-profile-settings"
    aria-labelledby="elce-summary-profile-settings-title"
  >
    <div
      id="elce-summary-profile-settings-heading"
      className="elce-summary-profile-settings__heading"
    >
      <h1 id="elce-summary-profile-settings-title">Sommaire</h1>
      <button
        id="elce-summary-profile-settings-save"
        type={summaryProfileEditingEnabled ? 'submit' : 'button'}
        form={summaryProfileEditingEnabled ? 'elce-profile-constraints-form' : undefined}
        mix={on<HTMLButtonElement, 'click'>('click', () => {
          if (!summaryProfileEditingEnabled) props.onClose()
        })}
      >
        Enregistrer
      </button>
    </div>
    {props.error === null ? null : <p id="elce-summary-profile-error" role="alert">{props.error}</p>}
    {renderSummarySettings(props)}
    {summaryProfileEditingEnabled ? renderProfileProperties(props) : null}
    {summaryProfileEditingEnabled ? renderConstraintWorkspace(props) : null}
  </section>
}

/** Edits the unique summary presentation settings through the document facade. */
function renderSummarySettings(props: SummaryProfileSettingsProps): RemixNode {
  const summary = props.document.data.summary
  const change = (patch: Partial<SummarySettings>): void => {
    const next = { ...summary, ...patch }
    if (!next.showAtRoot && next.endChapterDestination === 'summary') next.endChapterDestination = 'next'
    commitSummary(props, next)
  }
  return <fieldset id="elce-summary-settings" className="elce-summary-profile-settings__group">
    <legend id="elce-summary-settings-title">Présentation du Sommaire</legend>
    <div id="elce-summary-presentation-fields" className="elce-summary-profile-settings__fields">
      <div id="elce-summary-title-control" className="elce-summary-profile-settings__field">
        <label id="elce-summary-title-field" htmlFor="elce-summary-title">Titre</label>
        <input
          id="elce-summary-title"
          type="text"
          value={summary.title}
          data-elce-profile-token-target="true"
          maxLength={120}
          mix={on<HTMLInputElement, 'blur'>('blur', (event) => change({ title: event.currentTarget.value }))}
        />
      </div>
      <div id="elce-summary-background-control" className="elce-summary-profile-settings__field">
        <span id="elce-summary-background-field">Image de fond</span>
        {renderRemixMediaPicker({
          idPrefix: 'elce-summary-background',
          className: 'elce-summary-background-picker',
          accept: MEDIA_FILE_ACCEPT.IMAGE,
          ariaLabel: 'Choisir une image de fond',
          promptLabel: 'Image de fond',
          emptyHint: 'Déposer ici',
          removeLabel: 'Retirer l’image de fond',
          media: props.document.medias.find((candidate) => candidate.id === summary.backgroundMediaId) ?? null,
          mediaType: summary.backgroundMediaId === null
            ? null
            : mediaTypeFromMimeType(props.document.medias.find((candidate) => candidate.id === summary.backgroundMediaId)?.mimeType ?? ''),
          mediaSource: summary.backgroundMediaId === null ? null : props.mediaSources[summary.backgroundMediaId] ?? null,
          onImport: (file) => props.actions.importSummaryBackgroundFile(file),
          onClear: () => change({ backgroundMediaId: null }),
          onCatalogReference: (reference) => setSummaryBackgroundFromCatalog(props, reference),
        })}
      </div>
      <div id="elce-summary-description-control" className="elce-summary-profile-settings__field elce-summary-profile-settings__field--wide">
        <label id="elce-summary-description-field" htmlFor="elce-summary-description">Description</label>
        <textarea
          id="elce-summary-description"
          value={summary.description}
          rows={3}
          data-elce-profile-token-target="true"
          mix={on<HTMLTextAreaElement, 'blur'>('blur', (event) => change({ description: event.currentTarget.value }))}
        />
      </div>
    </div>
    <fieldset id="elce-summary-navigation-options" className="elce-summary-profile-settings__subgroup">
      <legend id="elce-summary-navigation-options-title">Affichage et navigation</legend>
      <div id="elce-summary-option-toggles" className="elce-summary-profile-settings__checks">
        {renderCheckbox('elce-summary-show-in-menu', 'Afficher dans le menu', summary.showInMenu, (value) => change({ showInMenu: value }))}
        {renderCheckbox('elce-summary-show-at-root', 'Afficher comme destination racine', summary.showAtRoot, (value) => change({
          showAtRoot: value,
          endChapterDestination: value ? summary.endChapterDestination : 'next',
        }))}
        {renderCheckbox(
          'elce-summary-permanent-access',
          'Sommaire dans la navigation',
          summary.permanentAccess,
          (value) => change({ permanentAccess: value }),
          !summary.showAtRoot,
        )}
      </div>
      <div id="elce-summary-navigation-fields" className="elce-summary-profile-settings__fields">
        <div id="elce-summary-display-mode-control" className="elce-summary-profile-settings__field">
          <label id="elce-summary-display-mode-field" htmlFor="elce-summary-display-mode">Entrées affichées</label>
          <select
            id="elce-summary-display-mode"
            value={summary.displayMode}
            mix={on<HTMLSelectElement, 'change'>('change', (event) => change({ displayMode: event.currentTarget.value as SummarySettings['displayMode'] }))}
          >
            <option value="chapters">Niveaux seuls</option>
            <option value="pages">Pages et niveaux</option>
          </select>
        </div>
        <div id="elce-summary-page-continuation-control" className="elce-summary-profile-settings__field">
          <label id="elce-summary-page-continuation-field" htmlFor="elce-summary-page-continuation">Accès à la suite</label>
          <select
            id="elce-summary-page-continuation"
            value={summary.pageContinuationMode ?? 'endpage'}
            mix={on<HTMLSelectElement, 'change'>('change', (event) => change({ pageContinuationMode: event.currentTarget.value as SummarySettings['pageContinuationMode'] }))}
          >
            <option value="endpage">Fin de page</option>
            <option value="free">Libre</option>
          </select>
        </div>
        <div id="elce-summary-end-destination-control" className="elce-summary-profile-settings__field">
          <label id="elce-summary-end-destination-field" htmlFor="elce-summary-end-destination">Après un chapitre</label>
          <select
            id="elce-summary-end-destination"
            value={summary.endChapterDestination}
            disabled={!summary.showAtRoot}
            mix={on<HTMLSelectElement, 'change'>('change', (event) => change({ endChapterDestination: event.currentTarget.value as SummarySettings['endChapterDestination'] }))}
          >
            <option value="next">Ouvrir le chapitre suivant</option>
            <option value="summary">Revenir au Sommaire</option>
          </select>
        </div>
      </div>
    </fieldset>
  </fieldset>
}

/** Edits stable profile properties, their fields, defaults and choice labels. */
function renderProfileProperties(props: SummaryProfileSettingsProps): RemixNode {
  const profile = props.document.data.profile
  return <section id="elce-profile-properties" className="elce-summary-profile-settings__group">
    <h2 id="elce-profile-properties-title">Propriétés du profil</h2>
    <p id="elce-profile-properties-help">Les propriétés peuvent être utilisées par les règles même si elles ne figurent pas dans le formulaire.</p>
    <button
      id="elce-profile-property-add"
      type="button"
      mix={on<HTMLButtonElement, 'click'>('click', () => addProfileProperty(props))}
    >
      Ajouter une propriété
    </button>
    <ul id="elce-profile-property-list">
      {profile.properties.map((property) => renderProfileProperty(props, property))}
    </ul>
  </section>
}

/** Renders one property and blocks its deletion while references remain. */
function renderProfileProperty(props: SummaryProfileSettingsProps, property: ProfileProperty): RemixNode {
  const profile = props.document.data.profile
  const usages = profilePropertyUsages(props.document, property.id)
  const update = (patch: Partial<ProfileProperty>): void => {
    const properties = profile.properties.map((entry) => entry.id === property.id ? { ...entry, ...patch } : entry)
    updateProfile(props, { ...profile, properties })
  }
  const isField = profile.fieldPropertyIds.includes(property.id)
  return <li id={`elce-profile-property-row-${property.id}`} key={property.id}>
    <fieldset id={`elce-profile-property-${property.id}`}>
      <legend id={`elce-profile-property-heading-${property.id}`}>{property.label || property.name}</legend>
      <label id={`elce-profile-property-name-label-${property.id}`} htmlFor={`elce-profile-property-name-${property.id}`}>Nom interne</label>
      <input
        id={`elce-profile-property-name-${property.id}`}
        type="text"
        value={property.name}
        mix={on<HTMLInputElement, 'blur'>('blur', (event) => update({ name: event.currentTarget.value }))}
      />
      <label id={`elce-profile-property-label-label-${property.id}`} htmlFor={`elce-profile-property-label-${property.id}`}>Libellé</label>
      <input
        id={`elce-profile-property-label-${property.id}`}
        type="text"
        value={property.label}
        mix={on<HTMLInputElement, 'blur'>('blur', (event) => update({ label: event.currentTarget.value }))}
      />
      <label id={`elce-profile-property-type-label-${property.id}`} htmlFor={`elce-profile-property-type-${property.id}`}>Type</label>
      <select
        id={`elce-profile-property-type-${property.id}`}
        value={property.type}
        mix={on<HTMLSelectElement, 'change'>('change', (event) => updatePropertyType(props, property, event.currentTarget.value as ProfilePropertyType))}
      >
        <option value="text">Texte</option>
        <option value="number">Nombre</option>
        <option value="choice-one">Choix unique</option>
        <option value="choice-many">Choix multiple</option>
      </select>
      {renderCheckbox(`elce-profile-property-required-${property.id}`, 'Champ obligatoire', property.required, (value) => update({ required: value }))}
      {renderCheckbox(`elce-profile-property-field-${property.id}`, 'Afficher dans le formulaire', isField, (value) => {
        const fieldPropertyIds = value
          ? [...profile.fieldPropertyIds, property.id]
          : profile.fieldPropertyIds.filter((propertyId) => propertyId !== property.id)
        updateProfile(props, { ...profile, fieldPropertyIds })
      })}
      {renderProfileDefault(props, property, update)}
      {property.type === 'choice-one' || property.type === 'choice-many' ? renderChoices(props, property, update) : null}
      <button
        id={`elce-profile-property-delete-${property.id}`}
        type="button"
        disabled={usages.length > 0}
        title={usages.length === 0 ? 'Supprimer la propriété' : `Utilisations : ${usages.join(' ; ')}`}
        mix={on<HTMLButtonElement, 'click'>('click', () => deleteProfileProperty(props, property.id))}
      >
        Supprimer
      </button>
      {usages.length === 0 ? null : <p id={`elce-profile-property-usages-${property.id}`}>Utilisée par : {usages.join(' ; ')}.</p>}
    </fieldset>
  </li>
}

/** Renders an optional default value appropriate to the property's type. */
function renderProfileDefault(
  props: SummaryProfileSettingsProps,
  property: ProfileProperty,
  update: (patch: Partial<ProfileProperty>) => void,
): RemixNode {
  const id = `elce-profile-property-default-${property.id}`
  const labelId = `${id}-label`
  switch (property.type) {
    case 'text':
      return <div id={`${id}-control`} className="elce-summary-profile-settings__field">
        <label id={labelId} htmlFor={id}>Valeur par défaut</label>
        <input
          id={id}
          type="text"
          list={undefined}
          value={property.defaultValue === undefined ? '' : String(property.defaultValue)}
          mix={on<HTMLInputElement, 'blur'>('blur', (event) => {
            const raw = event.currentTarget.value
            update({ defaultValue: raw === '' ? undefined : raw })
          })}
        />
      </div>
    case 'number':
      return <div id={`${id}-control`} className="elce-summary-profile-settings__field">
        <label id={labelId} htmlFor={id}>Valeur par défaut</label>
        <input
          id={id}
          type="number"
          step="any"
          value={property.defaultValue === undefined ? '' : String(property.defaultValue)}
          mix={on<HTMLInputElement, 'blur'>('blur', (event) => {
            const raw = event.currentTarget.value
            const defaultValue = raw === '' ? undefined : Number(raw)
            if (defaultValue !== undefined && !Number.isFinite(defaultValue)) {
              props.onError('La valeur par défaut doit être un nombre valide.')
              return
            }
            update({ defaultValue })
          })}
        />
      </div>
    case 'choice-one':
      return <div id={`${id}-control`} className="elce-summary-profile-settings__field">
        <label id={labelId} htmlFor={id}>Valeur par défaut</label>
        <select
          id={id}
          value={typeof property.defaultValue === 'string' ? property.defaultValue : ''}
          mix={on<HTMLSelectElement, 'change'>('change', (event) => update({ defaultValue: event.currentTarget.value === '' ? undefined : event.currentTarget.value }))}
        >
          <option value="">Aucune</option>
          {property.choices.map((choice) => <option id={`${id}-option-${choice.id}`} value={choice.id}>{choice.label}</option>)}
        </select>
      </div>
    case 'choice-many':
      return <div id={`${id}-choices`} data-profile-default-property={property.id}>
        <p id={labelId}>Valeurs par défaut</p>
        {property.choices.map((choice) => {
          const selected = Array.isArray(property.defaultValue) && property.defaultValue.includes(choice.id)
          return <div id={`${id}-choice-${choice.id}`}>
            <input
              id={`${id}-input-${choice.id}`}
              name={`default-${property.id}`}
              type="checkbox"
              value={choice.id}
              checked={selected}
              mix={on<HTMLInputElement, 'change'>('change', (event) => {
                const container = event.currentTarget.closest('[data-profile-default-property]')
                if (!(container instanceof HTMLElement)) return
                const selectedIds = Array.from(container.querySelectorAll<HTMLInputElement>(`input[name="default-${property.id}"]:checked`), (input) => input.value)
                update({ defaultValue: selectedIds.length === 0 ? undefined : selectedIds })
              })}
            />
            <label id={`${id}-label-${choice.id}`} htmlFor={`${id}-input-${choice.id}`}>{choice.label}</label>
          </div>
        })}
        {property.choices.length === 0 ? <p id={`${id}-empty`}>Ajoutez une option avant de choisir un défaut.</p> : null}
      </div>
  }
}

/** Renders stable choice options and prevents removal while a rule uses one. */
function renderChoices(
  props: SummaryProfileSettingsProps,
  property: ProfileProperty,
  update: (patch: Partial<ProfileProperty>) => void,
): RemixNode {
  return <fieldset id={`elce-profile-choices-${property.id}`}>
    <legend id={`elce-profile-choices-title-${property.id}`}>Options</legend>
    <ul id={`elce-profile-choice-list-${property.id}`}>
      {property.choices.map((choice) => {
        const uses = props.document.data.profile.constraints.filter((constraint) => constraint.conditions.some((row) =>
          row.propertyId === property.id
          && (row.condition.kind === 'choice-one' || row.condition.kind === 'choice-many')
          && row.condition.choiceIds.includes(choice.id)))
        return <li id={`elce-profile-choice-row-${choice.id}`} key={choice.id}>
          <input
            id={`elce-profile-choice-label-${choice.id}`}
            type="text"
            aria-label={`Libellé de ${choice.label}`}
            value={choice.label}
            mix={on<HTMLInputElement, 'blur'>('blur', (event) => update({
              choices: property.choices.map((entry) => entry.id === choice.id ? { ...entry, label: event.currentTarget.value } : entry),
            }))}
          />
          <button
            id={`elce-profile-choice-delete-${choice.id}`}
            type="button"
            disabled={uses.length > 0}
            title={uses.length === 0 ? 'Supprimer l’option' : `Utilisée par ${uses.map((entry) => entry.target.id).join(', ')}`}
            mix={on<HTMLButtonElement, 'click'>('click', () => removeChoice(props, property, choice.id))}
          >
            Supprimer
          </button>
        </li>
      })}
    </ul>
    <button
      id={`elce-profile-choice-add-${property.id}`}
      type="button"
      mix={on<HTMLButtonElement, 'click'>('click', () => update({
        choices: [...property.choices, { id: createStableId('profile-choice'), label: `Choix ${property.choices.length + 1}` }],
      }))}
    >
      Ajouter un choix
    </button>
  </fieldset>
}

/** Combines scenario target selection and both rule families under one save. */
function renderConstraintWorkspace(props: SummaryProfileSettingsProps): RemixNode {
  return <form
    id="elce-profile-constraints-form"
    mix={[
      on<HTMLFormElement, 'click'>('click', (event) => handleVisibilityClick(props, event)),
      on<HTMLFormElement, 'change'>('change', (event) => handleVisibilityChange(props, event)),
      on<HTMLFormElement, 'input'>('input', handleVisibilityInput),
      on<HTMLFormElement, 'submit'>('submit', (event) => {
        event.preventDefault()
        if (props.error !== null) return
        if (saveConstraintChanges(props, event.currentTarget)) props.onClose()
      }),
    ]}
  >
    <div id="elce-profile-constraint-layout" className="elce-profile-constraint-layout">
      <section id="elce-profile-constraint-target-panel" className="elce-summary-profile-settings__group">
        <h2 id="elce-profile-constraint-target-title">Sommaire</h2>
        {renderConstraintTargetTree(props.document)}
      </section>
      <section id="elce-profile-constraint-editor-panel" className="elce-summary-profile-settings__group">
        <h2 id="elce-profile-constraint-editor-title">Contraintes</h2>
        <fieldset id="elce-constraints-editor" aria-labelledby="elce-profile-constraint-editor-title" disabled>
          <legend id="elce-constraints-editor-legend" className="elce-visually-hidden">Édition des contraintes</legend>
          <p id="elce-constraints-selection-state" role="status">Sélectionnez au moins un élément du Sommaire.</p>
          {renderProfileConstraintEditor(props)}
          {renderReadingConstraintEditor(props)}
        </fieldset>
      </section>
    </div>
  </form>
}

/** Renders the scenario hierarchy with checkboxes and without structural actions. */
function renderConstraintTargetTree(document: ElceDocument): RemixNode {
  const pages = new Map(document.pages.map((page) => [page.id, page]))
  const chapters = new Map(document.chapters.map((chapter) => [chapter.id, chapter]))
  const entries: RemixNode[] = []
  for (const entry of document.data.scenarioEntries) {
    if (entry.kind === SCENARIO_ENTRY_KIND.PAGE) {
      const page = pages.get(entry.pageId)
      if (page !== undefined) entries.push(renderConstraintTargetItem(document, { kind: 'page', id: page.id }, page.name))
      continue
    }
    const chapter = chapters.get(entry.chapterId)
    if (chapter === undefined) continue
    const pageItems = chapter.pageIds.flatMap((pageId) => {
      const page = pages.get(pageId)
      return page === undefined ? [] : [renderConstraintTargetItem(document, { kind: 'page', id: page.id }, page.name)]
    })
    entries.push(renderConstraintTargetItem(
      document,
      { kind: 'chapter', id: chapter.id },
      chapter.name,
      pageItems,
    ))
  }
  return <ul id="elce-profile-constraint-target-tree" className="elce-outline-list">
    {entries}
  </ul>
}

/** Renders one selectable chapter or page target in the scenario hierarchy. */
function renderConstraintTargetItem(
  document: ElceDocument,
  target: Extract<ProfileTarget, { kind: 'chapter' | 'page' }>,
  label: string,
  children?: readonly RemixNode[],
): RemixNode {
  const value = `${target.kind}:${target.id}`
  const itemId = `elce-profile-target-item-${safeId(value)}`
  return <li id={itemId} key={value}>
    <label id={`${itemId}-label`} className="elce-profile-constraint-target-row" htmlFor={`${itemId}-checkbox`}>
      <input
        id={`${itemId}-checkbox`}
        type="checkbox"
        name="targets"
        value={value}
        mix={on<HTMLInputElement, 'change'>('change', (event) => {
          const form = event.currentTarget.form
          if (form === null) return
          if (target.kind === 'chapter') {
            const chapter = document.chapters.find((candidate) => candidate.id === target.id)
            const pageIds = new Set(chapter?.pageIds ?? [])
            for (const checkbox of form.querySelectorAll<HTMLInputElement>('input[name="targets"]')) {
              const childTarget = parseTarget(checkbox.value)
              if (childTarget?.kind === 'page' && pageIds.has(childTarget.id)) {
                checkbox.checked = event.currentTarget.checked
              }
            }
            event.currentTarget.indeterminate = false
          } else {
            syncParentChapterSelection(form, document, target.id)
          }
          syncConstraintEditorState(form, document)
          refreshProfileVisibilityRows(form, document)
          refreshReadingRuleState(form, document)
        })}
      />
      <span id={`${itemId}-name`}>{label}</span>
    </label>
    {children === undefined ? null : <ul id={`${itemId}-children`} className="elce-outline-list">{[...children]}</ul>}
  </li>
}

/** Renders profile visibility rule controls for the checked pages and chapters. */
function renderProfileConstraintEditor(props: SummaryProfileSettingsProps): RemixNode {
  const properties = props.document.data.profile.properties
  return <fieldset
    id="elce-profile-rule-editor"
    className="elce-summary-profile-settings__subgroup"
    disabled={properties.length === 0}
  >
    <legend id="elce-profile-rule-editor-title">Visibilité</legend>
    {properties.length === 0 ? <p id="elce-profile-constraints-needs-property">Ajoutez d’abord une propriété.</p> : <div
      id="elce-profile-rule-fields"
      className="elce-summary-profile-settings__rule-fields"
    >
      <div id="elce-profile-visibility-effect-control" className="elce-summary-profile-settings__field">
        <label id="elce-profile-visibility-effect-label" htmlFor="elce-profile-visibility-unmet-behavior">
          Si la condition échoue
        </label>
        <select
          id="elce-profile-visibility-unmet-behavior"
          name="visibilityUnmetBehavior"
          defaultValue="hide"
        >
          <option value="hide">Masquer</option>
          <option value="lock">Verrouiller</option>
        </select>
      </div>
      <div id="elce-profile-visibility-conditions" className="elce-profile-visibility-conditions" />
      <div id="elce-profile-visibility-actions">
        <button
          id="elce-profile-visibility-add"
          className="elce-icon-action"
          type="button"
          data-profile-visibility-action="add"
          aria-label="Ajouter une condition"
          title="Ajouter une condition"
        >
          {renderLucideIcon(Plus, 'elce-profile-visibility-add-icon', 14)}
        </button>
      </div>
      <p id="elce-profile-rule-current-state" role="status" />
      <div id="elce-profile-visibility-condition-template" hidden aria-hidden="true">
        {renderVisibilityConditionRowTemplate(properties)}
      </div>
    </div>}
  </fieldset>
}

/** Renders the exclusive previous-or-multiple-chapters prerequisite selector. */
function renderReadingConstraintEditor(props: SummaryProfileSettingsProps): RemixNode {
  const chapters = props.document.chapters
  return <fieldset
    id="elce-reading-rule-editor"
    className="elce-summary-profile-settings__subgroup"
    disabled={chapters.length < 2}
  >
    <legend id="elce-reading-rule-editor-title">Prérequis de lecture</legend>
    {chapters.length < 2 ? <p id="elce-reading-constraints-needs-chapters">Ajoutez un chapitre pour définir un prérequis.</p> : <div
      id="elce-reading-rule-fields"
      className="elce-summary-profile-settings__rule-fields"
    >
      <div id="elce-reading-prerequisites-control" className="elce-summary-profile-settings__field">
        <label id="elce-reading-prerequisites-label" htmlFor="elce-reading-prerequisites">Chapitres requis</label>
        <select
          id="elce-reading-prerequisites"
          name="readingPrerequisites"
          multiple
          size={Math.min(8, chapters.length + 2)}
        >
          <option value="ignore">-</option>
          <option value="previous">Précédent</option>
          {chapters.map((chapter) => <option id={`elce-reading-prerequisite-${chapter.id}`} value={`chapter:${chapter.id}`}>{chapter.name}</option>)}
        </select>
      </div>
      <p id="elce-reading-rule-current-state" role="status">Sélectionnez au moins un chapitre.</p>
    </div>}
  </fieldset>
}

/** Renders one cloneable, single-line profile visibility condition. */
function renderVisibilityConditionRowTemplate(properties: readonly ProfileProperty[]): RemixNode {
  return <div
    id="elce-profile-visibility-row-__row__"
    className="elce-profile-visibility-row"
    data-profile-visibility-row="true"
  >
    <select id="elce-profile-visibility-property-__row__" data-profile-visibility-property="true" aria-label="Propriété">
      {properties.map((property) => <option id={`elce-profile-visibility-property-__row__-${property.id}`} value={property.id}>{property.label}</option>)}
    </select>
    <div id="elce-profile-visibility-comparison-__row__" className="elce-profile-visibility-comparison">
      <div id="elce-profile-visibility-text-__row__" data-profile-condition-kind="text" hidden>
        <select id="elce-profile-visibility-text-operator-__row__" data-profile-condition-operator="text" aria-label="Condition du texte">
          <option value="equals">Égal à</option>
          <option value="not-equals">Différent</option>
        </select>
        <input id="elce-profile-visibility-text-value-__row__" data-profile-condition-value="text" type="text" aria-label="Valeur du texte" />
      </div>
      <div id="elce-profile-visibility-number-__row__" data-profile-condition-kind="number" hidden>
        <select id="elce-profile-visibility-number-operator-__row__" data-profile-condition-operator="number" aria-label="Condition du nombre">
          <option value="equals">=</option>
          <option value="not-equals">!=</option>
          <option value="less-than">&lt;</option>
          <option value="greater-than">&gt;</option>
        </select>
        <input id="elce-profile-visibility-number-value-__row__" data-profile-condition-value="number" type="number" step="any" aria-label="Valeur du nombre" />
      </div>
      <div id="elce-profile-visibility-choice-__row__" data-profile-condition-kind="choice-one" hidden>
        <select id="elce-profile-visibility-choice-operator-__row__" data-profile-condition-operator="choice" aria-label="Condition du choix">
          <option value="is">=</option>
          <option value="is-not">≠</option>
        </select>
        <select id="elce-profile-visibility-choice-value-__row__" data-profile-condition-value="choice" aria-label="Valeur du choix" multiple size={2}>
          {properties.flatMap((property) => property.choices.map((choice) => <option
            id={`elce-profile-visibility-choice-__row__-${property.id}-${choice.id}`}
            value={choice.id}
            data-profile-property-id={property.id}
            disabled={property.id !== properties[0]?.id}
          >
            {choice.label}
          </option>))}
        </select>
      </div>
    </div>
    <select id="elce-profile-visibility-join-__row__" data-profile-visibility-join="true" aria-label="Combinaison avec la condition suivante">
      <option value="and">ET</option>
      <option value="or">OU</option>
    </select>
    <button
      id="elce-profile-visibility-remove-__row__"
      className="elce-icon-action"
      type="button"
      data-profile-visibility-action="remove"
      aria-label="Supprimer la condition"
      title="Supprimer la condition"
    >
      {renderLucideIcon(Trash2, 'elce-profile-visibility-remove-icon-__row__', 14)}
    </button>
  </div>
}

/** Creates and exposes a new stable property in the initial profile form. */
function addProfileProperty(props: SummaryProfileSettingsProps): void {
  const id = createStableId('profile-property')
  const index = props.document.data.profile.properties.length + 1
  const property: ProfileProperty = {
    id,
    name: `propriete_${index}`,
    label: `Propriété ${index}`,
    type: 'text',
    required: false,
    choices: [],
  }
  updateProfile(props, {
    ...props.document.data.profile,
    properties: [...props.document.data.profile.properties, property],
    fieldPropertyIds: [...props.document.data.profile.fieldPropertyIds, id],
  })
}

/** Deletes a property only after the invariant checker confirms no references remain. */
function deleteProfileProperty(props: SummaryProfileSettingsProps, propertyId: string): void {
  const profile = props.document.data.profile
  updateProfile(props, {
    ...profile,
    properties: profile.properties.filter((property) => property.id !== propertyId),
    fieldPropertyIds: profile.fieldPropertyIds.filter((id) => id !== propertyId),
  })
}

/** Changes property type only when its existing conditions remain compatible. */
function updatePropertyType(props: SummaryProfileSettingsProps, property: ProfileProperty, type: ProfilePropertyType): void {
  const profile = props.document.data.profile
  const updated: ProfileProperty = {
    ...property,
    type,
    choices: type === 'choice-one' || type === 'choice-many' ? property.choices : [],
    defaultValue: undefined,
  }
  updateProfile(props, { ...profile, properties: profile.properties.map((entry) => entry.id === property.id ? updated : entry) })
}

/** Removes a choice after checking that no saved condition still uses it. */
function removeChoice(props: SummaryProfileSettingsProps, property: ProfileProperty, choiceId: string): void {
  const uses = props.document.data.profile.constraints.filter((constraint) => constraint.conditions.some((row) =>
    row.propertyId === property.id
    && (row.condition.kind === 'choice-one' || row.condition.kind === 'choice-many')
    && row.condition.choiceIds.includes(choiceId)))
  if (uses.length > 0) {
    props.onError(`Suppression bloquée : option utilisée par ${uses.map((entry) => targetLabel(props.document, entry.target)).join(' ; ')}.`)
    return
  }
  updateProfile(props, {
    ...props.document.data.profile,
    properties: props.document.data.profile.properties.map((entry) => entry.id === property.id
      ? { ...entry, choices: entry.choices.filter((choice) => choice.id !== choiceId) }
      : entry),
  })
}

/** Applies a settings change only after the document command validates it. */
function commitSummary(props: SummaryProfileSettingsProps, summary: SummarySettings): void {
  try {
    applyDocumentCommand(props.document, { type: 'summary.settings.update', summary })
    props.actions.updateSummarySettings(summary)
    props.onError(null)
  } catch (error) {
    props.onError(errorMessage(error))
  }
}

/** Assigns only an existing image reference dropped from the shared media catalogue. */
function setSummaryBackgroundFromCatalog(props: SummaryProfileSettingsProps, serializedReference: string): void {
  const mediaId = readCatalogMediaId(serializedReference)
  if (mediaId === null) return
  const media = props.document.medias.find((candidate) => candidate.id === mediaId)
  if (media === undefined || mediaTypeFromMimeType(media.mimeType) !== MEDIA_TYPE.IMAGE) return
  commitSummary(props, { ...props.document.data.summary, backgroundMediaId: mediaId })
}

/** Reads a shared catalogue media reference without accepting other catalogue items. */
function readCatalogMediaId(serializedReference: string): string | null {
  try {
    const reference = JSON.parse(serializedReference) as { kind?: unknown; mediaId?: unknown }
    return reference.kind === CATALOG_REFERENCE.MEDIA && typeof reference.mediaId === 'string'
      ? reference.mediaId
      : null
  } catch {
    return null
  }
}

/** Applies a profile change only after references and chapter dependencies validate. */
function updateProfile(props: SummaryProfileSettingsProps, profile: ProfileDefinition): boolean {
  try {
    applyDocumentCommand(props.document, { type: 'profile.definition.update', profile })
    props.actions.updateProfileDefinition(profile)
    props.onError(null)
    return true
  } catch (error) {
    props.onError(errorMessage(error))
    return false
  }
}

/** Parses the selected chapter or page from the author target tree. */
function parseTarget(value: string): ProfileTarget | null {
  const separator = value.indexOf(':')
  if (separator < 0) return null
  const kind = value.slice(0, separator)
  const id = value.slice(separator + 1)
  if (id.length === 0) return null
  if (kind === 'chapter' || kind === 'page') return { kind, id } as ProfileTarget
  return null
}

/** Reads selected chapter and page targets in their rendered scenario order. */
function selectedTargets(form: HTMLFormElement): ProfileTarget[] {
  return Array.from(form.querySelectorAll<HTMLInputElement>('input[name="targets"]:checked'))
    .flatMap((input) => parseTarget(input.value) ?? [])
}

/** Marks the parent chapter partial without selecting its chapter-level target. */
function syncParentChapterSelection(form: HTMLFormElement, document: ElceDocument, pageId: string): void {
  const page = document.pages.find((candidate) => candidate.id === pageId)
  if (page?.chapterId === null || page?.chapterId === undefined) return
  const checkboxes = new Map(
    Array.from(form.querySelectorAll<HTMLInputElement>('input[name="targets"]'), (input) => [input.value, input]),
  )
  const chapter = document.chapters.find((candidate) => candidate.id === page.chapterId)
  if (chapter === undefined) return
  const chapterCheckbox = checkboxes.get(`chapter:${chapter.id}`)
  if (chapterCheckbox === undefined) return
  const hasSelectedPage = chapter.pageIds.some((childPageId) => checkboxes.get(`page:${childPageId}`)?.checked === true)
  chapterCheckbox.checked = false
  chapterCheckbox.indeterminate = hasSelectedPage
}

/** Enables the constraint editor only while the author has selected a target. */
function syncConstraintEditorState(form: HTMLFormElement, document: ElceDocument): void {
  const targets = selectedTargets(form)
  const editor = form.querySelector<HTMLFieldSetElement>('#elce-constraints-editor')
  const state = form.querySelector<HTMLElement>('#elce-constraints-selection-state')
  const readingEditor = form.querySelector<HTMLFieldSetElement>('#elce-reading-rule-editor')
  const selectedChapterCount = targets.filter((target) => target.kind === 'chapter').length
  if (editor !== null) editor.disabled = targets.length === 0
  if (readingEditor !== null) readingEditor.disabled = document.chapters.length < 2 || selectedChapterCount === 0
  if (state !== null) {
    state.textContent = targets.length === 0
      ? 'Sélectionnez au moins un élément du Sommaire.'
      : `${targets.length} élément${targets.length > 1 ? 's' : ''} sélectionné${targets.length > 1 ? 's' : ''}.`
  }
}

/** Handles add and remove buttons for the delegated visibility row editor. */
function handleVisibilityClick(props: SummaryProfileSettingsProps, event: Event): void {
  const form = event.currentTarget
  const target = event.target
  if (!(form instanceof HTMLFormElement) || !(target instanceof Element)) return
  const button = target.closest<HTMLButtonElement>('[data-profile-visibility-action]')
  if (button === null) return
  event.preventDefault()
  if (button.dataset.profileVisibilityAction === 'add') {
    appendVisibilityConditionRow(form, props.document.data.profile.properties)
  } else if (button.dataset.profileVisibilityAction === 'remove') {
    button.closest('[data-profile-visibility-row]')?.remove()
    syncVisibilityJoinControls(form)
  } else {
    return
  }
  markVisibilityTouched(form)
}

/** Updates row controls and marks edits made to a visibility list. */
function handleVisibilityChange(props: SummaryProfileSettingsProps, event: Event): void {
  const form = event.currentTarget
  const target = event.target
  if (!(form instanceof HTMLFormElement) || !(target instanceof Element)) return
  if (target.matches('#elce-reading-prerequisites')) {
    handleReadingRequirementChange(form)
    return
  }
  if (target.matches('#elce-profile-visibility-unmet-behavior')) {
    markVisibilityTouched(form)
    return
  }
  const row = target.closest<HTMLElement>('[data-profile-visibility-row]')
  if (row === null) return
  if (target.matches('[data-profile-visibility-property]')) {
    syncVisibilityConditionControls(row, props.document.data.profile.properties)
  }
  markVisibilityTouched(form)
}

/** Marks text and number edits in a visibility condition before the form is saved. */
function handleVisibilityInput(event: Event): void {
  const form = event.currentTarget
  const target = event.target
  if (!(form instanceof HTMLFormElement) || !(target instanceof Element)) return
  if (target.closest('[data-profile-visibility-row]') !== null) markVisibilityTouched(form)
}

/** Adds a clone of the condition-row template and optionally fills a saved rule. */
function appendVisibilityConditionRow(
  form: HTMLFormElement,
  properties: readonly ProfileProperty[],
  initial?: ProfileConditionRow,
): void {
  const template = form.querySelector<HTMLElement>('#elce-profile-visibility-condition-template')
  const container = form.querySelector<HTMLElement>('#elce-profile-visibility-conditions')
  if (template === null || container === null || properties.length === 0) return
  const nextIndex = Number(form.dataset.visibilityRowSequence ?? '0') + 1
  form.dataset.visibilityRowSequence = String(nextIndex)
  const rowTemplate = template.firstElementChild
  if (rowTemplate === null) return
  const row = rowTemplate.cloneNode(true) as HTMLElement
  for (const element of [row, ...row.querySelectorAll<HTMLElement>('[id]')]) {
    element.id = element.id.replace(/__row__/g, String(nextIndex))
  }
  for (const label of row.querySelectorAll<HTMLLabelElement>('[for]')) {
    label.htmlFor = label.htmlFor.replace(/__row__/g, String(nextIndex))
  }
  const propertySelect = row.querySelector<HTMLSelectElement>('[data-profile-visibility-property]')
  if (propertySelect === null) return
  propertySelect.value = initial?.propertyId ?? properties[0]?.id ?? ''
  if (initial !== undefined) setVisibilityConditionRow(row, initial)
  syncVisibilityConditionControls(row, properties)
  const join = row.querySelector<HTMLSelectElement>('[data-profile-visibility-join]')
  if (join !== null) join.value = initial?.joinWithNext ?? 'and'
  container.append(row)
  syncVisibilityJoinControls(form)
}

/** Loads saved or inherited conditions for the selected target set. */
function refreshProfileVisibilityRows(form: HTMLFormElement, document: ElceDocument): void {
  const container = form.querySelector<HTMLElement>('#elce-profile-visibility-conditions')
  const status = form.querySelector<HTMLElement>('#elce-profile-rule-current-state')
  const unmetBehavior = form.querySelector<HTMLSelectElement>('#elce-profile-visibility-unmet-behavior')
  if (container === null || status === null) return
  const targets = selectedTargets(form)
  if (targets.length === 0) {
    if (form.dataset.profileVisibilityTouched !== 'true') {
      container.replaceChildren()
      if (unmetBehavior !== null) unmetBehavior.value = 'hide'
    }
    status.textContent = 'Sélectionnez un élément du Sommaire.'
    return
  }
  if (form.dataset.profileVisibilityTouched === 'true') {
    status.textContent = 'La liste affichée sera appliquée aux cibles sélectionnées.'
    return
  }

  const states = targets.map((target) => effectiveProfileVisibility(document, target))
  const signatures = new Set(states.map((state) => JSON.stringify({
    conditions: state?.rule.conditions ?? [],
    unmetBehavior: state?.rule.unmetBehavior ?? 'hide',
  })))
  const conditions = states[0]?.rule.conditions ?? []
  container.replaceChildren()
  if (unmetBehavior !== null) unmetBehavior.value = states[0]?.rule.unmetBehavior ?? 'hide'
  if (conditions.length === 0) appendVisibilityConditionRow(form, document.data.profile.properties)
  else conditions.forEach((condition) => appendVisibilityConditionRow(form, document.data.profile.properties, condition))
  status.textContent = signatures.size > 1
    ? 'Visibilités différentes ; enregistrer appliquera la liste affichée à toute la sélection.'
    : states.some((state) => state?.inherited === true) ? 'Visibilité héritée du chapitre.' : ''
}

/** Keeps the logical join selector only between consecutive conditions. */
function syncVisibilityJoinControls(form: HTMLFormElement): void {
  const rows = Array.from(form.querySelectorAll<HTMLElement>('#elce-profile-visibility-conditions [data-profile-visibility-row]'))
  rows.forEach((row, index) => {
    const join = row.querySelector<HTMLSelectElement>('[data-profile-visibility-join]')
    if (join === null) return
    const last = index === rows.length - 1
    join.hidden = last
    join.disabled = last
  })
}

/** Marks the visibility list as edited and announces its save scope. */
function markVisibilityTouched(form: HTMLFormElement): void {
  form.dataset.profileVisibilityTouched = 'true'
  const status = form.querySelector<HTMLElement>('#elce-profile-rule-current-state')
  if (status !== null) status.textContent = 'La liste affichée sera appliquée aux cibles sélectionnées.'
}

/** Keeps the ignore and previous options exclusive from named chapter selections. */
function handleReadingRequirementChange(form: HTMLFormElement): void {
  const select = form.querySelector<HTMLSelectElement>('#elce-reading-prerequisites')
  if (select === null) return
  const previousValues = parseStringArray(select.dataset.selectedValues)
  const currentValues = Array.from(select.selectedOptions, (option) => option.value)
  const addedValue = currentValues.find((value) => !previousValues.includes(value))
  let normalized = currentValues
  if (addedValue === 'ignore' || addedValue === 'previous') {
    normalized = [addedValue]
  } else if (addedValue?.startsWith('chapter:') === true) {
    normalized = currentValues.filter((value) => value.startsWith('chapter:'))
  } else if (normalized.length === 0) {
    normalized = ['ignore']
  }
  for (const option of Array.from(select.options)) option.selected = normalized.includes(option.value)
  select.dataset.selectedValues = JSON.stringify(normalized)
  form.dataset.readingTouched = 'true'
  const status = form.querySelector<HTMLElement>('#elce-reading-rule-current-state')
  if (status !== null) status.textContent = 'Le prérequis choisi sera appliqué aux chapitres sélectionnés.'
}

/** Reads the prior multiselect state used to enforce its exclusive choices. */
function parseStringArray(value: string | undefined): string[] {
  if (value === undefined) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

/** Applies both constraint editors in one validated document update. */
function saveConstraintChanges(props: SummaryProfileSettingsProps, form: HTMLFormElement): boolean {
  const targets = selectedTargets(form)
  const data = new FormData(form)
  const visibilityTouched = form.dataset.profileVisibilityTouched === 'true'
  const readingTouched = form.dataset.readingTouched === 'true'
  if (targets.length === 0) {
    if (visibilityTouched || readingTouched) {
      props.onError('Sélectionnez au moins un élément du Sommaire pour enregistrer les modifications.')
      return false
    }
    props.onError(null)
    return true
  }

  let constraints = [...props.document.data.profile.constraints]
  let readingConstraints = [...props.document.data.profile.readingConstraints]
  if (visibilityTouched) {
    const conditions = visibilityConditionsFromRows(form, props.document.data.profile.properties)
    if (conditions === null) {
      props.onError('Complétez chaque condition de visibilité avant de l’enregistrer.')
      return false
    }
    constraints = constraints.filter((entry) => !targets.some((target) => sameTarget(entry.target, target)))
    if (conditions.length > 0) {
      const unmetBehavior = data.get('visibilityUnmetBehavior') === 'lock' ? 'lock' : 'hide'
      for (const target of targets) {
        const current = props.document.data.profile.constraints.find((entry) => sameTarget(entry.target, target))
        constraints.push({
          id: current?.id ?? createStableId('visibility-rule'),
          target,
          conditions,
          ...(unmetBehavior === 'lock' ? { unmetBehavior } : {}),
        })
      }
    }
  }

  if (readingTouched) {
    const selectedChapters = targets.filter((target): target is Extract<ProfileTarget, { kind: 'chapter' }> => target.kind === 'chapter')
    if (selectedChapters.length === 0) {
      props.onError('Sélectionnez au moins un chapitre pour modifier les prérequis de lecture.')
      return false
    }
    const selectedRequirements = data.getAll('readingPrerequisites').map(String)
    if (selectedRequirements.length === 0 || selectedRequirements.every((value) => value === 'ignore')) {
      readingConstraints = readingConstraints.filter((entry) =>
        !selectedChapters.some((target) => entry.target.id === target.id))
    } else {
      let requirement: ReadingRequirement
      if (selectedRequirements.length === 1 && selectedRequirements[0] === 'previous') {
        requirement = { kind: 'previous-chapter' }
      } else if (selectedRequirements.every((value) => value.startsWith('chapter:'))) {
        const chapterIds = selectedRequirements.map((value) => value.slice('chapter:'.length))
        if (chapterIds.some((chapterId) => !props.document.chapters.some((chapter) => chapter.id === chapterId))) {
          props.onError('Choisissez des chapitres requis existants.')
          return false
        }
        requirement = { kind: 'chapters', chapterIds }
      } else {
        props.onError('Choisissez « - », « Précédent » ou un ou plusieurs chapitres.')
        return false
      }
      for (const target of selectedChapters) {
        const current = readingConstraints.find((entry) => entry.target.id === target.id)
        readingConstraints = readingConstraints.filter((entry) => entry.target.id !== target.id)
        readingConstraints.push({
          id: current?.id ?? createStableId('reading-rule'),
          target,
          requirement,
        })
      }
    }
  }

  if (!visibilityTouched && !readingTouched) {
    props.onError(null)
    return true
  }
  return updateProfile(props, {
    ...props.document.data.profile,
    constraints,
    readingConstraints,
  })
}

/** Compares stable target kind and identifier pairs. */
function sameTarget(left: ProfileTarget, right: ProfileTarget): boolean {
  return left.kind === right.kind && left.id === right.id
}

/** Resolves a target's local visibility list or its chapter's inherited list. */
function effectiveProfileVisibility(
  document: ElceDocument,
  target: ProfileTarget,
): Readonly<{ rule: ProfileConstraint; inherited: boolean }> | undefined {
  const constraints = document.data.profile.constraints
  const local = constraints.find((entry) => sameTarget(entry.target, target))
  if (local !== undefined) return { rule: local, inherited: false }
  if (target.kind !== 'page') return undefined
  const chapterId = document.pages.find((page) => page.id === target.id)?.chapterId
  const inherited = chapterId === null || chapterId === undefined
    ? undefined
    : constraints.find((entry) => entry.target.kind === 'chapter' && entry.target.id === chapterId)
  return inherited === undefined ? undefined : { rule: inherited, inherited: true }
}

/** Shows the saved prerequisite state for selected chapter targets. */
function refreshReadingRuleState(form: HTMLFormElement | null, document: ElceDocument): void {
  if (form === null) return
  const status = form.querySelector<HTMLElement>('#elce-reading-rule-current-state')
  const select = form.querySelector<HTMLSelectElement>('#elce-reading-prerequisites')
  if (status === null) return
  const chapters = selectedTargets(form).filter((target): target is Extract<ProfileTarget, { kind: 'chapter' }> => target.kind === 'chapter')
  if (chapters.length === 0) {
    status.textContent = 'Sélectionnez au moins un chapitre.'
    if (form.dataset.readingTouched !== 'true' && select !== null) {
      setReadingPrerequisiteSelection(select, ['ignore'])
    }
    return
  }
  const states = chapters.map((target) => document.data.profile.readingConstraints.find((entry) => entry.target.id === target.id)?.requirement)
  const signatures = new Set(states.map((state) => JSON.stringify(state ?? null)))
  if (signatures.size > 1) {
    status.textContent = 'Valeurs mixtes : enregistrer appliquera le même prérequis à tous les chapitres cochés.'
    if (form.dataset.readingTouched !== 'true' && select !== null) setReadingPrerequisiteSelection(select, [])
    return
  }
  const current = states[0]
  if (form.dataset.readingTouched !== 'true' && select !== null) {
    setReadingPrerequisiteSelection(select, current === undefined
      ? ['ignore']
      : current.kind === 'previous-chapter'
        ? ['previous']
        : current.chapterIds.map((chapterId) => `chapter:${chapterId}`))
  }
  status.textContent = current === undefined
    ? 'Aucun prérequis actuel pour les chapitres sélectionnés.'
    : `Même prérequis actuellement appliqué : ${readingRequirementLabel(document, current)}.`
}

/** Synchronizes the multiselect and its previous-selection snapshot. */
function setReadingPrerequisiteSelection(select: HTMLSelectElement, values: readonly string[]): void {
  for (const option of Array.from(select.options)) option.selected = values.includes(option.value)
  select.dataset.selectedValues = JSON.stringify(values)
}

/** Reads every completed visibility row in its rendered order. */
function visibilityConditionsFromRows(
  form: HTMLFormElement,
  properties: readonly ProfileProperty[],
): ProfileConditionRow[] | null {
  const rows = Array.from(form.querySelectorAll<HTMLElement>('#elce-profile-visibility-conditions [data-profile-visibility-row]'))
  const conditions: ProfileConditionRow[] = []
  for (const [index, row] of rows.entries()) {
    const propertyId = row.querySelector<HTMLSelectElement>('[data-profile-visibility-property]')?.value
    const property = properties.find((entry) => entry.id === propertyId)
    if (property === undefined) return null
    const condition = conditionFromVisibilityRow(property, row)
    if (condition === null) return null
    let joinWithNext: ProfileConditionRow['joinWithNext'] = null
    if (index < rows.length - 1) {
      const operator = row.querySelector<HTMLSelectElement>('[data-profile-visibility-join]')?.value
      if (operator !== 'and' && operator !== 'or') return null
      joinWithNext = operator
    }
    conditions.push({ propertyId: property.id, condition, joinWithNext })
  }
  return conditions
}

/** Converts one row's active comparison and value into a typed condition. */
function conditionFromVisibilityRow(property: ProfileProperty, row: HTMLElement): ProfileCondition | null {
  const kind = property.type === 'choice-many' ? 'choice-one' : property.type
  const group = row.querySelector<HTMLElement>(`[data-profile-condition-kind="${kind}"]`)
  if (group === null) return null
  switch (property.type) {
    case 'text': {
      const operator = group.querySelector<HTMLSelectElement>('[data-profile-condition-operator]')?.value
      if (operator !== 'equals' && operator !== 'not-equals') return null
      const value = group.querySelector<HTMLInputElement>('[data-profile-condition-value]')?.value ?? ''
      if (value.length === 0) return null
      return { kind: 'text', operator, value }
    }
    case 'number': {
      const operator = group.querySelector<HTMLSelectElement>('[data-profile-condition-operator]')?.value
      if (operator === undefined || !['equals', 'not-equals', 'less-than', 'greater-than'].includes(operator)) return null
      const rawValue = group.querySelector<HTMLInputElement>('[data-profile-condition-value]')?.value ?? ''
      if (rawValue.trim().length === 0) return null
      const value = Number(rawValue)
      if (!Number.isFinite(value)) return null
      return { kind: 'number', operator: operator as Extract<ProfileCondition, { kind: 'number' }>['operator'], value }
    }
    case 'choice-one':
    case 'choice-many': {
      const operator = group.querySelector<HTMLSelectElement>('[data-profile-condition-operator]')?.value
      if (operator !== 'is' && operator !== 'is-not') return null
      const availableIds = new Set(property.choices.map((choice) => choice.id))
      const value = group.querySelector<HTMLSelectElement>('[data-profile-condition-value]')
      const choiceIds = value === null ? [] : Array.from(value.selectedOptions, (option) => option.value).filter((id) => availableIds.has(id))
      if (choiceIds.length === 0) return null
      return { kind: property.type, operator, choiceIds, choiceMode: 'any' }
    }
  }
}

/** Sets a cloned row's saved comparison and value before it is displayed. */
function setVisibilityConditionRow(row: HTMLElement, initial: ProfileConditionRow): void {
  const groupKind = initial.condition.kind === 'choice-many' ? 'choice-one' : initial.condition.kind
  const group = row.querySelector<HTMLElement>(`[data-profile-condition-kind="${groupKind}"]`)
  if (group === null) return
  const operator = group.querySelector<HTMLSelectElement>('[data-profile-condition-operator]')
  if (operator !== null) operator.value = initial.condition.operator
  switch (initial.condition.kind) {
    case 'text': {
      const value = group.querySelector<HTMLInputElement>('[data-profile-condition-value]')
      if (value !== null) value.value = initial.condition.value
      break
    }
    case 'number': {
      const value = group.querySelector<HTMLInputElement>('[data-profile-condition-value]')
      if (value !== null) value.value = String(initial.condition.value)
      break
    }
    case 'choice-one':
    case 'choice-many': {
      const value = group.querySelector<HTMLSelectElement>('[data-profile-condition-value]')
      if (value !== null) {
        const choiceIds = new Set(initial.condition.choiceIds)
        for (const option of value.options) option.selected = choiceIds.has(option.value)
      }
      break
    }
  }
}

/** Shows the comparison controls that match one row's selected property. */
function syncVisibilityConditionControls(
  row: HTMLElement,
  properties: readonly ProfileProperty[],
): void {
  const propertyId = row.querySelector<HTMLSelectElement>('[data-profile-visibility-property]')?.value
  const property = properties.find((entry) => entry.id === propertyId)
  if (property === undefined) return
  const expectedKind = property.type === 'choice-many' ? 'choice-one' : property.type
  for (const group of row.querySelectorAll<HTMLElement>('[data-profile-condition-kind]')) {
    const kind = group.dataset.profileConditionKind
    const visible = kind === expectedKind
    group.hidden = !visible
    for (const control of group.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')) control.disabled = !visible
  }
  for (const option of row.querySelectorAll<HTMLOptionElement>('[data-profile-property-id]')) {
    option.disabled = option.dataset.profilePropertyId !== propertyId
    if (option.disabled) option.selected = false
  }
}

/** Resolves a stable target to its readable label. */
function targetLabel(document: ElceDocument, target: ProfileTarget): string {
  switch (target.kind) {
    case 'chapter': return `Chapitre ${document.chapters.find((entry) => entry.id === target.id)?.name ?? target.id}`
    case 'page': return `Page ${document.pages.find((entry) => entry.id === target.id)?.name ?? target.id}`
    case 'bdc': return `BDC ${target.id}`
  }
}

/** Resolves one chapter identifier to its author-facing name. */
function chapterLabel(document: ElceDocument, chapterId: string): string {
  return document.chapters.find((chapter) => chapter.id === chapterId)?.name ?? chapterId
}

/** Describes one chapter-reading prerequisite. */
function readingRequirementLabel(document: ElceDocument, requirement: ReadingRequirement): string {
  return requirement.kind === 'previous-chapter'
    ? 'chapitre précédent retenu'
    : requirement.chapterIds.map((chapterId) => chapterLabel(document, chapterId)).join(' et ')
}

/** Commits a checkbox while preserving its explicit label and DOM identity. */
function renderCheckbox(
  id: string,
  label: string,
  checked: boolean,
  update: (value: boolean) => void,
  disabled = false,
): RemixNode {
  return <div id={`${id}-field`} className="elce-summary-profile-settings__checkbox">
    <input id={id} type="checkbox" checked={checked} disabled={disabled} mix={on<HTMLInputElement, 'change'>('change', (event) => update(event.currentTarget.checked))} />
    <label id={`${id}-label`} htmlFor={id}>{label}</label>
  </div>
}

/** Removes an optional default without changing the property's other fields. */
/** Makes target identifiers safe for use in generated element ids. */
function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}

/** Converts unknown command errors into a message for the author. */
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
