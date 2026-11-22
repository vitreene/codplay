import type { StoryDoc } from 'codplay/scene/types';
import type { StrapFunction } from 'codplay/runtime/player/pipeline/strap-executor';
import { LEGACY_SOURCE_CANVAS, convertLegacyImageElement } from './legacy-image-converter';
import { resolveLegacyTranslation } from './legacy-page-converter';
import {
  PAGE2_CONTINUATION_START_EVENT,
  PAGE2_CONTINUATION_STORY_ID,
} from './page2-sequence-3-converter';

const QUIZ_PREFIX = 'course-motion-p2-2';
const TARGET_ANSWER_ID = 'unsafe-passenger';
const ANSWER_SELECT_EVENT = `${QUIZ_PREFIX}:answer:select`;
const ANSWER_SELECTED_EVENT = `${QUIZ_PREFIX}:answer:selected`;
const ANSWER_RESOLVED_EVENT = `${QUIZ_PREFIX}:answer:resolved`;
const VALIDATE_EVENT = `${QUIZ_PREFIX}:validate`;
const QUIZ_STAGE_HIDE_EVENT = `${QUIZ_PREFIX}:stage:hide`;
const SOURCE_HOTSPOT_HEIGHT = 190;
const SOURCE_QUIZ_FONT_SIZE = 32;
const SOURCE_QCM_ITEM_FONT_SCALE = 0.95;
const SOURCE_LABEL_PADDING_EM = 1.5;
export const PAGE2_SUCCESS_FEEDBACK_DURATION_MS = 1_513.8;
const PAGE2_AUDIO_START_AT_MS = 8_626.508;
const PAGE2_AUDIO_DURATION_MS = 4_469.683;
const PIXELS_PER_CQW = LEGACY_SOURCE_CANVAS.pixelsPerCqw;

type QuizStoryPerso = StoryDoc['persos'][number];
type QuizEventime = NonNullable<StoryDoc['eventimes']>[number];

type Page2VisualQuizOptions = Readonly<{
  assetBasePath: string;
  audioBasePath: string;
  audioDurationMs: number;
  audioStartAtMs: number;
  clipMarkup: string;
  imageSizes: Readonly<Record<string, Readonly<{ width: number; height: number }>>>;
  parentStageId: string;
  storyId: string;
  textXml: string;
}>;

/** Rejects XML fields outside the selected visual-quiz transcription. */
function requireAttributes(element: Element, allowed: readonly string[]): void {
  if ([...element.attributes].some(({ name }) => !allowed.includes(name))) {
    throw new Error(`The source <${element.tagName}> uses an unsupported visual-quiz attribute.`);
  }
}

