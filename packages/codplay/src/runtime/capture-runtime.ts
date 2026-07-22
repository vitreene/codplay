import type {
  CaptureDeclaration,
  CaptureSample,
  CaptureState,
  CaptureTickResult,
  KeyboardCaptureSample,
  PointerCaptureSample
} from './capture-types'
import type { RuntimeEmitEvent } from './types'

export type CaptureRuntimeInput = {
  capture: CaptureDeclaration
  persoId: string
  storyId: string
  /** Name of the triggering `emit` event (`action.event.name`) — carried into `meta.originEventName`, never read for routing. */
  originEventName: string
  emitRuntimeEvent: (event: RuntimeEmitEvent) => void
  /**
   * Subscribes to the playback ticker for delivery of `trackCommand`'s
   * result. Capture is the emitter only — it never applies its own output;
   * the returned unsubscribe is called at `endOn`. The ticker polls every
   * subscriber once per frame and channels the result through the
   * renderer's single render cycle (`PlayerFacade.applyCaptureTickActions`)
   * — never `director`/`dispatchEvents`/track. `persoId` travels through the
   * subscription itself (known once, at capture start), never through the
   * per-tick data. See `v1-capture-spec.md` regle 5.
   */
  subscribeCaptureTick?: (persoId: string, fn: () => CaptureTickResult | void) => () => void
  /**
   * Reads the current story state, read-only — used by `initCaptureState`
   * when `capture.stateScope` is absent or `'story'` (the default). Wired by
   * `PlayerFacade` onto the same `story.state` object `Player` (`player.ts`)
   * mutates via `resolveStateTarget`: confirmed 2026-07-21 that
   * `Player.currentScene` and `PlayerFacade.scene` are the SAME object in
   * memory (`normalizeSceneDef` mutates in place, never copies — see
   * `builder/scene-normalization.ts`), so this never risks reading a stale
   * or diverged `state`.
   */
  getStoryState?: (storyId: string) => Readonly<Record<string, unknown>>
  /** Reads the current scene state, read-only — used when `capture.stateScope === 'scene'`. */
  getSceneState?: () => Readonly<Record<string, unknown>>
  /**
   * Merges `trackCommand`'s `updateState` into the mutable `state` object at
   * the given scope — the same scope `stateScope` already resolves for
   * reading. Never materialized, never replayed at seek (see
   * `v1-capture-spec.md`, "Phase de tracking").
   */
  applyStateUpdate?: (scope: 'scene' | 'story', storyId: string, update: Record<string, unknown>) => void
  getCurrentTimelineMs?: () => number
  /**
   * Advances keyboard sampling once per playback frame — distinct from
   * `subscribeCaptureTick` (delivery) to keep the two roles separate: this
   * one produces a `KeyboardCaptureSample` and runs `trackCommand`, the
   * other only polls the last produced `CaptureTickResult`. Both fire within the
   * same synchronous `runPlaybackTick` frame (`create-player.ts`), in that
   * order, so there is no cross-frame delay between sampling and delivery.
   */
  subscribeJitTick?: (listener: (deltaMs: number) => void) => () => void
  /** Native keyboard code for a keyboard-driven capture; absent for pointer captures. */
  keyCode?: string
  /** The triggering `keydown` — its modifier keys are read at every tick (see `buildKeyboardSample`). Required when `keyCode` is set. */
  triggerKeyboardEvent?: KeyboardEvent
  /**
   * Releases whatever persistent `CaptureUpdate` handles the ticker created
   * for this capture's persoId, called once at `endOn`. `capture-runtime.ts`
   * never knows the target node or which `style` properties were used — only
   * `PlayerFacade` (which resolved them frame by frame) can release them.
   */
  releaseCaptureUpdates?: (persoId: string) => void
}

const DEFAULT_TRACK_ON = ['pointermove']
const DEFAULT_END_ON = ['pointerup']
const DEFAULT_DURATION_MS = 200

/**
 * Builds one pointer `CaptureSample` from a native `PointerEvent`.
 * `movementX`/`movementY` are the browser's own delta since the last
 * `pointermove` (`MouseEvent.movementX/Y`) — never computed here, per
 * `v1-capture-spec.md`'s `PointerCaptureSample` contract.
 */
function buildPointerSample(event: PointerEvent): PointerCaptureSample {
  return {
    clientX: event.clientX,
    clientY: event.clientY,
    movementX: event.movementX,
    movementY: event.movementY
  }
}

