import type {
  PipwerksScormApi,
  ScormChoiceInteraction,
  ScormEvaluationUpdate,
  ScormObjectiveResult,
  ScormReaderUpdate,
  ScormSessionOptions,
  ScormSessionRestore,
  ScormVersion,
} from './scorm-types'
import { suspendDataLimit } from './scorm-data-limits'

const SCORM_LOCATION_LIMIT_12 = 255
const SCORM_LOCATION_LIMIT_2004 = 1000
const SCORM_INTERACTION_ID_LIMIT_12 = 255
const SCORM_INTERACTION_ID_LIMIT_2004 = 4000

/** Owns the pipwerks connection and every SCORM CMI call for one SCO. */
export class ScormSession {
  private readonly version: ScormVersion
  private readonly onDiagnostic: ((message: string) => void) | undefined
  private api: PipwerksScormApi | undefined
  private connected = false
  private initialized = false
  private closed = false
  private browseMode = false
  private latestReaderUpdate: ScormReaderUpdate | undefined
  private restore: ScormSessionRestore = { location: '', suspendData: '', mode: '' }

  /** Creates a session with an injected API or the browser pipwerks global. */
  public constructor(options: ScormSessionOptions) {
    this.version = options.version
    this.api = options.api ?? resolvePipwerksApi()
    this.onDiagnostic = options.onDiagnostic
  }

  /** Connects to the LMS and returns its opaque bookmark and suspend data. */
  public async initialize(): Promise<ScormSessionRestore> {
    if (this.initialized) return this.restore
    this.initialized = true
    if (this.api === undefined) {
      this.onDiagnostic?.('Le wrapper SCORM ou l’API du LMS est indisponible ; la lecture démarre sans reprise SCORM.')
      return this.restore
    }

    this.api.version = this.version === '1.2' ? '1.2' : '2004'
    this.api.handleExitMode = false
    this.connected = this.api.init()
    if (!this.connected) {
      this.onDiagnostic?.('La connexion SCORM au LMS a échoué ; la lecture démarre sans reprise SCORM.')
      return this.restore
    }

    const mode = this.api.get(this.modeElement())
    this.browseMode = mode === 'browse' || mode === 'review'
    this.restore = {
      location: this.api.get(this.locationElement()),
      suspendData: this.api.get('cmi.suspend_data'),
      mode,
    }
    return this.restore
  }

  /** Saves the bookmark and opaque suspend data, then commits the LMS values. */
  public async saveReaderState(update: ScormReaderUpdate): Promise<void> {
    if (!this.canWrite()) return
    this.writeReaderState(update)
    this.latestReaderUpdate = update
    this.assertSuccess(this.api!.save(), 'commit')
  }

  /** Saves reader data, an evaluation result, an objective, and interactions. */
  public async recordEvaluationResult(update: ScormEvaluationUpdate): Promise<void> {
    if (!this.canWrite()) return
    this.writeReaderState(update.reader)
    this.latestReaderUpdate = update.reader
    this.writeEvaluation(update)
    this.assertSuccess(this.api!.save(), 'commit')
  }

  /** Saves the latest reader data and terminates the LMS session once. */
  public async close(finalUpdate?: ScormReaderUpdate): Promise<void> {
    if (this.closed) return
    this.closed = true
    if (!this.connected || this.api === undefined) return
    let failure: unknown
    if (!this.browseMode) {
      try {
        const update = finalUpdate ?? this.latestReaderUpdate
        if (update !== undefined) this.writeReaderState(update)
        this.assertSuccess(this.api.set(this.exitElement(), 'suspend'), 'suspension de la session')
        this.assertSuccess(this.api.save(), 'commit final')
      } catch (error: unknown) {
        failure = error
      }
    }
    try {
      this.assertSuccess(this.api.quit(), 'terminaison')
    } catch (error: unknown) {
      failure ??= error
    } finally {
      this.connected = false
    }
    if (failure !== undefined) throw failure
  }

  /** Returns whether the session accepts writable data-model calls. */
  private canWrite(): boolean {
    return this.connected && !this.closed && !this.browseMode && this.api !== undefined
  }

  /** Writes the version-specific bookmark, suspend data, and progress values. */
  private writeReaderState(update: ScormReaderUpdate): void {
    if (this.api === undefined) return
    const { location, suspendData } = update
    if (location !== null) {
      const limit = this.version === '1.2' ? SCORM_LOCATION_LIMIT_12 : SCORM_LOCATION_LIMIT_2004
      if (location.length > limit) throw new RangeError(`L’identifiant de page dépasse la limite SCORM ${this.version} (${limit} caractères).`)
      this.assertSuccess(this.api.set(this.locationElement(), location), 'écriture du signet')
    }
    const maximumSuspendDataLength = suspendDataLimit(this.version)
    if (suspendData.length > maximumSuspendDataLength) {
      throw new RangeError(`L’état suspendu dépasse la limite SCORM ${this.version} (${maximumSuspendDataLength} caractères).`)
    }
    this.assertSuccess(this.api.set('cmi.suspend_data', suspendData), 'écriture de l’état suspendu')
    if (update.progress !== undefined && this.version !== '1.2') {
      this.assertSuccess(this.api.set('cmi.progress_measure', String(update.progress.measure)), 'écriture de la progression globale')
      this.assertSuccess(this.api.set('cmi.completion_status', update.progress.completionStatus), 'écriture de l’état de complétion global')
    }
  }

