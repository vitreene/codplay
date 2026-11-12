import type { RemixNode } from 'remix/component'
import {
  POPUP_PREVIEW_PAGE_PARAM,
  POPUP_PREVIEW_PROJECT_PARAM,
  POPUP_PREVIEW_SESSION_PARAM,
} from '../../../core/preview/popup-preview-messages'
import { QuizHuntPreviewSession } from '../preview/quiz-hunt-preview-session'
import { QuizHuntPreviewView } from '../preview/quiz-hunt-preview-view'

export interface QuizHuntPreviewComposition {
  readonly root: RemixNode | null
  dispose(): Promise<void>
}

/** Builds the Quiz Hunt preview session from its local or server project URL. */
export function createQuizHuntPreviewComposition(searchParams: URLSearchParams): QuizHuntPreviewComposition {
  const sessionId = searchParams.get(POPUP_PREVIEW_SESSION_PARAM)
  const projectId = searchParams.get(POPUP_PREVIEW_PROJECT_PARAM)
  if ((sessionId === null || sessionId.length === 0) && (projectId === null || projectId.length === 0)) {
    return { root: null, dispose: async () => undefined }
  }

  const session = new QuizHuntPreviewSession({
    sessionId: projectId === null || projectId.length === 0 ? sessionId : null,
    projectId: projectId === null || projectId.length === 0 ? null : projectId,
    startPageId: searchParams.get(POPUP_PREVIEW_PAGE_PARAM),
    stage: () => document.getElementById('elce-player-stage'),
  })
  return {
    root: <div id="elce-remix-route-root"><QuizHuntPreviewView session={session} /></div>,
    dispose: async () => session.destroy(),
  }
}
