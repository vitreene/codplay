import type { SceneDoc } from '../../src/scene/types'

/** Creates the minimal S1 canary shape used by the V1 demos. */
function createS1CanaryScene(): SceneDoc {
  return {
    id: 's1-canary-scene',
    stories: {
      's1-canary-story': {
        id: 's1-canary-story',
        initial: { move: '@root' },
        persos: [{
          id: 'canary-title',
          type: 'text',
          initial: { tag: 'h1', move: '@root', content: 'Canary', style: { color: '#102643' } },
        }],
      },
    },
  }
}

/** Creates the S2 hierarchy and eventime shape used by the V1 demos. */
function createS2ReferenceScene(): SceneDoc {
  return {
    id: 's2-reference-scene',
    stories: {
      's2-reference-story': {
        id: 's2-reference-story',
        initial: { move: '@root' },
        persos: [
          {
            id: 'reference-list',
            type: 'list',
            initial: { move: '@root', className: 'reference-list', style: { width: '360px', minHeight: '180px' } },
            actions: { 'sequence:reference:start': { className: { add: 'reference-list-live' } } },
          },
          {
            id: 'reference-title',
            type: 'text',
            initial: { tag: 'h2', content: 'Reference Scene', move: { target: 'reference-list' } },
            actions: {
              'sequence:reference:start': { style: { opacity: { from: 0, to: 1, duration: 400 } } },
            },
          },
        ],
        eventimes: [{ name: 'sequence:reference:start', startAt: 0 }],
      },
    },
  }
}

/** Creates the S3 move transition shape used by the V1 robustness demo. */
function createS3RobustesseScene(): SceneDoc {
  return {
    id: 's3-robustesse-scene',
    stories: {
      's3-robustesse-story': {
        id: 's3-robustesse-story',
        initial: { move: '@root' },
        persos: [
          { id: 'robust-stage', type: 'list', initial: { move: '@root', className: 'robust-stage' } },
          { id: 'robust-overlay', type: 'list', initial: { move: '@root', className: 'robust-overlay' } },
          {
            id: 'robust-card',
            type: 'text',
            initial: { tag: 'div', content: 'CARD', move: { target: 'robust-stage' } },
            actions: {
              'sequence:robustesse:promote': { move: { target: 'robust-overlay', flipMode: 'overlay-world', transition: { duration: 400 } } },
              'sequence:robustesse:return': { move: { target: 'robust-stage', flipMode: 'overlay-world', transition: { duration: 400 } } },
            },
          },
        ],
      },
    },
  }
}

/** Creates the representative S4 multi-story layout and media shape. */
function createS4QuizReferenceScene(): SceneDoc {
  return {
    id: 's4-quiz-reference-scene',
    stories: {
      's4-layout-story': {
        id: 's4-layout-story',
        initial: { move: '@root' },
        persos: [{
          id: 'quiz-layout',
          type: 'layout',
          initial: {
            move: '@root',
            markup: '<section class="quiz-layout-container"></section>',
            style: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' },
          },
        }],
      },
      's4-media-story': {
        id: 's4-media-story',
        persos: [{
          id: 'quiz-media',
          type: 'media',
           initial: { tag: 'video', src: '/assets/quiz.mp4', move: { target: 'quiz-layout' } },
          actions: { 'quiz:media:start': { style: { opacity: { from: 0, to: 1, duration: 250 } } } },
        }],
        eventimes: [{ name: 'quiz:media:start', startAt: 1000 }],
      },
    },
  }
}

/** Provides representative V1 demo scene forms without importing the V1 demo package. */
export const demoSceneFixtures: readonly Readonly<{ id: string; scene: SceneDoc }>[] = [
  { id: 's1', scene: createS1CanaryScene() },
  { id: 's2', scene: createS2ReferenceScene() },
  { id: 's3', scene: createS3RobustesseScene() },
  { id: 's4', scene: createS4QuizReferenceScene() },
]
