import {
  MOVE_OPERATION_MOVE,
  type MoveFlipCaptureBuilder,
} from '../player'
import type { FlipAncestorRegime, HtmlFlipMode } from '../flip'
import { resolveAncestorChain, type SolvedScene } from '../player/pipeline'

/** Host declaration used to classify one logical ancestor for FLIP. */
export type HtmlAncestorRegimeResolver = (input: Readonly<{
  ancestorId: string
  parentId?: string
  ancestorChain: readonly string[]
  previousScene: SolvedScene
  nextScene: SolvedScene
  touchedItemIds: readonly string[]
}>) => FlipAncestorRegime

/** Options for the direct-item FLIP capture builder used by the HTML runner. */
export type HtmlMoveCaptureBuilderOptions = Readonly<{
  hostContextId: string
  getProjectionEpoch: () => number
  /** Declares which ancestor regime the HTML host must resolve historically. */
  resolveAncestorRegime?: HtmlAncestorRegimeResolver
}>

/**
 * Creates the HTML capture builder for direct mounted-item moves.
 *
 * The consumer-owned touched set is retained, the mover keeps its authored mode,
 * and ancestor chains remain geometric context rather than implicit animated
 * entries. A direct overlay-world mover projects independently; stable
 * reflow siblings keep their own overlay handles but the projection graph may
 * compose their local reflow with an active parent trajectory. A delta without
 * an explicit positive duration remains logical-only.
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
    const directMode = candidates[0]!.flipMode ?? 'local'
    if (candidates.some((delta) => (delta.flipMode ?? 'local') !== directMode)) return undefined

    const itemIds = touchedItemIds === undefined
      ? collectTouchedItemIds(previousScene, nextScene, candidates)
      : collectPublishedTouchedItemIds(previousScene, nextScene, candidates, touchedItemIds)
    const startAt = candidates[0]!.transitionStartAt ?? nextScene.timeMs
    const directDeltas = new Map(candidates.map((delta) => [delta.persoKey, delta]))
    const itemAncestorChains = new Map(itemIds.map((itemId) => [
      itemId,
      resolveSharedAncestorChain(previousScene, nextScene, itemId),
    ]))
    const itemModes = new Map(itemIds.map((itemId) => [
      itemId,
      directMode === 'overlay-world' || directDeltas.has(itemId) ? directMode : 'local' as const,
    ]))
    const ancestorChains = collectAncestorChains(previousScene, nextScene, itemIds, itemModes)
    const ancestors = collectAncestors({
      chains: ancestorChains,
      previousScene,
      nextScene,
      touchedItemIds: itemIds,
      resolveRegime: options.resolveAncestorRegime,
    })
    // Ancestors describe the coordinate tree used to resolve local entries;
    // they are not animated by a descendant capture. A container can only gain
    // projection ownership from its own direct move capture.
    const entryIds = [...new Set(itemIds)]
    const fallbackCaptureId = `${options.hostContextId}:move:${startAt}:${entryIds.join(',')}`
    const captureId = resolveStableCaptureId(candidates, fallbackCaptureId)
    const sourceCaptureIds = [...new Set(candidates
      .map((candidate) => candidate.transitionOccurrenceId)
      .filter((captureId): captureId is string => captureId !== undefined))]
    return {
      captureId,
      hostContextId: options.hostContextId,
      projectionEpoch: options.getProjectionEpoch(),
      startAt,
      duration: firstTransition.duration,
      ...(firstTransition.ease === undefined ? {} : { ease: firstTransition.ease }),
      ...(sourceCaptureIds.length > 1 ? { sourceCaptureIds } : {}),
      entries: entryIds.map((itemId) => {
        const mode = itemModes.get(itemId) ?? 'local'
        const overlayTargetByPerso = mode === 'overlay-world'
          ? resolveOverlayTargetByPerso(previousScene, itemId)
          : undefined
        const overlayParentIds = mode === 'overlay-world' && !directDeltas.has(itemId)
          ? itemAncestorChains.get(itemId)
          : undefined
        return {
          itemId,
          ancestorIds: mode === 'overlay-world'
            ? []
            : itemAncestorChains.get(itemId) ?? ancestorChains.get(itemId) ?? [],
          ...resolveEntryOwnership(previousScene, nextScene, itemId, mode === 'overlay-world'),
          ...(overlayTargetByPerso === undefined ? {} : { overlayTargetByPerso }),
          ...(overlayParentIds === undefined || overlayParentIds.length === 0 ? {} : { overlayParentIds }),
          ...(directDeltas.has(itemId) ? {} : { isDirectMover: false }),
          mode,
          ...(directDeltas.get(itemId) === undefined || firstTransition.path === undefined
            ? {}
            : { path: firstTransition.path }),
        }
      }),
      ...(ancestors.length === 0 ? {} : { ancestors }),
    }
  }
}

/** Carries the exact source and destination targets with every measured item. */
function resolveEntryOwnership(
  previousScene: SolvedScene,
  nextScene: SolvedScene,
  itemId: string,
  includeParentOwnership: boolean,
): Readonly<{
  sourceTargetId?: string
  destinationTargetId?: string
  sourceParentId?: string
  destinationParentId?: string
}> {
  const sourceTargetId = previousScene.graph.targetByPerso[itemId]
  const destinationTargetId = nextScene.graph.targetByPerso[itemId]
  const sourceParentId = previousScene.graph.parentByPerso[itemId]
  const destinationParentId = nextScene.graph.parentByPerso[itemId]
  const hasParentChange = sourceParentId !== destinationParentId
  const preserveParentOwnership = includeParentOwnership || hasParentChange
  return {
    ...(sourceTargetId === undefined ? {} : { sourceTargetId }),
    ...(destinationTargetId === undefined ? {} : { destinationTargetId }),
    ...(!preserveParentOwnership || sourceParentId === undefined ? {} : { sourceParentId }),
    ...(!preserveParentOwnership || destinationParentId === undefined ? {} : { destinationParentId }),
  }
}

