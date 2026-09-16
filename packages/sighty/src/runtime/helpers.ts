import type { CodPlayInstanceHostTarget } from 'codplay'
import type {
  ActiveComposition,
  ActiveSelection,
  IndexedSlot,
  ViewIndex,
} from '../navigation/types'
import type { SightyCondition, SightyViewAction } from '../types'
import type { SightyRuntimeWarning } from './types'

type RuntimeWarningSink = Readonly<{
  onPreloadWarning?: (warning: SightyRuntimeWarning) => void
}>

/** Reports one non-fatal runtime problem through the configured warning channel. */
export function reportWarning(
  state: RuntimeWarningSink,
  code: string,
  error: unknown,
): void {
  state.onPreloadWarning?.({
    code,
    message: error instanceof Error ? error.message : String(error),
  })
}

/** Joins diagnostic messages into one readable error detail. */
export function diagnosticDetails(diagnostics: readonly { message: string }[]): string {
  return diagnostics.map((diagnostic) => diagnostic.message).join(' ')
}

/** Adds all action references from one optional scope to a set. */
export function addActionReferences(
  actions: Readonly<Record<string, SightyViewAction>> | undefined,
  references: Set<string>,
): void {
  for (const action of Object.values(actions ?? {})) {
    if (action.action !== undefined) references.add(action.action)
  }
}

/** Adds one catalogued condition reference when a declaration uses a string. */
export function addConditionReference<SceneKey extends string>(
  condition: SightyCondition<SceneKey> | undefined,
  references: Set<string>,
): void {
  if (typeof condition === 'string') references.add(condition)
}

/** Returns all view and graph scope paths active in one logical composition. */
export function activeScopePaths<SceneKey extends string, SlotName extends string>(
  composition: ActiveComposition<SceneKey, SlotName> | ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
  layoutPath?: string,
): ReadonlySet<string> {
  const selections = 'selections' in composition
    ? composition.selections.values()
    : composition.values()
  const paths = new Set<string>()
  if (layoutPath !== undefined) paths.add(layoutPath)
  for (const selection of selections) {
    paths.add(selection.entry.path)
    for (const parent of selection.entry.parentViews) paths.add(parent.path)
    for (const graph of selection.entry.graphScopes) paths.add(graph.path)
  }
  return paths
}

/** Collects scene keys in the first-seen order of the immutable index. */
export function collectSceneKeys<SceneKey extends string, SlotName extends string>(
  index: ViewIndex<SceneKey, SlotName>,
): readonly SceneKey[] {
  const sceneKeys: SceneKey[] = []
  for (const entry of index.entries) {
    const sceneKey = entry.view.view.scene
    if (sceneKey !== undefined && !sceneKeys.includes(sceneKey)) sceneKeys.push(sceneKey)
  }
  return sceneKeys
}

/** Returns each distinct slot name in authored declaration order. */
export function uniqueSlotNames<SceneKey extends string, SlotName extends string>(
  slots: readonly IndexedSlot<SceneKey, SlotName>[],
): readonly SlotName[] {
  const names: SlotName[] = []
  for (const slot of slots) if (!names.includes(slot.slotName)) names.push(slot.slotName)
  return names
}

/** Derives the stable physical occurrence key for one logical slot selection. */
export function occurrenceKeyForSelection<SceneKey extends string, SlotName extends string>(
  selection: ActiveSelection<SceneKey, SlotName>,
): string {
  return JSON.stringify([selection.slotAddress, selection.sceneKey])
}

/** Compares two physical CodPlay host targets without exposing their identity. */
export function sameMountHost(
  left: CodPlayInstanceHostTarget,
  right: CodPlayInstanceHostTarget,
): boolean {
  return left.instanceId === right.instanceId
    && left.storyId === right.storyId
    && left.persoId === right.persoId
}
