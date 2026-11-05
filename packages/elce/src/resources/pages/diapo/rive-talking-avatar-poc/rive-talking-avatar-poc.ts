import type { StoryDoc } from 'codplay/scene/types'
import {
  createRiveTalkingAvatarStory,
  type RiveTalkingAvatarFrame,
  type RiveTalkingAvatarProfile,
} from '@codplay/story/rive-talking-avatar'
import type { CarouselContent } from '../../../bdcs/carousel/domain/carousel-types'
import { CAROUSEL_PLAYBACK_MODE } from '../../../bdcs/carousel/carousel-config'
import { PAGE_FINISHED_EVENT } from '../../page-completion/page-completion-events'

export type TemporaryRiveTalkingAvatarPocOptions = Readonly<{
  autoStart?: boolean
  profile: RiveTalkingAvatarProfile
  voice: Readonly<{ src: string; durationMs: number }>
  frames: readonly RiveTalkingAvatarFrame[]
  words: readonly Readonly<{ text: string; startAtMs: number; endAtMs: number }>[]
  cardCues: readonly Readonly<{ bdcId: string; wordIndex?: number }>[]
}>

/** Resolves a transcript occurrence for every Carousel view and spans the voice duration. */
export function createTemporaryRiveTalkingAvatarPocCarouselContent(
  content: CarouselContent,
  options: TemporaryRiveTalkingAvatarPocOptions,
): CarouselContent {
  if (!Number.isFinite(options.voice.durationMs) || options.voice.durationMs <= 0) {
    throw new Error('La durée de la voix doit être positive et finie.')
  }
  if (options.cardCues.length !== content.cards.length) {
    throw new Error('La configuration Avatar/Carousel doit associer chaque carte à une occurrence.')
  }

  const startsAt = options.cardCues.map((cue, index) => {
    if (content.cards[index]?.bdcId !== cue.bdcId) {
      throw new Error(`L’occurrence transcript de la carte ${cue.bdcId} ne respecte pas l’ordre du Carousel.`)
    }
    if (cue.wordIndex === undefined) {
      if (index !== 0) throw new Error(`La carte ${cue.bdcId} doit désigner un mot du transcript.`)
      return 0
    }

    const word = options.words[cue.wordIndex]
    if (word === undefined) throw new Error(`Le mot transcript ${cue.wordIndex} de la carte ${cue.bdcId} est absent.`)
    if (!Number.isInteger(word.startAtMs) || word.startAtMs < 0 || word.startAtMs >= options.voice.durationMs) {
      throw new Error(`Le temps du mot transcript ${cue.wordIndex} n’est pas dans la durée de la voix.`)
    }
    return word.startAtMs
  })

  if (startsAt[0] !== 0 || startsAt.some((startAt, index) => index > 0 && startAt <= (startsAt[index - 1] ?? -1))) {
    throw new Error('Les cartes du Carousel doivent commencer à zéro et suivre des occurrences croissantes.')
  }
  if (options.voice.durationMs <= (startsAt.at(-1) ?? 0)) {
    throw new Error('La dernière carte doit apparaître avant la fin de la voix.')
  }

  return {
    ...content,
    playbackMode: CAROUSEL_PLAYBACK_MODE.AUTOMATIC,
    repeatCount: 0,
    defaultViewDurationMs: options.voice.durationMs,
    cards: content.cards.map((entry, index) => ({
      ...entry,
      durationMs: (startsAt[index + 1] ?? options.voice.durationMs) - (startsAt[index] ?? 0),
    })),
  }
}

/** Adds the avatar and voice to a Diapo Carousel story without changing its identity or state. */
export function appendTemporaryRiveTalkingAvatarPocToDiapoStory(
  story: StoryDoc<string>,
  pageId: string,
  carouselRootId: string,
  options: TemporaryRiveTalkingAvatarPocOptions,
): StoryDoc<string> {
  const avatarStory = createRiveTalkingAvatarStory({
    id: `rive-talking-avatar-${pageId}`,
    profile: options.profile,
    voice: options.voice,
    frames: options.frames,
    frame: {
      move: { target: carouselRootId },
      style: {
        position: 'absolute',
        top: '2cqw',
        right: '2cqw',
        width: 'clamp(9rem, 32cqw, 18rem)',
        aspectRatio: '420 / 500',
        overflow: 'hidden',
        zIndex: 3,
        pointerEvents: 'none',
      },
    },
  })

  return {
    ...story,
    persos: [...(story.persos ?? []), ...(avatarStory.persos ?? [])],
    listen: [
      ...(story.listen ?? []),
      {
        on: 'sequence:end',
        emit: [{ name: PAGE_FINISHED_EVENT, visibility: 'public', data: { pageId } }],
      },
    ],
    eventimes: [
      ...(story.eventimes ?? []),
      ...(avatarStory.eventimes ?? []),
      {
        name: 'sequence:end',
        startAt: options.voice.durationMs,
      },
    ],
  }
}
