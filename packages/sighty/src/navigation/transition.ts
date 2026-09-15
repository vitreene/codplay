import type { ActiveSelection } from './types'

/** Describes the logical difference between two active compositions. */
export type CompositionTransition<SceneKey extends string = string, SlotName extends string = string> = Readonly<{
  retained: readonly ActiveSelection<SceneKey, SlotName>[]
  entered: readonly ActiveSelection<SceneKey, SlotName>[]
  exited: readonly ActiveSelection<SceneKey, SlotName>[]
}>

/** Computes a transition plan without touching CodPlay or the DOM. */
export function planCompositionTransition<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  current: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
  desired: ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>>,
): CompositionTransition<SceneKey, SlotName> {
  const retained: ActiveSelection<SceneKey, SlotName>[] = []
  const entered: ActiveSelection<SceneKey, SlotName>[] = []
  const exited: ActiveSelection<SceneKey, SlotName>[] = []

  for (const [slotAddress, currentSelection] of current) {
    const nextSelection = desired.get(slotAddress)
    if (nextSelection !== undefined && sameSelection(currentSelection, nextSelection)) {
      retained.push(nextSelection)
    } else {
      exited.push(currentSelection)
    }
  }

  for (const [slotAddress, nextSelection] of desired) {
    const currentSelection = current.get(slotAddress)
    if (currentSelection === undefined || !sameSelection(currentSelection, nextSelection)) {
      entered.push(nextSelection)
    }
  }

  return { retained, entered, exited }
}

/** Determines whether one selection can retain its physical occurrence. */
function sameSelection<SceneKey extends string, SlotName extends string>(
  left: ActiveSelection<SceneKey, SlotName>,
  right: ActiveSelection<SceneKey, SlotName>,
): boolean {
  return left.entry.path === right.entry.path && left.sceneKey === right.sceneKey
}
