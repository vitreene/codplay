import { MOUNT_PLACEMENT_INVALID, MOUNT_PLACEMENT_OFF, MOUNT_PLACEMENT_PARENT, MOUNT_PLACEMENT_ROOT, MOUNT_PLACEMENT_UNSPECIFIED } from '../../config/mount-placement'
import { MOUNT_TARGET_KIND_OUTLET, MOUNT_TARGET_KIND_PERSO, MountTargetRegistry, type MountTargetDeclaration } from './mount-targets'
import type { ResolvedScene, SolvedPerso, SolvedScene } from './types'
import { buildSolvedGraph } from './presentation-graph'

/** Resolves typed placements before parent-child ordering and transform composition. */
export function solveScene(
  resolved: ResolvedScene,
  options: Readonly<{
    mountTargets?: readonly MountTargetDeclaration[]
    childrenByTarget?: Readonly<Record<string, readonly string[]>>
  }> = {},
): SolvedScene {
  const targets = MountTargetRegistry.fromScene(resolved.scene, options.mountTargets)
  const persos: Record<string, SolvedPerso> = {}
  const persoByTargetId = new Map<string, string>()
  const persoByComponentId = new Map<string, string>()
  for (const perso of Object.values(resolved.persos)) persoByTargetId.set(perso.persoId, perso.key)
  for (const perso of Object.values(resolved.persos)) persoByComponentId.set(perso.key, perso.key)
  for (const perso of Object.values(resolved.persos)) {
    const placement = resolvePlacement(perso, targets, persoByTargetId, persoByComponentId)
    persos[perso.key] = { ...perso, placement }
  }

  validateNoPlacementCycles(persos)
  const effectivePersos = applyEffectiveMountState(persos)
  const graph = buildSolvedGraph(effectivePersos, options.childrenByTarget)

  return {
    scene: resolved.scene,
    timeMs: resolved.timeMs,
    sceneState: resolved.sceneState,
    storyStates: resolved.storyStates,
    persos: effectivePersos,
    graph,
    moveIssues: Object.values(effectivePersos).flatMap((perso) => perso.moveIssues),
  }
}

/** Resolves one authored placement through the internal target registry. */
function resolvePlacement(
  perso: ResolvedScene['persos'][string],
  targets: MountTargetRegistry,
  persoByTargetId: ReadonlyMap<string, string>,
  persoByComponentId: ReadonlyMap<string, string>,
): SolvedPerso['placement'] {
  switch (perso.placement.kind) {
    case MOUNT_PLACEMENT_ROOT: {
      const target = targets.resolveStoryRoot(perso.storyId)
      return {
        kind: MOUNT_PLACEMENT_ROOT,
        mounted: target !== undefined,
        targetId: target?.id,
        target,
        mode: perso.placement.mode,
        flipMode: perso.placement.flipMode,
        source: perso.placement.source,
      }
    }
    case MOUNT_PLACEMENT_OFF:
      return { kind: MOUNT_PLACEMENT_OFF, mounted: false, mode: perso.placement.mode, flipMode: perso.placement.flipMode, source: perso.placement.source }
    case MOUNT_PLACEMENT_PARENT: {
      const target = targets.resolve(perso.placement.targetId)
      return {
        kind: MOUNT_PLACEMENT_PARENT,
        mounted: target !== undefined,
        targetId: perso.placement.targetId,
        target,
        parentKey: target === undefined
          ? undefined
          : target.kind === MOUNT_TARGET_KIND_PERSO
            ? persoByTargetId.get(target.id)
            : target.kind === MOUNT_TARGET_KIND_OUTLET
              ? persoByComponentId.get(target.ownerId ?? '') ?? persoByTargetId.get(target.ownerId ?? '')
              : undefined,
        mode: perso.placement.mode,
        flipMode: perso.placement.flipMode,
        reorder: perso.placement.reorder,
        source: perso.placement.source,
      }
    }
    case MOUNT_PLACEMENT_INVALID:
      return { kind: MOUNT_PLACEMENT_INVALID, mounted: false, source: perso.placement.source }
    case MOUNT_PLACEMENT_UNSPECIFIED:
      return { kind: MOUNT_PLACEMENT_UNSPECIFIED, mounted: false, source: perso.placement.source }
  }
}

/** Propagates detached parent state to descendants without touching compiled data. */
function applyEffectiveMountState(
  persos: Readonly<Record<string, SolvedPerso>>,
): Readonly<Record<string, SolvedPerso>> {
  const mounted = new Map<string, boolean>()

  const isMounted = (key: string, visiting = new Set<string>()): boolean => {
    const cached = mounted.get(key)
    if (cached !== undefined) return cached
    if (visiting.has(key)) throw new Error(`Mount hierarchy cycle detected at: ${key}`)
    visiting.add(key)
    const perso = persos[key]
    const result = perso !== undefined
      && perso.placement.mounted
      && (perso.placement.parentKey === undefined || isMounted(perso.placement.parentKey, visiting))
    visiting.delete(key)
    mounted.set(key, result)
    return result
  }

  return Object.fromEntries(Object.values(persos).map((perso) => [
    perso.key,
    {
      ...perso,
      placement: { ...perso.placement, mounted: isMounted(perso.key) },
    },
  ]))
}

/** Rejects cycles in the mounted perso-to-perso graph before materialization. */
function validateNoPlacementCycles(persos: Readonly<Record<string, SolvedPerso>>): void {
  const visiting = new Set<string>()
  const visited = new Set<string>()

  for (const perso of Object.values(persos)) visit(perso.key)

  function visit(key: string): void {
    if (visited.has(key)) return
    if (visiting.has(key)) throw new Error(`Mount hierarchy cycle detected at: ${key}`)
    visiting.add(key)
    const parentKey = persos[key]?.placement.parentKey
    if (parentKey !== undefined) visit(parentKey)
    visiting.delete(key)
    visited.add(key)
  }
}
