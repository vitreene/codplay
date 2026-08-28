import type { StrapCollection } from 'codplay-v1/player'
import type { SceneDoc } from 'codplay-v1/player/types'
import { riveCoachVisemeConversionStraps } from './avatar-data/rive-viseme-conversion'
import { createQuizQuestionStory, type ResolvedQuizQuestion } from './quiz-question-scene'
import { createRiveCoachBlock } from './rive-coach-scene'
import { buildAnimeGridScene, createAnimeGridSimulation } from './threejs-anime-grid-scene'

const MASHUP_END_MS = 18500

const mashupQuestion: ResolvedQuizQuestion = {
  index: 1,
  type: 'single',
  prompt: 'Quel mot correspond au visème entendu ?',
  answers: [
    { id: 'bonjour', label: 'Bonjour', isCorrect: true },
    { id: 'merci', label: 'Merci', isCorrect: false },
    { id: 'maison', label: 'Maison', isCorrect: false },
  ],
  labels: {
    validate: 'Valider',
    next: '',
    correct: 'Gagné !',
    incorrect: 'Perdu',
    multipleHint: 'Plusieurs réponses possibles',
  },
}

const riveBlock = createRiveCoachBlock({
  stageId: 'mashup-rive-stage',
  audioId: 'mashup-audio',
  avatarId: 'mashup-avatar',
  parentId: 'mashup-aside-slot',
  width: '340px',
  height: '340px',
  showCaption: true,
  stageClassName: 'mashup-rive-stage',
  avatarStyle: {
    inset: 'auto',
    left: '50%',
    bottom: '-6%',
    width: '165%',
    height: '165%',
    transform: 'translateX(-50%)',
  },
  captionStyle: {
    bottom: '8px',
    width: '88%',
    fontSize: '0.85rem',
    padding: '0.3em 0.55em',
  },
  stageStyle: {
    width: '100%',
    height: '100%',
  },
})

const quizStory = createQuizQuestionStory(mashupQuestion, {
  storyId: 'mashup-quiz-story',
  parentId: 'mashup-quiz-slot',
  panelClassName: 'mashup-quiz-panel',
  panelStyle: {
    margin: 0,
  },
})

quizStory.listen.push(
  { on: 'scene:start', straps: ['mashup-quiz-countdown-start'] },
  { on: 'quiz:question:resolved', straps: ['mashup-quiz-countdown-stop'] },
  { on: 'mashup:quiz-timeout', straps: ['mashup-quiz-timeout'] },
)
quizStory.persos.unshift({
  id: 'mashup-quiz-count',
  type: 'tag',
  initial: {
    tag: 'strong',
    content: '10',
    className: 'mashup-quiz-count',
    // '@root': reaches `mashup-quiz-slot` via quizStory's own `initial.move`
    // (set above), never targets another story's outlet directly. `mode`
    // is forced to 'append' for any initial move regardless — ordering
    // before the panel is achieved by `unshift`, declared first.
    move: '@root',
    style: {
      opacity: 0,
    },
  } as never,
  actions: {
    'mashup:quiz-count:show': {
      style: {
        opacity: {
          from: 0,
          to: 1,
          duration: 180,
        },
        scale: {
          from: 0.92,
          to: 1,
          duration: 180,
        },
      },
    },
    'quiz:question:resolved:correct': {
      style: {
        opacity: {
          from: 1,
          to: 0,
          duration: 180,
        },
        scale: {
          from: 1,
          to: 0.92,
          duration: 180,
        },
      },
    },
    'quiz:question:resolved:incorrect': {
      style: {
        opacity: {
          from: 1,
          to: 0,
          duration: 180,
        },
        scale: {
          from: 1,
          to: 0.92,
          duration: 180,
        },
      },
    },
    'mashup:quiz-count': {},
  },
})

