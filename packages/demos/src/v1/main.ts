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
import { runRiveCoachDemo } from './codplay/rive-coach-demo'
import { runChronoDemo } from './codplay/chrono-demo'
import { runQuizHuntDemo } from './codplay/quiz-hunt-demo'
import { runThreejsAnimeGridDemo } from './codplay/threejs-anime-grid-demo'
import { runMashupRiveThreeQuizDemo } from './codplay/mashup-rive-three-quiz-demo'
import { runMashupBackAndForeDemo } from './codplay/mashup-back-and-fore-demo'
import { runOverlayWorldOutletDemo } from './codplay/overlay-world-outlet-demo'
import { runPolygonDemo } from './codplay/polygon-demo'
import { runEd2BuilderDemo } from './codplay/ed2-builder-demo'
import { runSpaceBubblesDemo } from './codplay/space-bubbles-demo'
import { runStrokePathDemo } from './codplay/stroke-path-demo'

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
	case 'rive-coach':      void runRiveCoachDemo(); break
	case 'threejs-anime-grid': void runThreejsAnimeGridDemo(); break
	case 'mashup-rive-three-quiz': void runMashupRiveThreeQuizDemo(); break
	case 'mashup-back-and-fore': void runMashupBackAndForeDemo(); break
	case 'chrono':          void runChronoDemo(); break
	case 'overlay-world-outlet': void runOverlayWorldOutletDemo(); break
	case 'polygon':         void runPolygonDemo(); break
	case 'quiz-hunt':       void runQuizHuntDemo(); break
	case 'ed2-builder':     void runEd2BuilderDemo(); break
	case 'space-bubbles':   void runSpaceBubblesDemo(); break
	case 'stroke-path':     void runStrokePathDemo(); break
	default:                void runPlayerPocDemo()
}
