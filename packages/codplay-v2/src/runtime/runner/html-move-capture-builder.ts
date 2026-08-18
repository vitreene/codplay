import {
  MOVE_OPERATION_MOVE,
  type MoveFlipCaptureBuilder,
} from '../player'
import { MOUNT_TARGET_KIND_OUTLET, MOUNT_TARGET_KIND_PERSO } from '../config/mount-target'
import type { SolvedScene } from '../player/pipeline'

/** Options for the direct-item FLIP capture builder used by the HTML runner. */
export type HtmlMoveCaptureBuilderOptions = Readonly<{
  hostContextId: string
  getProjectionEpoch: () => number
}>

/**
 * Creates a minimal capture builder for direct mounted-item moves.
 *
 * This tranche captures the logical parent chain as stable ancestors and projects
 * geometry-changing ancestors as local entries so width/height can interpolate.
 * Overlay mode remains outside the local runner tranche and is never converted to
 * local. A delta without an explicit positive duration remains logical-only.
 */
export function createHtmlMoveCaptureBuilder(
  options: HtmlMoveCaptureBuilderOptions,
): MoveFlipCaptureBuilder {
  return ({ previousScene, nextScene, deltas, preparedTransitions, touchedItemIds }) => {
    const candidates = deltas.filter((delta) => {
      const transition = preparedTransitions.get(delta.persoKey)
      return delta.operation === MOVE_OPERATION_MOVE
        && delta.mountedBefore
        && delta.mountedAfter
        && transition?.duration !== undefined
        && transition.duration > 0
    })
    if (candidates.length === 0) return undefined

    const firstTransition = preparedTransitions.get(candidates[0]!.persoKey)
    if (firstTransition?.duration === undefined || firstTransition.duration <= 0) return undefined
    if (candidates.some((delta) => !sameTransition(firstTransition, preparedTransitions.get(delta.persoKey)))) return undefined
    const mode = candidates[0]!.flipMode ?? 'local'
    if (candidates.some((delta) => (delta.flipMode ?? 'local') !== mode)) return undefined
    if (mode !== 'local') return undefined

    const itemIds = touchedItemIds === undefined
      ? collectTouchedItemIds(previousScene, nextScene, candidates)
      : collectPublishedTouchedItemIds(previousScene, nextScene, candidates, touchedItemIds)
    const startAt = candidates[0]!.transitionStartAt ?? nextScene.timeMs
    const directDeltas = new Map(candidates.map((delta) => [delta.persoKey, delta]))
    const itemAncestorChains = new Map(itemIds.map((itemId) => [
      itemId,
      resolveSharedAncestorChain(previousScene, nextScene, itemId),
    ]))
    const ancestorChains = collectAncestorChains(previousScene, nextScene, itemIds)
    const ancestors = collectAncestors(ancestorChains)
    const entryIds = [...new Set([...ancestors.map((ancestor) => ancestor.ancestorId), ...itemIds])]
    return {
      captureId: `${options.hostContextId}:move:${startAt}:${entryIds.join(',')}`,
      hostContextId: options.hostContextId,
      projectionEpoch: options.getProjectionEpoch(),
      startAt,
      duration: firstTransition.duration,
      ...(firstTransition.ease === undefined ? {} : { ease: firstTransition.ease }),
      entries: entryIds.map((itemId) => ({
        itemId,
        ancestorIds: itemAncestorChains.get(itemId) ?? ancestorChains.get(itemId) ?? [],
        mode: 'local' as const,
        ...(directDeltas.get(itemId) === undefined || firstTransition.path === undefined
          ? {}
          : { path: firstTransition.path }),
      })),
      ...(ancestors.length === 0 ? {} : { ancestors }),
    }
  }
}

/** Keeps the list capability's touched set while retaining every direct mover. */
function collectPublishedTouchedItemIds(
  previousScene: SolvedScene,
  nextScene: SolvedScene,
  candidates: readonly Readonly<{ persoKey: string }>[],
  published: readonly string[],
): readonly string[] {
  const touched = new Set(candidates.map((candidate) => candidate.persoKey))
  for (const itemId of published) {
    if (isMountedInBoth(previousScene, nextScene, itemId)) touched.add(itemId)
  }
  return [...touched]
}

/** Collects ancestor chains from both DOM states, preferring the destination chain. */
function collectAncestorChains(
  previousScene: SolvedScene,
  nextScene: SolvedScene,
  itemIds: readonly string[],
): ReadonlyMap<string, readonly string[]> {
  const chains = new Map<string, readonly string[]>()
  for (const itemId of itemIds) {
    const nextChain = resolveAncestorChain(nextScene, itemId)
    const previousChain = resolveAncestorChain(previousScene, itemId)
    for (const ancestorId of nextChain) {
      if (!chains.has(ancestorId)) chains.set(ancestorId, resolveAncestorChain(nextScene, ancestorId))
    }
    for (const ancestorId of previousChain) {
      if (!chains.has(ancestorId)) chains.set(ancestorId, resolveAncestorChain(previousScene, ancestorId))
    }
  }
  return chains
}

