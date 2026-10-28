import type { Handle } from 'remix/component'
import type { Actor } from 'xstate'
import { createDecorEditorBridge } from '../bridges/decor-editor-bridge'
import type { BridgeHandle } from '../bridges/types'
import type { EditorCoordinationBridge } from '../bridges/editor-coordination-bridge'
import type { controllerMachine } from '../controller/controller-machine'

type DecorEditorRegionProps = Readonly<{
  controller: Actor<typeof controllerMachine>
  coordination: EditorCoordinationBridge
}>

/** Mounts and releases the existing decor-editor bridge in one stable host. */
export function DecorEditorRegion(handle: Handle<DecorEditorRegionProps>) {
  let bridge: BridgeHandle | null = null
  handle.queueTask(() => {
    if (bridge !== null) return
    const container = document.getElementById(handle.id)
    if (container instanceof HTMLElement) {
      bridge = createDecorEditorBridge(container, handle.props.controller, handle.props.coordination)
    }
  })
  handle.signal.addEventListener('abort', () => bridge?.destroy(), { once: true })

  return () => <div
    id={handle.id}
    className="app-region-content app-region-content--decor-editor"
    data-rmx-preserve-dom
  />
}
