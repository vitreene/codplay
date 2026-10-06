import type { PersoDoc } from 'codplay/scene/types'
import { ELCE_EVENTS } from '../config/document-config'

type PageBottomMarkerOptions = Readonly<{
  readonly pageId: string
  readonly markerId: string
  readonly rootId: string
  readonly targetPartId: string
  readonly className?: string
  readonly style?: Readonly<Record<string, string | number>>
}>

/** Builds the public bottom-of-page observer shared by Flux and Diapo. */
export function createPageBottomMarkerPerso(options: PageBottomMarkerOptions): PersoDoc<string> {
  const { pageId, markerId, rootId, targetPartId } = options
  return {
    id: markerId,
    type: 'tag',
    initial: {
      tag: 'span',
      attr: { id: markerId, 'aria-hidden': 'true' },
      ...(options.className === undefined ? {} : { className: options.className }),
      style: options.style ?? { display: 'block', width: '1px', height: '1px', marginTop: 'auto', opacity: 0 },
      move: { target: targetPartId },
    },
    emit: {
      observe: {
        root: rootId,
        initial: 'enter',
        zone: { threshold: 0 },
        enter: [{ name: ELCE_EVENTS.PAGE_FINISHED, data: { pageId }, visibility: 'public' }],
      },
    },
  }
}
