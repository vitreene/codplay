import type { AvatarHeadApi } from './avatar3d-component'

type RenderTickInfo = { deltaMs: number }
type RenderSeekInfo = { nowMs: number; timelineMs: number }
type RenderAdapter = {
  tick(info: RenderTickInfo): void
  seek(info: RenderSeekInfo): void
  pause?(): void
  resume?(): void
  rateChange?(rate: number): void
  stop?(): void
}

/**
 * Internal TalkingHead morph target shape — accessed via duck typing.
 * Only the properties needed for snap are referenced.
 */
type THMorphTarget = {
  fixed: number | null
  value: number
  v: number
  applied: number
  needsUpdate: boolean
  min: number
  max: number
  ms: number[][]
  is: number[]
}

/**
 * Directly writes all viseme morph targets to their correct seek-position value,
 * bypassing TalkingHead's easing system.
 */
function snapVisemeMorphs(head: AvatarHeadApi): void {
  const internal = head as { mtAvatar?: Record<string, THMorphTarget> }
  if (!internal.mtAvatar) return
  for (const [key, mt] of Object.entries(internal.mtAvatar)) {
    if (!key.startsWith('viseme_')) continue
    if (mt.fixed === null) continue
    const clamped = Math.max(mt.min, Math.min(mt.max, mt.fixed))
    mt.value = mt.fixed
    mt.applied = clamped
    mt.v = 0
    mt.needsUpdate = false
    for (let i = 0; i < mt.ms.length; i++) {
      mt.ms[i][mt.is[i]] = clamped
    }
  }
}

export type TalkingHeadRenderAdapterDeps = {
  /** TalkingHead instance — must have been started in avatarOnly mode (head.start() called). */
  head: AvatarHeadApi & { animate(deltaMs: number): void }
  /** Three.js WebGLRenderer.render — called after each animate(). */
  render(): void
}

/**
 * RenderAdapter that couples TalkingHead (avatarOnly) and a Three.js renderer to CodPlay's ticker.
 *
 * tick  — head.animate(deltaMs), then render
 * seek  — snap viseme morphs directly to their fixed values, then render
 *
 * The adapter does not own the head or renderer — callers must manage their lifecycle.
 */
export function createTalkingHeadRenderAdapter(
  deps: TalkingHeadRenderAdapterDeps,
): RenderAdapter {
  return {
    tick({ deltaMs }) {
      deps.head.animate(deltaMs)
      deps.render()
    },
    seek() {
      snapVisemeMorphs(deps.head)
      deps.render()
    },
  }
}
