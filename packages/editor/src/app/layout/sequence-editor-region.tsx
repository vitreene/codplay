import type { Handle } from 'remix/component'
import type { Actor } from 'xstate'
import { createSequenceEditorBridge } from '../bridges/sequence-editor-bridge'
import type { BridgeHandle } from '../bridges/types'
import type { EditorCoordinationBridge } from '../bridges/editor-coordination-bridge'
import type { controllerMachine } from '../controller/controller-machine'

type SequenceEditorRegionProps = Readonly<{
  controller: Actor<typeof controllerMachine>
  coordination: EditorCoordinationBridge
}>

/** Mounts and releases the existing sequence-editor bridge in one stable host. */
export function SequenceEditorRegion(handle: Handle<SequenceEditorRegionProps>) {
  let bridge: BridgeHandle | null = null
  handle.queueTask(() => {
    if (bridge !== null) return
    const container = document.getElementById(handle.id)
    if (container instanceof HTMLElement) {
      bridge = createSequenceEditorBridge(container, handle.props.controller, handle.props.coordination)
    }
  })
  handle.signal.addEventListener('abort', () => bridge?.destroy(), { once: true })

  return () => <div
    id={handle.id}
    className="app-region-content app-region-content--sequence-editor"
    data-rmx-preserve-dom
  />
}
