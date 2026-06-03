import { createQuizQuestionScene, quizQuestionStraps } from '../scenes'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

/**
 * Mounts the generated quiz question demo through the CodPlay surface.
 */
export async function runQuizQuestionDemo(): Promise<void> {
	await runCodPlaySceneDemo({
		title: 'Quiz Question',
		subtitle: 'Question V1 generee avec form/input et straps locaux.',
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
		strapCollection: quizQuestionStraps,
		rootNodeIds: ['quiz-question-panel'],
		activeDemo: 'quiz-question'
	})
}
