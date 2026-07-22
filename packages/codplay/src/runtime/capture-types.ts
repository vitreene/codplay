import type { DeepReadonly, StoryEvent } from '../player/helper-types'
import type { StrapMeta } from '../player/strap-types'

export type NativeEventName = string

export type CaptureSample = Record<string, unknown>
export type CaptureState = Record<string, unknown>

/**
 * Forme concrete d'un CaptureSample issu d'un `trackOn` pointeur (ex:
 * 'pointermove'). `movementX`/`movementY` sont le delta natif depuis le
 * dernier `PointerEvent` (herite de `MouseEvent`), fournis par le navigateur
 * lui-meme — pas un calcul du player, unifie souris/trackpad/tactile.
 */
export type PointerCaptureSample = CaptureSample & {
  clientX: number
  clientY: number
  movementX: number
  movementY: number
}

/**
 * Forme concrete d'un CaptureSample issu d'un `trackOn` clavier (ex: 'keydown').
 * `deltaMs`/`elapsedMs` proviennent du tick du player, pas de `KeyboardEvent` :
 * le clavier ne fournit aucune valeur continue entre `keydown` et `keyup`.
 * `altKey`/`shiftKey`/`ctrlKey`/`metaKey` sont les modificateurs natifs de
 * `KeyboardEvent`, lus a l'etat courant a chaque tick.
 */
export type KeyboardCaptureSample = CaptureSample & {
  keyCode: string
  deltaMs: number
  elapsedMs: number
  altKey: boolean
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
}

export type CaptureAction = {
  actionName: string
  data?: Record<string, unknown>
}

export type CaptureInitInput = {
  state: DeepReadonly<Record<string, unknown>>
}

/**
 * `false` cancels the capture cycle before any `trackOn`/`endOn` listener is
 * installed (`capture-runtime.ts`'s `startCapture`) — a guard applied once,
 * at capture opening, never a rejection after the fact on an already-applied
 * commit. Whatever makes this return `false` is entirely up to the author;
 * codplay only reads the result.
 */
export type CaptureInitFn = (input: CaptureInitInput) => CaptureState | false

export type CaptureTrackInput = {
  sample: CaptureSample
  samples: readonly CaptureSample[]
  captureState: DeepReadonly<CaptureState>
}

/**
 * `action` is the legacy, unchanged path: a hand-built `CaptureAction`
 * (`actionName`+`data`), resolved by `resolvePersoIdsForActionName` exactly
 * as today (`space-bubbles-scene.ts`'s turret, `quiz-hunt/extra-story.ts`'s
 * token). `position`/`dnd` are a separate, honest channel for a capture that
 * has no "catalog" to speak of — a single known target (`persoId`, carried by
 * the `subscribeCaptureTick` subscription itself, never by this data) with a
 * direct value to apply or a payload to dispatch. Never both `action` and
 * `position`/`dnd` meaningfully at once: `action` short-circuits the other
 * two in `runTrackCommand`.
 */
export type CaptureTickResult = {
  action?: CaptureAction
  position?: Record<string, number | string>
  dnd?: Record<string, unknown>
  captureState?: CaptureState
  /**
   * Merged (`Object.assign`) into `state` at the scope `stateScope` resolves
   * to, on every sample — the only way another strap can read an up-to-date
   * value while a capture is still active (e.g. firing while a keyboard
   * capture is still held). Never materialized, never replayed at seek (see
   * `v1-capture-spec.md`, "Phase de tracking"/"Materialisation").
   */
  updateState?: Record<string, unknown>
}

export type CaptureTrackFn = (input: CaptureTrackInput) => CaptureTickResult | void

export type CaptureEndInput = {
  samples: readonly CaptureSample[]
  captureState: DeepReadonly<CaptureState>
  state: DeepReadonly<Record<string, unknown>>
  meta: StrapMeta
}

export type CaptureEndDurationMode = 'value' | 'default' | 'capture'

export type CaptureEndOutput = {
  events?: StoryEvent[]
  duration?: number
  durationMode?: CaptureEndDurationMode
}

export type CaptureEndFn = (input: CaptureEndInput) => CaptureEndOutput | void

/**
 * Declares one capture cycle attached to one emit trigger. `initCaptureState`/
 * `trackCommand`/`endCapture` are plain JS functions carried directly by this
 * declaration — never resolved by name from a separate collection, mirroring
 * how `StoryDef.straps`/`listen[].transform` already carry real functions
 * through `CompiledScene` (see `v1-capture-spec.md`, "Forme d'authoring").
 */
export type CaptureDeclaration = {
  trackOn?: NativeEventName[]
  endOn?: NativeEventName[]
  /**
   * Scope of the `state` read by `initCaptureState`/`endCapture`. Defaults to
   * `'story'` (the story owning the capture's host perso) — a capture always
   * belongs to a perso (`emit` only exists on `PersoDoc`), never directly to
   * a story or scene, so this is the natural default. `'scene'` reads
   * `scene.state` instead. Fixed once at capture declaration — never changes
   * mid-capture. Governs reading only: writing (via the strap triggered by
   * `endEmit`/`endCapture.events`) picks its own scope through `cascade`,
   * independently of `stateScope`.
   */
  stateScope?: 'scene' | 'story'
  initCaptureState?: CaptureInitFn
  trackCommand?: CaptureTrackFn
  endEmit?: StoryEvent
  endCapture?: CaptureEndFn
  /**
   * Static ghost placeholder styling for a list-dnd-flavored capture (one
   * whose `initCaptureState` returns `{ dropIn }`) — never a function, never
   * read for anything else. Dimensions always match the dragged node's own
   * rect regardless of this config; `className` defaults to a conventional
   * constant when absent (see `list-dnd`'s ghost lifecycle).
   */
  ghost?: {
    className?: string
    style?: Record<string, string | number>
  }
}
