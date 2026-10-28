import type { RemixNode } from 'remix/ui'
import {
  POPUP_PREVIEW_PAGE_PARAM,
  POPUP_PREVIEW_PROJECT_PARAM,
  POPUP_PREVIEW_SESSION_PARAM,
} from '../../../core/preview/popup-preview-messages'
import { LearningPreviewSession } from '../preview/learning-preview-session'
import { LearningPreviewView } from '../preview/learning-preview-view'

export interface LearningPreviewComposition {
  readonly root: RemixNode | null
  dispose(): Promise<void>
}

/** Builds and owns one Learning preview session for the parameters in its URL. */
export function createLearningPreviewComposition(searchParams: URLSearchParams): LearningPreviewComposition {
  const sessionId = searchParams.get(POPUP_PREVIEW_SESSION_PARAM)
  const projectId = searchParams.get(POPUP_PREVIEW_PROJECT_PARAM)
  if ((sessionId === null || sessionId.length === 0) && (projectId === null || projectId.length === 0)) {
    return { root: null, dispose: async () => undefined }
  }

  const session = new LearningPreviewSession({
    sessionId: projectId === null || projectId.length === 0 ? sessionId : null,
    projectId: projectId === null || projectId.length === 0 ? null : projectId,
    startPageId: searchParams.get(POPUP_PREVIEW_PAGE_PARAM),
    stage: () => document.getElementById('elce-player-stage'),
  })
  return {
    root: <div id="elce-remix-route-root"><LearningPreviewView session={session} /></div>,
    dispose: async () => session.destroy(),
  }
}