/** Collects direct movers and mounted siblings in stable before/after order. */
function collectTouchedItemIds(
  previousScene: SolvedScene,
  nextScene: SolvedScene,
  candidates: readonly Readonly<{ persoKey: string; fromTargetId?: string; toTargetId?: string }>[],
): readonly string[] {
  const touched = new Set(candidates.map((candidate) => candidate.persoKey))
  const targetIds = unique(candidates.flatMap((candidate) => [candidate.fromTargetId, candidate.toTargetId]))
  for (const targetId of targetIds) {
    if (targetId === undefined) continue
    for (const itemId of previousScene.childrenByTarget[targetId] ?? []) {
      if (isMountedInBoth(previousScene, nextScene, itemId)) touched.add(itemId)
    }
    for (const itemId of nextScene.childrenByTarget[targetId] ?? []) {
      if (isMountedInBoth(previousScene, nextScene, itemId)) touched.add(itemId)
    }
  }
  return [...touched]
}

/** Checks that one sibling has a measurable live node in both scene states. */
function isMountedInBoth(previousScene: SolvedScene, nextScene: SolvedScene, itemId: string): boolean {
  return previousScene.persos[itemId]?.placement.mounted === true
    && nextScene.persos[itemId]?.placement.mounted === true
}

/** Deduplicates opaque target IDs without changing their first-seen order. */
function unique(values: readonly (string | undefined)[]): readonly (string | undefined)[] {
  return [...new Set(values)]
}

/** Checks whether two move transitions can share one capture interval. */
function sameTransition(
  first: Readonly<{ duration?: number; ease?: string; path?: unknown }>,
  candidate: Readonly<{ duration?: number; ease?: string; path?: unknown }> | undefined,
): boolean {
  return candidate?.duration === first.duration
    && candidate?.ease === first.ease
    && candidate?.path === first.path
}

/** Resolves one mounted item's component-parent chain from the solved scene. */
function resolveAncestorChain(scene: SolvedScene, persoKey: string): readonly string[] {
  const reversed: string[] = []
  const visited = new Set<string>()
  let current = resolveLogicalParentKey(scene, persoKey)
  while (current !== undefined) {
    if (visited.has(current)) throw new Error(`HTML FLIP ancestor cycle detected: ${current}`)
    visited.add(current)
    const ancestor = scene.persos[current]
    if (ancestor === undefined || !ancestor.placement.mounted) break
    reversed.push(current)
    current = resolveLogicalParentKey(scene, current)
  }
  return reversed.reverse()
}

/** Keeps a local ancestor chain only when FIRST and LAST share the same parents. */
function resolveSharedAncestorChain(
  previousScene: SolvedScene,
  nextScene: SolvedScene,
  persoKey: string,
): readonly string[] {
  const previousChain = resolveAncestorChain(previousScene, persoKey)
  const nextChain = resolveAncestorChain(nextScene, persoKey)
  if (previousChain.length !== nextChain.length) return []
  for (let index = 0; index < previousChain.length; index += 1) {
    if (previousChain[index] !== nextChain[index]) return []
  }
  return nextChain
}

/** Resolves the next logical component parent through a perso or markup outlet target. */
function resolveLogicalParentKey(scene: SolvedScene, persoKey: string): string | undefined {
  const placement = scene.persos[persoKey]?.placement
  const target = placement?.target
  if (target?.kind === MOUNT_TARGET_KIND_PERSO) return placement.parentKey
  if (target?.kind === MOUNT_TARGET_KIND_OUTLET) return target.ownerId
  return undefined
}

/** Builds one stable root-to-leaf ancestor set shared by all capture entries. */
function collectAncestors(
  chains: ReadonlyMap<string, readonly string[]>,
): readonly Readonly<{ ancestorId: string; parentId?: string; regime: 'stable' }>[] {
  const entries = new Map<string, Readonly<{ ancestorId: string; parentId?: string; regime: 'stable' }>>()
  for (const [ancestorId, chain] of chains) {
    const parentId = chain.at(-1)
    const current = entries.get(ancestorId)
    if (current !== undefined) {
      if (current.parentId !== parentId) throw new Error(`HTML FLIP ancestor has conflicting parents: ${ancestorId}`)
      continue
    }
    entries.set(ancestorId, { ancestorId, ...(parentId === undefined ? {} : { parentId }), regime: 'stable' })
  }
  return [...entries.values()]
}