  /** Writes standard status and score values for one completed evaluation. */
  private writeEvaluation(update: ScormEvaluationUpdate): void {
    if (this.api === undefined) return
    if (this.version === '1.2') {
      this.assertSuccess(this.api.set('cmi.core.lesson_status', update.status), 'écriture du résultat')
      this.assertSuccess(this.api.set('cmi.core.score.raw', String(Math.round(update.score.raw))), 'écriture du score')
    } else {
      if (update.reader.progress === undefined) {
        this.assertSuccess(this.api.set('cmi.completion_status', 'completed'), 'écriture de la progression')
      }
      this.assertSuccess(this.api.set('cmi.success_status', update.status), 'écriture du résultat')
      this.writeScore('cmi.score', update.score, 'du score global')
    }
    if (update.objective !== undefined && this.version !== '1.2') this.writeObjective(update.objective)
    this.writeInteractions(update.interactions)
  }

  /** Writes one objective when the package manifest declares its identifier. */
  private writeObjective(objective: ScormObjectiveResult): void {
    if (this.api === undefined) return
    const count = Number.parseInt(this.api.get('cmi.objectives._count'), 10)
    if (!Number.isFinite(count) || count <= 0) return
    for (let index = 0; index < count; index += 1) {
      if (this.api.get(`cmi.objectives.${index}.id`) !== objective.id) continue
      const prefix = `cmi.objectives.${index}`
      this.assertSuccess(this.api.set(`${prefix}.completion_status`, 'completed'), 'écriture de la progression du chapitre')
      this.assertSuccess(this.api.set(`${prefix}.success_status`, objective.status), 'écriture du résultat du chapitre')
      this.writeScore(`${prefix}.score`, objective.score, 'du score du chapitre')
      return
    }
    this.onDiagnostic?.(`L’objectif SCORM ${objective.id} est absent du manifeste.`)
  }

  /** Writes raw, minimum, maximum, and normalized score values. */
  private writeScore(prefix: string, score: ScormEvaluationUpdate['score'], label: string): void {
    if (this.api === undefined) return
    this.assertSuccess(this.api.set(`${prefix}.min`, String(score.min)), `écriture ${label} minimal`)
    this.assertSuccess(this.api.set(`${prefix}.max`, String(score.max)), `écriture ${label} maximal`)
    this.assertSuccess(this.api.set(`${prefix}.raw`, String(Math.round(score.raw))), `écriture ${label}`)
    this.assertSuccess(this.api.set(`${prefix}.scaled`, String(score.scaled)), `écriture ${label} normalisé`)
  }

  /** Writes choice interactions while reusing existing LMS records by ID. */
  private writeInteractions(interactions: readonly ScormChoiceInteraction[]): void {
    if (this.api === undefined) return
    const count = Number.parseInt(this.api.get('cmi.interactions._count'), 10)
    let interactionCount = Number.isFinite(count) && count > 0 ? count : 0
    for (const interaction of interactions) {
      const idLimit = this.version === '1.2' ? SCORM_INTERACTION_ID_LIMIT_12 : SCORM_INTERACTION_ID_LIMIT_2004
      if (interaction.id.length > idLimit) {
        throw new RangeError(`L’identifiant d’interaction dépasse la limite SCORM ${this.version} (${idLimit} caractères).`)
      }
      const index = this.interactionIndex(interaction.id, interactionCount)
      if (index === interactionCount) interactionCount += 1
      const prefix = `cmi.interactions.${index}`
      this.assertSuccess(this.api.set(`${prefix}.id`, interaction.id), 'écriture de l’identifiant d’interaction')
      this.assertSuccess(this.api.set(`${prefix}.type`, 'choice'), 'écriture du type d’interaction')
      this.assertSuccess(this.api.set(`${prefix}.correct_responses.0.pattern`, interaction.correctResponse), 'écriture de la réponse attendue')
      this.assertSuccess(this.api.set(`${prefix}.learner_response`, interaction.learnerResponse), 'écriture de la réponse apprenant')
      this.assertSuccess(this.api.set(`${prefix}.result`, interaction.result), 'écriture du résultat d’interaction')
    }
  }

  /** Finds an existing interaction or returns the next LMS interaction index. */
  private interactionIndex(id: string, initialCount: number): number {
    if (this.api === undefined) return initialCount
    for (let index = 0; index < initialCount; index += 1) {
      if (this.api.get(`cmi.interactions.${index}.id`) === id) return index
    }
    return initialCount
  }

  /** Returns the CMI mode element for the configured SCORM edition. */
  private modeElement(): string {
    return this.version === '1.2' ? 'cmi.core.lesson_mode' : 'cmi.mode'
  }

  /** Returns the CMI bookmark element for the configured SCORM edition. */
  private locationElement(): string {
    return this.version === '1.2' ? 'cmi.core.lesson_location' : 'cmi.location'
  }

  /** Returns the CMI exit element used to retain the suspended attempt. */
  private exitElement(): string {
    return this.version === '1.2' ? 'cmi.core.exit' : 'cmi.exit'
  }

  /** Raises a diagnostic when one pipwerks operation returns false. */
  private assertSuccess(success: boolean, operation: string): void {
    if (success) return
    const errorCode = this.api?.debug?.getCode?.()
    const diagnostic = this.api?.debug?.getDiagnosticInfo?.(errorCode)
    throw new Error(`Échec SCORM pendant ${operation}${diagnostic ? ` : ${diagnostic}` : ''}.`)
  }
}

/** Resolves the wrapper global only in a browser SCO runtime. */
function resolvePipwerksApi(): PipwerksScormApi | undefined {
  if (typeof window === 'undefined') return undefined
  return window.pipwerks?.SCORM
}

declare global {
  interface Window {
    pipwerks?: Readonly<{ SCORM: PipwerksScormApi }>
  }
}
