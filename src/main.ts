import { runCodPlayPocDemo } from './demos/codplay/codplay-poc-demo'
import { runDragDemo } from './demos/codplay/drag-demo'
import { runDndListDemo } from './demos/codplay/dnd-list-demo'
import { runQuizReferenceDemo } from './demos/codplay/quiz-reference-demo'
import { runPlayerPocDemo } from './demos/player/player-poc-demo'

const demoName = new URL(globalThis.location.href).searchParams.get('demo')

if (demoName === 'quiz') {
	void runQuizReferenceDemo()
} else if (demoName === 'codplay-poc') {
	void runCodPlayPocDemo()
} else if (demoName === 'drag') {
	void runDragDemo()
} else if (demoName === 'dnd-list') {
	void runDndListDemo()
} else {
	void runPlayerPocDemo()
}
