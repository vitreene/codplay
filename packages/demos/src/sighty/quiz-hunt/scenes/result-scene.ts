import type { CompiledRecord } from 'codplay'
import type { SceneDoc } from 'codplay/scene/types'
import { QUIZ_HUNT_EVENTS } from '../messages'

type ResultScenePerso = SceneDoc<string>['stories'][string]['persos'][number]

/** Builds the V1-styled verdict card as an autonomous result scene. */
export function createResultScene(): SceneDoc<string> {
  const persos: ResultScenePerso[] = [
    createResultOverlay(),
    createResultVerdict(),
    createResultSummary(),
    createResultTime(),
  ]
  return {
    id: 'quiz-hunt-result',
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        straps: { 'quiz-hunt-result-project': ({ event }) => projectResult(event.data) },
        listen: [{ on: QUIZ_HUNT_EVENTS.resultProject, straps: ['quiz-hunt-result-project'] }],
        persos,
      },
    },
  }
}

/** Creates the original full-overlay result card without adding a new visual treatment. */
function createResultOverlay(): ResultScenePerso {
  return {
    id: 'quiz-hunt-result-overlay',
    type: 'layout',
    initial: {
      className: 'quiz-hunt-result-overlay is-hidden',
      move: '@root',
      markup: `<div id="quiz-hunt-result-root" class="quiz-hunt-result-overlay is-hidden">
        <div id="quiz-hunt-result-card" class="quiz-hunt-result-card">
          <p id="quiz-hunt-result-verdict-slot" class="quiz-hunt-result-verdict-slot" data-part="quiz-hunt:result:verdict"></p>
          <p id="quiz-hunt-result-summary-slot" class="quiz-hunt-result-summary-slot" data-part="quiz-hunt:result:summary"></p>
          <p id="quiz-hunt-result-time-slot" class="quiz-hunt-result-time-slot" data-part="quiz-hunt:result:time"></p>
        </div>
      </div>`,
    },
    actions: {
      [QUIZ_HUNT_EVENTS.resultShow]: {
        className: { add: 'is-visible', remove: 'is-hidden' },
        style: { opacity: { from: 0, to: 1, duration: 300 } },
      },
    },
  }
}

/** Creates the green or red verdict label used by the original result card. */
function createResultVerdict(): ResultScenePerso {
  return {
    id: 'quiz-hunt-result-verdict',
    type: 'tag',
    initial: {
      tag: 'span',
      content: '',
      className: 'quiz-hunt-result-verdict',
      move: { target: 'quiz-hunt:result:verdict' },
    },
    actions: {
      [QUIZ_HUNT_EVENTS.resultPassed]: {
        content: 'Partie réussie !',
        className: 'quiz-hunt-result-verdict is-passed',
      },
      [QUIZ_HUNT_EVENTS.resultFailed]: {
        content: 'Partie échouée',
        className: 'quiz-hunt-result-verdict is-failed',
      },
    },
  }
}

/** Creates the found-color summary in the result card. */
function createResultSummary(): ResultScenePerso {
  return {
    id: 'quiz-hunt-result-summary',
    type: 'tag',
    initial: {
      tag: 'span',
      content: '',
      move: { target: 'quiz-hunt:result:summary' },
    },
    actions: { [QUIZ_HUNT_EVENTS.resultSummary]: null },
  }
}

/** Creates the elapsed-time value in the result card. */
function createResultTime(): ResultScenePerso {
  return {
    id: 'quiz-hunt-result-time',
    type: 'tag',
    initial: {
      tag: 'span',
      content: '',
      move: { target: 'quiz-hunt:result:time' },
    },
    actions: { [QUIZ_HUNT_EVENTS.resultTime]: null },
  }
}

/** Projects one Sighty result payload to the original verdict-card actions. */
function projectResult(data: Readonly<Record<string, unknown>> | undefined): Readonly<{
  events: readonly Readonly<{ name: string; data?: CompiledRecord }>[]
}> | undefined {
  const outcome = data?.outcome
  if (outcome !== 'won' && outcome !== 'lost') return undefined
  const summary = typeof data?.summary === 'string' ? data.summary : ''
  const time = typeof data?.time === 'string' ? data.time : ''
  return {
    events: [
      { name: outcome === 'won' ? QUIZ_HUNT_EVENTS.resultPassed : QUIZ_HUNT_EVENTS.resultFailed },
      { name: QUIZ_HUNT_EVENTS.resultSummary, data: { content: summary } },
      { name: QUIZ_HUNT_EVENTS.resultTime, data: { content: time } },
      { name: QUIZ_HUNT_EVENTS.resultShow },
    ],
  }
}
