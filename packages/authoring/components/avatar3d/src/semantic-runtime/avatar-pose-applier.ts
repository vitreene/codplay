import type { AvatarEngine } from '@codplay/avatar-engine'
import type { AvatarResolvedPose } from './avatar-pose-types.js'
import type { Avatar3DRuntimeMode } from './avatar3d-runtime-types.js'

/** Applies one resolved avatar pose to AvatarEngine in a single place. */
export class AvatarPoseApplier {
  private readonly engine: AvatarEngine
  private readonly appliedMorphs = new Set<string>()

  /** Creates one applier bound to a loaded AvatarEngine. */
  constructor(engine: AvatarEngine) {
    this.engine = engine
  }

  /** Applies all resolved morph/bone-morph values and releases stale overrides. */
  apply(pose: AvatarResolvedPose, mode: Avatar3DRuntimeMode): void {
    const nextMorphs = new Set(Object.keys(pose.morphs))
    const snapMorphs = pose.snapMorphs ?? new Set<string>()

    for (const name of this.appliedMorphs) {
      if (!nextMorphs.has(name)) {
        if (mode === 'seek') {
          this.engine.morphEngine.snapFixed(name, null)
        } else {
          this.engine.morphEngine.setFixed(name, null)
        }
      }
    }

    for (const [name, value] of Object.entries(pose.morphs)) {
      if (mode === 'seek' || snapMorphs.has(name) || shouldSnapMorph(name)) {
        this.engine.morphEngine.snapFixed(name, value)
      } else {
        this.engine.morphEngine.setFixed(name, value)
      }
    }

    this.appliedMorphs.clear()
    for (const name of nextMorphs) {
      this.appliedMorphs.add(name)
    }
  }

  /** Releases every override previously applied by this applier. */
  clear(): void {
    for (const name of this.appliedMorphs) {
      this.engine.morphEngine.snapFixed(name, null)
    }
    this.appliedMorphs.clear()
  }
}

/** Returns true for frame-exact channels that must not be eased by MorphEngine. */
function shouldSnapMorph(name: string): boolean {
  return name.startsWith('viseme_')
    || name.startsWith('eyeLook')
    || name.startsWith('headRotate')
    || name.startsWith('bodyRotate')
    || name.startsWith('handFist')
    || name === 'eyesClosed'
    || name === 'chestInhale'
}
