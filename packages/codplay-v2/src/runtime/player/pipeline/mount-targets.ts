import type { CompiledScene } from '../../../scene/compiled'
import {
  MOUNT_TARGET_KIND_HOST,
  MOUNT_TARGET_KIND_OUTLET,
  MOUNT_TARGET_KIND_PERSO,
  MOUNT_TARGET_KIND_ROOT,
  type MountTargetKind,
} from '../../config/mount-target'

/** One internally declared target that can receive a mounted perso. */
export type MountTargetDeclaration = Readonly<{
  id: string
  kind: MountTargetKind
  storyId?: string
  ownerId?: string
}>

/** One resolved target with its compiled ownership metadata. */
export type MountTarget = MountTargetDeclaration

/** Registry of opaque, scene-unique mount target IDs. */
export class MountTargetRegistry {
  private readonly targets = new Map<string, MountTarget>()

  /** Creates a registry from compiled perso targets and internal declarations. */
  static fromScene(
    scene: CompiledScene,
    declarations: readonly MountTargetDeclaration[] = [],
  ): MountTargetRegistry {
    const registry = new MountTargetRegistry()
    for (const story of Object.values(scene.scene.stories)) {
      for (const perso of story.persos) {
        registry.register({
          id: perso.id,
          kind: MOUNT_TARGET_KIND_PERSO,
          storyId: story.id,
        })
      }
    }
    for (const declaration of declarations) registry.register(declaration)
    return registry
  }

  /** Registers one target and rejects duplicate IDs within the scene. */
  register(target: MountTargetDeclaration): void {
    if (target.id.length === 0) throw new Error('Mount target ID must not be empty.')
    if (this.targets.has(target.id)) throw new Error(`Mount target ID is duplicated: ${target.id}`)
    this.targets.set(target.id, { ...target })
  }

  /** Returns one opaque target by ID without inferring its kind from the name. */
  resolve(id: string): MountTarget | undefined {
    return this.targets.get(id)
  }

  /** Resolves the internally declared root target for one story. */
  resolveStoryRoot(storyId: string): MountTarget | undefined {
    const roots = [...this.targets.values()].filter(
      (target) => target.kind === MOUNT_TARGET_KIND_ROOT && target.storyId === storyId,
    )
    if (roots.length > 1) throw new Error(`Story root target is duplicated: ${storyId}`)
    return roots[0]
  }

  /** Returns all declarations in registration order for diagnostics and materialization. */
  getAll(): readonly MountTarget[] {
    return [...this.targets.values()]
  }
}

export {
  MOUNT_TARGET_KIND_HOST,
  MOUNT_TARGET_KIND_OUTLET,
  MOUNT_TARGET_KIND_PERSO,
  MOUNT_TARGET_KIND_ROOT,
}
