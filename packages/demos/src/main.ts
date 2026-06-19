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
import { runAvatarPoc1Demo } from './codplay/avatar-poc-1-demo'
import { runAvatarRiveDemo } from './codplay/avatar-rive-demo'
import { runRiveCoachDemo } from './codplay/rive-coach-demo'
import { runChronoDemo } from './codplay/chrono-demo'

const demoName = new URL(globalThis.location.href).searchParams.get('demo')

switch (demoName) {
	case 'quiz':            void runQuizReferenceDemo(); break
	case 'quiz-question':   void runQuizQuestionDemo(); break
	case 'quiz-series':     void runQuizSeriesDemo(); break
	case 'codplay-poc':     void runCodPlayPocDemo(); break
	case 'drag':            void runDragDemo(); break
	case 'dnd-list':        void runDndListDemo(); break
	case 'preload-media':   void runPreloadMediaDemo(); break
	case 'carousel':        void runCarouselDemo(); break
	case 'replace-carousel': void runReplaceCarouselDemo(); break
	case 'avatar-poc-1':    void runAvatarPoc1Demo(); break
	case 'avatar-rive':     void runAvatarRiveDemo(); break
	case 'rive-coach':      void runRiveCoachDemo(); break
	case 'chrono':          void runChronoDemo(); break
	default:                void runPlayerPocDemo()
}
