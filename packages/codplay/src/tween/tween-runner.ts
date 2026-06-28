import type { RenderAdapter, RenderSeekInfo, RenderTickInfo } from '../player/render-adapter-types'
import type { RuntimeComponent } from '../runtime/components/types'
import type { ContinuousAnimationEngine, ContinuousAnimationEngineTriggerInput } from '../animation/types'

export type TweenFn = (input: { progress: number; data?: Record<string, unknown> }) => Record<string, unknown> | undefined

export type TweenActionShape = {
  fn: TweenFn
  duration: number
  ease?: string
  ignoreDuration?: boolean
}

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
 * Drives `TweenAction` — a continuous interpolation engine for one action
 * triggered once, at the same level as the external animation library
 * (`ContinuousAnimationEngine`). Implements `RenderAdapter` so it receives
 * tick()/seek() from RenderSync for its own per-frame evaluation, independent
 * of the commit circuit.
 *
 * `TweenAction` never carries chaining or `move` — a heterogeneous list of
 * steps (`ActionSequence`) is a distinct, separate concern that decomposes
 * into individually-triggered ordinary actions through the normal commit
 * circuit; this engine only ever claims one `TweenAction` at a time.
 */
export class TweenRunner implements RenderAdapter, ContinuousAnimationEngine {
  readonly name = 'tween-action'

  private activeTweens: ActiveTween[] = []
  private readonly getComponent: (persoId: string) => RuntimeComponent | null

  constructor(getComponent: (persoId: string) => RuntimeComponent | null) {
    this.getComponent = getComponent
  }

  // -------------------------------------------------------------------------
  // ContinuousAnimationEngine interface
  // -------------------------------------------------------------------------

  /**
   * Claims one resolved action's payload when it is a `TweenAction` shape
   * (`fn`+`duration`). Never claims an array — a heterogeneous or homogeneous
   * list of steps is not this engine's concern (see `ActionSequence`).
   */
  claims(action: unknown): boolean {
    return isTweenAction(action)
  }

  /**
   * Registers one tween from its single trigger point. Called once, after
   * the resolved action has already gone through `beforeUpdate`/component
   * resolution/`afterUpdate` like any other action.
   */
  trigger(input: ContinuousAnimationEngineTriggerInput): void {
    const action = input.resolvedAction.action as unknown
    if (!isTweenAction(action)) {
      return
    }

    this.register({
      persoId: input.resolvedAction.listenerId,
      actionKey: input.resolvedAction.actionKey,
      eventId: input.resolvedAction.eventId,
      fn: action.fn,
      startMs: input.eventMs,
      duration: action.duration,
      ease: action.ease ?? 'linear',
      data: action as unknown as Record<string, unknown>,
    })
  }

  /**
   * Registers one active tween. Cancels any existing tween for the same
   * (persoId, actionKey) pair — a new trigger on the same key interrupts and
   * restarts (Cas 1 — interruption + remplacement).
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
   * Cancels the active tween, if any, registered under one exact
   * (persoId, actionKey) pair — a narrower cancellation than `cancelAll`,
   * used to retire a tween left active by a specific prior step (e.g. one
   * `ActionSequence` step explicitly closing out whatever the previous step
   * of the same chain may have left active, rather than waiting for a
   * global seek pass that may run out of chronological order).
   */
  cancelByActionKey(persoId: string, actionKey: string): void {
    this.activeTweens = this.activeTweens.filter(
      (t) => !(t.persoId === persoId && t.actionKey === actionKey),
    )
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
// Detection helpers
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

export function isTweenStopAction(value: unknown): value is 'stop' {
  return value === 'stop'
}
