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

const TIMELINE_HEIGHT_PREFERENCE_KEY = 'editor.timeline-height'
const MIN_SCENE_HEIGHT = 200
const MIN_TIMELINE_HEIGHT = 160

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

  const savedTimelineHeight = window.localStorage.getItem(TIMELINE_HEIGHT_PREFERENCE_KEY)
  let preferredTimelineHeight = savedTimelineHeight === null ? null : Number(savedTimelineHeight)
  if (preferredTimelineHeight !== null && (!Number.isFinite(preferredTimelineHeight) || preferredTimelineHeight <= 0)) {
    preferredTimelineHeight = null
  }
  let timelineResizeStart: { pointerId: number; y: number; height: number; handle: HTMLElement } | null = null
  let timelineSyncFrame: number | null = null
  let timelineResizeObserver: ResizeObserver | null = null

  /** Computes the space left after the ratio-constrained scene and clamps a track height. */
  const timelineHeightBounds = (layout: HTMLElement, scene: HTMLElement, resizer: HTMLElement, telco: HTMLElement) => {
    const availableHeight = layout.clientHeight - resizer.offsetHeight - telco.offsetHeight
    const maximum = Math.max(MIN_TIMELINE_HEIGHT, availableHeight - MIN_SCENE_HEIGHT)
    const aspectRatio = getComputedStyle(scene.firstElementChild ?? scene).aspectRatio
    const [aspectWidth, aspectHeight] = aspectRatio.split('/').map(Number.parseFloat)
    const sceneRatio = Number.isFinite(aspectWidth) && Number.isFinite(aspectHeight) && aspectHeight !== 0
      ? aspectWidth / aspectHeight
      : 16 / 9
    const sceneHeightAtAvailableWidth = (scene.clientWidth - 2) / sceneRatio
    const automaticHeight = availableHeight - sceneHeightAtAvailableWidth
    return { maximum, automaticHeight }
  }

  /** Applies one track height and keeps the separator's accessibility range in sync. */
  const setTimelineHeight = (requestedHeight: number, persist: boolean): void => {
    const layout = document.getElementById('editor-app-layout')
    const scene = document.getElementById('editor-scene-region')
    const resizer = document.getElementById('editor-timeline-resizer')
    const telco = document.getElementById('editor-telco-region')
    if (!(layout instanceof HTMLElement) || !(scene instanceof HTMLElement)
      || !(resizer instanceof HTMLElement) || !(telco instanceof HTMLElement)) return
    const bounds = timelineHeightBounds(layout, scene, resizer, telco)
    const height = Math.round(Math.max(MIN_TIMELINE_HEIGHT, Math.min(bounds.maximum, requestedHeight)))
    layout.style.setProperty('--app-timeline-height', `${height}px`)
    resizer.setAttribute('aria-valuemin', String(MIN_TIMELINE_HEIGHT))
    resizer.setAttribute('aria-valuemax', String(Math.round(bounds.maximum)))
    resizer.setAttribute('aria-valuenow', String(height))
    if (persist) {
      preferredTimelineHeight = height
      window.localStorage.setItem(TIMELINE_HEIGHT_PREFERENCE_KEY, String(height))
    }
  }

  /** Rebalances the scene and timeline when the page or its aspect-ratio player changes size. */
  const syncTimelineLayout = (): void => {
    timelineSyncFrame = null
    const layout = document.getElementById('editor-app-layout')
    const scene = document.getElementById('editor-scene-region')
    const resizer = document.getElementById('editor-timeline-resizer')
    const telco = document.getElementById('editor-telco-region')
    if (!(layout instanceof HTMLElement) || !(scene instanceof HTMLElement)
      || !(resizer instanceof HTMLElement) || !(telco instanceof HTMLElement)) return
    const bounds = timelineHeightBounds(layout, scene, resizer, telco)
    setTimelineHeight(preferredTimelineHeight ?? bounds.automaticHeight, false)
  }

  /** Coalesces layout observations into one page-frame update. */
  const scheduleTimelineLayout = (): void => {
    if (timelineSyncFrame !== null) return
    timelineSyncFrame = window.requestAnimationFrame(syncTimelineLayout)
  }

  /** Starts a drag on the dedicated separator without entering document command history. */
  const onTimelineResizePointerDown = (event: PointerEvent): void => {
    const target = event.target
    if (!(target instanceof HTMLElement) || target.id !== 'editor-timeline-resizer') return
    const timeline = document.getElementById('editor-timeline-region')
    if (!(timeline instanceof HTMLElement)) return
    event.preventDefault()
    timelineResizeStart = {
      pointerId: event.pointerId,
      y: event.clientY,
      height: timeline.getBoundingClientRect().height,
      handle: target,
    }
    target.setPointerCapture(event.pointerId)
    document.getElementById('editor-app-layout')?.classList.add('app-layout--resizing-timeline')
  }

  /** Updates the track area during an active separator drag. */
  const onTimelineResizePointerMove = (event: PointerEvent): void => {
    const start = timelineResizeStart
    if (start === null || start.pointerId !== event.pointerId) return
    event.preventDefault()
    preferredTimelineHeight = start.height - (event.clientY - start.y)
    setTimelineHeight(preferredTimelineHeight, false)
  }

  /** Persists the selected track height when a pointer drag ends. */
  const onTimelineResizePointerUp = (event: PointerEvent): void => {
    const start = timelineResizeStart
    if (start === null || start.pointerId !== event.pointerId) return
    const timeline = document.getElementById('editor-timeline-region')
    if (timeline instanceof HTMLElement) setTimelineHeight(timeline.getBoundingClientRect().height, true)
    timelineResizeStart = null
    document.getElementById('editor-app-layout')?.classList.remove('app-layout--resizing-timeline')
  }

  const startTimelineLayoutObserver = (): void => {
    syncTimelineLayout()
    const layout = document.getElementById('editor-app-layout')
    const player = document.querySelector<HTMLElement>('.app-region-content--scene-player')
    if (layout === null) return
    timelineResizeObserver = new ResizeObserver(scheduleTimelineLayout)
    timelineResizeObserver.observe(layout)
    if (player !== null) timelineResizeObserver.observe(player)
  }
  const timelineObserverFrame = window.requestAnimationFrame(startTimelineLayoutObserver)
  document.addEventListener('pointerdown', onTimelineResizePointerDown, true)
  document.addEventListener('pointermove', onTimelineResizePointerMove, true)
  document.addEventListener('pointerup', onTimelineResizePointerUp, true)
  document.addEventListener('pointercancel', onTimelineResizePointerUp, true)

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
    document.removeEventListener('pointerdown', onTimelineResizePointerDown, true)
    document.removeEventListener('pointermove', onTimelineResizePointerMove, true)
    document.removeEventListener('pointerup', onTimelineResizePointerUp, true)
    document.removeEventListener('pointercancel', onTimelineResizePointerUp, true)
    document.removeEventListener('pointerdown', onScenePointerDown, true)
    window.cancelAnimationFrame(timelineObserverFrame)
    if (timelineSyncFrame !== null) window.cancelAnimationFrame(timelineSyncFrame)
    timelineResizeObserver?.disconnect()
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
      <DecorEditorRegion controller={controller} coordination={coordination} actions={actions} />
    </section>
    <div
      id="editor-timeline-resizer"
      className="app-timeline-resizer"
      role="separator"
      aria-label="Redimensionner l’éditeur de pistes"
      aria-orientation="horizontal"
      aria-valuemin={MIN_TIMELINE_HEIGHT}
      aria-valuenow={MIN_TIMELINE_HEIGHT}
      tabIndex={-1}
    />
    <section id="editor-timeline-region" className="app-region app-region--timeline">
      <SequenceEditorRegion controller={controller} coordination={coordination} />
    </section>
    <section id="editor-telco-region" className="app-region app-region--telco" />
  </div>
}
