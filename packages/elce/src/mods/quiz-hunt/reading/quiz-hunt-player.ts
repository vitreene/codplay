import { createScrollContainerSourceAdapter } from '@codplay/component-v2/scroll-container'
import type { SightyScenarioDefinition } from '@codplay/sighty'
import type { QuizHuntDocument } from '../document/quiz-hunt-document-types'
import { ELCE_ENGINE_CAPABILITIES } from '../../../player/elce-player-engine'
import { ReadingRuntime } from '../../../core/reading/reading-runtime'
import type { QuizHuntGameStatePersistence } from '../persistence/quiz-hunt-game-state-persistence'
import { QuizHuntGameStateApiClient } from '../persistence/quiz-hunt-game-state-api-client'
import { createQuizHuntScenarioModel, QUIZ_HUNT_MENU_PROJECT_EVENT } from './quiz-hunt-scenario-builder'
import type { QuizHuntSceneKey, QuizHuntSlotName } from './quiz-hunt-scenario-builder'
import { QUIZ_HUNT_VIDEO_EVENT } from './quiz-hunt-page-scene-catalog'
import { QUIZ_HUNT_LAYOUT_EVENT, QUIZ_HUNT_SLOT } from './quiz-hunt-layout-scene'

export interface QuizHuntPlayerOptions {
  readonly stage: HTMLElement
  readonly document: QuizHuntDocument
  readonly mediaSources?: Readonly<Record<string, string>>
  readonly startPageId?: string
  readonly context?: 'authoring' | 'release'
  readonly gameStatePersistence?: QuizHuntGameStatePersistence
  readonly showAuthoringGridDebug?: boolean
  readonly onPageChange?: (pageId: string) => void
  readonly onLog?: (message: string, level?: 'info' | 'warn' | 'error') => void
}

type QuizHuntTokenDropObservation = Readonly<{
  isInInventory: boolean
  isDragging: boolean
  pageId: string | undefined
}>

/** Owns the real Sighty/CodPlay runtime used to play one Quiz Hunt document. */
export class QuizHuntPlayer {
  private runtime: ReadingRuntime<QuizHuntSceneKey, QuizHuntSlotName> | null = null
  private readonly options: QuizHuntPlayerOptions
  private readonly statePersistence: QuizHuntGameStatePersistence | undefined
  private trialPageIds: ReadonlySet<string> = new Set()
  private removeSlotChange: (() => void) | undefined
  private readonly pointerEventTarget: EventTarget
  private readonly pendingTokenDrops = new WeakMap<PointerEvent, QuizHuntTokenDropObservation>()
  private readonly handlePointerEndCapture: EventListener = (event) => this.captureTokenDropTarget(event as PointerEvent)
  private readonly handlePointerEnd: EventListener = (event) => this.dispatchTokenDrop(event as PointerEvent)
  private destroyed = false

  /** Builds one complete Quiz Hunt scenario and installs its host-side drop hit-test. */
  public constructor(options: QuizHuntPlayerOptions) {
    this.options = options
    this.statePersistence = options.context === 'release'
      ? options.gameStatePersistence ?? new QuizHuntGameStateApiClient()
      : options.gameStatePersistence
    this.pointerEventTarget = options.stage.ownerDocument.defaultView ?? options.stage
    this.pointerEventTarget.addEventListener('pointerup', this.handlePointerEndCapture, true)
    this.pointerEventTarget.addEventListener('pointercancel', this.handlePointerEndCapture, true)
    options.stage.addEventListener('play', this.handleVideoPlayback, true)
    options.stage.addEventListener('pause', this.handleVideoPlayback, true)
    options.stage.addEventListener('ended', this.handleVideoPlayback, true)
    options.stage.addEventListener('pointerup', this.handlePointerEnd, true)
    options.stage.addEventListener('pointercancel', this.handlePointerEnd, true)
  }

