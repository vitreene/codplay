import { createAnimationAdapter, type AnimeImplementation } from './adapter'
import type { TransitionRequest } from './types'

/**
 * `2026-07-25-perso-state-at-t-plan.md` §4.2/§5 — captures the resolved state of every perso
 * currently animated, in the PERSO's own unit (raw `from`/`to`, e.g. `cqw`, never resolved to px)
 * — never read from the DOM node, never read from anime.js's cache tied to the real node.
 *
 * Builds one mirror `TransitionRequest` per active transition (same `from`/`to`/`duration`/
 * `easing`/timing, `target` replaced by a fresh plain object instead of the real node), runs them
 * through a dedicated, EPHEMERAL `AnimationAdapter` instance (never the real one — this never
 * touches the real node or the real active animations), seeks that ephemeral adapter to
 * `timelineMs`, then reads the resulting values off the mirror objects.
 *
 * `target instanceof Element` is false for a plain object, so `resolveTransitionValue`
 * (`adapter.ts`) never converts the value — the mirror ends up holding the perso's native unit,
 * exactly as it was authored, guaranteed conform to the real interpolation since it is produced by
 * the SAME anime.js engine with the SAME parameters (only the target and the absence of DOM
 * resolution differ).
 */
export function capturePersoStatesMirror(
  activeTransitions: readonly TransitionRequest[],
  eventMsByEventId: ReadonlyMap<string, number>,
  timelineMs: number,
  animeImplementation: AnimeImplementation,
): Map<string, Record<string, unknown>> {
  const statesByPersoId = new Map<string, Record<string, unknown>>()
  if (activeTransitions.length === 0) {
    return statesByPersoId
  }

  const mirrorByPersoId = new Map<string, Record<string, unknown>>()
  const mirrorTransitions: TransitionRequest[] = []

  for (const transition of activeTransitions) {
    let mirror = mirrorByPersoId.get(transition.listenerId)
    if (mirror === undefined) {
      mirror = {}
      mirrorByPersoId.set(transition.listenerId, mirror)
    }
    mirrorTransitions.push({ ...transition, target: mirror })
  }

  const mirrorAdapter = createAnimationAdapter(animeImplementation)
  mirrorAdapter.run(mirrorTransitions)
  mirrorAdapter.seek?.(timelineMs, eventMsByEventId)

  // Read BEFORE stop(): `stop()` calls `animation.revert()` on each active animation, which
  // snaps every affected value back to its state from BEFORE the animation ever started — the
  // mirror object would lose the very value this function exists to capture.
  for (const [persoId, mirror] of mirrorByPersoId) {
    statesByPersoId.set(persoId, { ...mirror })
  }

  mirrorAdapter.stop()

  return statesByPersoId
}
