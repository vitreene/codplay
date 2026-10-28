import type { StrapExecutionInput, StrapEvent, StrapRuntimeOutput } from 'codplay/runtime/player'
import { ELCE_EVENTS } from '../../mods/learning/reading/learning-reading-events'
import type { ProfileProperty, ProfileValue } from '../../mods/learning/profile/domain/learning-profile-types'
import { learningProfileService } from '../../mods/learning/profile/domain/learning-profile-service'

export const ELCE_PROFILE_FORM_RUNTIME_KEY = 'elceProfileFormRuntime'

export type ProfileFormRuntimeConfiguration = Readonly<{
  prefix: string
  properties: readonly ProfileProperty[]
  fieldPropertyIds: readonly string[]
}>

/** Applies one field change using only its CodPlay event and story state. */
export function changeProfileValueStrap(input: StrapExecutionInput): StrapRuntimeOutput | undefined {
  const configuration = readProfileFormConfiguration(input.state)
  return configuration === undefined
    ? undefined
    : changeProfileValue(configuration.prefix, configuration.properties, input.state, input.event.data)
}

/** Validates and publishes one profile submission from the current story state. */
export function submitProfileStrap(input: StrapExecutionInput): StrapRuntimeOutput | undefined {
  const configuration = readProfileFormConfiguration(input.state)
  if (configuration === undefined) return undefined
  return submitProfile(configuration.properties, configuration.fieldPropertyIds, input.state)
}

/** Reads the compact profile form parameters passed in the current story state. */
function readProfileFormConfiguration(
  state: Readonly<Record<string, unknown>>,
): ProfileFormRuntimeConfiguration | undefined {
  const value = state[ELCE_PROFILE_FORM_RUNTIME_KEY]
  if (!isRecord(value)
    || typeof value.prefix !== 'string'
    || !Array.isArray(value.properties)
    || !Array.isArray(value.fieldPropertyIds)
    || value.fieldPropertyIds.some((id) => typeof id !== 'string')) {
    return undefined
  }
  return value as ProfileFormRuntimeConfiguration
}

/** Updates reader values and reflects choice selection in the authored inputs. */
function changeProfileValue(
  prefix: string,
  properties: readonly ProfileProperty[],
  state: Readonly<Record<string, unknown>>,
  data: Readonly<Record<string, unknown>> | undefined,
): StrapRuntimeOutput | undefined {
  if (typeof data?.propertyId !== 'string') return undefined
  const property = properties.find((candidate) => candidate.id === data.propertyId)
  if (property === undefined) return undefined
  const values = readValues(state.values)
  const nextValues: Record<string, ProfileValue> = { ...values }
  switch (property.type) {
    case 'text':
      if (typeof data.value === 'string') nextValues[property.id] = data.value
      break
    case 'number': {
      const text = typeof data.value === 'string' ? data.value.trim() : ''
      if (text.length === 0) delete nextValues[property.id]
      else {
        const number = Number(text)
        nextValues[property.id] = Number.isFinite(number) ? number : text
      }
      break
    }
    case 'choice-one':
      if (typeof data.choiceId === 'string' && property.choices.some((choice) => choice.id === data.choiceId)) {
        nextValues[property.id] = data.choiceId
      }
      break
    case 'choice-many': {
      if (typeof data.choiceId !== 'string' || !property.choices.some((choice) => choice.id === data.choiceId)) break
      const current = Array.isArray(values[property.id]) ? [...values[property.id] as readonly string[]] : []
      nextValues[property.id] = current.includes(data.choiceId)
        ? current.filter((id) => id !== data.choiceId)
        : [...current, data.choiceId]
      break
    }
  }
  const events: StrapEvent[] = [{ name: ELCE_EVENTS.PROFILE_CHANGED, data: { profileValues: nextValues }, visibility: 'public' }]
  if (property.type === 'choice-one' || property.type === 'choice-many') {
    const selected = new Set(typeof nextValues[property.id] === 'string'
      ? [nextValues[property.id] as string]
      : Array.isArray(nextValues[property.id]) ? nextValues[property.id] as readonly string[] : [])
    events.push(...property.choices.map((choice) => ({
      name: `${prefix}:choice:${property.id}:${choice.id}:${selected.has(choice.id) ? 'selected' : 'idle'}`,
    })))
  }
  return { update: { values: nextValues }, events }
}

/** Validates the form and publishes only a complete profile submission. */
function submitProfile(
  properties: readonly ProfileProperty[],
  fieldPropertyIds: readonly string[],
  state: Readonly<Record<string, unknown>>,
): StrapRuntimeOutput | undefined {
  const values = readValues(state.values)
  const errors = learningProfileService.validateProfileValues(properties, fieldPropertyIds, values)
  if (errors.length > 0) {
    return {
      events: [{
        name: ELCE_EVENTS.PROFILE_ERROR,
        data: { content: errors.join(' ') },
        visibility: 'story',
      }],
    }
  }
  return {
    events: [
      { name: ELCE_EVENTS.PROFILE_ERROR, data: { content: '', attr: { hidden: true } }, visibility: 'story' },
      {
        name: ELCE_EVENTS.PROFILE_SUBMIT,
        data: { profileValues: learningProfileService.resolveProfileValues(properties, values) },
        visibility: 'public',
      },
    ],
  }
}

/** Accepts only serializable values supported by the reader profile. */
function readValues(value: unknown): Readonly<Record<string, ProfileValue>> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, ProfileValue] => {
    const candidate = entry[1]
    return typeof candidate === 'string' || typeof candidate === 'number' && Number.isFinite(candidate)
      || Array.isArray(candidate) && candidate.every((item) => typeof item === 'string')
  }))
}

/** Checks one object received from CodPlay state or event data. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
