import type { SightyRuntimeApi } from '@codplay/sighty'
import { ELCE_EVENTS } from './learning-reading-events'
import type { ElceSceneKey, ElceSlotName } from './learning-scenario-types'

/** Binds mobile focus and accessibility semantics to the Learning menu scenes. */
export function bindLearningMenuDrawer(
  stage: HTMLElement,
  runtime: SightyRuntimeApi<ElceSceneKey, ElceSlotName>,
): () => void {
  const toggle = stage.querySelector<HTMLButtonElement>('.elce-player-menu-toggle')
  const close = stage.querySelector<HTMLButtonElement>('.elce-player-menu-close')
  const drawer = stage.querySelector<HTMLElement>('.elce-player-menu-drawer')
  const view = stage.ownerDocument.defaultView
  if (toggle === null || close === null || drawer === null || view === null) {
    throw new Error('Les commandes du sommaire Elcé sont absentes du player.')
  }

  const mobileViewport = typeof view.matchMedia === 'function'
    ? view.matchMedia('(max-width: 800px)')
    : undefined
  /** Reads the player breakpoint using the browser media-query circuit. */
  const isMobileViewport = (): boolean => mobileViewport?.matches ?? view.innerWidth <= 800

  /** Synchronizes dialog semantics without owning the animated state. */
  const setAccessibleState = (open: boolean, restoreFocus = false): void => {
    const mobile = isMobileViewport()
    toggle.setAttribute('aria-expanded', String(open && mobile))
    if (mobile) {
      drawer.setAttribute('role', 'dialog')
      drawer.setAttribute('aria-modal', 'true')
      drawer.setAttribute('aria-hidden', String(!open))
      if (open) drawer.removeAttribute('inert')
      else drawer.setAttribute('inert', '')
      if (open) view.requestAnimationFrame(() => close.focus())
      else if (restoreFocus) toggle.focus()
      return
    }
    drawer.removeAttribute('role')
    drawer.removeAttribute('aria-modal')
    drawer.setAttribute('aria-hidden', 'false')
    drawer.removeAttribute('inert')
  }

  /** Observes scene events only for focus and accessible state. */
  const handlePublicEvent = (event: Readonly<{ name: string }>): void => {
    if (event.name === ELCE_EVENTS.MENU_DRAWER_OPEN) {
      setAccessibleState(true)
      return
    }
    if (event.name === ELCE_EVENTS.MENU_DRAWER_CLOSE || event.name.startsWith(ELCE_EVENTS.MENU_PREFIX)) {
      view.requestAnimationFrame(() => setAccessibleState(false, true))
    }
  }

  /** Keeps keyboard focus inside the open mobile drawer. */
  const trapDrawerFocus = (event: KeyboardEvent): void => {
    if (!isMobileViewport() || drawer.getAttribute('aria-hidden') === 'true' || event.key !== 'Tab') return
    const focusable = Array.from(drawer.querySelectorAll<HTMLButtonElement>(
      '.elce-player-menu-close, .elce-player-menu__chapter-button, .elce-player-menu__page-button',
    )).filter((button) => !button.disabled)
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (first === undefined || last === undefined) return
    const active = stage.ownerDocument.activeElement
    if (event.shiftKey && (active === first || !drawer.contains(active))) {
      event.preventDefault()
      last.focus()
      return
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }

  let wasMobileViewport = isMobileViewport()
  /** Reconciles responsive accessibility when crossing the menu breakpoint. */
  const handleViewportChange = (): void => {
    const mobile = isMobileViewport()
    if (mobile === wasMobileViewport) return
    wasMobileViewport = mobile
    if (mobile) {
      setAccessibleState(false)
      drawer.setAttribute('data-open', 'false')
      return
    }
    void runtime.dispatch({ name: ELCE_EVENTS.MENU_DRAWER_CLOSE_REQUEST }).then(() => {
      setAccessibleState(false)
    })
  }

  setAccessibleState(false)
  const removePublicEventListener = runtime.events.onEvent(handlePublicEvent)
  drawer.addEventListener('keydown', trapDrawerFocus)
  if (mobileViewport === undefined) view.addEventListener('resize', handleViewportChange)
  else mobileViewport.addEventListener('change', handleViewportChange)

  /** Removes event, focus, and resize listeners during player teardown. */
  return () => {
    removePublicEventListener()
    drawer.removeEventListener('keydown', trapDrawerFocus)
    if (mobileViewport === undefined) view.removeEventListener('resize', handleViewportChange)
    else mobileViewport.removeEventListener('change', handleViewportChange)
    setAccessibleState(false)
  }
}
