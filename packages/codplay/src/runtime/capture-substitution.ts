/**
 * Builds the runtime-generated substitution transition for one capture
 * session's end event, replayed only on seek (never applied live — see
 * `EmitCapture.replay` and the `persist-only` mode on the triggering event).
 *
 * Pure and DOM-free: given the start/end position and duration of a capture
 * gesture, returns a style action moving the target from the captured start
 * position to the captured end position over `duration`, ready to be applied
 * verbatim as an action payload (`event.data` delegated via `actions[key] = true`).
 */
export function buildCaptureSubstitutionStyle(input: {
  fromX: number
  fromY: number
  toX: number
  toY: number
  duration: number
}): { style: { x: { from: number; to: number; duration: number }; y: { from: number; to: number; duration: number } } } {
  return {
    style: {
      x: { from: input.fromX, to: input.toX, duration: input.duration },
      y: { from: input.fromY, to: input.toY, duration: input.duration }
    }
  }
}
