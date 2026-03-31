import type { AnimationAdapter, AnimationHandle, TransitionRequest } from './types'

export type AnimeAnimationLike = {
  pause?: () => void
}

export type AnimeImplementation = (parameters: Record<string, unknown>) => AnimeAnimationLike | null | undefined

/**
 * Builds runtime animation parameters for one transition request.
 */
function toAnimeParameters(transition: TransitionRequest): Record<string, unknown> {
  const value = transition.from === undefined ? transition.to : [transition.from, transition.to]

  return {
    targets: transition.target,
    [transition.property]: value,
    duration: transition.duration,
    easing: transition.easing
  }
}

/**
 * Creates an animation adapter that bridges transition requests to Anime.js.
 */
export function createAnimationAdapter(animeImplementation: AnimeImplementation): AnimationAdapter {
  const activeHandles: AnimationHandle[] = []

  /**
   * Starts a batch of transitions and stores stoppable handles.
   */
  function run(transitions: TransitionRequest[]): AnimationHandle[] {
    const startedHandles: AnimationHandle[] = []

    for (const transition of transitions) {
      const animation = animeImplementation(toAnimeParameters(transition))
      if (animation === null || animation === undefined) {
        continue
      }

      const handle: AnimationHandle = {
        transitionId: transition.transitionId,
        target: transition.target,
        stop: () => {
          animation.pause?.()
        }
      }

      activeHandles.push(handle)
      startedHandles.push(handle)
    }

    return startedHandles
  }

  /**
   * Stops active animations either globally or for one specific target.
   */
  function stop(target?: unknown): void {
    for (const handle of [...activeHandles]) {
      if (target !== undefined && handle.target !== target) {
        continue
      }

      handle.stop()
      const index = activeHandles.indexOf(handle)
      if (index >= 0) {
        activeHandles.splice(index, 1)
      }
    }
  }

  return { run, stop }
}
