import type { Sighty } from '@codplay/sighty'
import { DEMO4_MENU_INTENTS, DEMO4_NAVIGATION_INTENTS } from '../demo4/messages'
import type { SightyViewTransitionSceneKey, SightyViewTransitionSlotName } from './scenario'

type ViewTransitionRuntime = Sighty<SightyViewTransitionSceneKey, SightyViewTransitionSlotName>['runtime']

const TRANSITION_TYPES: Readonly<Record<string, string>> = {
  [DEMO4_MENU_INTENTS.sceneA]: 'sighty-enter-a',
  [DEMO4_MENU_INTENTS.sceneB]: 'sighty-enter-b',
  [DEMO4_MENU_INTENTS.sceneC]: 'sighty-enter-c',
  [DEMO4_NAVIGATION_INTENTS.previous]: 'sighty-backward',
  [DEMO4_NAVIGATION_INTENTS.next]: 'sighty-forward',
}

const MENU_TARGET_SCENES: Readonly<Record<string, SightyViewTransitionSceneKey>> = {
  [DEMO4_MENU_INTENTS.sceneA]: 'scene-a',
  [DEMO4_MENU_INTENTS.sceneB]: 'scene-b',
  [DEMO4_MENU_INTENTS.sceneC]: 'scene-c',
}

/** Starts browser view transitions for page events and completes them at slot changes. */
export function connectViewTransitions(
  runtime: ViewTransitionRuntime,
  pageSlot: HTMLElement,
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void,
): () => void {
  const originalViewTransitionName = pageSlot.style.viewTransitionName
  pageSlot.style.viewTransitionName = 'sighty-vt-page'
  const pendingUpdates = new Set<() => void>()

  /** Releases every update callback waiting for the next committed page change. */
  const completePendingUpdates = () => {
    const updates = [...pendingUpdates]
    pendingUpdates.clear()
    updates.forEach((completeUpdate) => completeUpdate())
  }

  const removeSlotListener = runtime.onSlotChange('slot-scene', (sceneKey) => {
    if (pendingUpdates.size === 0) return
    onLog(`Transition → ${sceneKey ?? 'menu'}`)
    completePendingUpdates()
  })
  const removeEventListener = runtime.events.onEvent((event) => {
    const currentScene = runtime.getMountedSceneKey('slot-scene')
    const type = TRANSITION_TYPES[event.name]
    if (type === undefined || document.startViewTransition === undefined) return
    if (MENU_TARGET_SCENES[event.name] === currentScene) return
    if (event.name === DEMO4_NAVIGATION_INTENTS.previous && currentScene === 'scene-intro') return
    if (event.name === DEMO4_NAVIGATION_INTENTS.next && currentScene === 'scene-c') return
    if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const update = new Promise<void>((resolve) => {
      pendingUpdates.add(resolve)
    })
    document.startViewTransition({ update: () => update, types: [type] })
  })

  return () => {
    removeEventListener()
    removeSlotListener()
    completePendingUpdates()
    pageSlot.style.viewTransitionName = originalViewTransitionName
  }
}
