import { isPlainRecord } from 'codplay/shared/is-plain-record'
import type { Diagnostic } from 'codplay/diagnostics'
import type { CompiledRecord, CompiledScene } from 'codplay/scene/compiled'
import {
  PLAYER_LIFECYCLE_PAUSED,
  PLAYER_LIFECYCLE_PLAYING,
} from 'codplay/runtime/player'
import type { PlayerLifecycleState } from 'codplay/runtime/player'
import type {
  HtmlSourceAdapter,
  HtmlSourceAdapterContext,
  HtmlSourceAdapterFactory,
} from 'codplay/runtime/runner-html'
import { EXTERNAL_COURSE_PAGE_TYPE } from './external-course-page-types'
import type {
  ExternalCoursePageCommand,
  ExternalCoursePageInitial,
  ExternalCoursePagePlaybackStatus,
  ExternalCoursePageReaderMessage,
} from './external-course-page-types'
import { ExternalCoursePagePlaybackStore } from './external-course-page-playback'
import type {
  ExternalCoursePageCommandResult,
  ExternalCoursePagePlaybackTransport,
} from './external-course-page-playback'

const EXTERNAL_COURSE_PAGE_BOOTSTRAP_TIMEOUT_MS = 15_000
const EXTERNAL_COURSE_PAGE_SEEK_TIMEOUT_MS = 5_000

type PendingSourceSeek = {
  resolve: (result: ExternalCoursePageCommandResult) => void
  timeout: number
}

type ExternalCoursePageDeclaration = Readonly<{
  storyId: string
  persoId: string
  persoKey: string
  initial: ExternalCoursePageInitial
}>

/** Creates the optional source adapter for one external course page component. */
export const createExternalCoursePageSourceAdapter: HtmlSourceAdapterFactory = (context) => (
  new ExternalCoursePageSourceAdapter(context)
)

/** Pairs the HTML source adapter with its component-owned progress/seek transport. */
export function createExternalCoursePagePlaybackBinding(): Readonly<{
  sourceAdapterFactory: HtmlSourceAdapterFactory
  transport: ExternalCoursePagePlaybackTransport
}> {
  const playbackStore = new ExternalCoursePagePlaybackStore()
  return {
    sourceAdapterFactory: (context) => new ExternalCoursePageSourceAdapter(context, playbackStore),
    transport: playbackStore.transport,
  }
}

/** Connects the player lifecycle to one isolated iframe session. */
class ExternalCoursePageSourceAdapter implements HtmlSourceAdapter {
  private readonly context: HtmlSourceAdapterContext
  private readonly sceneId: string
  private readonly declaration: ExternalCoursePageDeclaration | undefined
  private readonly playbackStore: ExternalCoursePagePlaybackStore | undefined
  private readonly reportedDiagnostics = new Set<string>()
  private readonly pendingSeeks = new Map<string, PendingSourceSeek>()
  private frame: HTMLIFrameElement | undefined
  private launchUrl: URL | undefined
  private sourceOrigin: string | undefined
  private sessionId: string | undefined
  private desiredStatus: ExternalCoursePagePlaybackStatus | undefined
  private latestRequestId: string | undefined
  private requestIndex = 0
  private generation = 0
  private bootstrapTimeout: number | undefined
  private eventQueue: Promise<void> = Promise.resolve()
  private attached = false
  private ready = false
  private hasStarted = false
  private seeking = false
  private sequenceEnded = false
  private destroyed = false

  /** Captures the unique page declaration from the already compiled scene. */
  constructor(context: HtmlSourceAdapterContext, playbackStore?: ExternalCoursePagePlaybackStore) {
    this.context = context
    this.sceneId = context.compiledScene.scene.id
    this.playbackStore = playbackStore
    playbackStore?.setSeekHandler(this.requestSourceSeek)
    const declarations = collectPageDeclarations(context.compiledScene)
    this.declaration = declarations.length === 1 ? declarations[0] : undefined
    if (declarations.length !== 1) {
      this.reportDiagnostic(
        'RUNTIME_EXTERNAL_COURSE_PAGE_DECLARATION_INVALID',
        'The source adapter requires exactly one external course page perso.',
        'construction',
      )
    }
  }

