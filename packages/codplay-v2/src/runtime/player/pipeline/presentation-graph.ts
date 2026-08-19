import type { MountTargetKind } from '../../config/mount-target'
import { MOUNT_TARGET_KIND_OUTLET, MOUNT_TARGET_KIND_PERSO } from '../../config/mount-target'
import type { SolvedPerso, SolvedScene } from './types'

/** Immutable parentage and ordering graph produced by one scene solve. */
export type SolvedGraph = Readonly<{
  /** Stable identity of the complete logical structure and its order. */
  revision: string
  /** Logical component parent for every mounted perso, when one exists. */
  parentByPerso: Readonly<Record<string, string | undefined>>
  /** Opaque mount target selected by every mounted perso. */
  targetByPerso: Readonly<Record<string, string | undefined>>
  /** Complete child order, grouped by the exact opaque target ID. */
  childrenByTarget: Readonly<Record<string, readonly string[]>>
  /** Parent-first traversal order, independent of which outlet owns a child. */
  childrenByParent: Readonly<Record<string, readonly string[]>>
  /** Mounted roots in the same deterministic order as the solved perso record. */
  rootPersoKeys: readonly string[]
}>

/** Builds and validates the single graph consumed by structure and motion. */
export function buildSolvedGraph(
  persos: Readonly<Record<string, SolvedPerso>>,
  orderedChildrenByTarget?: Readonly<Record<string, readonly string[]>>,
): SolvedGraph {
  const parentByPerso: Record<string, string | undefined> = {}
  const targetByPerso: Record<string, string | undefined> = {}
  const children = new Map<string, string[]>()
  const childrenByParent = new Map<string, string[]>()
  const roots: string[] = []

  for (const perso of Object.values(persos)) {
    const placement = perso.placement
    if (!placement.mounted) continue
    if (placement.targetId === undefined || placement.target === undefined) {
      throw new Error(`Mounted perso has no resolved target: ${perso.key}`)
    }
    if (placement.target.id !== placement.targetId) {
      throw new Error(`Solved target identity diverges from placement: ${perso.key}`)
    }

    const declaredParentKey = resolveParentFromPerso(perso)
    if (declaredParentKey !== undefined
      && perso.placement.target?.kind === MOUNT_TARGET_KIND_PERSO
      && (persos[declaredParentKey] === undefined || persos[declaredParentKey]?.placement.mounted !== true)) {
      throw new Error(`Mounted perso parent is missing from the solved graph: ${perso.key} -> ${declaredParentKey}`)
    }
    // An outlet can be supplied by a host/module without its owner being part
    // of this scene. Keep the scene mountable while retaining strict perso
    // parent validation above.
    const parentKey = declaredParentKey !== undefined && persos[declaredParentKey]?.placement.mounted === true
      ? declaredParentKey
      : undefined
    parentByPerso[perso.key] = parentKey
    targetByPerso[perso.key] = placement.targetId
    const targetChildren = children.get(placement.targetId) ?? []
    targetChildren.push(perso.key)
    children.set(placement.targetId, targetChildren)
    if (parentKey === undefined) {
      roots.push(perso.key)
    } else {
      const parentChildren = childrenByParent.get(parentKey) ?? []
      parentChildren.push(perso.key)
      childrenByParent.set(parentKey, parentChildren)
    }
  }

  validateGraphAcyclic(parentByPerso)
  const naturalChildrenByTarget = Object.fromEntries([...children.entries()].map(([targetId, keys]) => [
    targetId,
    Object.freeze([...keys]),
  ]))
  const childrenByTarget = resolveOrderedChildrenByTarget(naturalChildrenByTarget, orderedChildrenByTarget)
  const orderedChildrenByParent = Object.fromEntries([...childrenByParent.entries()].map(([parentKey, keys]) => [
    parentKey,
    Object.freeze([...keys]),
  ]))
  const revision = createGraphRevision(parentByPerso, targetByPerso, childrenByTarget, orderedChildrenByParent)
  return Object.freeze({
    revision,
    parentByPerso: Object.freeze(parentByPerso),
    targetByPerso: Object.freeze(targetByPerso),
    childrenByTarget: Object.freeze(childrenByTarget),
    childrenByParent: Object.freeze(orderedChildrenByParent),
    rootPersoKeys: Object.freeze([...roots]),
  })
}

/** Applies one complete structural order without allowing parentage divergence. */
function resolveOrderedChildrenByTarget(
  natural: Readonly<Record<string, readonly string[]>>,
  ordered: Readonly<Record<string, readonly string[]>> | undefined,
): Readonly<Record<string, readonly string[]>> {
  if (ordered === undefined) return Object.freeze({ ...natural })
  const result: Record<string, readonly string[]> = {}
  for (const [targetId, naturalChildren] of Object.entries(natural)) {
    const requested = ordered[targetId] ?? naturalChildren
    const expected = new Set(naturalChildren)
    const seen = new Set<string>()
    for (const itemId of requested) {
      if (!expected.has(itemId)) throw new Error(`Structural order places ${itemId} outside target: ${targetId}`)
      if (seen.has(itemId)) throw new Error(`Structural order duplicates item: ${itemId}`)
      seen.add(itemId)
    }
    if (seen.size !== expected.size) throw new Error(`Structural order is incomplete for target: ${targetId}`)
    result[targetId] = Object.freeze([...requested])
  }
  for (const targetId of Object.keys(ordered)) {
    if (!Object.prototype.hasOwnProperty.call(natural, targetId) && (ordered[targetId]?.length ?? 0) > 0) {
      throw new Error(`Structural order references an empty target: ${targetId}`)
    }
  }
  return Object.freeze(result)
}

