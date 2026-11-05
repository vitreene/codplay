import { createRemote, type Remote } from '@codplay/remote/remote'
import type { SightyRuntimeApi } from '@codplay/sighty'
import { ELCE_SCENARIO } from '../learning-reading-events'
import type { ElceSceneKey, ElceSlotName } from '../learning-scenario-types'

export type LearningPagePlayback = Readonly<Record<string, Readonly<{ autoStart: boolean }>>>

/** Mounts the shared remote in navigation for the selected narrated page only. */
export function bindLearningNavigationRemote(
  stage: HTMLElement,
  runtime: SightyRuntimeApi<ElceSceneKey, ElceSlotName>,
  playbackBySceneKey: LearningPagePlayback,
  onError: (message: string) => void,
): () => void {
  const element = stage.querySelector<HTMLElement>('#elce-navigation-remote')
  if (element === null) throw new Error('L’emplacement de la télécommande Elcé est absent.')
  const host = element
  let remote: Remote | undefined

  /** Releases the previous page's controls and their transport observations. */
  function clearRemote(): void {
    remote?.destroy()
    remote?.element.remove()
    remote = undefined
    host.hidden = true
  }

  /** Connects navigation directly to the admitted page's canonical telco. */
  function selectPage(sceneKey: ElceSceneKey | undefined): void {
    clearRemote()
    if (sceneKey === undefined) return
    const playback = playbackBySceneKey[sceneKey]
    if (playback === undefined) return
    const instance = runtime.getInstance(sceneKey)
    if (instance === undefined) throw new Error(`La page narrée ${sceneKey} n’est pas montée.`)
    if (!playback.autoStart) {
      void instance.telco.pause().catch((error: unknown) => onError(String(error)))
    }
    remote = createRemote({ telco: instance.telco, onError })
    remote.element.id = 'elce-navigation-remote-control'
    remote.element.querySelector('input')?.setAttribute('aria-label', 'Progression de la narration')
    host.append(remote.element)
    host.hidden = false
  }

  const unsubscribe = runtime.onSlotChange(ELCE_SCENARIO.CONTENT_SLOT, selectPage)
  selectPage(runtime.getMountedSceneKey(ELCE_SCENARIO.CONTENT_SLOT))
  return () => {
    unsubscribe()
    clearRemote()
  }
}
