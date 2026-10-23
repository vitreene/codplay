/** Lists the SCORM editions supported by the shared session package. */
export type ScormVersion = '1.2' | '2004v3' | '2004v4'

/** Describes the pipwerks API used by a running SCO. */
export interface PipwerksScormApi {
  version: string
  handleExitMode?: boolean
  init(): boolean
  get(parameter: string): string
  set(parameter: string, value: string): boolean
  save(): boolean
  quit(): boolean
  debug?: Readonly<{
    getCode?: () => string | number
    getDiagnosticInfo?: (errorCode?: string | number) => string
  }>
}

/** Contains the unparsed learner data returned by one LMS session. */
export interface ScormSessionRestore {
  readonly location: string
  readonly suspendData: string
  readonly mode: string
  /** LMS passing threshold expressed as a percentage, when one is configured. */
  readonly masteryScore?: number
}

/** Describes one chapter's SCORM objective progress in a 2004 mono-SCO. */
export interface ScormObjectiveProgress {
  readonly id: string
  readonly measure: number
  readonly completionStatus?: 'completed'
}

/** Describes course completion for both editions and progress for SCORM 2004. */
export interface ScormProgressUpdate {
  readonly measure: number
  readonly completionStatus?: 'completed' | 'incomplete'
  readonly successStatus?: 'passed' | 'failed'
  readonly objectives?: readonly ScormObjectiveProgress[]
}

/** Carries an opaque bookmark and suspend-data value into the shared session. */
export interface ScormReaderUpdate {
  readonly location: string | null
  readonly suspendData: string
  readonly sessionTimeMs?: number
  readonly progress?: ScormProgressUpdate
}

/** Contains the four score values that a project adapter maps to SCORM. */
export interface ScormScore {
  readonly raw: number
  readonly min: number
  readonly max: number
  readonly scaled: number
}

/** Lists standard CMI interaction types accepted by the shared session. */
export type ScormInteractionType =
  | 'true-false'
  | 'choice'
  | 'fill-in'
  | 'long-fill-in'
  | 'matching'
  | 'performance'
  | 'sequencing'
  | 'likert'
  | 'numeric'
  | 'other'

/** Carries one generic SCORM interaction without project-domain types. */
export interface ScormInteraction {
  readonly id: string
  readonly type?: ScormInteractionType
  readonly description?: string
  readonly correctResponse: string
  readonly learnerResponse: string
  readonly timestampMs?: number
  readonly latencyMs?: number
  readonly weighting?: number
  readonly result: 'correct' | 'incorrect'
}

/** Preserves the public type name used by existing choice-interaction callers. */
export type ScormChoiceInteraction = ScormInteraction

/** Describes one SCORM objective result computed by a project adapter. */
export interface ScormObjectiveResult {
  readonly id: string
  readonly status: 'passed' | 'failed'
  readonly score: ScormScore
}

/** Groups project-neutral result values for one LMS evaluation write. */
export interface ScormEvaluationUpdate {
  readonly reader: ScormReaderUpdate
  readonly status: 'passed' | 'failed'
  readonly score: ScormScore
  readonly objective?: ScormObjectiveResult
  readonly interactions: readonly ScormInteraction[]
}

/** Configures the shared CMI session for one SCO. */
export interface ScormSessionOptions {
  readonly version: ScormVersion
  readonly api?: PipwerksScormApi
  readonly onDiagnostic?: (message: string) => void
}
