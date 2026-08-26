import type { SceneDoc } from '../../../../../codplay-v2/src/scene/types'
import { correctionIconPartId, selectionIconPartId } from '../../../../../codplay-v2/src/runtime/components/input'
import componentDemoImageUrl from './component-demo-image.svg?url'

/** Total duration exposed by the V2 component showcase. */
export const COMPONENTS_DEMO_DURATION_MS = 3800

const IMAGE_ENTER_EVENT = 'components:image:enter'
const POLYGON_MORPH_EVENT = 'components:polygon:morph'
const QUIZ_SELECT_EVENT = 'components:quiz:select-a'
const QUIZ_RESOLVE_EVENT = 'components:quiz:resolve'

/** Creates the V2 scene used to present image, input and polygon together. */
export function createComponentsScene(): SceneDoc {
  return {
    id: 'v2-core-components-scene',
    stories: {
      main: {
        id: 'main',
        persos: [
          createStageLayout(),
          createVisualLabel(),
          createImagePerso(),
          createPolygonPerso(),
          createQuestionTitle(),
          createQuestionHint(),
          ...createAnswerPersos('a', 'Alpha', true),
          ...createAnswerPersos('b', 'Beta', false),
          createQuizStatus(),
        ],
        eventimes: [
          { name: IMAGE_ENTER_EVENT, startAt: 0 },
          { name: POLYGON_MORPH_EVENT, startAt: 800 },
          { name: QUIZ_SELECT_EVENT, startAt: 1700 },
          { name: QUIZ_RESOLVE_EVENT, startAt: 2700 },
          { name: 'components:sequence:end', startAt: COMPONENTS_DEMO_DURATION_MS },
        ],
      },
    },
  }
}

/** Creates the root layout and its two demo-specific public outlets. */
function createStageLayout(): SceneDoc['stories']['main']['persos'][number] {
  return {
    id: 'components-stage',
    type: 'layout',
    initial: {
      move: '@root',
      markup: `
        <section class="components-stage">
          <div data-part="visual-outlet" class="components-stage__visual"></div>
          <div data-part="quiz-outlet" class="components-stage__quiz"></div>
        </section>
      `,
    },
    actions: {},
  }
}

/** Creates the small explanatory label above the visual components. */
function createVisualLabel(): SceneDoc['stories']['main']['persos'][number] {
  return {
    id: 'components-visual-label',
    type: 'tag',
    initial: {
      tag: 'p',
      content: 'DOM image + SVG polygon',
      className: 'components-stage__visual-label',
      move: { target: 'visual-outlet' },
    },
    actions: {},
  }
}

/** Creates the image instance with one simple fade-and-rise animation. */
function createImagePerso(): SceneDoc['stories']['main']['persos'][number] {
  return {
    id: 'components-image',
    type: 'img',
    initial: {
      src: componentDemoImageUrl,
      alt: 'Illustration abstraite CodPlay V2',
      className: 'components-image',
      style: {
        opacity: 0,
        translateY: 24,
      },
      img: {
        className: 'components-image__native',
        style: {
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        },
        attr: { draggable: 'false' },
      },
      move: { target: 'visual-outlet' },
    },
    actions: {
      [IMAGE_ENTER_EVENT]: {
        style: {
          opacity: { from: 0, to: 1, duration: 800, ease: 'outCubic' },
          translateY: { from: 24, to: 0, duration: 800, ease: 'outCubic' },
        },
      },
    },
  }
}

/** Creates the polygon instance with a deterministic SVG morph animation. */
function createPolygonPerso(): SceneDoc['stories']['main']['persos'][number] {
  return {
    id: 'components-polygon',
    type: 'polygon',
    initial: {
      sides: 4,
      inner: 25,
      outer: 44,
      rotationDeg: 45,
      content: 'V2',
      className: 'components-polygon',
      style: {
        opacity: 0,
        translateY: 16,
      },
      attr: { role: 'img', 'aria-label': 'Polygone SVG animé' },
      move: { target: 'visual-outlet' },
    },
    actions: {
      [POLYGON_MORPH_EVENT]: {
        sides: 7,
        inner: 20,
        outer: 44,
        rotationDeg: 0,
        content: 'SVG',
        morph: { duration: 900, ease: 'inOutCubic', sampleCount: 64 },
        style: {
          opacity: { from: 0, to: 1, duration: 500, ease: 'outCubic' },
          translateY: { from: 16, to: 0, duration: 700, ease: 'outCubic' },
        },
      },
    },
  }
}

