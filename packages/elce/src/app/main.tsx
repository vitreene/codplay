import { createRoot } from 'react-dom/client'
import type { Actor } from 'xstate'
import { controllerMachine } from './controller/controller-machine'
import { AppLayout } from './layout/app-layout'
import type { AppLayoutSurface } from './layout/app-layout-types'
import type { EditorActionsFacade } from './facades/editor-actions-facade'
import { PopupPlayer } from './player/popup-player'
import { POPUP_PREVIEW_PAGE_PARAM, POPUP_PREVIEW_SESSION_PARAM } from './player/popup-preview-messages'

/** Mounts the existing React editor or popup player in a supplied host. */
export function mountElceEditor(
  container: HTMLElement,
  controller: Actor<typeof controllerMachine> | null,
  actions: EditorActionsFacade | null,
  options: Readonly<{ hideHeader?: boolean; surface?: AppLayoutSurface }> = {},
): () => void {
  const params = new URLSearchParams(window.location.search)
  const sessionId = params.get(POPUP_PREVIEW_SESSION_PARAM)
  const root = createRoot(container)

  if (sessionId !== null) {
    document.title = 'Elcé — lecture'
    root.render(<PopupPlayer sessionId={sessionId} startPageId={params.get(POPUP_PREVIEW_PAGE_PARAM)} />)
  } else {
    if (controller === null) throw new Error('La composition XState de l’éditeur n’a pas été fournie.')
    if (actions === null) throw new Error('La façade d’actions de l’éditeur n’a pas été fournie.')
    root.render(<AppLayout controller={controller} actions={actions} hideHeader={options.hideHeader} surface={options.surface} />)
  }

  return () => root.unmount()
}
