import { runCarouselDemo } from './codplay/carousel-demo'
import { runReplaceCarouselDemo } from './codplay/replace-carousel-demo'
import { runCodPlayPocDemo } from './codplay/codplay-poc-demo'
import { runPreloadMediaDemo } from './codplay/preload-media-demo'
import { runDragDemo } from './codplay/drag-demo'
import { runDndListDemo } from './codplay/dnd-list-demo'
import { runQuizQuestionDemo } from './codplay/quiz-question-demo'
import { runQuizReferenceDemo } from './codplay/quiz-reference-demo'
import { runQuizSeriesDemo } from './codplay/quiz-series-demo'
import { runPlayerPocDemo } from './player/player-poc-demo'
import { runAvatarPocDemo } from './codplay/avatar-poc-demo'
import { runAvatarPoc1Demo } from './codplay/avatar-poc-1-demo'

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
} else if (demoName === 'avatar-poc') {
	void runAvatarPocDemo()
} else if (demoName === 'avatar-poc-1') {
	void runAvatarPoc1Demo()
} else {
	void runPlayerPocDemo()
}
