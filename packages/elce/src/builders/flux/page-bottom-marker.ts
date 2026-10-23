import type { PersoDoc } from 'codplay/scene/types'
import { ELCE_EVENTS } from '../../config/document-config'
import type { ElceResolvedPlayerSettings } from '../../domain/editor-settings/editor-settings-types'

type PageBottomMarkerOptions = Readonly<{
  readonly pageId: string
  readonly markerId: string
  readonly rootId: string
  readonly targetPartId: string
  readonly settings: ElceResolvedPlayerSettings['progression']['pageCompletionObservation']
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
      style: options.style ?? options.settings.markerStyle,
      move: { target: targetPartId },
    },
    emit: {
      observe: {
        root: rootId,
        initial: options.settings.initial,
        zone: options.settings.zone,
        enter: [{ name: ELCE_EVENTS.PAGE_FINISHED, data: { pageId }, visibility: 'public' }],
      },
    },
  }
}
