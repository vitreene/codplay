import { createAvatar3DBinding } from '@codplay/avatar3d'
import { createAvatarMoodTransitionScene } from '../scenes/avatar-mood-transition-scene'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

/** Runs the minimal avatar3d mood transition isolation demo. */
export function runAvatarMoodTransitionDemo(): Promise<void> {
  return runCodPlaySceneDemo({
    title: 'Avatar Mood Transition',
    subtitle: 'Isolation demo: no audio, no visèmes, no gestures, no idle layers. Mood sleep transition, then direct jawOpen control.',
    scene: createAvatarMoodTransitionScene(),
    activeDemo: 'avatar-mood-transition',
    bindings: [createAvatar3DBinding()],
    extraResources: [
      { url: '/avatars/avatarsdk.glb', type: 'avatar3d-glb', policy: { cache: 'default' } },
    ],
  })
}
