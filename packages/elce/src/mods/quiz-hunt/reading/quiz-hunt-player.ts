import { createScrollContainerSourceAdapter } from '@codplay/component-v2/scroll-container'
import type { SightyScenarioDefinition } from '@codplay/sighty'
import type { QuizHuntDocument } from '../document/quiz-hunt-document-types'
import { ELCE_ENGINE_CAPABILITIES } from '../../../player/elce-player-engine'
import { ReadingRuntime } from '../../../core/reading/reading-runtime'
import type { QuizHuntGameStatePersistence } from '../persistence/quiz-hunt-game-state-persistence'
import { QuizHuntGameStateApiClient } from '../persistence/quiz-hunt-game-state-api-client'
import { createQuizHuntScenarioModel, QUIZ_HUNT_MENU_PROJECT_EVENT } from './quiz-hunt-scenario-builder'
import type { QuizHuntSceneKey, QuizHuntSlotName } from './quiz-hunt-scenario-builder'
import { QUIZ_HUNT_LAYOUT_EVENT, QUIZ_HUNT_SLOT } from './quiz-hunt-layout-scene'

export interface QuizHuntPlayerOptions {
  readonly stage: HTMLElement
  readonly document: QuizHuntDocument
  readonly mediaSources?: Readonly<Record<string, string>>
  readonly startPageId?: string
  readonly context?: 'authoring' | 'release'
  readonly gameStatePersistence?: QuizHuntGameStatePersistence
  readonly onPageChange?: (pageId: string) => void
  readonly onLog?: (message: string, level?: 'info' | 'warn' | 'error') => void
}

/** Owns the real Sighty/CodPlay runtime used to play one Quiz Hunt document. */
export class QuizHuntPlayer {
  private runtime: ReadingRuntime<QuizHuntSceneKey, QuizHuntSlotName> | null = null
  private readonly options: QuizHuntPlayerOptions
  private readonly statePersistence: QuizHuntGameStatePersistence | undefined
  private trialPageIds: ReadonlySet<string> = new Set()
  private removeSlotChange: (() => void) | undefined
  private activePointerId: number | null = null
  private dropTargetPageId: string | null = null
  private destroyed = false

  /** Builds one complete Quiz Hunt scenario and installs its host-side drop hit-test. */
  public constructor(options: QuizHuntPlayerOptions) {
    this.options = options
    this.statePersistence = options.context === 'release'
      ? options.gameStatePersistence ?? new QuizHuntGameStateApiClient()
      : options.gameStatePersistence
    const ownerWindow = options.stage.ownerDocument.defaultView
    ownerWindow?.addEventListener('pointerdown', this.handlePointerDown, true)
    ownerWindow?.addEventListener('pointerup', this.handlePointerUpCapture, true)
    ownerWindow?.addEventListener('pointercancel', this.handlePointerCancelCapture, true)
    options.stage.addEventListener('pointerup', this.handlePointerUp)
    options.stage.addEventListener('pointercancel', this.handlePointerCancel)
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
    const ownerWindow = this.options.stage.ownerDocument.defaultView
    ownerWindow?.removeEventListener('pointerdown', this.handlePointerDown, true)
    ownerWindow?.removeEventListener('pointerup', this.handlePointerUpCapture, true)
    ownerWindow?.removeEventListener('pointercancel', this.handlePointerCancelCapture, true)
    this.options.stage.removeEventListener('pointerup', this.handlePointerUp)
    this.options.stage.removeEventListener('pointercancel', this.handlePointerCancel)
    this.removeSlotChange?.()
    this.removeSlotChange = undefined
    this.runtime?.destroy()
    this.runtime = null
  }

  /** Records only pointer captures that begin on the layout-owned extra token. */
  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (!(event.target instanceof Element)) return
    if (event.target.closest('.quiz-hunt-extra-token') === null) return
    this.activePointerId = event.pointerId
    this.dropTargetPageId = null
  }

  /** Resolves the tile beneath the captured token from the shared owner document. */
  private readonly handlePointerUpCapture = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return
    const elements = this.options.stage.ownerDocument.elementsFromPoint(event.clientX, event.clientY)
    const target = elements.flatMap((element) => {
      if (element.closest('.quiz-hunt-extra-token') !== null) return []
      const tile = element.closest<HTMLElement>('[data-quiz-hunt-page-id]')
      const pageId = tile?.dataset.quizHuntPageId
      return tile !== null && this.options.stage.contains(tile) && pageId !== undefined && this.trialPageIds.has(pageId)
        ? [pageId]
        : []
    })[0]
    this.dropTargetPageId = target ?? null
  }

  /** Publishes the resolved tile identity to the scenario after CodPlay ends capture. */
  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return
    this.dispatchDropTarget()
  }

  /** Captures cancellation before the stage listener returns the token to inventory. */
  private readonly handlePointerCancelCapture = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return
    this.dropTargetPageId = null
  }

  /** Returns a canceled token through the same Sighty validation path as an invalid drop. */
  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return
    this.dispatchDropTarget()
  }

  /** Sends one public intent and clears the transient DOM hit-test result. */
  private dispatchDropTarget(): void {
    const pageId = this.dropTargetPageId
    this.activePointerId = null
    this.dropTargetPageId = null
    const runtime = this.runtime
    if (this.destroyed || runtime === null) return
    void runtime.api.dispatch({
      name: QUIZ_HUNT_LAYOUT_EVENT.EXTRA_DROP_TARGET,
      sourceSceneKey: 'scene-layout',
      data: { pageId },
    }).catch((error: unknown) => {
      this.options.onLog?.(`Le dépôt du jeton Quiz Hunt a échoué : ${String(error)}`, 'error')
    })
  }

  /** Maps a selected page or Sommaire scene back to its document ID. */
  private pageIdForScene(sceneKey: QuizHuntSceneKey | undefined): string | undefined {
    if (sceneKey === undefined) return undefined
    if (sceneKey === 'scene-summary') return this.options.document.pages.find((page) => page.type === 'summary')?.id
    const pageId = sceneKey.startsWith('scene-page-') ? sceneKey.slice('scene-page-'.length) : undefined
    return pageId !== undefined && this.options.document.pages.some((page) => page.id === pageId)
      ? pageId
      : undefined
  }
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
