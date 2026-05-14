import { runPlayerPocDemo } from './demos/player-poc-demo'
import { runQuizReferenceDemo } from './demos/quiz-reference-demo'

const demoName = new URL(globalThis.location.href).searchParams.get('demo')

if (demoName === 'quiz') {
	void runQuizReferenceDemo()
} else {
	void runPlayerPocDemo()
}
