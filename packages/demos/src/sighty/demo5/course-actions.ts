import type {
  SightyActions,
  SightyActionContext,
  SightyActionHandler,
} from '@codplay/sighty'
import { COURSE_PRESENTATION_EVENTS } from './messages'
import {
  getCoursePageBySceneKey,
  markCoursePageFinished,
  readCourseSignet,
  recordCourseQuizAnswer,
  type CourseSignet,
} from './course-data'
import { createCoursePresentation } from './course-presentation'
import type { CourseSceneKey } from './sighty-file'

/** Creates handlers for course progress and presentation events. */
export function createCourseProgressAndPresentationActions(
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void,
): SightyActions<CourseSceneKey> {
  return {
    'course:mark-page-finished': markCurrentPageFinished(onLog),
    'course:record-quiz-answer': recordCurrentQuizAnswer(onLog),
    'course:refresh-presentation': refreshCoursePresentation(onLog),
  }
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

    const signet = markCoursePageFinished(readCourseSignet(context.context.signet), page.id)
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
    visibility: 'scene',
    data: { content: presentation.title },
  }, { scope: 'scene' })
  await context.send('scene-menu', {
    name: COURSE_PRESENTATION_EVENTS.menu,
    visibility: 'scene',
    data: { className: presentation.menuClassPatch },
  }, { scope: 'scene' })
  await context.send('scene-navigation', {
    name: COURSE_PRESENTATION_EVENTS.navigationPrevious,
    visibility: 'scene',
    data: { attr: presentation.previousAttributes },
  }, { scope: 'scene' })
  await context.send('scene-navigation', {
    name: COURSE_PRESENTATION_EVENTS.navigationStatus,
    visibility: 'scene',
    data: { content: presentation.navigationStatus },
  }, { scope: 'scene' })
  await context.send('scene-navigation', {
    name: COURSE_PRESENTATION_EVENTS.navigationNext,
    visibility: 'scene',
    data: { attr: presentation.nextAttributes },
  }, { scope: 'scene' })
}