  /** Resolves the materialized iframe and attaches the origin-checked listener. */
  attach(): void {
    if (this.attached || this.destroyed || this.declaration === undefined) return
    const element = this.context.resolvePersoElement(this.declaration.persoKey)
    if (!(element instanceof HTMLIFrameElement)) {
      this.reportDiagnostic(
        'RUNTIME_EXTERNAL_COURSE_PAGE_IFRAME_MISSING',
        'The external course page perso did not materialize as an iframe.',
        'attach',
      )
      return
    }
    const launchUrl = element.dataset.externalCourseLaunchUrl
    if (launchUrl === undefined) {
      this.reportDiagnostic(
        'RUNTIME_EXTERNAL_COURSE_PAGE_LAUNCH_URL_MISSING',
        'The iframe has no prepared launch URL.',
        'attach',
      )
      return
    }
    const parsedLaunchUrl = new URL(launchUrl)
    if (parsedLaunchUrl.origin === globalThis.location.origin) {
      this.reportDiagnostic(
        'RUNTIME_EXTERNAL_COURSE_PAGE_ORIGIN_NOT_ISOLATED',
        'The course reader and CodPlay host must use distinct origins.',
        'attach',
      )
      return
    }
    this.frame = element
    this.launchUrl = parsedLaunchUrl
    this.sourceOrigin = parsedLaunchUrl.origin
    this.attached = true
    globalThis.addEventListener('message', this.handleMessage)
  }

  /** Starts the source on the first player Play and keeps later intent current. */
  onPlaybackStateChange(state: PlayerLifecycleState): void {
    if (this.destroyed || !this.attached || this.seeking || this.sequenceEnded) return
    if (state === PLAYER_LIFECYCLE_PLAYING) {
      this.desiredStatus = 'playing'
      if (!this.hasStarted) {
        this.hasStarted = true
        this.openSession()
        return
      }
      this.sendDesiredStatus()
      return
    }
    if (state !== PLAYER_LIFECYCLE_PAUSED) return
    this.desiredStatus = 'paused'
    if (this.hasStarted) this.sendDesiredStatus()
  }

  /** Pauses the source while the player reconstructs a seek target. */
  beforeSeek(): void {
    if (this.destroyed) return
    this.seeking = true
    this.desiredStatus = 'paused'
    if (this.hasStarted) this.sendDesiredStatus()
  }

  /** Follows the player lifecycle after the seek presentation has committed. */
  afterSeek(): void {
    if (this.destroyed || this.sequenceEnded) return
    this.seeking = false
    if (!this.hasStarted) return
    this.desiredStatus = resolveDesiredStatus(this.context.getLifecycleState())
    this.sendDesiredStatus()
  }

  /** Closes the active source before a reset returns the player to its start. */
  onReset(): void {
    if (this.destroyed) return
    this.seeking = false
    this.sequenceEnded = false
    this.hasStarted = false
    this.desiredStatus = undefined
    this.closeSession()
  }

  /** Pauses the source while preserving its last rendered frame at sequence end. */
  onSequenceEnd(): void {
    if (this.destroyed || this.sequenceEnded) return
    this.sequenceEnded = true
    this.generation += 1
    this.settlePendingSeeks('La séquence CodPlay est terminée.')
    const progress = this.playbackStore?.getState()
    if (progress !== undefined) this.playbackStore?.setState({ ...progress, status: 'paused' })
    this.desiredStatus = 'paused'
    this.sendDesiredStatus()
  }

