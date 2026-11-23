import type { StoryDoc } from 'codplay/scene/types';
import type { StrapFunction } from 'codplay/runtime/player/pipeline/strap-executor';
import { LEGACY_SOURCE_CANVAS, convertLegacyImageElement } from './legacy-image-converter';

const CONTINUATION_PREFIX = 'course-motion-p2-3';
const CONTINUATION_STORY_ID = 'page2-sequence-3';
const CONTINUATION_START_EVENT = `${CONTINUATION_PREFIX}:start`;
const CONTINUATION_PLAY_EVENT = `${CONTINUATION_PREFIX}:play`;
const CONTINUATION_SCHEDULE_STRAP = `${CONTINUATION_PREFIX}-schedule`;
const IMAGE_APPEAR_EVENT = `${CONTINUATION_PREFIX}:image:appear`;
const IMAGE_BLINK_EVENTS = [
  `${CONTINUATION_PREFIX}:image:blink-out-1`,
  `${CONTINUATION_PREFIX}:image:blink-in-1`,
  `${CONTINUATION_PREFIX}:image:blink-out-2`,
  `${CONTINUATION_PREFIX}:image:blink-in-2`,
] as const;
const SOURCE_AUDIO_DURATION_MS = 4_022.132;
const SOURCE_IMAGE_DELAY_MS = 1_500;
const BLINK_HALF_CYCLE_MS = 500;
const SOURCE_CROSS_SIZE = 340;
const SOURCE_CROSS_SCALE = 0.6;
const SOURCE_CROSS_X = 660;
const SOURCE_CROSS_Y = 320;
const SOURCE_CROSS_DURATION_MS = (23 / 24) * 1_000;
const SOURCE_PIXELS_PER_CQW = LEGACY_SOURCE_CANVAS.pixelsPerCqw;

type ContinuationPerso = StoryDoc['persos'][number];

type Page2ContinuationOptions = Readonly<{
  assetBasePath: string;
  audioBasePath: string;
  imageSize: Readonly<{ width: number; height: number }>;
  parentStageId: string;
  successFeedbackDurationMs: number;
}>;

/** Rejects source fields that this sequence transcription does not interpret. */
function requireAttributes(element: Element, allowed: readonly string[]): void {
  if ([...element.attributes].some(({ name }) => !allowed.includes(name))) {
    throw new Error(`The source <${element.tagName}> uses an unsupported p2_3 attribute.`);
  }
}

/** Reads the p2_3 audio, external cross animation and delayed correction image. */
function readSourceContinuation(xml: string) {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const page = document.documentElement;
  const sequence = page.children[0];
  if (
    document.querySelector('parsererror')
    || page.tagName !== 'page'
    || page.getAttribute('id') !== 'page2'
    || page.children.length !== 1
    || sequence?.tagName !== 'sequency'
    || sequence.children.length !== 3
  ) {
    throw new Error('Expected one p2_3 sequence from page2.');
  }

  const [sound, cross, sourceImage] = Array.from(sequence.children);
  if (sound?.tagName !== 'sound' || cross?.tagName !== 'snapFLA' || sourceImage?.tagName !== 'img') {
    throw new Error('The p2_3 sequence must contain sound, snapFLA and image nodes in source order.');
  }
  requireAttributes(sound, []);
  requireAttributes(cross, ['common', 'src', 'x', 'y', 'scale', 'loop', 'showAfter']);
  requireAttributes(sourceImage, ['delay', 'x', 'y', 'scale', 'effect', 'showAfter']);
  if (
    sound.textContent?.trim() !== 'p2_3.mp3'
    || cross.getAttribute('common') !== 'Y'
    || cross.getAttribute('src') !== 'snapFLA/croix_rouge_snap_canvas.js'
    || cross.getAttribute('x') !== String(SOURCE_CROSS_X)
    || cross.getAttribute('y') !== String(SOURCE_CROSS_Y)
    || cross.getAttribute('scale') !== String(SOURCE_CROSS_SCALE)
    || cross.getAttribute('loop') !== 'N'
    || cross.getAttribute('showAfter') !== 'Y'
    || sourceImage.textContent?.trim() !== 'p2/2_2b.jpg'
    || sourceImage.getAttribute('delay') !== '1.5'
    || sourceImage.getAttribute('x') !== 'center'
    || sourceImage.getAttribute('y') !== '390'
    || sourceImage.getAttribute('scale') !== '1.4'
    || sourceImage.getAttribute('effect') !== 'blink'
    || sourceImage.getAttribute('showAfter') !== 'Y'
  ) {
    throw new Error('The p2_3 sequence no longer matches the inspected source nodes.');
  }

  const image = sourceImage.cloneNode(true) as Element;
  image.setAttribute('src', sourceImage.textContent?.trim() ?? '');
  image.setAttribute('delay', '0');
  image.removeAttribute('effect');
  image.removeAttribute('showAfter');
  return { image, soundFile: sound.textContent.trim() };
}

