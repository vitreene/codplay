import { addActionReferences, addConditionReference } from './helpers'
import type { SightyRuntimeState } from './state'

/** Validates every declarative action reference against the integration catalog. */
export function validateActionCatalog<SceneKey extends string, SlotName extends string>(
  state: SightyRuntimeState<SceneKey, SlotName>,
): void {
  const references = new Set<string>()
  for (const entry of state.viewIndex.entries) addActionReferences(entry.view.actions, references)
  for (const graph of state.viewIndex.graphs.values()) addActionReferences(graph.scope.actions, references)
  for (const reference of references) {
    if (state.actionCatalog[reference] === undefined) {
      throw new Error(`L'action Sighty « ${reference} » n'est pas enregistrée dans le catalogue.`)
    }
  }
}

/** Validates every declarative condition reference against the integration catalog. */
export function validateConditionCatalog<SceneKey extends string, SlotName extends string>(
  state: SightyRuntimeState<SceneKey, SlotName>,
): void {
  const references = new Set<string>()
  for (const entry of state.viewIndex.entries) {
    addConditionReference(entry.view.accessBy, references)
    addConditionReference(entry.view.exitBy, references)
  }
  for (const graph of state.viewIndex.graphs.values()) {
    addConditionReference(graph.scope.accessBy, references)
    addConditionReference(graph.scope.exitBy, references)
  }
  for (const reference of references) {
    if (state.conditionCatalog[reference] === undefined) {
      throw new Error(`La condition Sighty « ${reference} » n'est pas enregistrée dans le catalogue.`)
    }
  }
}
