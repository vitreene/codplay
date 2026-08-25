import { QUIZ_HUNT_DEBUG_QUESTION_TRACK_ID, createQuizHuntScene, createQuizHuntStraps } from '../scenes'
import type { GameConfig, QuizHuntContent } from '../scenes/quiz-hunt/types'
import quizHuntContent from '../scenes/quiz-hunt/assets/questions/quiz-hunt-sf-spatiale.json'
import nostromoVideoUrl from '../scenes/quiz-hunt/assets/questions/nostromo.mp4'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

const content: QuizHuntContent = structuredClone(quizHuntContent as QuizHuntContent)
const nostromoWord = content.words.find((word) => word.id === 'nostromo')
if (nostromoWord?.trial.clueMedia?.type === 'video') {
  nostromoWord.trial.clueMedia.src = nostromoVideoUrl
}

const config: GameConfig = {
  content,
  seed: 1,
  timerTotalMs: 3 * 60 * 1000,
  extraDurationMs: 3000,
  showCorrection: true,
  labels: {
    validate: 'Valider',
    next: 'Suivant',
    correct: 'Gagné !',
    incorrect: 'Perdu',
    multipleHint: 'Plusieurs réponses possibles',
    gridTitle: 'Choisis une épreuve',
    basketTitle: 'Panier',
    basketEmptySlot: '—',
    finalButton: 'Épreuve finale',
    resultPassedTitle: 'Partie réussie !',
    resultFailedTitle: 'Partie échouée',
    extraLabel: 'Jeton de rattrapage'
  }
}

/**
 * Mounts the quiz-hunt demo: a 16-tile grid hunt across 4 colors, each tile a
 * reading+quiz trial, ending on a final question once the basket is full.
 */
export async function runQuizHuntDemo(): Promise<void> {
  const scene = createQuizHuntScene(config)

  await runCodPlaySceneDemo({
    title: 'Quiz Hunt — SF spatiale',
    subtitle: '16 epreuves autour des films de science-fiction spatiale, 4 couleurs a completer, une question finale contre le temps.',
    scene,
    strapCollection: createQuizHuntStraps(config, scene),
    activeDemo: 'quiz-hunt',
    onControlsReady: ({ player, container, sceneContainer }) => {
      let active = false
      let previousPointerEvents = ''
      let previousHadInert = false
      let lockObserver: MutationObserver | null = null
      const enforceInspectableContainer = () => {
        sceneContainer.style.pointerEvents = 'auto'
        sceneContainer.removeAttribute('inert')
      }
      const setDebugInspectionMode = (enabled: boolean) => {
        if (enabled) {
          previousPointerEvents = sceneContainer.style.pointerEvents
          previousHadInert = sceneContainer.hasAttribute('inert')
          enforceInspectableContainer()
          lockObserver = new MutationObserver(() => {
            if (active) {
              enforceInspectableContainer()
            }
          })
          lockObserver.observe(sceneContainer, { attributes: true, attributeFilter: ['style', 'inert'] })
          return
        }

        lockObserver?.disconnect()
        lockObserver = null
        sceneContainer.style.pointerEvents = previousPointerEvents
        if (previousHadInert) {
          sceneContainer.setAttribute('inert', '')
        } else {
          sceneContainer.removeAttribute('inert')
        }
      }
      const label = globalThis.document.createElement('label')
      label.className = 'quiz-hunt-debug-toggle'
      const input = globalThis.document.createElement('input')
      input.type = 'checkbox'
      const track = globalThis.document.createElement('span')
      track.className = 'quiz-hunt-debug-toggle-track'
      const text = globalThis.document.createElement('span')
      text.className = 'quiz-hunt-debug-toggle-label'
      text.textContent = 'Debug'
      input.addEventListener('change', () => {
        active = input.checked
        setDebugInspectionMode(active)
        void player.emit({
          name: active ? 'track:activate' : 'track:deactivate',
          payload: { trackIds: [QUIZ_HUNT_DEBUG_QUESTION_TRACK_ID] }
        })
      })
      label.append(input, track, text)
      container.appendChild(label)
    }
  })
}
