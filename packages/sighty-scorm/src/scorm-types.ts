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
}

/** Describes optional SCORM 2004 progress values computed by an adapter. */
export interface ScormProgressUpdate {
  readonly measure: number
  readonly completionStatus: 'completed' | 'incomplete'
}

/** Carries an opaque bookmark and suspend-data value into the shared session. */
export interface ScormReaderUpdate {
  readonly location: string | null
  readonly suspendData: string
  readonly progress?: ScormProgressUpdate
}

/** Contains the four score values that a project adapter maps to SCORM. */
export interface ScormScore {
  readonly raw: number
  readonly min: number
  readonly max: number
  readonly scaled: number
}

/** Carries one standard SCORM choice interaction without project-domain types. */
export interface ScormChoiceInteraction {
  readonly id: string
  readonly correctResponse: string
  readonly learnerResponse: string
  readonly result: 'correct' | 'incorrect'
}

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
  readonly interactions: readonly ScormChoiceInteraction[]
}

/** Configures the shared CMI session for one SCO. */
export interface ScormSessionOptions {
  readonly version: ScormVersion
  readonly api?: PipwerksScormApi
  readonly onDiagnostic?: (message: string) => void
}
