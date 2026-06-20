/**
 * Avatar3DComponent — CodPlay RuntimeComponent for the 'avatar3d' perso type.
 *
 * Translates CodPlay action payloads to AvatarEngine + GazeService calls.
 * No TalkingHead dependency — driven entirely by CodPlay events.
 *
 * Supported actions (configure in perso.actions in the scene):
 *   avatar:viseme  { viseme: string | null }
 *   avatar:morph   { name: string, value: number, snap?: boolean }
 *   avatar:gesture { gesture: string | null }
 *   avatar:gaze    { enabled: boolean }
 *   avatar:mood    { mood: string }
 *   avatar:breathe { breathe: true }
 *   broadcast      { type: 'STOP' }
 *
 * Head drift and blink are driven by avatar:morph events from the idle strap —
 * their calculations live in avatar3d-straps.ts, not here.
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

type ActionHandler = (action: Record<string, unknown>, eventSeq: number) => void

/** Builds the action dispatch table. Each entry: [discriminant key, handler]. */
function buildActionHandlers(
  engine: AvatarEngine,
  gaze: GazeService,
  visemeWeight: number,
): [string, ActionHandler][] {
  return [
    ['broadcast', (action) => {
      if ((action['broadcast'] as { type?: string } | null | undefined)?.type === 'STOP') {
        engine.prepareSeek()
      }
    }],

    ['viseme', (action) => {
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
    }],

    // avatar:morph — keyed on 'name'; handler also requires 'value' key
    ['name', (action) => {
      if (!('value' in action)) return
      const name  = action['name']  as string
      const value = action['value'] as number
      const snap  = action['snap']  as boolean | undefined
      if (snap) engine.morphEngine.snapFixed(name, value)
      else      engine.morphEngine.setFixed(name, value)
    }],

    ['gesture', (action, eventSeq) => {
      const name = action['gesture']
      if (typeof name === 'string') {
        engine.playGesture(name, { random: mulberry32(eventSeq) })
      } else {
        engine.releaseGesture()
      }
    }],

    ['enabled', (action) => {
      gaze.setEnabled(action['enabled'] === true)
    }],

    ['mood', (action) => {
      if (typeof action['mood'] !== 'string') return
      engine.setMood(action['mood'] as Parameters<AvatarEngine['setMood']>[0])
    }],

    // avatar:head-drift — registers the sine-wave fn with the engine on a single event.
    // The fn (the calculation) lives here; the engine calls it every animate() tick.
    ['headDrift', (action) => {
      if (action['headDrift'] === true) {
        engine.setHeadDriftFn(({ elapsed }) => {
          const hx = Math.sin(elapsed * 0.00032) * 0.10 + Math.sin(elapsed * 0.00071) * 0.04
          const hy = Math.sin(elapsed * 0.00051) * 0.14 + Math.sin(elapsed * 0.00087) * 0.06
          return { headRotateX: hx, headRotateY: hy }
        })
      } else {
        engine.setHeadDriftFn(null)
      }
    }],

    // avatar:blink — registers the epoch-detection + close/hold/open fn on a single event.
    // Stateful via closure: epoch state and blink progress live inside the fn.
    ['blink', (action) => {
      if (action['blink'] !== true) { engine.setBlinkScheduleFn(null); return }
      engine.setBlinkScheduleFn((() => {
        const BLINK_PERIOD  = 4500
        const CLOSE_MS = 80, HOLD_MS = 80, OPEN_MS = 150
        const TOTAL_MS = CLOSE_MS + HOLD_MS + OPEN_MS
        let lastEpoch = -1
        let blinkStart = -1
        return ({ elapsed }) => {
          if (blinkStart < 0) {
            const epochIdx = Math.floor(elapsed / BLINK_PERIOD)
            if (epochIdx > lastEpoch) {
              const tInEpoch = elapsed - epochIdx * BLINK_PERIOD
              const rng = mulberry32(0xdeadbeef ^ (epochIdx * 0x9e3779b9))
              const offset = BLINK_PERIOD * (0.20 + rng() * 0.55)
              if (tInEpoch >= offset) { lastEpoch = epochIdx; blinkStart = elapsed }
            }
          }
          if (blinkStart < 0) return null
          const t = elapsed - blinkStart
          if (t < CLOSE_MS)               return { eyesClosed: t / CLOSE_MS }
          if (t < CLOSE_MS + HOLD_MS)     return { eyesClosed: 1 }
          if (t < TOTAL_MS)               return { eyesClosed: 1 - (t - CLOSE_MS - HOLD_MS) / OPEN_MS }
          blinkStart = -1
          return { eyesClosed: 0 }
        }
      })())
    }],

    // avatar:breathe — registers the epoch-detection fn; BreathAnimator handles the curve.
    ['breathe', (action) => {
      if (action['breathe'] !== true) { engine.setBreathTriggerFn(null); return }
      engine.setBreathTriggerFn((() => {
        const BREATH_PERIOD = 4000
        let lastEpoch = -1
        return ({ elapsed }) => {
          const epochIdx = Math.floor(elapsed / BREATH_PERIOD)
          if (epochIdx <= lastEpoch) return null
          const tInEpoch = elapsed - epochIdx * BREATH_PERIOD
          const rng = mulberry32((0xdeadbeef ^ 0x12345678) ^ (epochIdx * 0x9e3779b9))
          const offset = BREATH_PERIOD * (0.10 + rng() * 0.50)
          if (tInEpoch >= offset) { lastEpoch = epochIdx; return { triggerBreath: true } }
          return null
        }
      })())
    }],
  ]
}

export function createAvatar3DComponentClass(
  deps: Avatar3DComponentDeps,
): RuntimeComponentClass {
  const { engine, gaze, canvas } = deps
  const visemeWeight = deps.visemeWeight ?? 0.75
  const actionHandlers = buildActionHandlers(engine, gaze, visemeWeight)

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
      for (const [key, handler] of actionHandlers) {
        if (key in action) {
          handler(action, eventSeq)
          return
        }
      }
    }
  } as unknown as RuntimeComponentClass
}
