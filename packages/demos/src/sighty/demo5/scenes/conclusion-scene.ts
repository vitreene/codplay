import type { SceneDoc } from 'codplay/scene/types'
import { COURSE_EVENTS } from '../messages'
import type { CoursePerso } from './page-support'
import {
  createPageBottomMarker,
  createPageScrollPort,
  pageBottomPartId,
  pageScrollPortId,
} from './page-support'

const CONCLUSION_PAGE_ID = 'course-congratulations'

/** Creates the terminal course page shown only after three correct answers. */
export function createConclusionScene(): SceneDoc<string> {
  const persos: CoursePerso[] = [
    createPageScrollPort(CONCLUSION_PAGE_ID),
    {
      id: 'demo5-course-conclusion-article',
      type: 'layout',
      initial: {
        move: { target: pageScrollPortId(CONCLUSION_PAGE_ID) },
        className: 'demo5-conclusion__article',
        style: {
          display: 'flex',
          minHeight: 'calc(100% + 8rem)',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '1rem',
          padding: 'clamp(1rem, 4vw, 3rem)',
          boxSizing: 'border-box',
        },
        markup: `<article id="demo5-course-conclusion-root" class="demo5-conclusion">
          <div id="demo5-course-conclusion-content" class="demo5-conclusion__content">
            <div id="demo5-course-conclusion-heading-host" data-part="demo5:conclusion:heading"></div>
            <div id="demo5-course-conclusion-message-host" data-part="demo5:conclusion:message"></div>
            <div id="demo5-course-conclusion-actions-host" data-part="demo5:conclusion:actions"></div>
          </div>
          <div id="demo5-course-conclusion-bottom-host" class="demo5-page__bottom-host" data-part="${pageBottomPartId(CONCLUSION_PAGE_ID)}"></div>
        </article>`,
      },
    },
    {
      id: 'demo5-course-conclusion-heading',
      type: 'tag',
      initial: {
        tag: 'h2',
        content: 'Félicitations !',
        className: 'demo5-conclusion__heading',
        move: { target: 'demo5:conclusion:heading' },
      },
    },
    {
      id: 'demo5-course-conclusion-message',
      type: 'tag',
      initial: {
        tag: 'p',
        content: 'Vous avez obtenu 3 bonnes réponses sur 3 et terminé le cours.',
        className: 'demo5-conclusion__message',
        move: { target: 'demo5:conclusion:message' },
      },
    },
    {
      id: 'demo5-course-conclusion-restart',
      type: 'tag',
      initial: {
        tag: 'button',
        content: 'Recommencer le cours',
        attr: { type: 'button' },
        className: 'demo5-conclusion__restart',
        move: { target: 'demo5:conclusion:actions' },
      },
      emit: { click: { event: { name: COURSE_EVENTS.restart, visibility: 'public' } } },
    },
    createPageBottomMarker(CONCLUSION_PAGE_ID),
  ]

  return {
    id: 'sighty-demo5-conclusion-scene',
    stories: { main: { id: 'main', initial: { move: '@root' }, persos } },
  }
}
