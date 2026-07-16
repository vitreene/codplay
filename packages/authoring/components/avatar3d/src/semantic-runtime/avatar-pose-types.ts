export type AvatarMorphPose = Record<string, number>

export type AvatarLayerOutput = {
  morphs?: AvatarMorphPose
  snapMorphs?: ReadonlySet<string>
}

export type AvatarResolvedPose = {
  morphs: AvatarMorphPose
  snapMorphs: ReadonlySet<string>
}