  /** Initializes Sighty and starts the persistent game layout. */
  public async initialize(): Promise<void> {
    if (this.destroyed || this.runtime !== null) return
    const context = this.options.context ?? 'authoring'
    const statePersistence = this.statePersistence
    const savedRun = context === 'release' ? await statePersistence?.readGameState(this.options.document.id) ?? null : null
    const model = createQuizHuntScenarioModel(
      this.options.document,
      this.options.mediaSources,
      context,
      this.options.startPageId,
      savedRun,
      statePersistence === undefined ? undefined : (value) => statePersistence.saveGameState(this.options.document.id, value).then(() => undefined),
      statePersistence === undefined ? undefined : () => statePersistence.readGameState(this.options.document.id),
      () => this.options.stage.ownerDocument.defaultView?.setTimeout(() => {
        void this.restartGame().catch((error: unknown) => {
          this.options.onLog?.(`Le redémarrage Quiz Hunt a échoué : ${String(error)}`, 'error')
        })
      }, 0),
      this.options.showAuthoringGridDebug ?? false,
    )
    this.trialPageIds = new Set(model.game.trials.map((trial) => trial.page.id))
    const runtime = new ReadingRuntime(model.scenario, {
      root: this.options.stage,
      context: model.initialContext,
      instanceIds: createInstanceIds(model.scenario),
      codplay: {
        engine: {
          ...ELCE_ENGINE_CAPABILITIES,
          idle: false,
          diagnosticOutput: (diagnostic) => {
            this.options.onLog?.(diagnostic.message, diagnostic.severity === 'warning' ? 'warn' : 'error')
          },
        },
        htmlHost: { sourceAdapterFactories: [createScrollContainerSourceAdapter] },
        pauseOnDocumentHidden: false,
      },
    })
    this.runtime = runtime
    await runtime.initialize()
    this.removeSlotChange = runtime.api.onSlotChange(QUIZ_HUNT_SLOT.CONTENT, (sceneKey) => {
      const pageId = this.pageIdForScene(sceneKey)
      if (pageId !== undefined) this.options.onPageChange?.(pageId)
    })
    await runtime.api.play('scene-layout')
    if (savedRun !== null) {
      await runtime.api.dispatch({
        name: QUIZ_HUNT_MENU_PROJECT_EVENT,
        sourceSceneKey: 'scene-layout',
      })
    }
    const initialPageId = this.getCurrentPageId()
    if (initialPageId !== undefined) this.options.onPageChange?.(initialPageId)
    this.options.onLog?.('Joueur Quiz Hunt initialisé.', 'info')
  }

  /** Returns the authored page selected in the content slot, when one is active. */
  public getCurrentPageId(): string | undefined {
    const runtime = this.runtime
    if (runtime === null) return undefined
    const current = runtime.api.scenarioState.current.find((selection) => selection.slotName === QUIZ_HUNT_SLOT.CONTENT)
    return current === undefined ? undefined : this.pageIdForScene(current.sceneKey)
  }

  /** Starts a clean game while retaining the author's configured seed policy. */
  public async restartGame(): Promise<void> {
    if (this.destroyed) return
    await this.statePersistence?.clearGameState(this.options.document.id)
    this.removeSlotChange?.()
    this.removeSlotChange = undefined
    this.runtime?.destroy()
    this.runtime = null
    await this.initialize()
  }

