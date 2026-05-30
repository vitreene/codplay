import { createS4QuizReferenceScene, s4QuizStraps } from '../scenes'
import { runCodPlaySceneDemo } from './run-codplay-scene-demo'

/**
 * Mounts the quiz business reference demo through the CodPlay surface.
 */
export async function runQuizReferenceDemo(): Promise<void> {
	await runCodPlaySceneDemo({
		title: 'Quiz Reference',
		subtitle: 'CodPlay compile la scene puis la joue via la facade publique avec un layout identique a la demo player.',
		scene: createS4QuizReferenceScene(),
		strapCollection: s4QuizStraps,
		rootNodeIds: ['quiz-layout'],
		demoLinks: [
			{ label: 'Player POC', href: '?demo=poc' },
			{ label: 'CodPlay POC', href: '?demo=codplay-poc' },
			{ label: 'Quiz Reference', href: '?demo=quiz', active: true },
			{ label: 'Drag & Capture', href: '?demo=drag' },
		],
	})
}
