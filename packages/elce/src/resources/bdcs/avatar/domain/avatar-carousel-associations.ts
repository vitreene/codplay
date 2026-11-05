import type { ResourceBdc } from '../../../document/resource-document-types'

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
