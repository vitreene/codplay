import { addActionReferences, addConditionReference } from './helpers'
import type { SightyRuntimeState } from './state'
import type { SightyActionKey, SightyGuardKey } from '../types'

/** Validates every referenced action against the scenario definitions. */
export function validateScenarioActions<SceneKey extends string, SlotName extends string>(
  state: SightyRuntimeState<SceneKey, SlotName>,
): void {
  const references = new Set<string>()
  for (const entry of state.viewIndex.entries) {
    addActionReferences(entry.view.actions, references)
    if (typeof entry.view.action === 'string') references.add(entry.view.action)
  }
  for (const graph of state.viewIndex.graphs.values()) {
    addActionReferences(graph.scope.actions, references)
    if (typeof graph.scope.action === 'string') references.add(graph.scope.action)
  }
  for (const reference of references) {
    if (state.scenario.actions[reference as SightyActionKey] === undefined) {
      throw new Error(`L'action Sighty « ${reference} » n'est pas définie dans scenario.actions.`)
    }
  }
}

/** Validates every referenced guard against the scenario definitions. */
export function validateScenarioGuards<SceneKey extends string, SlotName extends string>(
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
    if (state.scenario.guards[reference as SightyGuardKey] === undefined) {
      throw new Error(`Le guard Sighty « ${reference} » n'est pas défini dans scenario.guards.`)
    }
  }
}
