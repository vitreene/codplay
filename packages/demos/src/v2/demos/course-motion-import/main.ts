import type { SceneDoc } from 'codplay/scene/types';
import sequenceXml from './page2-sequence-1.xml?raw';
import visualQuizPageXml from './page2-sequence-2.xml?raw';
import continuationXml from './page2-sequence-3.xml?raw';
import visualQuizTextXml from './page2-text-fr.xml?raw';
import hotspotClipMarkup from './page2-hotspot-clip.svg?raw';
import globalPropertiesXml from './source-global-properties.xml?raw';
import { convertLegacyPageSequence } from './legacy-page-sequence-converter';
import {
  convertPage2VisualQuiz,
  PAGE2_SUCCESS_FEEDBACK_DURATION_MS,
} from './page2-visual-quiz-converter';
import { convertPage2Continuation } from './page2-sequence-3-converter';

const IMAGE_BASE_PATH = '/assets/course-motion-import/02_circulation/images';
const AUDIO_BASE_PATH = '/assets/course-motion-import/02_circulation/sounds/fr';
const PAGE2_SEQUENCE_1_AUDIO_DURATION_MS = 8_626.508;

/** Creates the CodPlay scene from page2 motion, its visual quiz and its correction sequence. */
export function createScene(): SceneDoc {
  const motionScene = convertLegacyPageSequence(sequenceXml, {
    assetBasePath: IMAGE_BASE_PATH,
    audioBasePath: AUDIO_BASE_PATH,
    audioDurationMs: PAGE2_SEQUENCE_1_AUDIO_DURATION_MS,
    chapterId: '02_circulation',
    globalPropertiesXml,
    stageId: 'course-motion-stage',
    imageSizes: {
      'p2/circu01.png': { width: 966, height: 603 },
      'p2/circu02.png': { width: 111, height: 123 },
      'p2/IMG_0565.jpg': { width: 1_200, height: 700 },
    },
  });
  const motionStory = motionScene.stories.main;
  const previousBackground = motionStory.persos.find((perso) => (
    perso.type === 'img' && perso.initial?.src === `${IMAGE_BASE_PATH}/p2/IMG_0565.jpg`
  ));
  const backgroundHideEvent = 'course-motion-p2-1:background:hide';
  if (previousBackground === undefined) {
    throw new Error('The p2_1 background image is missing from the motion scene.');
  }
  const previousBackgroundId = previousBackground.id;
  const motionStoryWithBackgroundEnd = {
    ...motionStory,
    persos: motionStory.persos.map((perso) => (
      perso.id === previousBackgroundId
        ? {
          ...perso,
          actions: {
            ...perso.actions,
            [backgroundHideEvent]: { style: { display: 'none' } },
          },
        }
        : perso
    )),
    eventimes: [
      ...(motionStory.eventimes ?? []),
      { name: backgroundHideEvent, startAt: PAGE2_SEQUENCE_1_AUDIO_DURATION_MS },
    ],
  };

  const quizStory = convertPage2VisualQuiz(visualQuizPageXml, {
    assetBasePath: IMAGE_BASE_PATH,
    audioBasePath: AUDIO_BASE_PATH,
    audioDurationMs: 4_469.683,
    audioStartAtMs: 8_626.508,
    clipMarkup: hotspotClipMarkup,
    imageSizes: {
      'p2/2_2a.jpg': { width: 500, height: 333 },
      'p2/2_2a_zone.png': { width: 79, height: 183 },
    },
    parentStageId: 'course-motion-stage',
    storyId: 'page2-sequence-2',
    textXml: visualQuizTextXml,
  });
  const continuation = convertPage2Continuation(continuationXml, {
    assetBasePath: IMAGE_BASE_PATH,
    audioBasePath: AUDIO_BASE_PATH,
    imageSize: { width: 500, height: 333 },
    parentStageId: 'course-motion-stage',
    successFeedbackDurationMs: PAGE2_SUCCESS_FEEDBACK_DURATION_MS,
  });

  return {
    ...motionScene,
    id: 'course-motion-page2-checkpoint',
    stories: {
      ...motionScene.stories,
      main: motionStoryWithBackgroundEnd,
      'page2-sequence-2': quizStory,
      'page2-sequence-3': continuation,
    },
    eventimes: [],
  };
}
