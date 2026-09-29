import type { SceneDoc } from 'codplay/scene/types'
import {
  COURSE_CHAPTERS,
  getMenuPages,
  type CourseChapterId,
} from '../course-data'
import { COURSE_PRESENTATION_EVENTS, courseMenuEvent } from '../messages'

/** Builds the live chapter and page list driven by the shared course catalogue. */
export function createMenuScene(): SceneDoc<string> {
  const chapterMarkup = COURSE_CHAPTERS.map((chapter) => {
    const chapterPages = getMenuPages(chapter.id)
    const chapterPart = chapterButtonPart(chapter.id)
    const pageMarkup = chapterPages.map((page) => `
      <li id="${page.id}-menu-row" class="demo5-menu__page-row">
        <div id="${page.id}-menu-button-host" data-part="${pageButtonPart(page.id)}"></div>
      </li>`).join('')
    return `
      <section id="${chapter.id}-menu-group" class="demo5-menu__chapter">
        <div id="${chapter.id}-menu-heading-host" data-part="${chapterPart}"></div>
        <ol id="${chapter.id}-menu-pages" class="demo5-menu__pages">${pageMarkup}
        </ol>
      </section>`
  }).join('')

  const persos = [
    {
      id: 'demo5-course-menu-root',
      type: 'layout',
      initial: {
        move: '@root',
        className: 'demo5-menu',
        markup: `<nav id="demo5-menu-root" class="demo5-menu" aria-label="Chapitres et pages du cours">
          <h2 id="demo5-menu-title" class="demo5-menu__title">Sommaire</h2>
          <div id="demo5-menu-state-host" class="demo5-menu__state" data-part="course:menu:state"></div>
          <div id="demo5-menu-scroll" class="demo5-menu__scroll">${chapterMarkup}</div>
        </nav>`,
      },
      actions: {},
    },
    {
      id: 'demo5-menu-state',
      type: 'tag',
      initial: {
        tag: 'span',
        attr: { 'aria-hidden': 'true' },
        className: 'demo5-menu-state',
        style: { display: 'none' },
        move: { target: 'course:menu:state' },
      },
      actions: {
        [COURSE_PRESENTATION_EVENTS.menu]: {
          className: { add: '', remove: '' },
        },
      },
    },
    ...COURSE_CHAPTERS.map((chapter) => createChapterButton(chapter.id, chapter.title)),
    ...COURSE_CHAPTERS.flatMap((chapter) => getMenuPages(chapter.id).map((page) => ({
      id: `${page.id}-menu-button`,
      type: 'tag',
      initial: {
        tag: 'button',
        content: page.title,
        attr: { type: 'button' },
        className: `demo5-menu__page-button demo5-menu__page-button--page-${page.id}`,
        move: { target: pageButtonPart(page.id) },
      },
      emit: { click: { event: { name: courseMenuEvent(page.id), visibility: 'public' as const } } },
    }))),
  ] satisfies SceneDoc<string>['stories']['main']['persos']

  return {
    id: 'sighty-demo5-menu-scene',
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        persos,
      },
    },
  }
}

/** Creates one chapter heading button routed through Sighty's page guard. */
function createChapterButton(chapterId: CourseChapterId, title: string) {
  const chapterPages = getMenuPages(chapterId)
  const firstPage = chapterPages[0]
  if (firstPage === undefined) throw new Error(`Le chapitre ${chapterId} ne contient aucune page.`)
  return {
    id: `${chapterId}-menu-button`,
    type: 'tag' as const,
    initial: {
      tag: 'button',
      content: title,
      attr: { type: 'button' },
      className: `demo5-menu__chapter-button demo5-menu__chapter-button--${chapterId}`,
      move: { target: chapterButtonPart(chapterId) },
    },
    emit: { click: { event: { name: courseMenuEvent(firstPage.id), visibility: 'public' as const } } },
  }
}

/** Creates the authored part name for one chapter heading. */
function chapterButtonPart(chapterId: string): string {
  return `course:menu:chapter:${chapterId}`
}

/** Creates the authored part name for one page menu button. */
function pageButtonPart(pageId: string): string {
  return `course:menu:page:${pageId}`
}