/** Creates the CodPlay image used for the source cross animation. */
function createCorrectionCross(assetBasePath: string, parentStageId: string): ContinuationPerso {
  const size = SOURCE_CROSS_SIZE * SOURCE_CROSS_SCALE / SOURCE_PIXELS_PER_CQW;
  const centerX = SOURCE_CROSS_X / SOURCE_PIXELS_PER_CQW;
  const centerY = SOURCE_CROSS_Y / SOURCE_PIXELS_PER_CQW;
  const startEvent = CONTINUATION_PLAY_EVENT;
  const animation = {
    from: 0.5,
    to: 1,
    duration: SOURCE_CROSS_DURATION_MS,
    ease: 'outSine',
  };
  return {
    id: `${CONTINUATION_PREFIX}-cross`,
    type: 'img',
    initial: {
      src: `${assetBasePath.replace(/\/$/, '')}/p2/correction-cross.svg`,
      alt: 'Croix rouge sur l’élément à corriger',
      className: 'course-motion-correction-cross',
      img: { style: { width: '100%', height: '100%', objectFit: 'contain' } },
      style: {
        position: 'absolute',
        left: 0,
        top: 0,
        x: centerX - size / 2,
        y: centerY - size / 2,
        width: size,
        height: size,
        opacity: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        zIndex: 3,
      },
      move: { target: parentStageId },
    },
    actions: {
      [startEvent]: {
        style: {
          opacity: { from: 0, to: 1, duration: SOURCE_CROSS_DURATION_MS, ease: 'outSine' },
          scaleX: animation,
          scaleY: animation,
        },
      },
    },
  };
}

/** Creates the p2_3 audio and starts it when the quiz feedback has finished. */
function createContinuationAudio(src: string, parentStageId: string): ContinuationPerso {
  return {
    id: `${CONTINUATION_PREFIX}-audio`,
    type: 'media',
    initial: {
      tag: 'audio',
      src,
      sync: 'master',
      video: { style: { display: 'none' } },
      move: { target: parentStageId },
    },
    actions: { [CONTINUATION_PLAY_EVENT]: { broadcast: { type: 'START' } } },
  };
}

/** Schedules the delayed correction image, its finite blink rendition and story end. */
function createScheduleContinuation(successFeedbackDurationMs: number): StrapFunction {
  return ({ context }) => {
    const storyEvent = (name: string) => ({
      name,
      storyId: CONTINUATION_STORY_ID,
      visibility: 'story' as const,
    });
    return [
      context.planned.wait(successFeedbackDurationMs, { event: storyEvent(CONTINUATION_PLAY_EVENT) }),
      context.planned.wait(successFeedbackDurationMs + SOURCE_IMAGE_DELAY_MS, {
        event: storyEvent(IMAGE_APPEAR_EVENT),
      }),
      ...IMAGE_BLINK_EVENTS.map((name, index) => context.planned.wait(
        successFeedbackDurationMs + SOURCE_IMAGE_DELAY_MS + BLINK_HALF_CYCLE_MS * (index + 1),
        { event: storyEvent(name) },
      )),
      context.planned.wait(successFeedbackDurationMs + SOURCE_AUDIO_DURATION_MS, {
        event: { name: 'sequence:end', visibility: 'public' },
      }),
    ];
  };
}

