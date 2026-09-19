import type { DiagnosticReport } from '../../../diagnostics'

/** Controls whether a refresh re-emits the currently active move occurrences. */
export type RuntimePlayerRefreshOptions = Readonly<{
  emitMotionOccurrences?: boolean
}>

/** Result returned by player initialization. */
export type PlayerInitResult = Readonly<
  | { ok: true; diagnostics: DiagnosticReport }
  | { ok: false; diagnostics: DiagnosticReport }
>

/** Result returned after one local seek and its pure reconstruction. */
export type PlayerSeekResult = Readonly<
  | { ok: true; timeMs: number; diagnostics: DiagnosticReport }
  | { ok: false; timeMs: number; diagnostics: DiagnosticReport }
>
