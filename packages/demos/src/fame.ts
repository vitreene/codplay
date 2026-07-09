import { runCodPlayPocDemo } from './codplay/codplay-poc-demo'
import { runQuizReferenceDemo } from './codplay/quiz-reference-demo'
import { runChronoDemo } from './codplay/chrono-demo'
import { runPolygonDemo } from './codplay/polygon-demo'
import { runMashupRiveThreeQuizDemo } from './codplay/mashup-rive-three-quiz-demo'
import { FAME_REGISTRY } from './shared/demo-registry'

const demoName = new URL(globalThis.location.href).searchParams.get('demo')

switch (demoName) {
	case 'codplay-poc':            void runCodPlayPocDemo(FAME_REGISTRY); break
	case 'chrono':                 void runChronoDemo(FAME_REGISTRY); break
	case 'polygon':                void runPolygonDemo(FAME_REGISTRY); break
	case 'mashup-rive-three-quiz': void runMashupRiveThreeQuizDemo(FAME_REGISTRY); break
	case 'quiz':
	default:                       void runQuizReferenceDemo(FAME_REGISTRY)
}
