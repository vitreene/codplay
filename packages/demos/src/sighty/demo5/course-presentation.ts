import type { SightyScenarioStateApi } from '@codplay/sighty'
import {
  COURSE_CHAPTERS,
  COURSE_PAGES,
  getCoursePageBySceneKey,
  getCoursePagePath,
  getMenuPages,
} from './course-data'
import { COURSE_EVENTS, courseMenuEvent } from './messages'
import type { CourseSceneKey } from './sighty-file'

/** Holds the patches sent to the menu and navigation scene actions. */
export type CoursePresentation = Readonly<{
  title: string
  menuClassPatch: Readonly<{ add: string; remove: string }>
  previousAttributes: Readonly<{ type: 'button'; disabled: boolean }>
  nextAttributes: Readonly<{ type: 'button'; disabled: boolean }>
  navigationStatus: string
}>

/** Projects the active page and the runtime's guard answers into course controls. */
export async function createCoursePresentation(
  scenarioState: SightyScenarioStateApi<CourseSceneKey>,
): Promise<CoursePresentation> {
  const page = getCoursePageBySceneKey(scenarioState.active?.sceneKey)
  const activePageId = page?.id
  const pageIndex = activePageId === undefined
    ? -1
    : COURSE_PAGES.findIndex((candidate) => candidate.id === activePageId)
  const chapterId = page?.chapterId
  const classes = ['demo5-menu-state']
  const oldClasses = [
    ...COURSE_CHAPTERS.map((chapter) => `demo5-menu--active-${chapter.id}`),
    ...COURSE_PAGES.map((candidate) => `demo5-menu--active-page-${candidate.id}`),
    ...COURSE_CHAPTERS.map((chapter) => `demo5-menu--locked-${chapter.id}`),
    ...COURSE_PAGES.filter((candidate) => candidate.menuVisible !== false)
      .map((candidate) => `demo5-menu--locked-page-${candidate.id}`),
  ]

  if (chapterId !== undefined) classes.push(`demo5-menu--active-${chapterId}`)
  if (activePageId !== undefined && page?.menuVisible !== false) {
    classes.push(`demo5-menu--active-page-${activePageId}`)
  }

  const accessByPage = new Map<string, boolean>()
  for (const chapter of COURSE_CHAPTERS) {
    for (const menuPage of getMenuPages(chapter.id)) {
      const allowed = await scenarioState.canAccess(
        { path: getCoursePagePath(menuPage.id) },
        { name: courseMenuEvent(menuPage.id), sourceSceneKey: 'scene-menu' },
      )
      accessByPage.set(menuPage.id, allowed)
    }
  }

  for (const chapter of COURSE_CHAPTERS) {
    const firstPage = getMenuPages(chapter.id)[0]
    if (firstPage !== undefined && accessByPage.get(firstPage.id) === false) {
      classes.push(`demo5-menu--locked-${chapter.id}`)
    }
  }

  for (const chapter of COURSE_CHAPTERS) {
    for (const menuPage of getMenuPages(chapter.id)) {
      if (accessByPage.get(menuPage.id) === false) {
        classes.push(`demo5-menu--locked-page-${menuPage.id}`)
      }
    }
  }

  let previousAllowed = false
  let nextAllowed = false
  if (page !== undefined) {
    const pageReference = { path: getCoursePagePath(page.id) }
    previousAllowed = await scenarioState.canExit(pageReference, {
      name: COURSE_EVENTS.previous,
      sourceSceneKey: 'scene-navigation',
    })
    nextAllowed = await scenarioState.canExit(pageReference, {
      name: COURSE_EVENTS.next,
      sourceSceneKey: 'scene-navigation',
    })
  }

  const nextDisabled = page === undefined || page.kind === 'conclusion' || !nextAllowed
  const previousDisabled = page === undefined || !previousAllowed

  return {
    title: page?.title ?? '',
    menuClassPatch: { add: classes.join(' '), remove: oldClasses.join(' ') },
    previousAttributes: { type: 'button', disabled: previousDisabled },
    nextAttributes: { type: 'button', disabled: nextDisabled },
    navigationStatus: page === undefined
      ? ''
      : page.kind === 'conclusion'
        ? 'Cours terminé'
        : `Page ${pageIndex + 1} sur ${COURSE_PAGES.filter((candidate) => candidate.kind !== 'conclusion').length}`,
  }
}
