import { Sighty } from '@codplay/sighty'
import { SIGHTY_SCENE_ROOT_STYLE_SHEET } from '../scene-root-capsule'
import { createQuizHuntGameData } from './game-data'
import { QUIZ_HUNT_EVENTS, retryTrialEvent } from './messages'
import {
  createInitialQuizHuntContext,
  createQuizHuntScenario,
  type QuizHuntSceneKey,
  type QuizHuntSlotName,
} from './scenario'

type QuizHuntCompositionOptions = Readonly<{
  stage: HTMLElement
  onLog: (message: string, level?: 'info' | 'warn' | 'error') => void
}>

type QuizHuntSighty = Sighty<QuizHuntSceneKey, QuizHuntSlotName>

type QuizHuntTrialHitTest = Readonly<{
  trialId: string | undefined
}>

type QuizHuntTokenDropObservation = Readonly<{
  isInInventory: boolean
  isDragging: boolean
  hitTest: QuizHuntTrialHitTest
}>

/** Owns Quiz Hunt's Sighty runtime, eager catalog generation, and scene lifecycle. */
export class QuizHuntComposition {
  private readonly sighty: QuizHuntSighty
  private readonly options: QuizHuntCompositionOptions
  private readonly pointerEventTarget: EventTarget
  private readonly pendingTokenDrops = new WeakMap<PointerEvent, QuizHuntTokenDropObservation>()
  private readonly handlePointerEndCapture: EventListener
  private readonly handlePointerEnd: EventListener
  readonly runtime: QuizHuntSighty['runtime']

  /** Creates the full trial and final catalog before Sighty compiles and preloads the scenario. */
  constructor(options: QuizHuntCompositionOptions) {
    this.options = options
    this.pointerEventTarget = options.stage.ownerDocument.defaultView ?? options.stage
    this.handlePointerEndCapture = (event) => this.captureTokenDropTarget(event as PointerEvent)
    this.handlePointerEnd = (event) => this.dispatchTokenDrop(event as PointerEvent)
    const gameData = createQuizHuntGameData()
    const scenario = createQuizHuntScenario(gameData)
    const instanceIds = Object.fromEntries(Object.keys(scenario.scenes ?? {}).map((sceneKey) => [
      sceneKey,
      `quiz-hunt-${sceneKey}-instance`,
    ])) as Record<QuizHuntSceneKey, string>
    this.sighty = new Sighty({
      scenario,
      runtime: {
        root: options.stage,
        instanceIds,
        context: createInitialQuizHuntContext(gameData),
        styles: [{ slot: 'sighty-quiz-hunt-scene-root', cssText: SIGHTY_SCENE_ROOT_STYLE_SHEET }],
        codplay: {
          engine: {
            idle: false,
            diagnosticOutput: (diagnostic) => {
              options.onLog(diagnostic.message, diagnostic.severity === 'warning' ? 'warn' : 'error')
            },
          },
          pauseOnDocumentHidden: false,
        },
      },
    })
    this.runtime = this.sighty.runtime
    // Register before runtime.initialize() attaches CodPlay's window capture source.
    this.pointerEventTarget.addEventListener('pointerup', this.handlePointerEndCapture, true)
    this.pointerEventTarget.addEventListener('pointercancel', this.handlePointerEndCapture, true)
    options.stage.addEventListener('pointerup', this.handlePointerEnd, true)
    options.stage.addEventListener('pointercancel', this.handlePointerEnd, true)
  }

  /** Initializes all direct scenes, starts the visible composition, and projects state. */
  async initialize(): Promise<void> {
    await this.runtime.initialize()
    await this.runtime.play('scene-layout')
    const refreshed = await this.runtime.dispatch({ name: QUIZ_HUNT_EVENTS.refresh })
    if (!refreshed) this.options.onLog('La présentation initiale de Quiz Hunt n’a pas été traitée.', 'warn')
    this.options.onLog('Quiz Hunt initialisé : menu, questions, panier et minuteur orchestrés par Sighty.')
  }

  /** Destroys the game runtime and releases every owned scene occurrence. */
  destroy(): void {
    this.pointerEventTarget.removeEventListener('pointerup', this.handlePointerEndCapture, true)
    this.pointerEventTarget.removeEventListener('pointercancel', this.handlePointerEndCapture, true)
    this.options.stage.removeEventListener('pointerup', this.handlePointerEnd, true)
    this.options.stage.removeEventListener('pointercancel', this.handlePointerEnd, true)
    this.runtime.destroy()
  }

  /** Saves a release target before CodPlay closes capture and records cancelled drags. */
  private captureTokenDropTarget(event: PointerEvent): void {
    const token = this.options.stage.querySelector<HTMLElement>('.quiz-hunt-extra-token')
    if (token === null) return

    const isInInventory = token.classList.contains('quiz-hunt-extra-token-inventory')
    const isDragging = token.classList.contains('is-dragging')
    const capturedOnToken = event.target instanceof Node && token.contains(event.target)
    if (!isDragging && !capturedOnToken) return

    const hitTest = event.type === 'pointerup'
      ? inspectTrialUnderPointer(this.options.stage, token, event)
      : { trialId: undefined }
    this.pendingTokenDrops.set(event, { isInInventory, isDragging, hitTest })
  }

  /** Requests a retry for a valid drop or returns every other drag to inventory. */
  private dispatchTokenDrop(event: PointerEvent): void {
    const observation = this.pendingTokenDrops.get(event)
    if (observation === undefined) return
    this.pendingTokenDrops.delete(event)

    const { isInInventory, isDragging, hitTest } = observation
    if (!isDragging) return
    const canRetry = event.type === 'pointerup'
      && isInInventory
      && hitTest.trialId !== undefined
    const name = canRetry && hitTest.trialId !== undefined
      ? retryTrialEvent(hitTest.trialId)
      : QUIZ_HUNT_EVENTS.extraDragReturn
    void this.runtime.dispatch({ name, sourceSceneKey: 'scene-layout' }).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error)
      this.options.onLog(`Le dépôt du jeton n’a pas pu être transmis à Sighty : ${detail}`, 'warn')
    })
  }
}

/** Reads the DOM stack under release, ignoring the captured token when resolving its menu target. */
function inspectTrialUnderPointer(
  stage: HTMLElement,
  token: HTMLElement,
  event: PointerEvent,
): QuizHuntTrialHitTest {
  const elements = stage.ownerDocument.elementsFromPoint(event.clientX, event.clientY)
  const belowToken = elements.filter((element) => element !== token && !token.contains(element))
  const tileElement = belowToken.find((element) => (
    stage.contains(element) && element.closest('[data-quiz-hunt-trial-id]') !== null
  ))
  const tile = tileElement?.closest<HTMLElement>('[data-quiz-hunt-trial-id]') ?? null
  const isInsideStage = tile !== null && stage.contains(tile)
  const trialId = tile?.dataset.quizHuntTrialId
  return { trialId: isInsideStage && trialId !== undefined && trialId.length > 0 ? trialId : undefined }
}
