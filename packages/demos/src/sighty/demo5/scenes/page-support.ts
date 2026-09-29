import type { SceneDoc } from 'codplay/scene/types'
import { COURSE_EVENTS } from '../messages'

/** Names a scene perso shape that also accepts the optional scroll component. */
export type CoursePerso = SceneDoc<string>['stories'][string]['persos'][number]

/** Creates the page scrollport using the registered CodPlay V2 component. */
export function createPageScrollPort(pageId: string): CoursePerso {
  const scrollId = pageScrollPortId(pageId)
  return {
    id: scrollId,
    type: 'scroll-container',
    initial: {
      tag: 'section',
      attr: { id: scrollId, 'aria-label': 'Contenu de la page' },
      className: 'demo5-page__scrollport',
      style: { width: '100%', height: '100%', minHeight: 0, overflowY: 'auto' },
      move: '@root',
    },
  }
}

/** Creates the one-pixel end marker whose public entry unlocks Suivant. */
export function createPageBottomMarker(pageId: string): CoursePerso {
  const bottomPart = pageBottomPartId(pageId)
  return {
    id: `${pageId}-bottom-marker`,
    type: 'tag',
    initial: {
      tag: 'span',
      attr: { 'aria-hidden': 'true' },
      className: 'demo5-page__bottom-marker',
      style: { display: 'block', width: '1px', height: '1px', marginTop: 'auto', opacity: 0 },
      move: { target: bottomPart },
    },
    emit: {
      observe: {
        root: pageScrollPortId(pageId),
        zone: { threshold: 0 },
        enter: [{ name: COURSE_EVENTS.pageBottom, data: { pageId }, visibility: 'public', once: true }],
      },
    },
  }
}

/** Returns the stable scroll-container perso identity for one page. */
export function pageScrollPortId(pageId: string): string {
  return `${pageId}-scrollport`
}

/** Returns the authored part name receiving the observed end marker. */
export function pageBottomPartId(pageId: string): string {
  return `${pageId}:bottom-marker`
}
