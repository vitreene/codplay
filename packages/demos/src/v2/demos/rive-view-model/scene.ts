import { createRiveTalkingAvatarStory } from '@codplay/story/rive-talking-avatar'
import type { SceneDoc } from 'codplay'

import {
  createMattAvatarCaptions,
  createMattAvatarFrames,
  MATT_AVATAR_PROFILE,
  MATT_VOICE,
} from './avatar-data/matt-avatar-data'

/** Exercises the reusable avatar story with the supplied Matt rig and voice. */
export function createScene(): SceneDoc<string> {
const avatarStory = createRiveTalkingAvatarStory({
    id: 'rive-matt',
    profile: MATT_AVATAR_PROFILE,
    voice: MATT_VOICE,
    frames: createMattAvatarFrames(),
    captions: { cues: createMattAvatarCaptions() },
    frame: {
      style: {
        width: 'min(100cqw, 100cqh, 37.5rem)',
        overflow: 'hidden',
        background: '#1a1a2e',
      },
    },
  })

  return {
    id: 'rive-matt-visemes',
    stories: { [avatarStory.id]: avatarStory },
    eventimes: [
      { name: 'scene:start', startAt: 0 },
      { name: 'sequence:end', startAt: MATT_VOICE.durationMs },
    ],
  }
}