/** Reads the source nodes and confirms this fixture still describes one correct image hotspot. */
function readSourceQuiz(xml: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const page = document.documentElement;
  if (document.querySelector('parsererror') || page.tagName !== 'page' || page.getAttribute('id') !== 'page2') {
    throw new Error('Expected one valid page2 source excerpt.');
  }

  const [defaults, sequence] = Array.from(page.children);
  if (
    page.children.length !== 2
    || defaults?.tagName !== 'default'
    || sequence?.tagName !== 'sequency'
  ) {
    throw new Error('The page2 excerpt must contain its defaults and one quiz sequence.');
  }
  requireAttributes(defaults, ['textSize', 'textColor', 'textAlign']);
  const defaultTextSize = Number(defaults.getAttribute('textSize'));
  const defaultTextColor = defaults.getAttribute('textColor');
  const defaultTextAlign = defaults.getAttribute('textAlign');
  if (
    !Number.isFinite(defaultTextSize)
    || defaultTextSize <= 0
    || defaultTextColor === null
    || !/^#[0-9a-f]{6}$/i.test(defaultTextColor)
    || defaultTextAlign === null
  ) {
    throw new Error('The page2 default text style is unsupported.');
  }

  const [sound, prompt, illustration, reveal, quiz] = Array.from(sequence.children);
  if (
    sequence.children.length !== 5
    || sound?.tagName !== 'sound'
    || prompt?.tagName !== 'sub'
    || illustration?.tagName !== 'img'
    || reveal?.tagName !== 'img'
    || quiz?.tagName !== 'quizz'
  ) {
    throw new Error('The source visual-quiz sequence has an unsupported structure.');
  }
  requireAttributes(sound, []);
  requireAttributes(prompt, ['id', 'x', 'y', 'width', 'centered', 'textAlign']);
  requireAttributes(illustration, ['delay', 'x', 'y', 'background', 'scale', 'showAfter']);
  requireAttributes(reveal, ['delay', 'id', 'x', 'y', 'scale', 'alpha']);
  requireAttributes(quiz, ['showAfter']);
  if (
    sound.textContent?.trim() !== 'p2_2.mp3'
    || prompt.getAttribute('id') !== 'question'
    || prompt.getAttribute('x') !== 'center'
    || prompt.getAttribute('centered') !== 'Y'
    || prompt.getAttribute('textAlign') !== 'center'
    || prompt.textContent?.trim() !== 'm2p2_txt1'
    || illustration.textContent?.trim() !== 'p2/2_2a.jpg'
    || illustration.getAttribute('x') !== 'center'
    || illustration.getAttribute('y') !== '390'
    || illustration.getAttribute('background') !== 'Y'
    || reveal.textContent?.trim() !== 'p2/2_2a_zone.png'
    || reveal.getAttribute('id') !== 'zone1'
    || quiz.getAttribute('showAfter') !== 'N'
  ) {
    throw new Error('The visual-quiz source references differ from the accepted page2 fixture.');
  }

  const [type, choice, success, failed] = Array.from(quiz.children);
  if (
    quiz.children.length !== 4
    || type?.tagName !== 'type'
    || type.textContent?.trim() !== 'choice'
    || choice?.tagName !== 'prop'
    || success?.tagName !== 'sequencyAction'
    || failed?.tagName !== 'sequencyAction'
  ) {
    throw new Error('The source quiz must contain one choice and success/failed actions.');
  }
  requireAttributes(choice, ['x', 'y', 'correct', 'width', 'textAlign', 'cssClass', 'alpha', 'scale', 'withBackground', 'itemToShow']);
  requireAttributes(success, ['id']);
  requireAttributes(failed, ['id']);
  if (
    success.getAttribute('id') !== 'success'
    || failed.getAttribute('id') !== 'failed'
    || choice.getAttribute('correct') !== 'Y'
    || choice.getAttribute('itemToShow') !== 'zone1'
    || choice.textContent?.trim() !== 'm2p2_txt2_zone'
  ) {
    throw new Error('The source quiz does not match the single correct hotspot mapping.');
  }

  const readActionSound = (action: Element): string => {
    const soundNode = action.firstElementChild;
    if (
      action.children.length !== 1
      || soundNode?.tagName !== 'sound'
      || soundNode.getAttribute('common') !== 'Y'
      || soundNode.children.length > 0
    ) {
      throw new Error(`The source ${action.getAttribute('id')} action must have one common sound.`);
    }
    return soundNode.textContent?.trim() ?? '';
  };
  const successSound = readActionSound(success);
  if (readActionSound(failed) !== 'mauvaise.mp3' || successSound !== 'bonne.mp3') {
    throw new Error('The source visual-quiz feedback references are unsupported.');
  }

  return {
    choice,
    defaultTextAlign,
    defaultTextColor,
    defaultTextSize,
    illustration,
    prompt,
    reveal,
    soundFile: sound.textContent.trim(),
    successSound,
  };
}

/** Copies an image node and moves its source path from text content to the converter field. */
function prepareImageElement(element: Element): Element {
  const image = element.cloneNode(true) as Element;
  const source = image.textContent?.trim();
  if (source === undefined || source.length === 0) throw new Error('A visual-quiz image requires one source path.');
  image.setAttribute('src', source);
  image.removeAttribute('showAfter');
  return image;
}

/** Creates a hidden SVG resource that clips pointer hit-testing to the source silhouette. */
function createHotspotClipPerso(clipMarkup: string, stageId: string): QuizStoryPerso {
  return {
    id: 'course-motion-p2-2-hotspot-clip',
    type: 'layout',
    initial: {
      markup: clipMarkup,
      style: {
        position: 'absolute',
        left: -1,
        top: -1,
        width: 1,
        height: 1,
        opacity: 0,
        pointerEvents: 'none',
      },
      move: { target: stageId },
    },
    actions: {},
  };
}

