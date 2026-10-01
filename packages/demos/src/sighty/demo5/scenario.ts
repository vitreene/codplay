import type {
  SightyActionContext,
  SightyActionHandler,
  SightyGraphView,
  SightySceneSourceValue,
  SightyScenarioDefinition,
  SightyViewAction,
  SightyViewList,
} from '@codplay/sighty'
import {
  canAccessCoursePage,
  canExitCoursePage,
  COURSE_CHAPTERS,
  COURSE_PAGES,
  COURSE_START_PAGE_ID,
  getCoursePageBySceneKey,
  getCoursePagePath,
  getCourseSceneKey,
  getMenuPages,
  readCourseSignet,
  markCoursePageFinished,
  recordCourseQuizAnswer,
  type CourseSignet,
} from './course-data'
import { createCoursePresentation } from './course-presentation'
import { COURSE_EVENTS, COURSE_PRESENTATION_EVENTS, courseMenuEvent } from './messages'
import { createConclusionScene } from './scenes/conclusion-scene'
import { createContentPageScene } from './scenes/content-page-scene'
import { layoutScene } from './scenes/layout-scene'
import { createMenuScene } from './scenes/menu-scene'
import { navigationScene } from './scenes/navigation-scene'
import { createQuizPageScene } from './scenes/quiz-page-scene'
import { titleScene } from './scenes/title-scene'

/** Names every CodPlay scene used by the course scenario. */
export type CourseSceneKey =
  | 'scene-layout'
  | 'scene-menu'
  | 'scene-title'
  | 'scene-navigation'
  | `scene-${string}`

/** Names the regions declared by the course layout. */
export type CourseSlotName =
  | 'slot-menu'
  | 'slot-title'
  | 'slot-content'
  | 'slot-navigation'