/** Returns one logical component parent from the canonical solved graph. */
export function resolveLogicalParentKey(scene: SolvedScene, persoKey: string): string | undefined {
  return scene.graph.parentByPerso[persoKey]
}

/** Resolves a strict root-to-parent chain for one mounted perso. */
export function resolveAncestorChain(scene: SolvedScene, persoKey: string): readonly string[] {
  const chain: string[] = []
  const visited = new Set<string>()
  let current = scene.graph.parentByPerso[persoKey]
  while (current !== undefined) {
    if (visited.has(current)) throw new Error(`Solved graph ancestor cycle detected: ${current}`)
    visited.add(current)
    if (scene.persos[current]?.placement.mounted !== true) {
      throw new Error(`Solved graph ancestor is not mounted: ${current}`)
    }
    chain.push(current)
    current = scene.graph.parentByPerso[current]
  }
  return chain.reverse()
}

/** Traverses mounted nodes parent-first through the canonical target order. */
export function traverseSolvedGraph(scene: SolvedScene): readonly string[] {
  const result: string[] = []
  const visited = new Set<string>()
  const visit = (persoKey: string): void => {
    if (visited.has(persoKey)) return
    visited.add(persoKey)
    result.push(persoKey)
    for (const childKey of scene.graph.childrenByParent[persoKey] ?? []) visit(childKey)
  }
  for (const rootKey of scene.graph.rootPersoKeys) visit(rootKey)
  for (const perso of Object.values(scene.persos)) {
    if (perso.placement.mounted) visit(perso.key)
  }
  return result
}

/** Resolves a module order override into a complete validated target order. */
export function resolvePresentationOrder(
  scene: SolvedScene,
  override?: Readonly<Record<string, readonly string[]>>,
): Readonly<Record<string, readonly string[]>> {
  const result: Record<string, readonly string[]> = { ...scene.graph.childrenByTarget }
  if (override === undefined) return result

  for (const [targetId, childKeys] of Object.entries(override)) {
    const seen = new Set<string>()
    for (const childKey of childKeys) {
      if (seen.has(childKey)) throw new Error(`Presentation order contains a duplicate child: ${childKey}`)
      seen.add(childKey)
      const child = scene.persos[childKey]
      if (child === undefined || child.placement.mounted !== true) {
        throw new Error(`Presentation order references an unmounted child: ${childKey}`)
      }
      if (scene.graph.targetByPerso[childKey] !== targetId) {
        throw new Error(`Presentation order places ${childKey} outside its solved target: ${targetId}`)
      }
    }

    const solvedChildren = scene.graph.childrenByTarget[targetId] ?? []
    if (solvedChildren.length !== childKeys.length || solvedChildren.some((key) => !seen.has(key))) {
      throw new Error(`Presentation order is incomplete for target: ${targetId}`)
    }
    result[targetId] = Object.freeze([...childKeys])
  }
  return Object.freeze(result)
}

/** Resolves the logical parent encoded by one solved mount target. */
function resolveParentFromPerso(perso: SolvedPerso): string | undefined {
  if (perso.placement.target?.kind === MOUNT_TARGET_KIND_PERSO) return perso.placement.parentKey
  if (perso.placement.target?.kind === MOUNT_TARGET_KIND_OUTLET) return perso.placement.target.ownerId
  return undefined
}

/** Rejects cycles in the complete parent map before any host projection runs. */
function validateGraphAcyclic(parentByPerso: Readonly<Record<string, string | undefined>>): void {
  const visited = new Set<string>()
  for (const key of Object.keys(parentByPerso)) {
    const path = new Set<string>()
    let current: string | undefined = key
    while (current !== undefined) {
      if (path.has(current)) throw new Error(`Solved graph parent cycle detected: ${current}`)
      if (visited.has(current)) break
      path.add(current)
      current = parentByPerso[current]
    }
    for (const node of path) visited.add(node)
  }
}

/** Creates a deterministic revision from parentage, target ownership and order. */
function createGraphRevision(
  parentByPerso: Readonly<Record<string, string | undefined>>,
  targetByPerso: Readonly<Record<string, string | undefined>>,
  childrenByTarget: Readonly<Record<string, readonly string[]>>,
  childrenByParent: Readonly<Record<string, readonly string[]>>,
): string {
  return JSON.stringify({
    parentByPerso: Object.entries(parentByPerso),
    targetByPerso: Object.entries(targetByPerso),
    childrenByTarget: Object.entries(childrenByTarget),
    childrenByParent: Object.entries(childrenByParent),
  })
}

/** Narrows target kinds without leaking target-registry implementation details. */
export type SolvedGraphTargetKind = MountTargetKind
