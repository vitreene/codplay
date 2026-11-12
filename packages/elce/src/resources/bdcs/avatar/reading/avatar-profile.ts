import type { RiveTalkingAvatarProfile } from '@codplay/story/rive-talking-avatar'

/** Describes the supplied transparent rig; its native bindings stay out of the transcript. */
export const mattAvatarProfile: RiveTalkingAvatarProfile = {
  document: { src: '/assets/elce/assets/avatars/my-matt-visemes.riv', artboard: 'Matt Visemes', width: 420, height: 500 },
  viewModel: {
    stateMachine: 'Matt_Visemes_SM', viewModel: 'VisemesVM', instance: 'Instance', blendSpeed: 18,
    values: { ...Object.fromEntries(Array.from({ length: 22 }, (_, index) => [`v${100 + index}`, index === 0 ? 100 : 0])), isTalking: false },
  },
}
