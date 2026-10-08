import { createRouter } from 'remix/router'
import { render } from 'remix/spa'
import { jsx } from 'remix/ui/jsx-runtime'
import type { Actor } from 'xstate'
import { controllerMachine } from '../controller/controller-machine'
import type { EditorActionsFacade } from '../facades/editor-actions-facade'
import { PopupPlayer } from '../player/popup-player'
import { POPUP_PREVIEW_PAGE_PARAM, POPUP_PREVIEW_SESSION_PARAM } from '../player/popup-preview-messages'
import { EditorContextProvider } from './editor-context'
import { ProjectApplication } from './project-application'

/** Builds the browser route table for the editor. */
export function createElceSpaRouter(
  controller: Actor<typeof controllerMachine> | null,
  actions: EditorActionsFacade | null,
) {
  const searchParams = new URLSearchParams(window.location.search)
  const sessionId = searchParams.get(POPUP_PREVIEW_SESSION_PARAM)
  const popupPlayer = sessionId === null || sessionId.length === 0
    ? null
    : jsx(PopupPlayer, {
        sessionId,
        startPageId: searchParams.get(POPUP_PREVIEW_PAGE_PARAM),
      })
  const router = createRouter({
    middleware: [render()],
    defaultHandler({ render: renderRoute }) {
      return renderRoute(jsx(EditorContextProvider, {
        controller,
        actions,
        children: popupPlayer ?? jsx(ProjectApplication, {}),
      }), { status: 404 })
    },
  })

  router.get('/', ({ render: renderRoute }) => {
    const children = jsx('div', {
      id: 'elce-remix-route-root',
      children: controller === null || actions === null
        ? popupPlayer ?? jsx(ProjectApplication, {})
        : jsx(ProjectApplication, {}),
    })
    return renderRoute(jsx(EditorContextProvider, { controller, actions, children }))
  })

  return router
}