/** Declares the course views, guards, actions and scene catalog in one scenario. */
export function createCourseScenario(
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void,
): SightyScenarioDefinition<CourseSceneKey, CourseSlotName> {
  const pageScenes = Object.fromEntries(COURSE_PAGES.map((page) => {
    const scene = page.kind === 'content'
      ? createContentPageScene(page)
      : page.kind === 'quiz'
        ? createQuizPageScene(page)
        : createConclusionScene()
    if (page.kind !== 'quiz') return [getCourseSceneKey(page.id), scene]

    return [getCourseSceneKey(page.id), {
      sceneDoc: scene,
      onReset: (keys) => keys.includes('all') || keys.includes('quiz') || keys.includes('solutions')
        ? { name: `course-quiz:${page.id}:reset`, data: { keys: [...keys] } }
        : undefined,
    }]
  })) as Record<`scene-${string}`, SightySceneSourceValue>
  const coursePageActions = createCoursePageActions()
  const chapterViews = createCourseChapterViews()

  return {
    format: 'sighty',
    version: 1,
    id: 'sighty-scroll-course',
    views: {
      start: 'view-main',
      views: {
        'view-main': {
          action: 'action:course:refresh-presentation',
          actions: {
            [COURSE_EVENTS.refreshPresentation]: {},
            ...coursePageActions,
          },
          view: {
            scene: 'scene-layout',
            slots: {
              'slot-menu': {
                start: 'view-menu',
                views: { 'view-menu': { view: { scene: 'scene-menu' } } },
              },
              'slot-title': {
                start: 'view-title',
                views: { 'view-title': { view: { scene: 'scene-title' } } },
              },
              'slot-navigation': {
                start: 'view-navigation',
                views: { 'view-navigation': { view: { scene: 'scene-navigation' } } },
              },
            },
            views: {
              start: 'view-course',
              views: {
                'view-course': {
                  showMode: 'reset',
                  accessBy: 'guard:course:page-access',
                  exitBy: 'guard:course:page-exit',
                  onDenied: { path: getCoursePagePath(COURSE_START_PAGE_ID) },
                  actions: {
                    [COURSE_EVENTS.next]: {
                      go: { direction: 'next' },
                    },
                    [COURSE_EVENTS.previous]: {
                      go: { direction: 'previous' },
                    },
                    [COURSE_EVENTS.restart]: {
                      go: { path: getCoursePagePath(COURSE_START_PAGE_ID) },
                      reset: ['all'],
                      action: 'action:course:refresh-presentation',
                    },
                    [COURSE_EVENTS.pageBottom]: { action: 'action:course:mark-page-finished' },
                    [COURSE_EVENTS.quizAnswered]: { action: 'action:course:record-quiz-answer' },
                  },
                  view: {
                    views: {
                      start: 'chapter-1',
                      views: chapterViews,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    scenes: {
      'scene-layout': layoutScene,
      'scene-menu': createMenuScene(),
      'scene-title': titleScene,
      'scene-navigation': navigationScene,
      ...pageScenes,
    },
    actions: {
      'action:course:mark-page-finished': markCurrentPageFinished(onLog),
      'action:course:record-quiz-answer': recordCurrentQuizAnswer(onLog),
      'action:course:refresh-presentation': refreshCoursePresentation(onLog),
    },
    guards: {
      'guard:course:page-access': ({ sceneKey, context }) => {
        const page = getCoursePageBySceneKey(sceneKey)
        return page !== undefined && canAccessCoursePage(page.id, readCourseSignet(context.signet))
      },
      'guard:course:page-exit': ({ sceneKey, event, context }) => {
        const page = getCoursePageBySceneKey(sceneKey)
        return page !== undefined && canExitCoursePage(page.id, event?.name, readCourseSignet(context.signet))
      },
    },
  }
}

/** Builds every chapter graph from the single course page catalogue. */
function createCourseChapterViews(): Readonly<Record<
  (typeof COURSE_CHAPTERS)[number]['id'],
  SightyGraphView<CourseSceneKey, CourseSlotName>
>> {
  const chapterViews: Record<
    (typeof COURSE_CHAPTERS)[number]['id'],
    SightyGraphView<CourseSceneKey, CourseSlotName>
  > = {} as Record<
    (typeof COURSE_CHAPTERS)[number]['id'],
    SightyGraphView<CourseSceneKey, CourseSlotName>
  >

  for (const chapter of COURSE_CHAPTERS) {
    chapterViews[chapter.id] = {
      view: { slots: { 'slot-content': createCoursePageViews(chapter.id) } },
    }
  }

  return chapterViews
}

/** Builds the ordered page entries for one chapter from course data. */
function createCoursePageViews(
  chapterId: (typeof COURSE_CHAPTERS)[number]['id'],
): SightyViewList<CourseSceneKey, CourseSlotName> {
  return COURSE_PAGES
    .filter((page) => page.chapterId === chapterId)
    .map((page) => ({
      id: page.id,
      view: { scene: getCourseSceneKey(page.id) },
    }))
}

/** Builds menu routes from the same page catalogue used by the chapter graph. */
function createCoursePageActions(): Readonly<Record<
  string,
  SightyViewAction<CourseSceneKey, CourseSlotName>
>> {
  const actions: Record<string, SightyViewAction<CourseSceneKey, CourseSlotName>> = {}
  for (const page of getMenuPagesForCourse()) {
    actions[courseMenuEvent(page.id)] = { go: { path: getCoursePagePath(page.id) } }
  }
  return actions
}

/** Returns every visible menu page in catalogue order. */
function getMenuPagesForCourse() {
  return COURSE_CHAPTERS.flatMap((chapter) => getMenuPages(chapter.id))
}

/** Records the active scene's bottom-marker event in context.signet. */
function markCurrentPageFinished(
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void,
): SightyActionHandler<CourseSceneKey> {
  return async function markPage(context): Promise<void> {
    const page = getCoursePageBySceneKey(context.event.sourceSceneKey)
    if (page === undefined) {
      onLog('Repère de fin reçu depuis une scène sans page de cours.', 'warn')
      return
    }

    const currentSignet = readCourseSignet(context.context.signet)
    if (currentSignet.finishedPages[page.id] === true) return

    const signet = markCoursePageFinished(currentSignet, page.id)
    await updateCourseProgress(context, signet, onLog)
  }
}

/** Records one public question result in the appropriate signet field. */
function recordCurrentQuizAnswer(
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void,
): SightyActionHandler<CourseSceneKey> {
  return async function recordAnswer(context): Promise<void> {
    const page = getCoursePageBySceneKey(context.event.sourceSceneKey)
    const isCorrect = context.event.data?.isCorrect
    if (page === undefined || page.kind !== 'quiz' || typeof isCorrect !== 'boolean') {
      onLog(`Résultat de quiz invalide reçu depuis ${context.event.sourceSceneKey ?? 'une source inconnue'}.`, 'warn')
      return
    }

    const signet = recordCourseQuizAnswer(readCourseSignet(context.context.signet), page, isCorrect)
    await updateCourseProgress(context, signet, onLog)
    onLog(`${page.title} : ${isCorrect ? 'réponse juste' : 'réponse fausse'}`)
  }
}

/** Updates durable progress before projecting the runtime's guard answers. */
async function updateCourseProgress(
  context: SightyActionContext<CourseSceneKey>,
  signet: CourseSignet,
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void,
): Promise<void> {
  await context.updateContext({ signet })
  if (getCoursePageBySceneKey(context.scenarioState.active?.sceneKey) === undefined) {
    onLog('La présentation du cours ne trouve aucune vue active de contenu.', 'error')
    return
  }
  await sendCoursePresentation(context)
}

/** Refreshes persistent course controls through one declared Sighty action. */
function refreshCoursePresentation(
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void,
): SightyActionHandler<CourseSceneKey> {
  return async function refreshPresentation(context): Promise<void> {
    const page = getCoursePageBySceneKey(context.scenarioState.active?.sceneKey)
    if (page === undefined) {
      onLog('La présentation du cours ne trouve aucune page active.', 'warn')
      return
    }

    await sendCoursePresentation(context)
  }
}

/** Sends authored presentation events to their persistent scene instances. */
async function sendCoursePresentation(
  context: SightyActionContext<CourseSceneKey>,
): Promise<void> {
  const presentation = await createCoursePresentation(context.scenarioState)

  await context.send('scene-title', {
    name: COURSE_PRESENTATION_EVENTS.title,
    data: { content: presentation.title },
  }, { scope: 'story', storyId: 'main' })
  await context.send('scene-menu', {
    name: COURSE_PRESENTATION_EVENTS.menu,
    data: { className: presentation.menuClassPatch },
  }, { scope: 'story', storyId: 'main' })
  await context.send('scene-navigation', {
    name: COURSE_PRESENTATION_EVENTS.navigationPrevious,
    data: { attr: presentation.previousAttributes },
  }, { scope: 'story', storyId: 'main' })
  await context.send('scene-navigation', {
    name: COURSE_PRESENTATION_EVENTS.navigationStatus,
    data: { content: presentation.navigationStatus },
  }, { scope: 'story', storyId: 'main' })
  await context.send('scene-navigation', {
    name: COURSE_PRESENTATION_EVENTS.navigationNext,
    data: { attr: presentation.nextAttributes },
  }, { scope: 'story', storyId: 'main' })
}
