import { createQuizQuestionScene } from '../scenes'
import { quizQuestionSceneStraps } from '../scenes/quiz-question-scene'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

/**
 * Mounts the generated quiz question demo through the CodPlay surface.
 */
export async function runQuizQuestionDemo(): Promise<void> {
	await runCodPlaySceneDemo({
		title: 'Quiz Question',
		subtitle: 'Question V1 generee sans form dans la scene, avec inputs, boutons et straps locaux.',
		scene: createQuizQuestionScene({
			index: 1,
			type: 'single',
			prompt: 'Which answer is correct?',
			answers: [
				{ id: 'a', label: 'Alpha', isCorrect: true },
				{ id: 'b', label: 'Beta', isCorrect: false }
			],
			labels: {
				validate: 'Valider',
				next: 'Suivant',
				correct: 'Correct',
				incorrect: 'Incorrect',
				multipleHint: 'Plusieurs reponses possibles'
			}
		}),
		strapCollection: quizQuestionSceneStraps,
		activeDemo: 'quiz-question'
	})
}
