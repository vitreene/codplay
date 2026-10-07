import { createRouter } from 'remix/router'
import { render } from 'remix/spa'
import { jsx } from 'remix/ui/jsx-runtime'
import type { Handle, RemixNode } from 'remix/ui'
import type { Actor } from 'xstate'
import { controllerMachine } from '../controller/controller-machine'

interface EditorContext {
  readonly controller: Actor<typeof controllerMachine> | null
}

interface ElceSpaRootProps {
  readonly controller: Actor<typeof controllerMachine> | null
  readonly children?: RemixNode
}

/** Builds the browser route table for the editor. */
export function createElceSpaRouter(controller: Actor<typeof controllerMachine> | null) {
  const router = createRouter({
    middleware: [render()],
    defaultHandler({ render: renderRoute }) {
      return renderRoute(jsx(ElceSpaRoot, {
        controller,
        children: jsx(ReactEditorTempBridge, {}),
      }), { status: 404 })
    },
  })

  router.get('/', ({ render: renderRoute }) => renderRoute(jsx(ElceSpaRoot, {
    controller,
    children: jsx(ReactEditorTempBridge, {}),
  })))

  return router
}

/** Makes the shared XState actor available to Remix descendants through context. */
function ElceSpaRoot(handle: Handle<ElceSpaRootProps, EditorContext>) {
  handle.context.set({ controller: handle.props.controller })
  return () => handle.props.children ?? null
}

/** Keeps the existing React editor mounted while its surfaces are ported. */
function ReactEditorTempBridge(_handle: Handle) {
  return () => jsx('div', {
    id: 'elce-react-temp-host',
    'data-rmx-preserve-dom': true,
  })
}
