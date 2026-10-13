import { createRouter } from 'remix/router'
import { render } from 'remix/spa'

import type { Actor } from 'xstate'
import { controllerMachine } from '../controller/controller-machine'
import type { EditorActionsFacade } from '../facades/editor-actions-facade'
import { PopupPlayer } from '../player/popup-player'
import {
  POPUP_PREVIEW_PAGE_PARAM,
  POPUP_PREVIEW_PROJECT_PARAM,
  POPUP_PREVIEW_SESSION_PARAM,
} from '../player/popup-preview-messages'
import { EditorContextProvider } from './editor-context'
import { ProjectApplication } from './project-application'

/** Builds the browser route table for the editor. */
export function createElceSpaRouter(
  controller: Actor<typeof controllerMachine> | null,
  actions: EditorActionsFacade | null,
) {
  const searchParams = new URLSearchParams(window.location.search)
  const sessionId = searchParams.get(POPUP_PREVIEW_SESSION_PARAM)
  const projectId = searchParams.get(POPUP_PREVIEW_PROJECT_PARAM)
  const popupPlayer = projectId !== null && projectId.length > 0
    ? <PopupPlayer
      sessionId={null}
      projectId={projectId}
      startPageId={searchParams.get(POPUP_PREVIEW_PAGE_PARAM)}
    />
    : sessionId === null || sessionId.length === 0
      ? null
      : <PopupPlayer
        sessionId={sessionId}
        projectId={null}
        startPageId={searchParams.get(POPUP_PREVIEW_PAGE_PARAM)}
      />
  const router = createRouter({
    middleware: [render()],
    defaultHandler({ render: renderRoute }) {
      return renderRoute(<EditorContextProvider
        controller={controller}
        actions={actions}
      >
        {popupPlayer ?? <ProjectApplication />}
      </EditorContextProvider>, { status: 404 })
    },
  })

  router.get('/', ({ render: renderRoute }) => {
    const children = <div
      id="elce-remix-route-root"
    >
      {controller === null || actions === null
        ? popupPlayer ?? <ProjectApplication />
        : <ProjectApplication />}
    </div>
    return renderRoute(<EditorContextProvider
      controller={controller}
      actions={actions}
    >
      {children}
    </EditorContextProvider>)
  })

  return router
}
