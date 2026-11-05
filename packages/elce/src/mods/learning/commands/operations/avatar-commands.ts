import { AVATAR_BDC_TYPE } from '../../../../resources/bdcs/avatar/avatar-config'
import { assertAvatarContent } from '../../../../resources/bdcs/avatar/domain/avatar-service'
import { clearAvatarWordAssociations, resolveCarouselCueStarts } from '../../../../resources/bdcs/avatar/domain/avatar-carousel-associations'
import type { AvatarCommand } from '../../../../resources/bdcs/avatar/authoring/avatar-command-types'
import { findBdc } from '../../../../core/document/content-placement-service'
import { LearningDocument } from '../../document/learning-document'
import { withBdc } from './command-helpers'

/** Applies Avatar edits and word associations atomically through Learning's command dispatcher. */
export function applyAvatarCommand(document: LearningDocument, command: Exclude<AvatarCommand, { type: 'bdc.create' | 'bdc.avatar.delete' }>): LearningDocument {
  if (command.type === 'bdc.carousel.word.set') {
    const carousel = findBdc(document.bdcs, command.bdcId)
    const avatar = findBdc(document.bdcs, command.avatarBdcId)
    const take = avatar.avatar?.take
    if (carousel.carousel == null || carousel.pageId === null || carousel.pageId !== avatar.pageId
      || take == null || !Number.isInteger(command.wordIndex)) throw new Error('La carte et la prise doivent appartenir à la même Diapo.')
    const word = take.words[command.wordIndex]
    const content = carousel.carousel
    const starts = resolveCarouselCueStarts(content)
    const index = content.cards.findIndex((entry) => entry.bdcId === command.cardBdcId)
    if (word === undefined || index <= 0) throw new Error('Choisissez un mot pour une carte après la première, qui reste à zéro.')
    const cards = content.cards.map((entry, entryIndex) => ({
      ...entry,
      cue: entryIndex === index ? {
        startAtMs: word.startAtMs,
        word: { avatarBdcId: avatar.id, takeId: take.id, wordIndex: command.wordIndex },
      } : entry.cue ?? {
        startAtMs: starts[entryIndex]!,
      },
    }))
    return withBdc(document, { ...carousel, carousel: { ...carousel.carousel, cards } })
  }
  const bdc = findBdc(document.bdcs, command.bdcId)
  if (bdc.type !== AVATAR_BDC_TYPE || bdc.avatar == null) throw new Error('Ce BDC n’est pas un Avatar.')
  const avatar = command.type === 'bdc.avatar.update' ? command.avatar : { ...bdc.avatar, take: command.take }
  assertAvatarContent(avatar)
  const changedTake = avatar.take?.id !== bdc.avatar.take?.id
  const bdcs = changedTake ? clearAvatarWordAssociations(document.bdcs, bdc.id) : document.bdcs
  const updated = new LearningDocument({
    ...document.data,
    bdcs: bdcs.map((candidate) => {
      if (!changedTake || candidate.carousel == null || bdc.pageId === null || candidate.pageId !== bdc.pageId) return candidate
      const starts = resolveCarouselCueStarts(candidate.carousel)
      return { ...candidate, carousel: { ...candidate.carousel, cards: candidate.carousel.cards.map((entry, index) => ({ ...entry, cue: entry.cue ?? { startAtMs: starts[index]! } })) } }
    }),
    medias: command.type === 'bdc.avatar.take.set' && command.media !== undefined
      ? [...document.medias, command.media] : document.medias,
  })
  return withBdc(updated, { ...bdc, avatar })
}