/** Records the FIRST logical target of every descendant cloned into one overlay. */
function resolveOverlayTargetByPerso(
  scene: SolvedScene,
  overlayPersoKey: string,
): Readonly<Record<string, string>> | undefined {
  const targetByPerso: Record<string, string> = {}
  const pending = [...(scene.graph.childrenByParent[overlayPersoKey] ?? [])]
  const visited = new Set<string>()

  while (pending.length > 0) {
    const persoKey = pending.shift()!
    if (visited.has(persoKey)) continue
    visited.add(persoKey)
    const targetId = scene.graph.targetByPerso[persoKey]
    if (targetId !== undefined) targetByPerso[persoKey] = targetId
    pending.push(...(scene.graph.childrenByParent[persoKey] ?? []))
  }

  return Object.keys(targetByPerso).length === 0 ? undefined : Object.freeze(targetByPerso)
}

/** Reuses the compiled occurrence identity whenever one delta owns the capture. */
function resolveStableCaptureId(
  candidates: readonly Readonly<{ transitionOccurrenceId?: string }>[],
  fallback: string,
): string {
  const ids = [...new Set(candidates
    .map((candidate) => candidate.transitionOccurrenceId)
    .filter((captureId): captureId is string => captureId !== undefined))]
  return ids.length === 1 ? ids[0]! : fallback
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
  itemModes: ReadonlyMap<string, HtmlFlipMode>,
): ReadonlyMap<string, readonly string[]> {
  const chains = new Map<string, readonly string[]>()
  for (const itemId of itemIds) {
    // A world overlay has no local parent coordinate system. Its source and
    // destination chains are deliberately omitted; local siblings still add
    // their own chains to the shared capture.
    if (itemModes.get(itemId) === 'overlay-world') continue
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
    for (const itemId of previousScene.graph.childrenByTarget[targetId] ?? []) {
      if (isMountedInBoth(previousScene, nextScene, itemId)) touched.add(itemId)
    }
    for (const itemId of nextScene.graph.childrenByTarget[targetId] ?? []) {
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

/** Builds one stable root-to-leaf ancestor set shared by all capture entries. */
function collectAncestors(
  input: Readonly<{
    chains: ReadonlyMap<string, readonly string[]>
    previousScene: SolvedScene
    nextScene: SolvedScene
    touchedItemIds: readonly string[]
    resolveRegime?: HtmlAncestorRegimeResolver
  }>,
): readonly Readonly<{ ancestorId: string; parentId?: string; regime: FlipAncestorRegime }>[] {
  const entries = new Map<string, { ancestorId: string; parentId?: string; regime: FlipAncestorRegime; chain: readonly string[] }>()
  for (const [ancestorId, chain] of input.chains) {
    const parentId = chain.at(-1)
    const current = entries.get(ancestorId)
    if (current !== undefined) {
      if (current.parentId !== parentId) throw new Error(`HTML FLIP ancestor has conflicting parents: ${ancestorId}`)
      continue
    }
    const regime = input.resolveRegime?.({
      ancestorId,
      ...(parentId === undefined ? {} : { parentId }),
      ancestorChain: chain,
      previousScene: input.previousScene,
      nextScene: input.nextScene,
      touchedItemIds: input.touchedItemIds,
    }) ?? 'stable'
    entries.set(ancestorId, { ancestorId, ...(parentId === undefined ? {} : { parentId }), regime, chain })
  }

  // The first layout ancestor in a root-to-leaf chain is the reflow cut. Every
  // captured ancestor below that cut must be resolved against the historical
  // host pose as well; otherwise a stable child can reintroduce the old layout
  // frame while its grandparent is being realized.
  for (const entry of entries.values()) {
    const cutIndex = entry.chain.findIndex((ancestorId) => entries.get(ancestorId)?.regime === 'layout')
    if (cutIndex < 0) continue
    for (const descendantId of entry.chain.slice(cutIndex)) {
      const descendant = entries.get(descendantId)
      if (descendant !== undefined) descendant.regime = 'layout'
    }
  }

  return [...entries.values()].map(({ chain: _chain, ...entry }) => entry)
}
