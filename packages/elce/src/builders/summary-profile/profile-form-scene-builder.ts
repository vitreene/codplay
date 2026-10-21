import type { PersoDoc, SceneDoc, StoryDoc } from 'codplay/scene/types'
import { ELCE_EVENTS } from '../../config/document-config'
import type { ProfileChoice, ProfileProperty, ProfileValue } from '../../domain/summary-profile/summary-profile-types'
import { resolveProfileValues } from '../../domain/summary-profile/profile-rules'
import {
  changeProfileValueStrap,
  ELCE_PROFILE_FORM_RUNTIME_KEY,
  submitProfileStrap,
  type ProfileFormRuntimeConfiguration,
} from '../scene-functions/profile-form'

type ProfileFormState = Readonly<{
  values: Readonly<Record<string, ProfileValue>>
  [ELCE_PROFILE_FORM_RUNTIME_KEY]: ProfileFormRuntimeConfiguration
}>

/** Builds the child scene that collects and validates all configured profile fields. */
export function buildProfileFormScene(
  documentId: string,
  properties: readonly ProfileProperty[],
  fieldPropertyIds: readonly string[],
  initialValues: Readonly<Record<string, ProfileValue>>,
): SceneDoc<string> {
  const fields = fieldPropertyIds.flatMap((id) => {
    const property = properties.find((candidate) => candidate.id === id)
    return property === undefined ? [] : [property]
  })
  const prefix = `${documentId}:profile-form`
  const fieldMarkup = fields.map((property) => createFieldMarkup(prefix, property)).join('')
  const resolvedValues = resolveProfileValues(properties, initialValues)
  const persos = fields.flatMap((property) => createFieldPersos(prefix, property, resolvedValues[property.id]))
  const story: StoryDoc<string> = {
    id: 'main',
    initial: { move: '@root' },
    state: {
      values: resolvedValues,
      [ELCE_PROFILE_FORM_RUNTIME_KEY]: { prefix, properties: fields, fieldPropertyIds },
    } satisfies ProfileFormState,
    straps: {
      [`${prefix}:change`]: changeProfileValueStrap,
      [`${prefix}:submit`]: submitProfileStrap,
    },
    listen: [
      { on: ELCE_EVENTS.PROFILE_ERROR },
      { on: `${prefix}:field:change`, straps: [`${prefix}:change`] },
      { on: `${prefix}:submit`, straps: [`${prefix}:submit`] },
    ],
    persos: [
      {
        id: `${documentId}-profile-form-root`,
        type: 'layout',
        initial: {
          move: '@root',
          className: 'elce-profile-form',
          markup: `<main id="${documentId}-profile-form" class="elce-profile-form__page">
            <h1 id="${documentId}-profile-form-title">Profil</h1>
            <p id="${documentId}-profile-form-description">Complétez les champs pour afficher le parcours correspondant.</p>
            <div id="${documentId}-profile-form-fields">${fieldMarkup}</div>
            <div id="${documentId}-profile-form-feedback" role="status" aria-live="polite"><!-- data-part="${prefix}:feedback" --></div>
            <!-- data-part="${prefix}:submit-host" -->
          </main>`,
        },
      },
      ...persos,
      {
        id: `${documentId}-profile-form-submit`,
        type: 'tag',
        initial: {
          tag: 'button',
          content: 'Continuer',
          attr: { type: 'button' },
          className: 'elce-profile-form__submit',
          move: { target: `${prefix}:submit-host` },
        },
        emit: { click: { event: { name: `${prefix}:submit` } } },
      },
      {
        id: `${documentId}-profile-form-feedback`,
        type: 'tag',
        initial: { tag: 'p', content: '', attr: { hidden: true }, move: { target: `${prefix}:feedback` } },
        actions: { [ELCE_EVENTS.PROFILE_ERROR]: {} },
      },
    ],
  }
  return { id: `${documentId}-profile-form-scene`, stories: { main: story } }
}

/** Emits stable field hosts without placing authored labels in anonymous parents. */
function createFieldMarkup(prefix: string, property: ProfileProperty): string {
  const id = `${prefix}-field-${property.id}`
  return `<fieldset id="${id}" class="elce-profile-form__field">
    <legend id="${id}-label">${escapeHtmlText(property.label)}${property.required ? ' *' : ''}</legend>
    ${property.type === 'choice-one' || property.type === 'choice-many'
      ? property.choices.map((choice) => `<div id="${id}-choice-${choice.id}" class="elce-profile-form__choice"><!-- data-part="${inputPartId(prefix, property, choice)}" --></div>`).join('')
      : `<!-- data-part="${inputPartId(prefix, property)}" -->`}
  </fieldset>`
}

/** Creates the CodPlay inputs that own one field's current selection. */
function createFieldPersos(prefix: string, property: ProfileProperty, initialValue: ProfileValue | undefined): readonly PersoDoc<string>[] {
  if (property.type === 'choice-one' || property.type === 'choice-many') {
    const selected = new Set(typeof initialValue === 'string' ? [initialValue] : Array.isArray(initialValue) ? initialValue : [])
    return property.choices.map((choice) => createChoiceInput(prefix, property, choice, selected.has(choice.id)))
  }
  const part = inputPartId(prefix, property)
  return [{
    id: `${prefix}-input-${property.id}`,
    type: 'input',
    initial: {
      inputType: property.type === 'number' ? 'number' : 'text',
      value: typeof initialValue === 'string' || typeof initialValue === 'number' ? initialValue : '',
      label: property.label,
      required: property.required,
      attr: { 'aria-label': property.label },
      move: { target: part },
    },
    emit: {
      change: {
        event: {
          name: `${prefix}:field:change`,
          data: { propertyId: property.id },
        },
      },
    },
  }]
}

/** Creates a radio or checkbox perso for one stable choice. */
function createChoiceInput(prefix: string, property: ProfileProperty, choice: ProfileChoice, checked: boolean): PersoDoc<string> {
  return {
    id: `${prefix}-input-${property.id}-${choice.id}`,
    type: 'input',
    initial: {
      inputType: property.type === 'choice-one' ? 'radio' : 'checkbox',
      name: `${prefix}-group-${property.id}`,
      value: choice.id,
      label: choice.label,
      checked,
      attr: { 'aria-label': choice.label },
      move: { target: inputPartId(prefix, property, choice) },
    },
    emit: {
      change: {
        event: {
          name: `${prefix}:field:change`,
          data: { propertyId: property.id, choiceId: choice.id },
        },
      },
    },
    actions: {
      [`${prefix}:choice:${property.id}:${choice.id}:selected`]: { checked: true },
      [`${prefix}:choice:${property.id}:${choice.id}:idle`]: { checked: false },
    },
  }
}

/** Resolves the fixed part ID of one simple input or choice input. */
function inputPartId(prefix: string, property: ProfileProperty, choice?: ProfileChoice): string {
  return choice === undefined
    ? `${prefix}:field:${property.id}`
    : `${prefix}:field:${property.id}:choice:${choice.id}`
}

/** Escapes property text before writing it into authored scene markup. */
function escapeHtmlText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}