for (const perso of quizStory.persos) {
  const initial = perso.initial as Record<string, unknown>

  if (perso.id === 'quiz-question-title') {
    initial.style = { ...(initial.style as Record<string, unknown>), color: '#ffffff' }
  }

  if (perso.id === 'quiz-question-hint') {
    initial.style = { ...(initial.style as Record<string, unknown>), color: 'rgba(255,255,255,0.72)' }
  }

  if (perso.id === 'quiz-question-result') {
    initial.style = { ...(initial.style as Record<string, unknown>), color: '#ffffff' }
  }

  if (perso.id === 'quiz-question-validate' || perso.id === 'quiz-question-next') {
    initial.className = 'mashup-quiz-button'
    initial.style = {
      ...(initial.style as Record<string, unknown>),
      background: 'transparent',
      color: '#ffffff',
      border: '1px solid rgba(255,255,255,0.55)',
      borderRadius: '999px',
      padding: '0.65em 1.05em',
      cursor: 'pointer',
      boxShadow: 'none',
    }
  }

  if (perso.id === 'quiz-question-next') {
    perso.actions = {}
    initial.attr = {
      ...(typeof initial.attr === 'object' && initial.attr !== null ? initial.attr as Record<string, unknown> : {}),
      hidden: true,
    }
  }

  if (perso.type === 'input') {
    initial.style = {
      ...(initial.style as Record<string, unknown>),
      color: '#ffffff',
      background: 'transparent',
      border: 'none',
    }
  }
}

export const mashupRiveThreeQuizScene = {
  id: 'mashup-rive-three-quiz-scene',
  stories: {
    'mashup-root-story': {
      id: 'mashup-root-story',
      initial: { move: '@root' },
      straps: riveCoachVisemeConversionStraps,
      listen: [...riveBlock.listen],
      persos: [
        {
          id: 'mashup-stage',
          type: 'tag',
          initial: {
            tag: 'div',
            className: 'mashup-stage',
            move: '@root',
            style: {
              position: 'relative',
            },
          },
          actions: {},
        },
        {
          id: 'mashup-bg',
          type: 'threejs',
          initial: {
            move: { parentId: 'mashup-stage' },
            width: 960,
            height: 640,
            build: buildAnimeGridScene,
          },
          actions: {
            'scene:start': {
              simulate: createAnimeGridSimulation(),
            },
          },
        },
        {
          id: 'mashup-overlay',
          type: 'layout',
          initial: {
            markup: `
              <div class="mashup-overlay">
                <div data-part="mashup-quiz-slot" class="mashup-quiz-slot"></div>
                <div data-part="mashup-aside-slot" class="mashup-aside-slot"></div>
              </div>
            `,
            move: { parentId: 'mashup-stage' },
          } as never,
          actions: {},
        },
        ...riveBlock.persos,
      ],
      eventimes: [
        { name: 'scene:start', startAt: 0 },
        ...riveBlock.eventimes,
        { name: 'sequence:end', startAt: MASHUP_END_MS },
      ],
    },
    [quizStory.id]: quizStory,
  },
} as unknown as SceneDoc

export const mashupRiveThreeQuizStraps: StrapCollection = {
  'mashup-quiz-countdown-start': ({ context }) => {
    void context.live.loop(
      {
        eachMs: 1000,
        until: [
          { type: 'times', max: 11 },
          { type: 'event', name: 'counter:stop' },
        ],
      },
      ({ index }) => {
        const countStep = {
          event: {
            name: 'mashup:quiz-count',
            data: { content: String(Math.max(0, 10 - index)) },
            cascade: true,
          },
        }
        if (index === 10) return [countStep, { event: { name: 'mashup:quiz-timeout' } }]
        return countStep
      },
    )

    return {
      events: [{ name: 'mashup:quiz-count:show', cascade: true }],
    }
  },
  'mashup-quiz-countdown-stop': () => ({
    events: [{ name: 'counter:stop', cascade: true }],
  }),
  'mashup-quiz-timeout': () => ({
    events: [
      { name: 'counter:stop', cascade: true },
      { name: 'quiz:question:validate', cascade: true },
    ],
  }),
}
