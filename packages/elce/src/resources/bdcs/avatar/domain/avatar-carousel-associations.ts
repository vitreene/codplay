import type { ResourceBdc } from '../../../document/resource-document-types'
import type { CarouselContent } from '../../carousel/domain/carousel-types'

/** Resolves each view's start from its cue or the existing duration settings. */
export function resolveCarouselCueStarts(content: CarouselContent): readonly number[] {
  return content.cards.reduce<number[]>((starts, entry, index) => [
    ...starts,
    entry.cue?.startAtMs ?? (index === 0 ? 0 : starts[index - 1]! + (content.cards[index - 1]!.durationMs ?? content.defaultViewDurationMs)),
  ], [])
}

/** Removes word references while retaining the independently stored trigger times. */
export function clearAvatarWordAssociations<T extends ResourceBdc>(bdcs: readonly T[], avatarBdcId: string): readonly T[] {
  return bdcs.map((bdc) => bdc.carousel == null ? bdc : {
    ...bdc,
    carousel: {
      ...bdc.carousel,
      cards: bdc.carousel.cards.map((entry) => entry.cue?.word?.avatarBdcId !== avatarBdcId
        ? entry : { ...entry, cue: { startAtMs: entry.cue.startAtMs } }),
    },
  })
}

/** Resolves authored trigger times through the existing Carousel duration circuit. */
export function projectCarouselCues(content: CarouselContent, voiceDurationMs?: number): CarouselContent {
  if (!content.cards.some((entry) => entry.cue !== undefined)) return content
  const starts = resolveCarouselCueStarts(content)
  if (starts[0] !== 0 || starts.some((time, index) => !Number.isInteger(time) || time < 0
    || (index > 0 && time <= starts[index - 1]!))) throw new Error('Les temps des cartes doivent commencer à zéro et être croissants.')
  if (voiceDurationMs !== undefined && starts.at(-1)! >= voiceDurationMs) throw new Error('Une carte commence après la fin du son. Ajustez ses repères.')
  return {
    ...content,
    playbackMode: 'automatic',
    repeatCount: 0,
    cards: content.cards.map((entry, index) => ({
      ...entry,
      durationMs: index < starts.length - 1 ? starts[index + 1]! - starts[index]!
        : voiceDurationMs === undefined ? entry.durationMs : voiceDurationMs - starts[index]!,
    })),
  }
}
