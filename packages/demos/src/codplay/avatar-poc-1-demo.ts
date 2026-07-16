import { createAvatar3DBinding } from '@codplay/avatar3d'
import { createAvatarPocScene } from '../scenes/avatar-poc-scene'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

export function runAvatarPoc1Demo(): Promise<void> {
  return runCodPlaySceneDemo({
    title: 'Avatar 3D',
    subtitle:
      'Avatar 3D piloté par CodPlay — visèmes continus, gestes, gaze, idle et motions sémantiques intégrées.',
    scene: createAvatarPocScene(),
    activeDemo: 'avatar-poc-1',
    bindings: [createAvatar3DBinding()],
    // Declares the GLB for the automatic preload pipeline (studio.load() →
    // preload module → dispatched to the 'avatar3d-glb' strategy registered
    // by the binding above) — the builder has no way to derive this from the
    // scene itself since avatar3d personas don't carry a generic media URL.
    extraResources: [
      { url: '/avatars/avatarsdk.glb', type: 'avatar3d-glb', policy: { cache: 'default' } },
    ],
  })
}