/** Creates the quiz stage above the motion stage and keeps it hidden until p2_2 begins. */
function createQuizStage(stageId: string, parentStageId: string): QuizStoryPerso {
  const showEvent = `${QUIZ_PREFIX}:stage:show`;
  return {
    id: stageId,
    type: 'layout',
    initial: {
      markup: `<section id="${stageId}"></section>`,
      className: 'course-motion-quiz-stage',
      style: {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        containerType: 'inline-size',
        display: 'none',
        zIndex: 2,
      },
      move: { target: parentStageId },
    },
    actions: {
      [showEvent]: { style: { display: 'block' } },
      [QUIZ_STAGE_HIDE_EVENT]: { style: { display: 'none' } },
    },
  };
}

/** Creates the page-level validation button that emits the quiz's normal story event. */
function createValidationControlPersos(stageId: string): readonly QuizStoryPerso[] {
  const controlId = `${QUIZ_PREFIX}-validate-control`;
  return [
    {
      id: controlId,
      type: 'layout',
      initial: {
        markup: `<div id="${controlId}"></div>`,
        style: {
          position: 'absolute',
          left: 0,
          bottom: '2.5cqw',
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          zIndex: 4,
        },
        move: { target: stageId },
      },
      actions: {},
    },
    {
      id: `${QUIZ_PREFIX}-validate`,
      type: 'tag',
      initial: {
        tag: 'button',
        content: 'Valider',
        attr: { type: 'button' },
        className: 'course-motion-quiz-validate',
        style: { minWidth: '15.625cqw', minHeight: '4.5cqw' },
        move: { target: controlId },
      },
      emit: { click: { event: { name: VALIDATE_EVENT, visibility: 'story' } } },
      actions: { [ANSWER_RESOLVED_EVENT]: { attr: { disabled: true } } },
    },
  ];
}

/** Creates narration and feedback audio controlled by page2 events. */
function createAudioPerso(
  id: string,
  src: string,
  parentId: string,
  sync: 'auto' | 'master',
  startEvent: string,
  startAt: number,
  stopEvent?: string,
): Readonly<{ perso: QuizStoryPerso; eventime: QuizEventime }> {
  return {
    perso: {
      id,
      type: 'media',
      initial: {
        tag: 'audio',
        src,
        sync,
        video: { style: { display: 'none' } },
        move: { target: parentId },
      },
      actions: {
        [startEvent]: { broadcast: { type: 'START' } },
        ...(stopEvent === undefined ? {} : { [stopEvent]: { broadcast: { type: 'STOP' } } }),
      },
    },
    eventime: { name: startEvent, startAt },
  };
}

/** Positions the answer region over the SVG inside the source QCM's padded label. */
function createHotspotPerso(choice: Element, stageId: string): QuizStoryPerso {
  const left = Number(choice.getAttribute('x'));
  const top = Number(choice.getAttribute('y'));
  const width = Number(choice.getAttribute('width'));
  const scale = Number(choice.getAttribute('scale'));
  const opacity = Number(choice.getAttribute('alpha'));
  if (
    ![left, top, width, scale, opacity].every(Number.isFinite)
    || left < 0
    || top < 0
    || width <= 0
    || scale <= 0
    || opacity < 0
    || opacity > 1
  ) {
    throw new Error('The source hotspot position and dimensions must be finite and positive.');
  }
  const selectedEvent = ANSWER_SELECTED_EVENT;
  const resolvedEvent = ANSWER_RESOLVED_EVENT;
  // The source label adds 1.5em after the QCM's 0.95em font-size, before scale.
  const svgLeft = left + scale * SOURCE_LABEL_PADDING_EM * SOURCE_QCM_ITEM_FONT_SCALE * SOURCE_QUIZ_FONT_SIZE;
  const hotspotStyle = {
    position: 'absolute',
    left: `${svgLeft / PIXELS_PER_CQW}cqw`,
    top: `${top / PIXELS_PER_CQW}cqw`,
    width: `${width * scale / PIXELS_PER_CQW}cqw`,
    height: `${SOURCE_HOTSPOT_HEIGHT * scale / PIXELS_PER_CQW}cqw`,
    clipPath: 'url(#course-motion-hotspot-shape)',
    opacity,
    zIndex: 3,
    cursor: 'pointer',
  };

  return {
    id: `${QUIZ_PREFIX}-hotspot`,
    type: 'input',
    initial: {
      inputType: 'radio',
      name: `${QUIZ_PREFIX}-answer`,
      value: TARGET_ANSWER_ID,
      label: 'Élément à signaler',
      checked: false,
      disabled: false,
      visualState: 'idle',
      className: 'course-motion-hotspot',
      style: hotspotStyle,
      attr: { 'aria-label': 'Élément à signaler' },
      move: { target: stageId },
    },
    emit: {
      change: { event: { name: ANSWER_SELECT_EVENT, data: { answerId: TARGET_ANSWER_ID } } },
    },
    actions: {
      [selectedEvent]: { selectedAnswerIds: [TARGET_ANSWER_ID], checked: true, visualState: 'selected' },
      [resolvedEvent]: {
        selectedAnswerIds: [TARGET_ANSWER_ID],
        correctAnswerIds: [TARGET_ANSWER_ID],
        checked: true,
        disabled: true,
        disableAnswers: true,
        showCorrection: true,
        visualState: 'revealed-correct',
      },
    },
  };
}

