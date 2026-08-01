import { MOUNT_PLACEMENT_INVALID, MOUNT_PLACEMENT_OFF, MOUNT_PLACEMENT_PARENT, MOUNT_PLACEMENT_ROOT, MOUNT_PLACEMENT_UNSPECIFIED } from '../../config/mount-placement'
import { MountTargetRegistry, type MountTargetDeclaration } from './mount-targets'
import type { ResolvedScene, SolvedPerso, SolvedScene } from './types'

/** Resolves typed placements before parent-child ordering and transform composition. */
export function solveScene(
  resolved: ResolvedScene,
  options: Readonly<{ mountTargets?: readonly MountTargetDeclaration[] }> = {},
): SolvedScene {
  const targets = MountTargetRegistry.fromScene(resolved.scene, options.mountTargets)
  const persos: Record<string, SolvedPerso> = {}
  for (const perso of Object.values(resolved.persos)) {
    persos[perso.key] = {
      ...perso,
      placement: resolvePlacement(perso, targets),
    }
  }
  return {
    scene: resolved.scene,
    timeMs: resolved.timeMs,
    sceneState: resolved.sceneState,
    storyStates: resolved.storyStates,
    persos,
  }
}

/** Resolves one authored placement through the internal target registry. */
function resolvePlacement(
  perso: ResolvedScene['persos'][string],
  targets: MountTargetRegistry,
): SolvedPerso['placement'] {
  switch (perso.placement.kind) {
    case MOUNT_PLACEMENT_ROOT: {
      const target = targets.resolveStoryRoot(perso.storyId)
      return { kind: MOUNT_PLACEMENT_ROOT, mounted: target !== undefined, target: target }
    }
    case MOUNT_PLACEMENT_OFF:
      return { kind: MOUNT_PLACEMENT_OFF, mounted: false }
    case MOUNT_PLACEMENT_PARENT: {
      const target = targets.resolve(perso.placement.targetId)
      return {
        kind: MOUNT_PLACEMENT_PARENT,
        mounted: target !== undefined,
        targetId: perso.placement.targetId,
        target,
      }
    }
    case MOUNT_PLACEMENT_INVALID:
      return { kind: MOUNT_PLACEMENT_INVALID, mounted: false }
    case MOUNT_PLACEMENT_UNSPECIFIED:
      return { kind: MOUNT_PLACEMENT_UNSPECIFIED, mounted: false }
  }
}
