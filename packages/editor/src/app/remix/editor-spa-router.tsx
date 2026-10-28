import { createRouter } from 'remix/router'
import { render } from 'remix/spa'
import type { Actor } from 'xstate'
import type { controllerMachine } from '../controller/controller-machine'
import { EditorActionsFacade } from '../facades/editor-actions-facade'
import type { EditorScenePersistence } from '../persistence/editor-scene-persistence'
import { AppLayout } from '../layout/app-layout'

/** Creates the browser SPA route around the single Editor application composition. */
export function createEditorSpaRouter(
  controller: Actor<typeof controllerMachine>,
  actions: EditorActionsFacade,
  persistence: EditorScenePersistence,
) {
  const router = createRouter({
    middleware: [render()],
    defaultHandler({ render: renderRoute }) {
      return renderRoute(<AppLayout controller={controller} actions={actions} persistence={persistence} />, { status: 404 })
    },
  })
  router.get('/', ({ render: renderRoute }) => renderRoute(
    <AppLayout controller={controller} actions={actions} persistence={persistence} />,
  ))

  return router
}