  /** Destroys Sighty and releases the host-side pointer listeners. */
  public destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    this.pointerEventTarget.removeEventListener('pointerup', this.handlePointerEndCapture, true)
    this.pointerEventTarget.removeEventListener('pointercancel', this.handlePointerEndCapture, true)
    this.options.stage.removeEventListener('play', this.handleVideoPlayback, true)
    this.options.stage.removeEventListener('pause', this.handleVideoPlayback, true)
    this.options.stage.removeEventListener('ended', this.handleVideoPlayback, true)
    this.options.stage.removeEventListener('pointerup', this.handlePointerEnd, true)
    this.options.stage.removeEventListener('pointercancel', this.handlePointerEnd, true)
    this.removeSlotChange?.()
    this.removeSlotChange = undefined
    this.runtime?.destroy()
    this.runtime = null
  }

  /** Captures the inventory state and intended question before Sighty closes the pointer capture. */
  private captureTokenDropTarget(event: PointerEvent): void {
    const token = this.options.stage.querySelector<HTMLElement>('.quiz-hunt-extra-token')
    if (token === null) return

    const isInInventory = token.classList.contains('quiz-hunt-extra-token-inventory')
    const isDragging = token.classList.contains('is-dragging')
    const capturedOnToken = event.target instanceof Node && token.contains(event.target)
    if (!isDragging && !capturedOnToken) return

    const pageId = event.type === 'pointerup'
      ? inspectTrialUnderPointer(this.options.stage, token, event, this.trialPageIds)
      : undefined
    this.pendingTokenDrops.set(event, { isInInventory, isDragging, pageId })
  }

  /** Dispatches one completed token drag at the same capture phase used by the Sighty demo. */
  private dispatchTokenDrop(event: PointerEvent): void {
    const observation = this.pendingTokenDrops.get(event)
    if (observation === undefined) return
    this.pendingTokenDrops.delete(event)

    const { isInInventory, isDragging, pageId } = observation
    if (!isDragging) return
    const targetPageId = event.type === 'pointerup' && isInInventory ? pageId : undefined
    const runtime = this.runtime
    if (this.destroyed || runtime === null) return
    void runtime.api.dispatch({
      name: QUIZ_HUNT_LAYOUT_EVENT.EXTRA_DROP_TARGET,
      sourceSceneKey: 'scene-layout',
      data: targetPageId === undefined ? {} : { pageId: targetPageId },
    }).catch((error: unknown) => {
      this.options.onLog?.(`Le dépôt du jeton Quiz Hunt a échoué : ${String(error)}`, 'error')
    })
  }

  /** Forwards native playback changes from Quiz Hunt Question videos into Sighty. */
  private readonly handleVideoPlayback = (event: Event): void => {
    const ownerWindow = this.options.stage.ownerDocument.defaultView
    const video = event.target
    if (ownerWindow === null || !(video instanceof ownerWindow.HTMLVideoElement)) return
    if (event.type === 'pause' && video.ended) return
    const videoHost = video.closest<HTMLElement>('[data-quiz-hunt-video-page-id]')
    const pageId = videoHost?.dataset.quizHuntVideoPageId
    const eventName = event.type === 'play'
      ? QUIZ_HUNT_VIDEO_EVENT.PLAY
      : event.type === 'pause'
        ? QUIZ_HUNT_VIDEO_EVENT.PAUSE
        : event.type === 'ended' ? QUIZ_HUNT_VIDEO_EVENT.ENDED : undefined
    const runtime = this.runtime
    if (pageId === undefined || eventName === undefined || !this.options.stage.contains(videoHost) || runtime === null) return
    void runtime.api.dispatch({
      name: eventName,
      sourceSceneKey: `scene-page-${pageId}`,
      data: { pageId },
    }).catch((error: unknown) => {
      this.options.onLog?.(`La synchronisation de la vidéo Quiz Hunt a échoué : ${String(error)}`, 'error')
    })
  }

  /** Maps selected content, including terminal views, back to its document page ID. */
  private pageIdForScene(sceneKey: QuizHuntSceneKey | undefined): string | undefined {
    if (sceneKey === undefined) return undefined
    if (sceneKey === 'scene-summary' || sceneKey === 'scene-result-success' || sceneKey === 'scene-result-failure') {
      return this.options.document.pages.find((page) => page.type === 'summary')?.id
    }
    const pageId = sceneKey.startsWith('scene-page-') ? sceneKey.slice('scene-page-'.length) : undefined
    return pageId !== undefined && this.options.document.pages.some((page) => page.id === pageId)
      ? pageId
      : undefined
  }
}

/** Finds one drawn Question tile under the pointer, excluding the captured token itself. */
function inspectTrialUnderPointer(
  stage: HTMLElement,
  token: HTMLElement,
  event: PointerEvent,
  trialPageIds: ReadonlySet<string>,
): string | undefined {
  const elements = stage.ownerDocument.elementsFromPoint(event.clientX, event.clientY)
  const belowToken = elements.filter((element) => element !== token && !token.contains(element))
  const tileElement = belowToken.find((element) => (
    stage.contains(element) && element.closest('[data-quiz-hunt-page-id]') !== null
  ))
  const tile = tileElement?.closest<HTMLElement>('[data-quiz-hunt-page-id]') ?? null
  const pageId = tile?.dataset.quizHuntPageId
  return tile !== null && stage.contains(tile) && pageId !== undefined && trialPageIds.has(pageId)
    ? pageId
    : undefined
}

/** Assigns one stable CodPlay instance identity to each scene in the scenario. */
function createInstanceIds(
  scenario: SightyScenarioDefinition<QuizHuntSceneKey, QuizHuntSlotName>,
): Record<QuizHuntSceneKey, string> {
  return Object.fromEntries(Object.keys(scenario.scenes ?? {}).map((sceneKey) => [
    sceneKey,
    `quiz-hunt-${sceneKey}-instance`,
  ])) as Record<QuizHuntSceneKey, string>
}