/** Converts p2_3 into a separately activated CodPlay story. */
export function convertPage2Continuation(xml: string, options: Page2ContinuationOptions) {
  if (options.audioBasePath.length === 0 || options.assetBasePath.length === 0) {
    throw new Error('The p2_3 audio and image paths must be configured.');
  }
  if (!Number.isFinite(options.successFeedbackDurationMs) || options.successFeedbackDurationMs <= 0) {
    throw new Error('The p2_2 success-feedback duration must be finite and positive.');
  }
  if (
    !Number.isFinite(options.imageSize.width)
    || options.imageSize.width <= 0
    || !Number.isFinite(options.imageSize.height)
    || options.imageSize.height <= 0
  ) {
    throw new Error('The intrinsic p2_3 correction-image dimensions must be positive.');
  }
  const { image, soundFile } = readSourceContinuation(xml);
  const continuationAudio = createContinuationAudio(
    `${options.audioBasePath.replace(/\/$/, '')}/${soundFile}`,
    options.parentStageId,
  );
  const correctionImage = convertLegacyImageElement(image, {
    assetBasePath: options.assetBasePath,
    chapterId: '02_circulation',
    imageSize: options.imageSize,
    stageId: options.parentStageId,
  });
  const sourceAppearEvent = correctionImage.eventimes.find(({ startAt }) => startAt === 0)?.name;
  if (sourceAppearEvent === undefined) throw new Error('The p2_3 correction image has no appearance event.');
  const imageActions = correctionImage.perso.actions ?? {};
  const appearAction = imageActions[sourceAppearEvent];
  if (appearAction === undefined) throw new Error('The p2_3 correction image has no appearance action.');
  const otherImageActions = Object.fromEntries(
    Object.entries(imageActions).filter(([name]) => name !== sourceAppearEvent),
  );
  const imagePerso = {
    ...correctionImage.perso,
    actions: {
      ...otherImageActions,
      [IMAGE_APPEAR_EVENT]: appearAction,
      [IMAGE_BLINK_EVENTS[0]]: { style: { opacity: { from: 1, to: 0, duration: BLINK_HALF_CYCLE_MS, ease: 'linear' } } },
      [IMAGE_BLINK_EVENTS[1]]: { style: { opacity: { from: 0, to: 1, duration: BLINK_HALF_CYCLE_MS, ease: 'linear' } } },
      [IMAGE_BLINK_EVENTS[2]]: { style: { opacity: { from: 1, to: 0, duration: BLINK_HALF_CYCLE_MS, ease: 'linear' } } },
      [IMAGE_BLINK_EVENTS[3]]: { style: { opacity: { from: 0, to: 1, duration: BLINK_HALF_CYCLE_MS, ease: 'linear' } } },
    },
  } satisfies ContinuationPerso;

  return {
    id: CONTINUATION_STORY_ID,
    eventimes: [],
    straps: {
      [CONTINUATION_SCHEDULE_STRAP]: createScheduleContinuation(options.successFeedbackDurationMs),
    },
    listen: [{ on: CONTINUATION_START_EVENT, active: true, reset: true, straps: [CONTINUATION_SCHEDULE_STRAP] }],
    persos: [
      continuationAudio,
      createCorrectionCross(options.assetBasePath, options.parentStageId),
      imagePerso,
    ],
  };
}

export {
  CONTINUATION_START_EVENT as PAGE2_CONTINUATION_START_EVENT,
  CONTINUATION_STORY_ID as PAGE2_CONTINUATION_STORY_ID,
};
