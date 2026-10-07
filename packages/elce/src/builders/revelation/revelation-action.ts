import {
  DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS as REVELATION_EVENT_DEFINITIONS,
  type AutoCapsuleEventAction as RevelationEventAction,
  type AutoCapsuleEventDefinition as RevelationEventDefinition,
  type AutoCapsuleResolvedEvent as ResolvedRevelationEvent,
} from '@codplay/capsule-automation'
import type { RevelationTransitionRef } from '../../config/document-config-types'

/** Builds a CodPlay action from one configured reveal transition. */
export function createRevelationAction(
  reference: RevelationTransitionRef,
  action: RevelationEventAction,
): Record<string, unknown> {
  const definition = REVELATION_EVENT_DEFINITIONS[reference]
  if (definition === undefined) throw new Error(`Référence de révélation inconnue : ${reference}`)
  return actionFromDefinition(definition, action, definition.durationMs ?? 0)
}

/** Converts a resolved reveal event into its CodPlay style action. */
export function createResolvedRevelationAction(event: ResolvedRevelationEvent): Record<string, unknown> {
  switch (event.definition) {
    case undefined:
    case null:
      return {}
    default:
      return actionFromDefinition(event.definition, event.action, event.durationMs)
  }
}

/** Maps one registry action's property endpoints to CodPlay transition styles. */
function actionFromDefinition(
  definition: RevelationEventDefinition,
  action: RevelationEventAction,
  durationMs: number,
): Record<string, unknown> {
  const properties = definition.style?.[action]
  switch (properties) {
    case undefined:
      return {}
    default:
      return {
        style: Object.fromEntries(Object.entries(properties).map(([property, tween]) => [property, {
          ...(tween.from === undefined ? {} : { from: tween.from }),
          to: tween.to,
          duration: durationMs,
        }])),
      }
  }
}
