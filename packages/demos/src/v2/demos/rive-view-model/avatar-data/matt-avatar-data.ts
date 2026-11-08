import type {
  RiveTalkingAvatarCaption,
  RiveTalkingAvatarFrame,
  RiveTalkingAvatarProfile,
} from '@codplay/story/rive-talking-avatar'
import voiceTimeline from './visemes-2.json'

const MOUTH_LEAD_MS = 50
const MOUTH_PROPERTY_NAMES = Array.from({ length: 22 }, (_, index) => `v${100 + index}`)

export const MATT_VOICE = {
  src: '/assets/talking-head/speech.mp3',
  // Round the 14.445714-second recording up to CodPlay's millisecond precision.
  durationMs: 14_446,
}

export const MATT_AVATAR_PROFILE: RiveTalkingAvatarProfile = {
  document: {
    src: '/avatars/my-matt-visemes.riv',
    artboard: 'Matt Visemes',
    width: 600,
    height: 600,
  },
  viewModel: {
    stateMachine: 'Matt_Visemes_SM',
    viewModel: 'VisemesVM',
    instance: 'Instance',
    blendSpeed: 18,
    values: { ...createMattVisemeValues(null), isTalking: false },
  },
}

/** Maps one exported mouth property to the Matt rig's complete mouth pose. */
function createMattVisemeValues(property: string | null, value = 100) {
  return {
    ...Object.fromEntries(MOUTH_PROPERTY_NAMES.map((name) => [name, 0])),
    [property ?? 'v100']: value,
  }
}

/** Adapts the supplied visemes to Rive frames with the reference's 50 ms lead. */
export function createMattAvatarFrames(): readonly RiveTalkingAvatarFrame[] {
  return voiceTimeline.visemes.map((viseme) => ({
    startAt: Math.max(0, Math.round(viseme.start * 1000) - MOUTH_LEAD_MS),
    values: createMattVisemeValues(viseme.property, viseme.value),
  }))
}

/** Adapts the supplied word timings to caption intervals in milliseconds. */
export function createMattAvatarCaptions(): readonly RiveTalkingAvatarCaption[] {
  return voiceTimeline.words.map((word) => ({
    startAt: Math.round(word.start * 1000),
    endAt: Math.round(word.end * 1000),
    text: word.text,
  }))
}
