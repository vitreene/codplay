import type { AvatarLayerOutput, AvatarResolvedPose } from './avatar-pose-types.js'

/** Composes avatar layer outputs with later layers overriding earlier ones. */
export class AvatarPoseComposer {
  /** Merges layer outputs in priority order. */
  compose(layers: AvatarLayerOutput[]): AvatarResolvedPose {
    const morphs: Record<string, number> = {}
    const snapMorphs = new Set<string>()

    for (const layer of layers) {
      if (layer.morphs) {
        for (const [name, value] of Object.entries(layer.morphs)) {
          morphs[name] = value
        }
      }
      if (layer.snapMorphs) {
        for (const name of layer.snapMorphs) {
          snapMorphs.add(name)
        }
      }
    }

    return { morphs, snapMorphs }
  }
}
