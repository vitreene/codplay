import type { ResourceBdc } from '../../../document/resource-document-types'

/** Removes word references while retaining each view's authored duration. */
export function clearAvatarWordAssociations<T extends ResourceBdc>(bdcs: readonly T[], avatarBdcId: string): readonly T[] {
  return bdcs.map((bdc) => bdc.carousel == null ? bdc : {
    ...bdc,
    carousel: {
      ...bdc.carousel,
      cards: bdc.carousel.cards.map((entry) => {
        if (entry.cue?.word.avatarBdcId !== avatarBdcId) return entry
        const { cue: _cue, ...unassociated } = entry
        return unassociated
      }),
    },
  })
}