  /** Removes message handling and navigates the owned iframe to a blank document. */
  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.seeking = true
    globalThis.removeEventListener('message', this.handleMessage)
    this.playbackStore?.setSeekHandler(undefined)
    this.closeSession()
    this.playbackStore?.clear()
    this.frame = undefined
  }

  /** Opens a fresh source session only after a real player Play transition. */
  private openSession(): void {
    const frame = this.frame
    const launchUrl = this.launchUrl
    if (frame === undefined || launchUrl === undefined || this.destroyed) return
    this.closeSession()
    const sessionId = globalThis.crypto.randomUUID()
    this.sessionId = sessionId
    this.ready = false
    this.requestIndex = 0
    this.latestRequestId = undefined
    this.generation += 1
    const sessionUrl = new URL(launchUrl.href)
    sessionUrl.searchParams.set('parentOrigin', globalThis.location.origin)
    sessionUrl.searchParams.set('sessionId', sessionId)
    this.bootstrapTimeout = globalThis.setTimeout(() => {
      if (this.sessionId !== sessionId || this.ready || this.destroyed) return
      this.reportDiagnostic(
        'RUNTIME_EXTERNAL_COURSE_PAGE_READY_TIMEOUT',
        'The reader did not confirm its page and playback methods before the bootstrap deadline.',
        'bootstrap',
      )
      this.hasStarted = false
      this.closeSession()
    }, EXTERNAL_COURSE_PAGE_BOOTSTRAP_TIMEOUT_MS)
    frame.src = sessionUrl.href
  }

  /** Sends the most recent player intent after the source confirms readiness. */
  private sendDesiredStatus(): void {
    const sessionId = this.sessionId
    const frame = this.frame
    const sourceOrigin = this.sourceOrigin
    const status = this.desiredStatus
    if (!this.ready || sessionId === undefined || frame === undefined || sourceOrigin === undefined || status === undefined) return
    const contentWindow = frame.contentWindow
    if (contentWindow === null) {
      this.reportDiagnostic(
        'RUNTIME_EXTERNAL_COURSE_PAGE_WINDOW_MISSING',
        'The iframe has no window target for the playback command.',
        'command',
      )
      return
    }
    const requestId = `${sessionId}:${++this.requestIndex}`
    this.latestRequestId = requestId
    const command: ExternalCoursePageCommand = status === 'playing' ? 'play' : 'pause'
    contentWindow.postMessage({ version: 1, sessionId, kind: 'command', requestId, command }, sourceOrigin)
  }

  /** Accepts only the active iframe's versioned messages for its current session. */
  private readonly handleMessage = (event: MessageEvent<unknown>): void => {
    const sessionId = this.sessionId
    const sourceOrigin = this.sourceOrigin
    const frame = this.frame
    if (this.destroyed
      || !this.attached
      || sessionId === undefined
      || sourceOrigin === undefined
      || frame === undefined
      || event.origin !== sourceOrigin
      || event.source !== frame.contentWindow) return
    const message = readReaderMessage(event.data)
    if (message === undefined) {
      this.reportDiagnostic(
        'RUNTIME_EXTERNAL_COURSE_PAGE_MESSAGE_INVALID',
        'The iframe sent an unrecognized or malformed protocol message.',
        'message',
      )
      return
    }
    if (message.sessionId !== sessionId) return
    if (message.kind === 'ready') {
      this.handleReady(message)
      return
    }
    if (message.kind === 'result') {
      this.handleCommandResult(message)
      return
    }
    if (message.kind === 'progress') {
      if (this.ready && !this.sequenceEnded) {
        this.playbackStore?.setState({
          timelineMs: message.timelineMs,
          durationMs: message.durationMs,
          status: message.status,
        })
      }
      return
    }
    if (message.kind === 'seek-result') {
      this.handleSeekResult(message)
      return
    }
    this.reportDiagnostic(
      'RUNTIME_EXTERNAL_COURSE_READER_ERROR',
      message.reason,
      message.phase ?? 'reader',
      { requestId: message.requestId, chapterId: message.chapterId, pageId: message.pageId },
    )
    if (message.phase === 'bootstrap' && !this.ready) {
      this.hasStarted = false
      this.closeSession()
    }
  }

  /** Checks the source identity and applies the latest player intent. */
  private handleReady(message: Extract<ExternalCoursePageReaderMessage, { kind: 'ready' }>): void {
    const declaration = this.declaration
    if (declaration === undefined) return
    if (message.chapterId !== declaration.initial.chapterId || message.pageId !== declaration.initial.pageId) {
      this.reportDiagnostic(
        'RUNTIME_EXTERNAL_COURSE_PAGE_IDENTITY_MISMATCH',
        `The reader opened ${message.chapterId}/${message.pageId}; expected ${declaration.initial.chapterId}/${declaration.initial.pageId}.`,
        'ready',
        { chapterId: message.chapterId, pageId: message.pageId },
      )
      this.hasStarted = false
      this.closeSession()
      return
    }
    if (this.ready) return
    this.ready = true
    this.clearBootstrapTimeout()
    if (this.sequenceEnded) {
      this.desiredStatus = 'paused'
      this.sendDesiredStatus()
      return
    }
    this.recordFact('external-course:ready', {
      chapterId: message.chapterId,
      pageId: message.pageId,
      sessionId: message.sessionId,
    })
    this.sendDesiredStatus()
  }

  /** Journals confirmed reader playback state without changing host intent. */
  private handleCommandResult(message: Extract<ExternalCoursePageReaderMessage, { kind: 'result' }>): void {
    const declaration = this.declaration
    if (declaration === undefined || this.sequenceEnded) return
    this.recordFact(`external-course:${message.status}`, {
      chapterId: declaration.initial.chapterId,
      pageId: declaration.initial.pageId,
      sessionId: message.sessionId,
      requestId: message.requestId,
      latestRequest: message.requestId === this.latestRequestId,
      sourceSequenceId: message.sourceSequenceId,
      sourceSoundAvailable: message.sourceSoundAvailable,
      sourcePositionMs: message.sourcePositionMs,
      sourceDurationMs: message.sourceDurationMs,
    })
  }

  /** Resolves one remote seek and adopts the reader's authoritative position. */
  private handleSeekResult(message: Extract<ExternalCoursePageReaderMessage, { kind: 'seek-result' }>): void {
    const pending = this.pendingSeeks.get(message.requestId)
    if (pending === undefined) return
    globalThis.clearTimeout(pending.timeout)
    this.pendingSeeks.delete(message.requestId)
    this.playbackStore?.setState({
      timelineMs: message.timelineMs,
      durationMs: message.durationMs,
      status: message.status,
    })
    pending.resolve(message.ok ? undefined : {
      ok: false,
      error: { message: message.reason ?? 'Le lecteur externe a refusé le seek.' },
    })
  }

  /** Sends one seek request through the active, origin-checked iframe session. */
  private readonly requestSourceSeek = (targetMs: number): Promise<ExternalCoursePageCommandResult> => {
    const sessionId = this.sessionId
    const frame = this.frame
    const sourceOrigin = this.sourceOrigin
    if (!this.ready || sessionId === undefined || frame === undefined || sourceOrigin === undefined) {
      return Promise.resolve({ ok: false, error: { message: 'Le lecteur externe n’est pas prêt pour le seek.' } })
    }
    const contentWindow = frame.contentWindow
    if (contentWindow === null) {
      return Promise.resolve({ ok: false, error: { message: 'La fenêtre du lecteur externe est indisponible.' } })
    }
    const requestId = `${sessionId}:seek:${++this.requestIndex}`
    return new Promise((resolve) => {
      const timeout = globalThis.setTimeout(() => {
        this.pendingSeeks.delete(requestId)
        resolve({ ok: false, error: { message: 'Le lecteur externe n’a pas confirmé le seek à temps.' } })
      }, EXTERNAL_COURSE_PAGE_SEEK_TIMEOUT_MS)
      this.pendingSeeks.set(requestId, { resolve, timeout })
      contentWindow.postMessage({
        version: 1,
        sessionId,
        kind: 'command',
        requestId,
        command: 'seek' satisfies ExternalCoursePageCommand,
        targetMs,
      }, sourceOrigin)
    })
  }

  /** Resolves every in-flight seek before the source session is reset or closed. */
  private settlePendingSeeks(message: string): void {
    for (const [requestId, pending] of this.pendingSeeks) {
      globalThis.clearTimeout(pending.timeout)
      this.pendingSeeks.delete(requestId)
      pending.resolve({ ok: false, error: { message } })
    }
  }

  /** Serializes source facts through the player event journal and shared pipeline. */
  private recordFact(name: string, data: CompiledRecord): void {
    const declaration = this.declaration
    const sessionId = this.sessionId
    const generation = this.generation
    if (declaration === undefined || sessionId === undefined) return
    this.eventQueue = this.eventQueue.then(async () => {
      if (this.destroyed || generation !== this.generation || sessionId !== this.sessionId) return
      const result = await this.context.commands.emit({
        name,
        applyAtMs: this.context.getCurrentTimeMs(),
        visibility: 'public',
        data,
        context: {
          source: 'external-course-page',
          persoId: declaration.persoId,
        },
      })
      if (!result.ok) {
        this.reportDiagnostic(
          'RUNTIME_EXTERNAL_COURSE_PAGE_EVENT_REJECTED',
          `The player rejected the reader fact ${name}.`,
          'event',
          { name, issues: result.issues.map((issue) => issue.code) },
        )
      }
      for (const issue of result.issues) {
        this.reportDiagnostic(issue.code, issue.message, 'event', { name })
      }
    }).catch((error: unknown) => {
      this.reportDiagnostic(
        'RUNTIME_EXTERNAL_COURSE_PAGE_EVENT_FAILED',
        error instanceof Error ? error.message : String(error),
        'event',
        { name },
      )
    })
  }

  /** Invalidates the old session before the iframe is blanked. */
  private closeSession(): void {
    this.generation += 1
    this.clearBootstrapTimeout()
    this.settlePendingSeeks('La session du lecteur externe a été fermée.')
    this.sessionId = undefined
    this.ready = false
    this.latestRequestId = undefined
    this.playbackStore?.clear()
    if (this.frame !== undefined && this.frame.hasAttribute('src')) this.frame.src = 'about:blank'
  }

  /** Clears the one bootstrap timer owned by the current source session. */
  private clearBootstrapTimeout(): void {
    if (this.bootstrapTimeout === undefined) return
    globalThis.clearTimeout(this.bootstrapTimeout)
    this.bootstrapTimeout = undefined
  }

  /** Reports one adapter or reader error with the page's logical identity. */
  private reportDiagnostic(
    code: string,
    message: string,
    phase: string,
    context: Readonly<Record<string, unknown>> = {},
  ): void {
    const declaration = this.declaration
    const diagnosticKey = `${code}:${phase}:${message}`
    if (this.reportedDiagnostics.has(diagnosticKey)) return
    this.reportedDiagnostics.add(diagnosticKey)
    const diagnostic: Diagnostic = {
      severity: 'error',
      code,
      message,
      details: {
        refs: {
          sceneId: this.sceneId,
          storyId: declaration?.storyId,
          persoId: declaration?.persoId,
        },
        context: {
          phase,
          chapterId: declaration?.initial.chapterId,
          pageId: declaration?.initial.pageId,
          ...context,
        },
      },
    }
    this.context.reportDiagnostic(diagnostic)
  }
}

