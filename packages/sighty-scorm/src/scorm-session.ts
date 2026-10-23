import type {
  PipwerksScormApi,
  ScormEvaluationUpdate,
  ScormInteraction,
  ScormObjectiveProgress,
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
    const masteryScore = this.readMasteryScore()
    this.restore = {
      location: this.api.get(this.locationElement()),
      suspendData: this.api.get('cmi.suspend_data'),
      mode,
      ...(masteryScore === undefined ? {} : { masteryScore }),
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

  /** Saves reader state and one immediate interaction in a single LMS commit. */
  public async recordInteraction(update: ScormReaderUpdate, interaction: ScormInteraction): Promise<void> {
    if (!this.canWrite()) return
    this.writeReaderState(update)
    this.latestReaderUpdate = update
    if (this.version !== '1.2') this.writeInteraction(interaction, this.interactionCount())
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

  /** Requests an LMS navigation choice and ends this SCO session like the reference reader. */
  public async navigateToSco(identifier: string): Promise<boolean> {
    if (!this.connected || this.closed || this.api === undefined) return false
    this.api.get(`adl.nav.request_valid.choice.{target=${identifier}}`)
    if (!this.api.set('adl.nav.request', `{target=${identifier}}choice`)) return false

    this.closed = true
    let failure: unknown
    try {
      this.assertSuccess(this.api.save(), 'commit de navigation vers un autre SCO')
    } catch (error: unknown) {
      failure = error
    }
    try {
      this.assertSuccess(this.api.quit(), 'terminaison avant navigation vers un autre SCO')
    } catch (error: unknown) {
      failure ??= error
    } finally {
      this.connected = false
    }
    if (failure !== undefined) throw failure
    return true
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
    if (update.sessionTimeMs !== undefined) {
      const sessionTime = formatSessionTime(update.sessionTimeMs, this.version)
      const element = this.version === '1.2' ? 'cmi.core.session_time' : 'cmi.session_time'
      this.assertSuccess(this.api.set(element, sessionTime), 'écriture de la durée de session')
    }
    if (update.progress !== undefined) {
      if (this.version === '1.2') {
        const lessonStatus = update.progress.successStatus ?? update.progress.completionStatus
        if (lessonStatus !== undefined) {
          this.assertSuccess(this.api.set('cmi.core.lesson_status', lessonStatus), 'écriture de l’état du chapitre')
        }
      } else {
        this.assertSuccess(this.api.set('cmi.progress_measure', String(update.progress.measure)), 'écriture de la progression globale')
        if (update.progress.completionStatus !== undefined) {
          this.assertSuccess(this.api.set('cmi.completion_status', update.progress.completionStatus), 'écriture de l’état de complétion global')
        }
        for (const objective of update.progress.objectives ?? []) {
          this.writeObjectiveProgress(objective)
        }
      }
    }
  }

  /** Writes standard status and score values for one completed evaluation. */
  private writeEvaluation(update: ScormEvaluationUpdate): void {
    if (this.api === undefined) return
    if (this.version === '1.2') {
      this.assertSuccess(this.api.set('cmi.core.lesson_status', update.status), 'écriture du résultat')
      this.assertSuccess(this.api.set('cmi.core.score.raw', String(Math.round(update.score.raw))), 'écriture du score')
    } else {
      if (update.reader.progress?.completionStatus === undefined) {
        this.assertSuccess(this.api.set('cmi.completion_status', 'completed'), 'écriture de la progression')
      }
      this.assertSuccess(this.api.set('cmi.success_status', update.status), 'écriture du résultat')
      this.writeScore('cmi.score', update.score, 'du score global')
    }
    if (update.objective !== undefined && this.version !== '1.2') this.writeObjective(update.objective)
    if (this.version !== '1.2') this.writeInteractions(update.interactions)
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

  /** Writes chapter progress fields when the manifest declares the objective. */
  private writeObjectiveProgress(objective: ScormObjectiveProgress): void {
    if (this.api === undefined) return
    const count = Number.parseInt(this.api.get('cmi.objectives._count'), 10)
    if (!Number.isFinite(count) || count <= 0) return
    for (let index = 0; index < count; index += 1) {
      if (this.api.get(`cmi.objectives.${index}.id`) !== objective.id) continue
      const prefix = `cmi.objectives.${index}`
      this.assertSuccess(this.api.set(`${prefix}.progress_measure`, String(objective.measure)), 'écriture de la progression du chapitre')
      if (objective.completionStatus !== undefined) {
        this.assertSuccess(this.api.set(`${prefix}.completion_status`, objective.completionStatus), 'écriture de la complétion du chapitre')
      }
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
  private writeInteractions(interactions: readonly ScormInteraction[]): void {
    if (this.api === undefined) return
    let interactionCount = this.interactionCount()
    for (const interaction of interactions) {
      interactionCount = this.writeInteraction(interaction, interactionCount)
    }
  }

  /** Writes one interaction, reusing its current LMS index when the ID exists. */
  private writeInteraction(interaction: ScormInteraction, currentCount: number): number {
    if (this.api === undefined) return currentCount
    const idLimit = this.version === '1.2' ? SCORM_INTERACTION_ID_LIMIT_12 : SCORM_INTERACTION_ID_LIMIT_2004
    if (interaction.id.length > idLimit) {
      throw new RangeError(`L’identifiant d’interaction dépasse la limite SCORM ${this.version} (${idLimit} caractères).`)
    }
    const index = this.interactionIndex(interaction.id, currentCount)
    const nextCount = index === currentCount ? currentCount + 1 : currentCount
    const prefix = `cmi.interactions.${index}`
    this.assertSuccess(this.api.set(`${prefix}.id`, interaction.id), 'écriture de l’identifiant d’interaction')
    this.assertSuccess(this.api.set(`${prefix}.type`, interaction.type ?? 'choice'), 'écriture du type d’interaction')
    this.assertSuccess(this.api.set(`${prefix}.description`, interaction.description ?? ''), 'écriture de la description d’interaction')
    this.assertSuccess(this.api.set(`${prefix}.correct_responses.0.pattern`, interaction.correctResponse), 'écriture de la réponse attendue')
    this.assertSuccess(this.api.set(`${prefix}.learner_response`, interaction.learnerResponse), 'écriture de la réponse apprenant')
    if (interaction.timestampMs !== undefined) {
      this.assertSuccess(this.api.set(`${prefix}.timestamp`, formatInteractionTimestamp(interaction.timestampMs)), 'écriture de l’horodatage d’interaction')
    }
    if (interaction.latencyMs !== undefined) {
      this.assertSuccess(this.api.set(`${prefix}.latency`, formatInteractionLatency(interaction.latencyMs)), 'écriture de la latence d’interaction')
    }
    this.assertSuccess(this.api.set(`${prefix}.weighting`, String(interaction.weighting || 0)), 'écriture de la pondération d’interaction')
    this.assertSuccess(this.api.set(`${prefix}.result`, interaction.result), 'écriture du résultat d’interaction')
    return nextCount
  }

  /** Reads the existing CMI interaction count once for one write operation. */
  private interactionCount(): number {
    if (this.api === undefined) return 0
    const count = Number.parseInt(this.api.get('cmi.interactions._count'), 10)
    return Number.isFinite(count) && count > 0 ? count : 0
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

  /** Reads the LMS mastery score using the edition-specific element used by the reference reader. */
  private readMasteryScore(): number | undefined {
    if (this.api === undefined) return undefined
    const element = this.version === '1.2'
      ? 'cmi.student_data.mastery_score'
      : 'cmi.scaled_passing_score'
    const rawScore = Number.parseFloat(this.api.get(element))
    const score = this.version === '1.2' ? rawScore : rawScore * 100
    return Number.isFinite(score) && score !== 0 ? score : undefined
  }

  /** Returns the CMI bookmark element for the configured SCORM edition. */
  private locationElement(): string {
    return this.version === '1.2' ? 'cmi.core.lesson_location' : 'cmi.location'
  }

  /** Raises a diagnostic when one pipwerks operation returns false. */
  private assertSuccess(success: boolean, operation: string): void {
    if (success) return
    const errorCode = this.api?.debug?.getCode?.()
    const diagnostic = this.api?.debug?.getDiagnosticInfo?.(errorCode)
    throw new Error(`Échec SCORM pendant ${operation}${diagnostic ? ` : ${diagnostic}` : ''}.`)
  }
}

/** Formats elapsed SCO time with the reference reader's edition-specific representation. */
function formatSessionTime(timeMs: number, version: ScormVersion): string {
  if (!Number.isFinite(timeMs) || timeMs < 0) {
    throw new RangeError('La durée de session SCORM doit être un temps positif.')
  }
  const totalSeconds = Math.floor(timeMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor(totalSeconds / 60) % 60
  const seconds = totalSeconds % 60
  if (version === '1.2') {
    const centiseconds = Math.round((timeMs % 1000) / 10)
    return `${padFourDigits(hours)}:${padTwoDigits(minutes)}:${padTwoDigits(seconds)}.${String(centiseconds).padStart(2, '0').slice(-2)}`
  }
  return `PT${padFourDigits(hours)}H${padTwoDigits(minutes)}M${padTwoDigits(seconds)}S`
}

/** Formats one epoch timestamp using the date representation of the reference project. */
function formatInteractionTimestamp(timestampMs: number): string {
  if (!Number.isFinite(timestampMs) || timestampMs < 0) {
    throw new RangeError('L’horodatage d’interaction doit être un temps Unix positif.')
  }
  const date = new Date(timestampMs)
  return `${date.getFullYear()}-${padTwoDigits(date.getMonth() + 1)}-${padTwoDigits(date.getDate())}`
    + `T${padTwoDigits(date.getHours())}:${padTwoDigits(date.getMinutes())}:${padTwoDigits(date.getSeconds())}`
    + `.${String(Math.floor(date.getMilliseconds() / 10)).padStart(2, '0')}Z`
}

/** Formats one elapsed time with the reference project's minute/second representation. */
function formatInteractionLatency(latencyMs: number): string {
  if (!Number.isFinite(latencyMs) || latencyMs < 0) {
    throw new RangeError('La latence d’interaction doit être un temps positif.')
  }
  const totalSeconds = Math.floor(latencyMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds - minutes * 60
  return `PT${minutes}M${seconds}S`
}

/** Pads one date field to two digits. */
function padTwoDigits(value: number): string {
  return String(value).padStart(2, '0')
}

/** Pads the hour field to the width emitted by the reference reader. */
function padFourDigits(value: number): string {
  return String(value).padStart(4, '0').slice(-4)
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
