import { createRouter } from 'remix/router'
import { render } from 'remix/spa'
import { jsx } from 'remix/ui/jsx-runtime'
import type { Handle } from 'remix/ui'
import type { Actor } from 'xstate'
import { controllerMachine } from '../controller/controller-machine'
import type { EditorActionsFacade } from '../facades/editor-actions-facade'
import { EditorContextProvider } from './editor-context'
import { RemixEditorLifecycleProofTemp } from './editor-lifecycle-proof-temp'

/** Builds the browser route table for the editor. */
export function createElceSpaRouter(
  controller: Actor<typeof controllerMachine> | null,
  actions: EditorActionsFacade | null,
) {
  const router = createRouter({
    middleware: [render()],
    defaultHandler({ render: renderRoute }) {
      return renderRoute(jsx(EditorContextProvider, {
        controller,
        actions,
        children: jsx(ReactEditorTempBridge, {}),
      }), { status: 404 })
    },
  })

  router.get('/', ({ url, render: renderRoute }) => {
    const proof = url.searchParams.get('__remixProof') === '1'
      ? jsx(RemixEditorLifecycleProofTemp, {})
      : null
    const children = jsx('div', {
      id: 'elce-remix-route-root',
      children: [jsx(ReactEditorTempBridge, {}), proof],
    })
    return renderRoute(jsx(EditorContextProvider, { controller, actions, children }))
  })

  return router
}

/** Keeps the existing React editor mounted while its surfaces are ported. */
function ReactEditorTempBridge(_handle: Handle) {
  return () => jsx('div', {
    id: 'elce-react-temp-host',
    'data-rmx-preserve-dom': true,
  })
}
