/**
 * Avatar3DComponent — CodPlay RuntimeComponent for the 'avatar3d' perso type.
 *
 * Translates CodPlay action payloads to AvatarEngine + GazeService calls.
 * No TalkingHead dependency — driven entirely by CodPlay events.
 *
 * Supported actions (configure in perso.actions in the scene):
 *   avatar:viseme   { viseme: string | null }
 *   avatar:morph    { name: string, value: number, snap?: boolean }
 *   avatar:gesture  { gesture: string | null }
 *   avatar:gaze     { enabled: boolean }
 *   avatar:mood     { mood: string }
 *   broadcast       { type: 'STOP' }
 */
import type {
  RuntimeComponentClass,
  RuntimeComponentClassInput,
  RuntimeComponentUpdateInput,
} from 'codplay/runtime/components'
import type { AvatarEngine } from '@codplay/avatar-engine'
import type { GazeService } from '@codplay/avatar-engine'

// Mulberry32 seeded PRNG — kept local so gesture seek replay is deterministic without coupling.
function mulberry32(seed: number): () => number {
  let a = seed
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

const ALL_VISEMES = [
  'PP', 'FF', 'TH', 'DD', 'kk', 'CH', 'SS', 'nn', 'RR', 'aa', 'E', 'I', 'O', 'U',
] as const

export type Avatar3DComponentDeps = {
  canvas: HTMLCanvasElement
  engine: AvatarEngine
  gaze: GazeService
  visemeWeight?: number
}

export function createAvatar3DComponentClass(
  deps: Avatar3DComponentDeps,
): RuntimeComponentClass {
  const { engine, gaze, canvas } = deps
  const visemeWeight = deps.visemeWeight ?? 0.75

  // Cast is needed because TS cannot verify the class literal satisfies
  // RuntimeComponentClass — the structural check involves private module types.
  return class Avatar3DComponent {
    readonly modules: RuntimeComponentClassInput['modules']
    node: unknown = null

    constructor(input: RuntimeComponentClassInput) {
      this.modules = input.modules
    }

    render(): Node {
      this.node = canvas
      return canvas
    }

    _init(): void {
      this.node = this.render()
    }

    update({ action, eventSeq }: RuntimeComponentUpdateInput): void {
      // broadcast STOP — engine reset (mirrors media perso STOP)
      const broadcast = action['broadcast'] as { type?: string } | null | undefined
      if (broadcast?.type === 'STOP') {
        engine.prepareSeek()
        return
      }

      // avatar:viseme — snapFixed (instant, like TH newvalue channel)
      if ('viseme' in action) {
        const v = action['viseme']
        const active = typeof v === 'string' ? v : null
        if (active === null) {
          for (const name of ALL_VISEMES) {
            engine.morphEngine.setFixed('viseme_' + name, null)
          }
        } else {
          for (const name of ALL_VISEMES) {
            engine.morphEngine.snapFixed('viseme_' + name, name === active ? visemeWeight : 0)
          }
        }
        return
      }

      // avatar:morph — snap (instant) or setFixed (eased to target)
      if ('name' in action && 'value' in action) {
        const name  = action['name']  as string
        const value = action['value'] as number
        const snap  = action['snap']  as boolean | undefined
        if (snap) {
          engine.morphEngine.snapFixed(name, value)
        } else {
          engine.morphEngine.setFixed(name, value)
        }
        return
      }

      // avatar:gesture — eventSeq seeds PRNG → same resolved pose at seek replay
      if ('gesture' in action) {
        const name = action['gesture']
        if (typeof name === 'string') {
          engine.playGesture(name, { random: mulberry32(eventSeq) })
        } else {
          engine.releaseGesture()
        }
        return
      }

      // avatar:gaze — enable/disable per-frame geometric eye tracking
      if ('enabled' in action) {
        gaze.setEnabled(action['enabled'] === true)
        return
      }

      // avatar:mood
      if ('mood' in action && typeof action['mood'] === 'string') {
        engine.setMood(action['mood'] as Parameters<AvatarEngine['setMood']>[0])
        return
      }

      // avatar:head-drift — enable / disable the continuous TH sine-wave head drift
      if ('headDrift' in action) {
        engine.setHeadDriftEnabled(action['headDrift'] === true)
        return
      }

      // avatar:blink — triggers a single blink animation in the engine
      if ('blink' in action) {
        engine.triggerBlink()
        return
      }

      // avatar:breathe — triggers a single breath swell animation in the engine
      if ('breathe' in action) {
        engine.triggerBreath()
        return
      }
    }
  } as unknown as RuntimeComponentClass
}
