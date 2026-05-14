import { createS4QuizReferenceScene } from './scenes';
import { runPlayerSceneDemo } from './run-player-scene-demo';

/**
 * Mounts the quiz business reference demo using the shared player shell.
 */
export async function runQuizReferenceDemo(): Promise<void> {
	await runPlayerSceneDemo({
		title: 'Quiz Reference',
		subtitle: 'Decor persistant, intro temporisee, question puis branche yes/no par emit runtime.',
		scene: createS4QuizReferenceScene(),
		rootNodeIds: ['quiz-stage', 'quiz-intro-panel', 'quiz-question-panel', 'quiz-success-panel', 'quiz-failure-panel'],
		demoLinks: [
			{ label: 'Player POC', href: '?demo=poc' },
			{ label: 'Quiz Reference', href: '?demo=quiz', active: true },
		],
	});
}
