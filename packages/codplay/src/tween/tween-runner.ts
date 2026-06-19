import type { RenderAdapter, RenderSeekInfo, RenderTickInfo } from '../player/render-adapter-types'
import type { RuntimeComponent } from '../runtime/components/types'

export type TweenFn = (input: { progress: number; data?: Record<string, unknown> }) => Record<string, unknown> | undefined

export type TweenActionShape = {
  fn: TweenFn
  duration: number
  ease?: string
  ignoreDuration?: boolean
  startAt?: number
}

export type TweenSequenceShape = TweenActionShape[]

type ActiveTween = {
  persoId: string
  actionKey: string
  eventId: string
  fn: TweenFn
  startMs: number
  duration: number
  ease: string
  data?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Easing registry (subset — covers most authoring needs)
// ---------------------------------------------------------------------------

type EasingFn = (t: number) => number

const EASINGS: Record<string, EasingFn> = {
  linear: (t) => t,
  ease: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  'easeIn': (t) => t * t,
  'easeOut': (t) => t * (2 - t),
  'easeInOut': (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  'easeInQuad': (t) => t * t,
  'easeOutQuad': (t) => t * (2 - t),
  'easeInOutQuad': (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  'easeInCubic': (t) => t * t * t,
  'easeOutCubic': (t) => (--t) * t * t + 1,
  'easeInOutCubic': (t) => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  'easeInQuart': (t) => t * t * t * t,
  'easeOutQuart': (t) => 1 - (--t) * t * t * t,
  'easeInOutQuart': (t) => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
  'easeInExpo': (t) => t === 0 ? 0 : Math.pow(2, 10 * t - 10),
  'easeOutExpo': (t) => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  'easeInOutExpo': (t) => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  'easeInSine': (t) => 1 - Math.cos((t * Math.PI) / 2),
  'easeOutSine': (t) => Math.sin((t * Math.PI) / 2),
  'easeInOutSine': (t) => -(Math.cos(Math.PI * t) - 1) / 2,
}

function applyEasing(ease: string, t: number): number {
  const fn = EASINGS[ease]
  if (!fn) {
    console.warn(`[TweenRunner] Unknown easing "${ease}", falling back to "linear"`)
    return t
  }
  return fn(t)
}

// ---------------------------------------------------------------------------
// TweenRunner
// ---------------------------------------------------------------------------

/**
 * Manages active TweenActions. Implements RenderAdapter so it receives
 * tick() and seek() from RenderSync without modifying the core player loop.
 *
 * Registration happens in PlayerFacade.runTimelineEvent() when a TweenAction
 * or TweenSequence is detected in the resolved action payload.
 */
export class TweenRunner implements RenderAdapter {
  private activeTweens: ActiveTween[] = []
  private readonly getComponent: (persoId: string) => RuntimeComponent | null

  constructor(getComponent: (persoId: string) => RuntimeComponent | null) {
    this.getComponent = getComponent
  }

  /**
   * Registers one tween step. Cancels any existing step for the same
   * (persoId, actionKey) pair — new event on same key interrupts.
   */
  register(tween: ActiveTween): void {
    this.activeTweens = this.activeTweens.filter(
      (t) => !(t.persoId === tween.persoId && t.actionKey === tween.actionKey),
    )
    this.activeTweens.push(tween)
  }

  /**
   * Cancels all active tweens for one perso (tween:stop action).
   */
  cancelAll(persoId: string): void {
    this.activeTweens = this.activeTweens.filter((t) => t.persoId !== persoId)
  }

  /**
   * Clears all active tweens. Called at seek start before track replay.
   */
  resetActiveTweens(): void {
    this.activeTweens = []
  }

  // -------------------------------------------------------------------------
  // RenderAdapter interface
  // -------------------------------------------------------------------------

  tick(info: RenderTickInfo): void {
    this.evaluateAt(info.timelineMs, false)
  }

  seek(info: RenderSeekInfo): void {
    // One-shot evaluation at the target position.
    // Keep all tweens registered (active past the target still need their
    // final value applied if targetMs >= startMs + duration).
    this.evaluateAt(info.timelineMs, true)
  }

  stop(): void {
    this.activeTweens = []
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  private evaluateAt(timelineMs: number, isSeek: boolean): void {
    const stillActive: ActiveTween[] = []

    for (const tween of this.activeTweens) {
      // Tween hasn't started yet at this position
      if (timelineMs < tween.startMs) {
        stillActive.push(tween)
        continue
      }

      const rawProgress = Math.min(1, (timelineMs - tween.startMs) / tween.duration)
      const progress = applyEasing(tween.ease, rawProgress)

      const output = tween.fn({ progress, data: tween.data })
      if (output && Object.keys(output).length > 0) {
        const component = this.getComponent(tween.persoId)
        component?.update({
          persoId: tween.persoId,
          eventId: tween.eventId,
          eventSeq: 0,
          action: output,
        })
      }

      if (rawProgress < 1) {
        stillActive.push(tween)
      }
      // rawProgress === 1 → tween completed, drop from active list
    }

    if (!isSeek) {
      this.activeTweens = stillActive
    }
  }
}

// ---------------------------------------------------------------------------
// Detection helpers (used in PlayerFacade)
// ---------------------------------------------------------------------------

export function isTweenAction(value: unknown): value is TweenActionShape {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Record<string, unknown>)['fn'] === 'function' &&
    typeof (value as Record<string, unknown>)['duration'] === 'number' &&
    ((value as Record<string, unknown>)['duration'] as number) > 0
  )
}

export function isTweenSequence(value: unknown): value is TweenSequenceShape {
  return Array.isArray(value) && value.length > 0 && isTweenAction(value[0])
}

export function isTweenStopAction(value: unknown): value is 'stop' {
  return value === 'stop'
}

/**
 * Expands one TweenAction or TweenSequence into a flat list of ActiveTween
 * entries with absolute startMs computed from the triggering event timestamp.
 */
export function expandTweenToActiveSteps(input: {
  action: TweenActionShape | TweenSequenceShape
  persoId: string
  actionKey: string
  eventId: string
  eventMs: number
  data?: Record<string, unknown>
}): ActiveTween[] {
  const { action, persoId, actionKey, eventId, eventMs, data } = input
  const steps: TweenActionShape[] = isTweenSequence(action) ? action : [action as TweenActionShape]

  const result: ActiveTween[] = []
  let chainMs = 0

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]!
    const stepStartAt = step.startAt !== undefined ? step.startAt : chainMs
    result.push({
      persoId,
      actionKey: i === 0 ? actionKey : `${actionKey}:${i}`,
      eventId: `${eventId}:tween:${i}`,
      fn: step.fn,
      startMs: eventMs + stepStartAt,
      duration: step.duration,
      ease: step.ease ?? 'linear',
      data,
    })
    chainMs = stepStartAt + step.duration
  }

  return result
}
