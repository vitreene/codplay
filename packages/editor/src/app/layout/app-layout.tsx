import type { Handle } from 'remix/component'
import type { Actor } from 'xstate'
import './app-layout.css'
import type { controllerMachine } from '../controller/controller-machine'
import { EditorActionsFacade } from '../facades/editor-actions-facade'
import { EditorPlayerCommandFacade } from '../commands/editor-player-command-facade'
import { EditorCoordinationBridge } from '../bridges/editor-coordination-bridge'
import { createSceneSelectionHandler } from '../bridges/scene-selection'
import type { EditorScenePersistence } from '../persistence/editor-scene-persistence'
import { EditorMenuRegion } from './editor-menu-region'
import { SequenceEditorRegion } from './sequence-editor-region'
import { ScenePlayerRegion } from './scene-player-region'
import { DecorEditorRegion } from './decor-editor-region'

type AppLayoutProps = Readonly<{
  controller: Actor<typeof controllerMachine>
  actions: EditorActionsFacade
  persistence: EditorScenePersistence
}>

/** Composes the Remix page, central actor listeners, player facade, and existing DOM bridges. */
export function AppLayout(handle: Handle<AppLayoutProps>) {
  const { controller, actions, persistence } = handle.props
  const playerFacade = new EditorPlayerCommandFacade()
  const coordination = new EditorCoordinationBridge(controller, playerFacade)
  let snapshot = controller.getSnapshot()
  let history = actions.getHistoryState()

  const stopController = controller.subscribe((next) => {
    snapshot = next
    void handle.update()
  })
  const stopHistory = actions.subscribeHistory((next) => {
    history = next
    void handle.update()
  })
  const stopPersistence = persistence.subscribe(() => void handle.update())

  /** Routes escape and history shortcuts to the existing controller/facade boundaries. */
  const onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target
    const isEditable = target instanceof HTMLElement
      && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
    if (event.key === 'Escape') {
      if (isEditable) return
      if (snapshot.value === 'creating') {
        actions.cancelCreation()
        return
      }
      if (snapshot.context.selection.itemIds.length === 0) return
      actions.clearSelection()
      return
    }
    if (isEditable || !(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'z') return

    event.preventDefault()
    event.stopPropagation()
    if (event.shiftKey) actions.redo()
    else actions.undo()
  }
  document.addEventListener('keydown', onKeyDown)

  const onScenePointerDown = createSceneSelectionHandler(controller, actions, coordination)
  document.addEventListener('pointerdown', onScenePointerDown, true)

  handle.signal.addEventListener('abort', () => {
    stopController.unsubscribe()
    stopHistory()
    stopPersistence()
    document.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('pointerdown', onScenePointerDown, true)
    coordination.destroy()
    playerFacade.destroy()
  }, { once: true })

  return () => <div id="editor-app-layout" className="app-layout">
    <section id="editor-menu-region" className="app-region app-region--menu">
      <EditorMenuRegion
        controller={controller}
        actions={actions}
        persistence={persistence}
        scene={snapshot.context.scene}
        history={history}
      />
    </section>
    <section
      id="editor-scene-region"
      className="app-region app-region--scene"
    >
      <ScenePlayerRegion controller={controller} coordination={coordination} />
    </section>
    <section id="editor-decor-region" className="app-region app-region--panel">
      <DecorEditorRegion controller={controller} coordination={coordination} />
    </section>
    <section id="editor-timeline-region" className="app-region app-region--timeline">
      <SequenceEditorRegion controller={controller} coordination={coordination} />
    </section>
    <section id="editor-telco-region" className="app-region app-region--telco" />
  </div>
}