/** Creates the feedback gate after the one correct hotspot is submitted. */
const handleVisualQuizSubmit: StrapFunction = ({ state, context }) => {
  const selectedAnswerIds = state.selectedAnswerIds;
  if (
    state.submitted === true
    || !Array.isArray(selectedAnswerIds)
    || !selectedAnswerIds.includes(TARGET_ANSWER_ID)
  ) {
    return undefined;
  }

  const hideQuizStage = context.planned.wait(PAGE2_SUCCESS_FEEDBACK_DURATION_MS, {
    event: { name: QUIZ_STAGE_HIDE_EVENT, visibility: 'story' },
  });
  return [
    {
      update: { submitted: true },
      events: [
        { name: ANSWER_RESOLVED_EVENT, visibility: 'public' },
        { name: `${QUIZ_PREFIX}:success` },
        {
          name: PAGE2_CONTINUATION_START_EVENT,
          storyId: PAGE2_CONTINUATION_STORY_ID,
          visibility: 'story',
        },
      ],
    },
    hideQuizStage,
  ];
};

/** Transcribes the page2 image hotspot with the shared input/event route, outside the generic importer. */
export function convertPage2VisualQuiz(
  pageXml: string,
  options: Page2VisualQuizOptions,
): StoryDoc {
  if (options.audioStartAtMs !== PAGE2_AUDIO_START_AT_MS || options.audioDurationMs !== PAGE2_AUDIO_DURATION_MS) {
    throw new Error('The page2 audio timing differs from the inspected source media.');
  }
  const {
    choice,
    defaultTextAlign,
    defaultTextColor,
    defaultTextSize,
    illustration,
    prompt,
    reveal,
    soundFile,
    successSound,
  } = readSourceQuiz(pageXml);
  const imageBasePath = options.assetBasePath.replace(/\/$/, '');
  const audioBasePath = options.audioBasePath.replace(/\/$/, '');
  const stageId = 'course-motion-p2-2-stage';
  const sourceImage = prepareImageElement(illustration);
  const revealImage = prepareImageElement(reveal);
  const sourceImagePath = sourceImage.getAttribute('src')!;
  const revealImagePath = revealImage.getAttribute('src')!;
  const sourceImageSize = options.imageSizes[sourceImagePath];
  const revealImageSize = options.imageSizes[revealImagePath];
  if (sourceImageSize === undefined || revealImageSize === undefined) {
    throw new Error('The intrinsic size of each page2 quiz image is required.');
  }

  const mainAudio = createAudioPerso(
    `${QUIZ_PREFIX}-audio`,
    `${audioBasePath}/${soundFile}`,
    stageId,
    'auto',
    `${QUIZ_PREFIX}:audio:start`,
    options.audioStartAtMs,
    ANSWER_RESOLVED_EVENT,
  );
  const feedbackAudio = createAudioPerso(
    `${QUIZ_PREFIX}-feedback-audio`,
    `${audioBasePath}/${successSound}`,
    stageId,
    'master',
    `${QUIZ_PREFIX}:success`,
    0,
  );
  const baseImage = convertLegacyImageElement(sourceImage, {
    assetBasePath: imageBasePath,
    chapterId: '02_circulation',
    imageSize: sourceImageSize,
    stageId,
  });
  const revealImagePerso = convertLegacyImageElement(revealImage, {
    assetBasePath: imageBasePath,
    chapterId: '02_circulation',
    imageSize: revealImageSize,
    stageId,
  });
  const revealEvent = `${QUIZ_PREFIX}:hotspot:reveal`;
  const promptKey = prompt.textContent?.trim();
  if (!promptKey) throw new Error('The source prompt must reference one translation key.');
  const promptWidth = Number(prompt.getAttribute('width'));
  const promptY = Number(prompt.getAttribute('y'));
  if (!Number.isFinite(promptWidth) || promptWidth <= 0 || !Number.isFinite(promptY)) {
    throw new Error('The source prompt position and width must be finite.');
  }
  const promptX = prompt.getAttribute('x');
  const isCentered = prompt.getAttribute('centered') === 'Y';
  if (promptX !== 'center' || !isCentered) {
    throw new Error('The page2 prompt must be centered on the source canvas.');
  }
  const promptPerso = {
    id: `${QUIZ_PREFIX}-prompt`,
    type: 'text',
    initial: {
      tag: 'p',
      content: resolveLegacyTranslation(options.textXml, promptKey),
      className: 'course-motion-quiz-prompt',
      style: {
        position: 'absolute',
        left: `${(LEGACY_SOURCE_CANVAS.width - promptWidth) / 2 / PIXELS_PER_CQW}cqw`,
        top: `${promptY / PIXELS_PER_CQW}cqw`,
        width: `${promptWidth / PIXELS_PER_CQW}cqw`,
        fontSize: `${defaultTextSize / PIXELS_PER_CQW}cqw`,
        color: defaultTextColor,
        textAlign: prompt.getAttribute('textAlign') ?? defaultTextAlign,
        zIndex: 2,
      },
      move: { target: stageId },
    },
    actions: {},
  } satisfies QuizStoryPerso;
  const inputPerso = createHotspotPerso(choice, stageId);
  const showStageEvent = `${QUIZ_PREFIX}:stage:show`;
  const showStage: QuizEventime = { name: showStageEvent, startAt: options.audioStartAtMs };
  const absoluteImageEventimes = [...baseImage.eventimes, ...revealImagePerso.eventimes]
    .map((eventime) => ({ ...eventime, startAt: eventime.startAt + options.audioStartAtMs }));

  return {
    id: options.storyId,
    eventimes: [
      { ...showStage, visibility: 'public' },
      mainAudio.eventime,
      ...absoluteImageEventimes,
    ],
    state: { selectedAnswerIds: [], submitted: false },
    straps: {
      [`${QUIZ_PREFIX}-select`]: ({ event, state }) => {
        if (state.submitted === true || event.data?.answerId !== TARGET_ANSWER_ID) return undefined;
        return {
          update: { selectedAnswerIds: [TARGET_ANSWER_ID] },
          events: [
            { name: ANSWER_SELECTED_EVENT, visibility: 'public' },
            { name: revealEvent },
          ],
        };
      },
      [`${QUIZ_PREFIX}-submit`]: handleVisualQuizSubmit,
    },
    listen: [
      { on: ANSWER_SELECT_EVENT, straps: [`${QUIZ_PREFIX}-select`] },
      { on: VALIDATE_EVENT, straps: [`${QUIZ_PREFIX}-submit`] },
    ],
    persos: [
      createQuizStage(stageId, options.parentStageId),
      createHotspotClipPerso(options.clipMarkup, stageId),
      mainAudio.perso,
      feedbackAudio.perso,
      baseImage.perso,
      {
        ...revealImagePerso.perso,
        actions: {
          ...revealImagePerso.perso.actions,
          [revealEvent]: { style: { opacity: 1 } },
        },
      },
      promptPerso,
      inputPerso,
      ...createValidationControlPersos(stageId),
    ],
  };
}