/** Creates the quiz title using the same answer-card composition as the V1 demo. */
function createQuestionTitle(): SceneDoc['stories']['main']['persos'][number] {
  return {
    id: 'components-question-title',
    type: 'tag',
    initial: {
      tag: 'h2',
      content: 'Which answer belongs to CodPlay?',
      className: 'components-question__title',
      move: { target: 'quiz-outlet' },
    },
    actions: {},
  }
}

/** Creates the quiz hint displayed beneath the question title. */
function createQuestionHint(): SceneDoc['stories']['main']['persos'][number] {
  return {
    id: 'components-question-hint',
    type: 'tag',
    initial: {
      tag: 'p',
      content: 'Une réponse correcte sera révélée par la timeline V2.',
      className: 'components-question__hint',
      move: { target: 'quiz-outlet' },
    },
    actions: {},
  }
}

/** Creates one answer input and its two mounted icon children. */
function createAnswerPersos(
  answerId: 'a' | 'b',
  label: string,
  correct: boolean,
): SceneDoc['stories']['main']['persos'] {
  const inputId = `components-answer-${answerId}`
  const value = answerId
  const inputActions = correct
    ? {
        [QUIZ_SELECT_EVENT]: {
          selectedAnswerIds: [value],
          checked: true,
          visualState: 'selected',
        },
        [QUIZ_RESOLVE_EVENT]: {
          selectedAnswerIds: [value],
          correctAnswerIds: [value],
          checked: true,
          disabled: true,
          disableAnswers: true,
          showCorrection: true,
          visualState: 'revealed-correct',
        },
      }
    : {
        [QUIZ_SELECT_EVENT]: {
          selectedAnswerIds: ['a'],
          checked: false,
          visualState: 'idle',
        },
        [QUIZ_RESOLVE_EVENT]: {
          selectedAnswerIds: ['a'],
          correctAnswerIds: ['a'],
          checked: false,
          disabled: true,
          disableAnswers: true,
          showCorrection: true,
          visualState: 'revealed-missed-correct',
        },
      }

  return [
    {
      id: inputId,
      type: 'input',
      initial: {
        inputType: 'radio',
        id: `${inputId}-control`,
        name: 'components-answer',
        value,
        label,
        hint: correct ? 'bonne réponse' : 'réponse proposée',
        checked: false,
        disabled: false,
        visualState: 'idle',
        className: 'components-question__answer',
        selectionIcon: { className: 'components-question__selection-slot' },
        correctionIcon: {
          className: 'components-question__correction-slot',
          correctContent: '✓',
          missedCorrectContent: '✓',
          incorrectContent: '×',
        },
        move: { target: 'quiz-outlet' },
      },
      actions: inputActions,
    },
    {
      id: `${inputId}-selection-icon`,
      type: 'tag',
      initial: {
        tag: 'span',
        content: '○',
        className: 'components-question__selection-icon',
        move: { target: selectionIconPartId('main', inputId) },
      },
      actions: {
        [QUIZ_SELECT_EVENT]: { content: correct ? '●' : '○' },
        [QUIZ_RESOLVE_EVENT]: { content: correct ? '●' : '○' },
      },
    },
    {
      id: `${inputId}-correction-icon`,
      type: 'tag',
      initial: {
        tag: 'span',
        content: '',
        className: 'components-question__correction-icon',
        move: { target: correctionIconPartId('main', inputId) },
      },
      actions: {
        [QUIZ_RESOLVE_EVENT]: { content: correct ? '✓' : '+' },
      },
    },
  ]
}

/** Creates the live textual readout of the quiz phase. */
function createQuizStatus(): SceneDoc['stories']['main']['persos'][number] {
  return {
    id: 'components-question-status',
    type: 'tag',
    initial: {
      tag: 'p',
      content: 'Sélectionnez une réponse.',
      className: 'components-question__status',
      move: { target: 'quiz-outlet' },
    },
    actions: {
      [QUIZ_SELECT_EVENT]: { content: 'Réponse sélectionnée.' },
      [QUIZ_RESOLVE_EVENT]: { content: 'Bonne réponse révélée par le runtime V2.' },
    },
  }
}
