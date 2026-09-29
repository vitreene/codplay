import type { SightyScenarioResources } from '@codplay/sighty'
import type { SceneDoc } from 'codplay/scene/types'
import {
  canAccessCoursePage,
  canExitCoursePage,
  COURSE_PAGES,
  getCoursePageBySceneKey,
  getCourseSceneKey,
  readCourseSignet,
} from './course-data'
import { createCourseProgressAndPresentationActions } from './course-actions'
import { courseScenarioFile, type CourseSceneKey } from './sighty-file'
import type { CourseSlotName } from './sighty-file'
import { createConclusionScene } from './scenes/conclusion-scene'
import { createContentPageScene } from './scenes/content-page-scene'
import { layoutScene } from './scenes/layout-scene'
import { createMenuScene } from './scenes/menu-scene'
import { navigationScene } from './scenes/navigation-scene'
import { createQuizPageScene } from './scenes/quiz-page-scene'
import { titleScene } from './scenes/title-scene'

/** Returns the complete authored scenario and its executable resources. */
export function createCourseScenario(
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void,
): SightyScenarioResources<CourseSceneKey, CourseSlotName> {
  const pageScenes = Object.fromEntries(COURSE_PAGES.map((page) => {
    const scene = page.kind === 'content'
      ? createContentPageScene(page)
      : page.kind === 'quiz'
        ? createQuizPageScene(page)
        : createConclusionScene()
    return [getCourseSceneKey(page.id), scene]
  })) as Record<`scene-${string}`, SceneDoc<string>>

  return {
    file: courseScenarioFile,
    scenes: {
      'scene-layout': layoutScene,
      'scene-menu': createMenuScene(),
      'scene-title': titleScene,
      'scene-navigation': navigationScene,
      ...pageScenes,
    },
    actions: createCourseProgressAndPresentationActions(onLog),
    guards: {
      'guard:course:page-access': ({ sceneKey, context }) => {
        const page = getCoursePageBySceneKey(sceneKey)
        return page !== undefined && canAccessCoursePage(page.id, readCourseSignet(context.signet))
      },
      'guard:course:chapter-2-access': ({ sceneKey, context }) => {
        const page = getCoursePageBySceneKey(sceneKey)
        if (page?.chapterId !== 'chapter-2') return false

        const signet = readCourseSignet(context.signet)
        return signet.chapter1QuizPassed && canAccessCoursePage(page.id, signet)
      },
      'guard:course:page-exit': ({ sceneKey, event, context }) => {
        const page = getCoursePageBySceneKey(sceneKey)
        return page !== undefined && canExitCoursePage(page.id, event?.name, readCourseSignet(context.signet))
      },
    },
  }
}
