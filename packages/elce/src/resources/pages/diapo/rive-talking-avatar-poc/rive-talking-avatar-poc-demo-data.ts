import type { RiveTalkingAvatarProfile } from '@codplay/story/rive-talking-avatar'
import voiceTimeline from '../../../../assets/assets/talking-head/visemes-2.json'
import type { TemporaryRiveTalkingAvatarPocOptions } from './rive-talking-avatar-poc'

export const TEMPORARY_RIVE_TALKING_AVATAR_POC_DOCUMENT_ID = 'elce-document-2b78033e-180d-45c0-bb90-d0aa414b464d'
export const TEMPORARY_RIVE_TALKING_AVATAR_POC_PAGE_NAME = 'Tête parlante — Interstellar'

const voiceDurationMs = 14_446
const mouthLeadMs = 50
const mouthPropertyNames = Array.from({ length: 22 }, (_, index) => `v${100 + index}`)

const mattAvatarProfile: RiveTalkingAvatarProfile = {
  document: {
    src: '/assets/elce/assets/avatars/my-matt-visemes.riv',
    artboard: 'Matt Visemes',
    width: 420,
    height: 500,
  },
  viewModel: {
    stateMachine: 'Matt_Visemes_SM',
    viewModel: 'VisemesVM',
    instance: 'Instance',
    blendSpeed: 18,
    values: { ...createMattVisemeValues(null), isTalking: false },
  },
}

/** Adapts the supplied transcript and viseme times for the Elcé POC. */
export function createTemporaryRiveTalkingAvatarPocDemoData(
  cardBdcIds: readonly string[],
): TemporaryRiveTalkingAvatarPocOptions {
  if (cardBdcIds.length !== 4) throw new Error('La démo Avatar/Carousel attend quatre cartes.')

  return {
    autoStart: false,
    profile: mattAvatarProfile,
    voice: { src: '/assets/elce/assets/assets/talking-head/speech.mp3', durationMs: voiceDurationMs },
    frames: voiceTimeline.visemes.map(({ property, value, start }) => ({
      startAt: Math.max(0, Math.round(start * 1000) - mouthLeadMs),
      values: createMattVisemeValues(property, value),
    })),
    words: voiceTimeline.words.map(({ text, start, end }) => ({
      text,
      startAtMs: Math.round(start * 1000),
      endAtMs: Math.round(end * 1000),
    })),
    cardCues: [
      { bdcId: cardBdcIds[0] },
      { bdcId: cardBdcIds[1]!, wordIndex: 13 },
      { bdcId: cardBdcIds[2]!, wordIndex: 27 },
      { bdcId: cardBdcIds[3]!, wordIndex: 40 },
    ],
  }
}

/** Builds a complete single-property viseme patch for the Matt ViewModel. */
function createMattVisemeValues(property: string | null, value = 100) {
  return {
    ...Object.fromEntries(mouthPropertyNames.map((name) => [name, 0])),
    [property ?? 'v100']: value,
  }
}

