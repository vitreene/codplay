import type { CodPlayInstanceHostTarget } from 'codplay'
import type {
  ActiveSelection,
  IndexedSlot,
  ViewIndex,
} from '../navigation/types'
import type { SightyCondition, SightyViewAction } from '../types'

/** Reports one non-fatal runtime problem without routing it through preload. */
export function reportWarning(
  code: string,
  error: unknown,
): void {
  const message = error instanceof Error ? error.message : String(error)
  console.warn(`${code}: ${message}`)
}

/** Joins diagnostic messages into one readable error detail. */
export function diagnosticDetails(diagnostics: readonly { message: string }[]): string {
  return diagnostics.map((diagnostic) => diagnostic.message).join(' ')
}

/** Adds all action references from one optional scope to a set. */
export function addActionReferences<SceneKey extends string, SlotName extends string>(
  actions: Readonly<Record<string, SightyViewAction<SceneKey, SlotName>>> | undefined,
  references: Set<string>,
): void {
  for (const action of Object.values(actions ?? {})) {
    if (typeof action.action === 'string') references.add(action.action)
  }
}

/** Adds one named guard reference when a declaration uses a string. */
export function addConditionReference<SceneKey extends string>(
  condition: SightyCondition<SceneKey> | undefined,
  references: Set<string>,
): void {
  if (typeof condition === 'string') references.add(condition)
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