/** Selects lifecycle states that map directly to the source's two transport commands. */
function resolveDesiredStatus(state: PlayerLifecycleState): ExternalCoursePagePlaybackStatus | undefined {
  if (state === PLAYER_LIFECYCLE_PLAYING) return 'playing'
  if (state === PLAYER_LIFECYCLE_PAUSED) return 'paused'
  return undefined
}

/** Finds the page component and preserves the runner's canonical story/perso key. */
function collectPageDeclarations(scene: CompiledScene): readonly ExternalCoursePageDeclaration[] {
  return Object.entries(scene.scene.stories).flatMap(([storyId, story]) => (
    story.persos
      .filter((perso) => perso.type === EXTERNAL_COURSE_PAGE_TYPE)
      .map((perso) => ({
        storyId,
        persoId: perso.id,
        persoKey: `${storyId}:${perso.id}`,
        initial: perso.initial as unknown as ExternalCoursePageInitial,
      }))
  ))
}

/** Parses and validates one structured-clone message at the window boundary. */
function readReaderMessage(value: unknown): ExternalCoursePageReaderMessage | undefined {
  if (!isPlainRecord(value) || value.version !== 1 || typeof value.sessionId !== 'string') return undefined
  if (value.kind === 'ready'
    && typeof value.chapterId === 'string'
    && typeof value.pageId === 'string') {
    return value as unknown as Extract<ExternalCoursePageReaderMessage, { kind: 'ready' }>
  }
  if (value.kind === 'result'
    && typeof value.requestId === 'string'
    && (value.status === 'playing' || value.status === 'paused')
    && (typeof value.sourceSequenceId === 'string' || value.sourceSequenceId === null)
    && typeof value.sourceSoundAvailable === 'boolean'
    && (value.sourcePositionMs === null || isFiniteNumber(value.sourcePositionMs))
    && (value.sourceDurationMs === null || isFiniteNumber(value.sourceDurationMs))) {
    return value as unknown as Extract<ExternalCoursePageReaderMessage, { kind: 'result' }>
  }
  if (value.kind === 'progress'
    && (value.status === 'playing' || value.status === 'paused')
    && isNonNegativeFiniteNumber(value.timelineMs)
    && isNonNegativeFiniteNumber(value.durationMs)) {
    return value as unknown as Extract<ExternalCoursePageReaderMessage, { kind: 'progress' }>
  }
  if (value.kind === 'seek-result'
    && typeof value.requestId === 'string'
    && typeof value.ok === 'boolean'
    && (value.status === 'playing' || value.status === 'paused')
    && isNonNegativeFiniteNumber(value.timelineMs)
    && isNonNegativeFiniteNumber(value.durationMs)
    && (value.reason === undefined || typeof value.reason === 'string')) {
    return value as unknown as Extract<ExternalCoursePageReaderMessage, { kind: 'seek-result' }>
  }
  if (value.kind === 'error'
    && typeof value.reason === 'string'
    && (value.phase === undefined || typeof value.phase === 'string')
    && (value.chapterId === undefined || typeof value.chapterId === 'string')
    && (value.pageId === undefined || typeof value.pageId === 'string')
    && (value.requestId === undefined || typeof value.requestId === 'string')) {
    return value as unknown as Extract<ExternalCoursePageReaderMessage, { kind: 'error' }>
  }
  return undefined
}

/** Accepts one finite source-time measurement from the reader boundary. */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** Accepts finite non-negative source timeline values at the message boundary. */
function isNonNegativeFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}
