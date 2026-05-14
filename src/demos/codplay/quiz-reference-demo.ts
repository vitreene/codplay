import { createS4QuizReferenceScene } from '../scenes'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

/**
 * Mounts the quiz business reference demo through the CodPlay surface.
 */
export async function runQuizReferenceDemo(): Promise<void> {
	await runCodPlaySceneDemo({
		title: 'Quiz Reference',
		subtitle: 'CodPlay compile la scene puis la joue via la facade publique avec un layout identique a la demo player.',
		scene: createS4QuizReferenceScene(),
		rootNodeIds: ['quiz-stage', 'quiz-intro-panel', 'quiz-question-panel', 'quiz-success-panel', 'quiz-failure-panel'],
		demoLinks: [
			{ label: 'Player POC', href: '?demo=poc' },
			{ label: 'Quiz Reference', href: '?demo=quiz', active: true },
		],
	})
}
