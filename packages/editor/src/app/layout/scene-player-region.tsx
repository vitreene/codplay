import type { Handle } from 'remix/component'
import type { Actor } from 'xstate'
import type { controllerMachine } from '../controller/controller-machine'
import { createScenePlayerBridge } from '../bridges/scene-player-bridge'
import type { BridgeHandle } from '../bridges/types'
import type { EditorCoordinationBridge } from '../bridges/editor-coordination-bridge'

type ScenePlayerRegionProps = Readonly<{
  controller: Actor<typeof controllerMachine>
  coordination: EditorCoordinationBridge
}>

/** Mounts and releases the V2 player bridge inside its Remix-preserved host. */
export function ScenePlayerRegion(handle: Handle<ScenePlayerRegionProps>) {
  let bridge: BridgeHandle | null = null
  handle.queueTask(() => {
    if (bridge !== null) return
    const container = document.getElementById(handle.id)
    if (container instanceof HTMLElement) {
      bridge = createScenePlayerBridge(container, handle.props.controller, handle.props.coordination)
    }
  })
  handle.signal.addEventListener('abort', () => bridge?.destroy(), { once: true })

  return () => <div
    id={handle.id}
    className="app-region-content app-region-content--scene-player"
    data-rmx-preserve-dom
  />
}
