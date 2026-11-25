import { on, type Handle } from 'remix/component'
import type { Actor } from 'xstate'
import { createDecorEditorBridge, type DecorEditorBridgeHandle } from '../bridges/decor-editor-bridge'
import type { EditorCoordinationBridge } from '../bridges/editor-coordination-bridge'
import type { controllerMachine } from '../controller/controller-machine'
import type { EditorActionsFacade } from '../facades/editor-actions-facade'
import { AuthoringTools } from './decor-inspector/authoring-tools'
import { RootSettings } from './decor-inspector/root-settings'
import {
  authoringToolsState,
  defaultInspectorPanel,
  rootSettingsState,
  scenePanelTarget,
  type InspectorPanel,
} from './decor-inspector/decor-inspector-state'

type DecorEditorRegionProps = Readonly<{
  controller: Actor<typeof controllerMachine>
  coordination: EditorCoordinationBridge
  actions: EditorActionsFacade
}>

/** Host ids where the Decor bridge mounts the palette and the capsule definition editor. */
const DECOR_PALETTE_HOST_ID = 'editor-decor-palette-host'
const CAPSULE_DEFINITION_HOST_ID = 'editor-capsule-definition-host'

/**
 * Decor inspector region: the Zone/Block toolbar, the Decor / scene-panel tabs, the root settings,
 * and the hosts where the Decor bridge mounts the palette and the capsule definition editor.
 */
export function DecorEditorRegion(handle: Handle<DecorEditorRegionProps>) {
  const { controller, coordination, actions } = handle.props
  let bridge: DecorEditorBridgeHandle | null = null
  const initial = controller.getSnapshot().context
  let panelTarget = scenePanelTarget(initial.scene, initial.selection)
  let panel: InspectorPanel = defaultInspectorPanel(panelTarget)

  /** Panel actually shown: the palette whenever the selection has no scene panel. */
  const shownPanel = (): InspectorPanel => panelTarget === null ? 'decor' : panel

  /** Shows one panel and tells the bridge, which adapts the zone overlay to the capsule settings. */
  const selectPanel = (next: InspectorPanel): void => {
    panel = next
    bridge?.setInspectorPanel(shownPanel())
    void handle.update()
  }

  /** Opens the default panel of a new scene-panel target; keeps the author's choice otherwise. */
  const followPanelTarget = (): void => {
    const { scene, selection } = controller.getSnapshot().context
    const target = scenePanelTarget(scene, selection)
    if (target === panelTarget) {
      void handle.update()
      return
    }
    panelTarget = target
    selectPanel(defaultInspectorPanel(target))
  }

  const controllerSubscription = controller.subscribe(followPanelTarget)
  // The offset tool depends on the author time, which a seek changes without a document change.
  const seekSubscription = controller.on('seekApplied', () => void handle.update())

  handle.queueTask(() => {
    if (bridge !== null) return
    const paletteHost = document.getElementById(DECOR_PALETTE_HOST_ID)
    const capsuleDefinitionHost = document.getElementById(CAPSULE_DEFINITION_HOST_ID)
    if (!(paletteHost instanceof HTMLElement) || !(capsuleDefinitionHost instanceof HTMLElement)) return
    bridge = createDecorEditorBridge(paletteHost, controller, coordination, actions, { capsuleDefinitionHost })
    bridge.setInspectorPanel(shownPanel())
  })
  handle.signal.addEventListener('abort', () => {
    controllerSubscription.unsubscribe()
    seekSubscription.unsubscribe()
    bridge?.destroy()
  }, { once: true })

  return () => {
    const snapshot = controller.getSnapshot()
    const { context } = snapshot
    const locked = snapshot.value === 'playing' || snapshot.value === 'creating'
    const shown = shownPanel()
    const rootSelected = panelTarget === 'root'
    return <div id={handle.id} className="app-region-content app-region-content--decor-editor">
      <div id="editor-decor-tabs-host" className="editor-decor-tabs">
        <AuthoringTools state={authoringToolsState(context, locked, coordination.getAuthorTimeMs())} actions={actions} />
        <div id="editor-decor-tabs" className="dedit-tabs" hidden={panelTarget === null}>
          <button
            id="editor-decor-tab"
            type="button"
            className={shown === 'decor' ? 'dedit-tab dedit-tab--active' : 'dedit-tab'}
            hidden={rootSelected}
            mix={on('click', () => selectPanel('decor'))}
          >Décor</button>
          <button
            id="editor-scene-panel-tab"
            type="button"
            className={shown === 'capsule' ? 'dedit-tab dedit-tab--active' : 'dedit-tab'}
            mix={on('click', () => selectPanel('capsule'))}
          >{rootSelected ? 'Scène' : 'Capsule'}</button>
        </div>
        <div id="editor-decor-content" hidden={shown !== 'decor'}>
          <div id={DECOR_PALETTE_HOST_ID} data-rmx-preserve-dom />
        </div>
        <div id="editor-capsule-content" hidden={shown !== 'capsule'}>
          {rootSelected && context.scene !== null && <RootSettings
            state={rootSettingsState(context.scene, context.zonesVisible, locked)}
            actions={actions}
          />}
          <div id="editor-capsule-definition-content" hidden={rootSelected || panelTarget === null}>
            <div id={CAPSULE_DEFINITION_HOST_ID} data-rmx-preserve-dom />
          </div>
        </div>
      </div>
    </div>
  }
}