/**
 * Builds one keyboard `CaptureSample` for the current tick. `deltaMs`/
 * `elapsedMs` come from the player's tick, never from `KeyboardEvent` — the
 * keyboard has no native continuous value between `keydown` and `keyup`.
 * Modifier keys are read from the triggering `KeyboardEvent`, since no new
 * native event fires while a key is held.
 */
function buildKeyboardSample(
  triggerEvent: KeyboardEvent,
  keyCode: string,
  deltaMs: number,
  elapsedMs: number
): KeyboardCaptureSample {
  return {
    keyCode,
    deltaMs,
    elapsedMs,
    altKey: triggerEvent.altKey,
    shiftKey: triggerEvent.shiftKey,
    ctrlKey: triggerEvent.ctrlKey,
    metaKey: triggerEvent.metaKey
  }
}

/**
 * Patches every transition-shaped `style` entry (`{ to, ... }`) missing a
 * `duration` with the resolved capture duration — the automatic propagation
 * promised by `durationMode: 'default' | 'capture'` in `v1-capture-spec.md`.
 * A `duration` already authored on a given entry is left untouched.
 */
function propagateDuration(
  data: Record<string, unknown> | undefined,
  duration: number
): Record<string, unknown> | undefined {
  const style = data?.style
  if (typeof style !== 'object' || style === null) {
    return data
  }

  const patchedStyle: Record<string, unknown> = {}
  for (const [property, rawValue] of Object.entries(style)) {
    const isTransitionMissingDuration =
      typeof rawValue === 'object' && rawValue !== null && 'to' in rawValue && !('duration' in rawValue)
    patchedStyle[property] = isTransitionMissingDuration ? { ...rawValue, duration } : rawValue
  }

  return { ...data, style: patchedStyle }
}

/**
 * Starts one capture cycle, unified across native pointer and keyboard
 * sources (`v1-capture-spec.md`). Owns the tracking loop (`trackOn` →
 * `CaptureSample` → `trackCommand`) and the closing phase (`endOn` →
 * `endCapture`/`endEmit`), but never touches `state`, tracks, or nodes
 * directly, and never applies a visual mutation itself: `trackCommand`'s
 * resolved `CaptureTickResult` is only ever handed to the playback ticker via
 * `subscribeCaptureTick` — capture is the emitter, the ticker channels
 * delivery to the renderer's single render cycle. Every `event` this
 * function emits (`endCapture`/`endEmit`) goes through the same
 * `emitRuntimeEvent` pipeline used by ordinary user events.
 *
 * Returns a cleanup function that removes all installed listeners immediately.
 */
