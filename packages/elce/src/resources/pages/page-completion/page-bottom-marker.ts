import type { PersoDoc } from 'codplay/scene/types'
import { PAGE_FINISHED_EVENT } from './page-completion-events'
import type { ElceResolvedPlayerSettings } from '../../../domain/editor-settings/editor-settings-types'

type PageBottomMarkerOptions = Readonly<{
  readonly pageId: string
  readonly markerId: string
  readonly rootId: string
  readonly targetPartId: string
  readonly settings: ElceResolvedPlayerSettings['progression']['pageCompletionObservation']
  readonly className?: string
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
      className: options.className ?? 'elce-page-bottom-marker',
      move: { target: targetPartId },
    },
    emit: {
      observe: {
        root: rootId,
        initial: options.settings.initial,
        zone: options.settings.zone,
        enter: [{ name: PAGE_FINISHED_EVENT, data: { pageId }, visibility: 'public' }],
      },
    },
  }
}
