import { runCarouselDemo } from './demos/codplay/carousel-demo'
import { runReplaceCarouselDemo } from './demos/codplay/replace-carousel-demo'
import { runCodPlayPocDemo } from './demos/codplay/codplay-poc-demo'
import { runPreloadMediaDemo } from './demos/codplay/preload-media-demo'
import { runDragDemo } from './demos/codplay/drag-demo'
import { runDndListDemo } from './demos/codplay/dnd-list-demo'
import { runQuizQuestionDemo } from './demos/codplay/quiz-question-demo'
import { runQuizReferenceDemo } from './demos/codplay/quiz-reference-demo'
import { runQuizSeriesDemo } from './demos/codplay/quiz-series-demo'
import { runPlayerPocDemo } from './demos/player/player-poc-demo'

const demoName = new URL(globalThis.location.href).searchParams.get('demo')

if (demoName === 'quiz') {
	void runQuizReferenceDemo()
} else if (demoName === 'quiz-question') {
	void runQuizQuestionDemo()
} else if (demoName === 'quiz-series') {
	void runQuizSeriesDemo()
} else if (demoName === 'codplay-poc') {
	void runCodPlayPocDemo()
} else if (demoName === 'drag') {
	void runDragDemo()
} else if (demoName === 'dnd-list') {
	void runDndListDemo()
} else if (demoName === 'preload-media') {
	void runPreloadMediaDemo()
} else if (demoName === 'carousel') {
	void runCarouselDemo()
} else if (demoName === 'replace-carousel') {
	void runReplaceCarouselDemo()
} else {
	void runPlayerPocDemo()
}