export function startCapture(input: CaptureRuntimeInput): () => void {
  const {
    capture,
    persoId,
    storyId,
    originEventName,
    emitRuntimeEvent,
    subscribeCaptureTick,
    getStoryState,
    getSceneState,
    getCurrentTimelineMs,
    subscribeJitTick,
    keyCode,
    triggerKeyboardEvent,
    releaseCaptureUpdates,
    applyStateUpdate
  } = input
  const isKeyboardCapture = keyCode !== undefined
  const trackOn = capture.trackOn ?? (isKeyboardCapture ? [] : DEFAULT_TRACK_ON)
  const endOn = capture.endOn ?? DEFAULT_END_ON

  /**
   * Resolves the `state` read by `initCaptureState`/`endCapture`, fixed once
   * for the whole capture by `capture.stateScope` (default `'story'`) — see
   * `v1-capture-spec.md` regle 1.
   */
  function resolveCaptureState(): Readonly<Record<string, unknown>> {
    return capture.stateScope === 'scene'
      ? getSceneState?.() ?? {}
      : getStoryState?.(storyId) ?? {}
  }

  let ended = false
  const samples: CaptureSample[] = []
  const initResult = capture.initCaptureState
    ? capture.initCaptureState({ state: resolveCaptureState() })
    : {}
  if (initResult === false) {
    // Guard applied once, at opening — no `trackOn`/`endOn` listener is ever
    // installed, no cycle started. Not a rejection after the fact on an
    // already-applied commit (see `v1-capture-spec.md`).
    return () => {}
  }
  let captureState: CaptureState = initResult

  const startedAtMs = getCurrentTimelineMs?.() ?? 0
  let keyboardElapsedMs = 0
  let unsubscribeKeyboardTick: (() => void) | null = null
  let unsubscribeCaptureTick: (() => void) | null = null
  let pendingResult: CaptureTickResult | undefined
  /**
   * Accumulator for the default 1:1 pointer follow (no `trackCommand`
   * authored, non-dnd capture only) — `movementX`/`movementY` deltas, same
   * convention `style.x`/`y` already uses everywhere else (a transform
   * offset relative to the node's own layout position, never a raw
   * viewport-absolute coordinate).
   */
  let defaultOffset = { x: 0, y: 0 }

  /**
   * Runs `trackCommand` for one produced `CaptureSample`, then stores the
   * resolved `CaptureTickResult` for the next `subscribeCaptureTick` poll —
   * never applied here, never materialized, never a `StoryEvent`. The
   * `action` path (hand-built `CaptureAction`) is the legacy, unchanged
   * catalog-by-name channel; otherwise `position`/`dnd` are resolved
   * directly, `position` falling back to a 1:1 pointer follow when the
   * author wrote no `trackCommand` at all, and `dnd` only produced when
   * `captureState.dropIn` (the guard's output) is present.
   */
  function runTrackCommand(sample: CaptureSample): void {
    samples.push(sample)

    const output = capture.trackCommand?.({ sample, samples, captureState })
    if (output?.captureState !== undefined) {
      captureState = output.captureState
    }
    if (output?.updateState !== undefined) {
      applyStateUpdate?.(capture.stateScope ?? 'story', storyId, output.updateState)
    }

    if (output?.action !== undefined) {
      pendingResult = { action: output.action }
      return
    }

    const isPointerSample = 'clientX' in sample
    const dropIn = (captureState as { dropIn?: unknown }).dropIn
    const isDndCapture = Array.isArray(dropIn) && isPointerSample

    // `endEmit`'s data falls back to `captureState` when the author declares
    // no `endEmit.data` (the normal case) — `clientX`/`clientY` must live
    // here, not only in `pendingResult.dnd`, or the commit action (resolved
    // from that same fallback, per `v1-perso-spec.md`'s flat merge) would
    // never receive them. Updated on every dnd tick regardless of whether
    // the author wrote their own `trackCommand`.
    if (isDndCapture) {
      captureState = {
        ...captureState,
        clientX: (sample as PointerCaptureSample).clientX,
        clientY: (sample as PointerCaptureSample).clientY
      }
    }

    // A dnd capture's dragged node is positioned directly by the list-dnd
    // module (`previewAt`, `position: fixed` + `left`/`top`) — the generic
    // x/y transform-based follow would fight it, so it never applies here.
    const position = output?.position ?? (
      capture.trackCommand === undefined && isPointerSample && !isDndCapture
        ? (defaultOffset = {
            x: defaultOffset.x + (sample as PointerCaptureSample).movementX,
            y: defaultOffset.y + (sample as PointerCaptureSample).movementY
          })
        : undefined
    )

    if (position === undefined && !isDndCapture) {
      return
    }

    pendingResult = {
      position,
      dnd: isDndCapture
        ? {
            clientX: (sample as PointerCaptureSample).clientX,
            clientY: (sample as PointerCaptureSample).clientY,
            candidateListIds: dropIn,
            ghost: capture.ghost
          }
        : undefined
    }
  }

  /**
   * Handles one native `trackOn` pointer event.
   */
  function onPointerTrack(domEvent: Event): void {
    if (!(domEvent instanceof PointerEvent)) {
      return
    }
    runTrackCommand(buildPointerSample(domEvent))
  }

  /**
   * Advances keyboard sampling for one playback frame. The triggering
   * `KeyboardEvent` is closed over for its modifier keys (see `buildKeyboardSample`).
   */
  function makeKeyboardTickHandler(triggerEvent: KeyboardEvent, resolvedKeyCode: string): (deltaMs: number) => void {
    return (deltaMs: number) => {
      keyboardElapsedMs += deltaMs
      runTrackCommand(buildKeyboardSample(triggerEvent, resolvedKeyCode, deltaMs, keyboardElapsedMs))
    }
  }

  /**
   * Resolves the capture's real elapsed duration in timeline milliseconds,
   * independent of source (pointer or keyboard) — `durationMode: 'capture'`
   * uses this measurement, never exposed to the author.
   */
  function resolveElapsedCaptureMs(): number {
    return (getCurrentTimelineMs?.() ?? startedAtMs) - startedAtMs
  }

  /**
   * Resolves the `duration` an ended capture's `events` are anchored/animated
   * with, per `CaptureEndOutput.durationMode` (`v1-capture-spec.md` regle 3bis).
   */
  function resolveEndDuration(durationMode: 'value' | 'default' | 'capture' | undefined, authoredDuration: number | undefined): number {
    if (durationMode === 'value') {
      return authoredDuration ?? DEFAULT_DURATION_MS
    }
    if (durationMode === 'capture') {
      return resolveElapsedCaptureMs()
    }
    return DEFAULT_DURATION_MS
  }

  /**
   * Handles one native `endOn` event: resolves `endCapture`/`endEmit`,
   * anchors and emits their `events` through the standard runtime pipeline,
   * then tears down every listener this capture installed.
   */
  function onEnd(domEvent: Event): void {
    if (ended) {
      return
    }
    if (isKeyboardCapture && (!(domEvent instanceof KeyboardEvent) || domEvent.code !== keyCode)) {
      return
    }

    ended = true
    cleanup()

    const endResult = capture.endCapture?.({
      samples,
      captureState,
      state: resolveCaptureState(),
      meta: { originEventName, origin: { persoId } }
    })

    const nowMs = getCurrentTimelineMs?.() ?? 0
    const resolvedDuration = resolveEndDuration(endResult?.durationMode, endResult?.duration)
    const eventMs = nowMs - resolvedDuration

    for (const event of endResult?.events ?? []) {
      emitRuntimeEvent({
        name: event.name,
        data: propagateDuration(event.data, resolvedDuration),
        cascade: event.cascade,
        scopeStoryId: event.cascade === true ? undefined : storyId,
        source: 'system',
        ms: eventMs,
        mode: 'persist-only'
      })
    }

    if (capture.endEmit) {
      // `data` absent falls back to the accumulated `captureState`, same
      // pattern already used for `ListenEmit.data` in `applyLiveSceneEvent`
      // (`player.ts`: `data: e.data ?? event.data`) — no function needed to
      // carry captured data into a statically-declared event. `ms: nowMs` is
      // required: `player.ts`'s `onRuntimeEmit` heuristic
      // (`isLiveTracking = source === 'system' && event.ms === undefined`)
      // otherwise misroutes `endEmit` to `applyLiveSceneEvent` (the OLD
      // live-tracking path, which silently drops a triggered strap's
      // `events` — `liveOnly: true`) instead of the normal `apply-now`
      // pipeline `endEmit` is meant to use.
      emitRuntimeEvent({
        name: capture.endEmit.name,
        data: capture.endEmit.data ?? captureState,
        cascade: capture.endEmit.cascade,
        scopeStoryId: capture.endEmit.cascade === true ? undefined : storyId,
        source: 'system' as const,
        ms: nowMs
      })
    }
  }

  /**
   * Removes every listener and tick subscription this capture installed.
   * Safe to call more than once.
   */
  function cleanup(): void {
    unsubscribeKeyboardTick?.()
    unsubscribeKeyboardTick = null
    unsubscribeCaptureTick?.()
    unsubscribeCaptureTick = null
    releaseCaptureUpdates?.(persoId)

    for (const eventName of endOn) {
      globalThis.window?.removeEventListener(eventName, onEnd, { capture: true })
    }

    for (const eventName of trackOn) {
      globalThis.window?.removeEventListener(eventName, onPointerTrack, { capture: true })
    }
  }

  if (isKeyboardCapture && subscribeJitTick !== undefined && triggerKeyboardEvent !== undefined) {
    const onKeyboardTick = makeKeyboardTickHandler(triggerKeyboardEvent, keyCode)
    onKeyboardTick(0)
    unsubscribeKeyboardTick = subscribeJitTick(onKeyboardTick)
  }

  if (subscribeCaptureTick !== undefined) {
    unsubscribeCaptureTick = subscribeCaptureTick(persoId, () => {
      const result = pendingResult
      pendingResult = undefined
      return result
    })
  }

  for (const eventName of endOn) {
    globalThis.window?.addEventListener(eventName, onEnd, { capture: true })
  }

  for (const eventName of trackOn) {
    globalThis.window?.addEventListener(eventName, onPointerTrack, { capture: true })
  }

  return cleanup
}
