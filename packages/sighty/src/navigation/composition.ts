import type { SightyRouteTarget } from '../types'
import {
  findContainingSlot,
  getStartEntry,
  isPathPrefix,
} from './graph-index'
import type {
  ActiveSelection,
  IndexedEntry,
  IndexedSlot,
  ViewIndex,
} from './types'

/** Resolves one authored entry to the first scene below it. */
export function resolveSceneEntry<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  index: ViewIndex<SceneKey, SlotName>,
  entry: IndexedEntry<SceneKey, SlotName>,
): IndexedEntry<SceneKey, SlotName> | undefined {
  const visited = new Set<string>()
  let current: IndexedEntry<SceneKey, SlotName> | undefined = entry
  while (current !== undefined) {
    if (current.view.view.scene !== undefined) return current
    if (visited.has(current.path)) return undefined
    visited.add(current.path)
    const nestedPath: string | undefined = nestedGraphPath(current)
    if (nestedPath === undefined) return undefined
    current = getStartEntry(index, nestedPath)
  }
  return undefined
}

/** Creates one logical selection for a slot and an authored entry. */
export function createSelection<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  index: ViewIndex<SceneKey, SlotName>,
  slot: IndexedSlot<SceneKey, SlotName>,
  entry: IndexedEntry<SceneKey, SlotName>,
  generation: number,
): ActiveSelection<SceneKey, SlotName> {
  const sceneEntry = resolveSceneEntry(index, entry)
  if (sceneEntry === undefined || sceneEntry.view.view.scene === undefined) {
    throw new Error(`La vue Sighty « ${entry.path} » ne désigne aucune scène montable.`)
  }
  return {
    slotAddress: slot.address,
    slotName: slot.slotName,
    graphPath: entry.graphPath,
    ownerPath: slot.ownerPath,
    entry,
    sceneEntry,
    sceneKey: sceneEntry.view.view.scene,
    generation,
  }
}

/** Resolves the first active view branch below the configured layout entry. */
export function resolveInitialAnchor<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  index: ViewIndex<SceneKey, SlotName>,
  layoutEntry: IndexedEntry<SceneKey, SlotName>,
): IndexedEntry<SceneKey, SlotName> {
  const visited = new Set<string>()
  let current = layoutEntry
  while (!visited.has(current.path)) {
    visited.add(current.path)
    const nestedPath = nestedGraphPath(current)
    if (nestedPath === undefined) return current
    const nestedStart = getStartEntry(index, nestedPath)
    if (nestedStart === undefined) return current
    current = nestedStart
  }
  return current
}

/** Builds the target composition from the layout branch and one optional target. */
export function buildComposition<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  index: ViewIndex<SceneKey, SlotName>,
  layoutPath: string,
  initialAnchor: IndexedEntry<SceneKey, SlotName>,
  target?: ActiveSelection<SceneKey, SlotName>,
  generations: ReadonlyMap<string, number> = new Map(),
): ReadonlyMap<string, ActiveSelection<SceneKey, SlotName>> {
  const anchorPath = target?.entry.path ?? initialAnchor.path
  const activeViewPaths = new Set(
    index.entries
      .filter((entry) => entry.path === layoutPath || isPathPrefix(entry.path, anchorPath))
      .map((entry) => entry.path),
  )
  const desired = new Map<string, ActiveSelection<SceneKey, SlotName>>()

  for (const slot of index.slots) {
    if (!activeViewPaths.has(slot.ownerPath)) continue
    const entry = entryForSlot(index, slot, target)
    if (entry === undefined) throw new Error(`Le slot Sighty ${slot.slotName} est vide.`)
    const currentGeneration = generations.get(slot.address) ?? 0
    desired.set(
      slot.address,
      target?.slotAddress === slot.address && target.entry.path === entry.path
        ? target
        : createSelection(index, slot, entry, currentGeneration),
    )
  }
  return desired
}

/** Resolves a declared route into a logical target selection. */
export function resolveRouteTarget<
  SceneKey extends string = string,
  SlotName extends string = string,
>(
  index: ViewIndex<SceneKey, SlotName>,
  target: SightyRouteTarget,
  preferredSelection: ActiveSelection<SceneKey, SlotName> | undefined,
  generation: number,
): ActiveSelection<SceneKey, SlotName> | undefined {
  if ('direction' in target) return resolveDirection(index, target.direction, preferredSelection, generation)

  let entry: IndexedEntry<SceneKey, SlotName> | undefined
  if ('path' in target) {
    entry = index.entriesByPath.get(target.path.trim().replace(/^\/+|\/+$/g, ''))
  } else {
    const entries = index.entriesByKey.get(target.label)
    entry = entries?.length === 1 ? entries[0] : undefined
  }
  if (entry === undefined) return undefined
  const slot = findContainingSlot(index, entry.path)
  if (slot === undefined) return undefined
  return createSelection(index, slot, entry, generation)
}

/** Resolves a direction within the selected graph or its nested graph. */
function resolveDirection<
  SceneKey extends string,
  SlotName extends string,
>(
  index: ViewIndex<SceneKey, SlotName>,
  direction: 'next' | 'previous' | 'up' | 'down',
  selection: ActiveSelection<SceneKey, SlotName> | undefined,
  generation: number,
): ActiveSelection<SceneKey, SlotName> | undefined {
  if (selection === undefined) return undefined
  const slot = index.slotsByAddress.get(selection.slotAddress)
  if (slot === undefined) return undefined

  if (direction === 'next' || direction === 'previous') {
    const graph = index.graphs.get(selection.graphPath)
    if (graph === undefined) return undefined
    const currentIndex = graph.entries.findIndex((entry) => entry.path === selection.entry.path)
    if (currentIndex < 0) return undefined
    const offset = direction === 'next' ? 1 : -1
    const target = graph.entries[currentIndex + offset]
    return target === undefined ? undefined : createSelection(index, slot, target, generation)
  }

  if (direction === 'down') {
    const nestedPath = nestedGraphPath(selection.entry)
    const target = nestedPath === undefined ? undefined : getStartEntry(index, nestedPath)
    return target === undefined ? undefined : createSelection(index, slot, target, generation)
  }

  const parent = [...selection.entry.parentViews]
    .reverse()
    .find((candidate) => isPathPrefix(slot.graphPath, candidate.path))
  return parent === undefined ? undefined : createSelection(index, slot, parent, generation)
}

/** Selects the entry from a slot that contains the requested route target. */
function entryForSlot<
  SceneKey extends string,
  SlotName extends string,
>(
  index: ViewIndex<SceneKey, SlotName>,
  slot: IndexedSlot<SceneKey, SlotName>,
  target: ActiveSelection<SceneKey, SlotName> | undefined,
): IndexedEntry<SceneKey, SlotName> | undefined {
  if (target?.slotAddress === slot.address) return target.entry
  if (target !== undefined && isPathPrefix(slot.graphPath, target.entry.path)) {
    const graph = index.graphs.get(slot.graphPath)
    const direct = graph?.entries.find((entry) => isPathPrefix(entry.path, target.entry.path))
    if (direct !== undefined) return direct
  }
  return getStartEntry(index, slot.graphPath)
}

/** Returns the graph path nested below one view, if any. */
function nestedGraphPath<
  SceneKey extends string,
  SlotName extends string,
>(entry: IndexedEntry<SceneKey, SlotName>): string | undefined {
  if (entry.view.view.views !== undefined) return entry.path
  if (entry.view.view.graph !== undefined) return `${entry.path}/graph`
  return undefined
}
