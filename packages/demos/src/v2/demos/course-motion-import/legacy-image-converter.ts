import type { SceneDoc } from 'codplay/scene/types';

const SOURCE_CANVAS_WIDTH = 1_600;
const SOURCE_CANVAS_HEIGHT = 788;
const SOURCE_PIXELS_PER_CQW = SOURCE_CANVAS_WIDTH / 100;
const SOURCE_EXIT_DISTANCE = 200;
const DEFAULT_EFFECT_DURATION_MS = 500;
const DEFAULT_EXIT_DELAY_MS = 100;
const DEFAULT_BACKGROUND_MARGIN_PX = 6;

type ScenePerso = SceneDoc['stories']['main']['persos'][number];
type ImagePerso = Extract<ScenePerso, { type: 'img' }>;
type ImageActions = NonNullable<ImagePerso['actions']>;
type SceneEventime = Readonly<{ name: string; startAt: number }>;

export type LegacyImageConversionOptions = Readonly<{
  assetBasePath: string;
  chapterId: string;
  imageSize: Readonly<{ width: number; height: number }>;
  stageId: string;
  targetId?: string;
}>;

type ConvertedImage = Readonly<{
  perso: ImagePerso;
  eventimes: readonly SceneEventime[];
  exitEndAt: number | null;
  initialFrame: Readonly<{ x: number; y: number; width: number; height: number }>;
}>;

/** Formats a media path with the identifier convention used by the source player. */
export function formatLegacyResourceId(path: string): string {
  const pathDirectory = path.substring(0, path.lastIndexOf('/') + 1);
  const fileName = path.substring(path.lastIndexOf('/') + 1, path.lastIndexOf('.')).replace(/\./g, '_');
  return `${pathDirectory}${fileName}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\//g, '_')
    .replace(/ /g, '_');
}

/** Reads and validates one finite numeric XML attribute. */
function readNumber(element: Element, name: string, fallback?: number): number {
  const value = element.getAttribute(name);
  if (value === null && fallback !== undefined) return fallback;
  if (value === null || value.trim() === '') throw new Error(`Expected a finite number for ${name}.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected a finite number for ${name}.`);
  return parsed;
}

/** Reads one source coordinate, including its canvas-centre keyword. */
function readSourceCoordinate(element: Element, name: 'x' | 'y'): number {
  const value = element.getAttribute(name);
  if (value === 'center') return name === 'x' ? SOURCE_CANVAS_WIDTH / 2 : SOURCE_CANVAS_HEIGHT / 2;
  return readNumber(element, name);
}

/** Converts an image XML element into one image perso and its timeline events. */
export function convertLegacyImageElement(
  image: Element,
  options: LegacyImageConversionOptions,
): ConvertedImage {
  if (image.tagName.toLowerCase() !== 'img') throw new Error('Expected a legacy <img> element.');

  const tweenNodes = Array.from(image.children);
  if (tweenNodes.some((node) => node.tagName !== 'tween')) {
    throw new Error('Only direct <tween> children are supported inside a legacy <img>.');
  }

  const allowedImageAttributes = new Set(['id', 'src', 'x', 'y', 'scale', 'delay', 'duration', 'effect', 'background', 'alpha']);
  const allowedTweenAttributes = new Set(['x', 'y', 'delay', 'time', 'alpha', 'targetItem']);
  if ([...image.attributes].some(({ name }) => !allowedImageAttributes.has(name))) {
    throw new Error('The legacy image uses an attribute outside the motion prototype.');
  }
  if (tweenNodes.some((tween) => [...tween.attributes].some(({ name }) => !allowedTweenAttributes.has(name)))) {
    throw new Error('The legacy tween uses an attribute outside the motion prototype.');
  }

  const id = image.getAttribute('id');
  const source = image.getAttribute('src');
  if (!source || !options.chapterId) throw new Error('The image requires a chapter id and a source.');
  if (source.split('/').includes('..')) throw new Error('Parent-directory media paths are not supported.');
  const itemId = options.targetId ?? id ?? `img_${options.chapterId}_${formatLegacyResourceId(source)}`;

  const effects = (image.getAttribute('effect') ?? '').split(',').filter(Boolean);
  const supportedEffects = new Set(['growDown', 'grow', 'fromLeft', 'fromRight', 'toLeft']);
  if (effects.some((effect) => !supportedEffects.has(effect)) || new Set(effects).size !== effects.length) {
    throw new Error('The legacy image uses an effect outside the motion prototype.');
  }
  if (effects.includes('growDown') && effects.includes('fromLeft')) {
    throw new Error('The legacy image combines unsupported entry effects.');
  }

  const scale = readNumber(image, 'scale', 1);
  if (scale <= 0) throw new Error('Expected a positive finite image scale.');
  if (
    !Number.isFinite(options.imageSize.width)
    || options.imageSize.width <= 0
    || !Number.isFinite(options.imageSize.height)
    || options.imageSize.height <= 0
  ) {
    throw new Error('Expected positive finite intrinsic image dimensions.');
  }

  const background = image.getAttribute('background');
  if (background !== null && background !== 'Y' && background !== 'N') {
    throw new Error('The image background attribute must be Y or N.');
  }
  const backgroundPadding = background === 'Y'
    ? DEFAULT_BACKGROUND_MARGIN_PX / scale / SOURCE_PIXELS_PER_CQW
    : 0;
  const itemWidth = options.imageSize.width * scale / SOURCE_PIXELS_PER_CQW;
  const itemHeight = options.imageSize.height * scale / SOURCE_PIXELS_PER_CQW;
  const outerWidth = itemWidth + backgroundPadding * 2;
  const outerHeight = itemHeight + backgroundPadding * 2;
  const centerX = readSourceCoordinate(image, 'x') / SOURCE_PIXELS_PER_CQW;
  const centerY = readSourceCoordinate(image, 'y') / SOURCE_PIXELS_PER_CQW;
  const targetX = centerX - outerWidth / 2;
  const targetY = centerY - outerHeight / 2;
  const itemDelayMs = readNumber(image, 'delay', 0) * 1_000;
  const durationAttribute = image.getAttribute('duration');
  const itemDurationMs = durationAttribute === null ? null : readNumber(image, 'duration') * 1_000;
  if (itemDelayMs < 0 || (itemDurationMs !== null && itemDurationMs <= 0)) {
    throw new Error('Expected a non-negative image delay and a positive image duration.');
  }
  if (effects.includes('toLeft') && itemDurationMs === null) {
    throw new Error('The toLeft exit effect requires an image duration.');
  }

  const motionTweens = tweenNodes.filter((tween) => tween.getAttribute('targetItem') === null && (
    tween.hasAttribute('x') || tween.hasAttribute('y')
  ));
  const motionSegments = motionTweens.map((tween, index) => {
    const tweenDelayMs = readNumber(tween, 'delay', 0) * 1_000;
    const durationMs = readNumber(tween, 'time') * 1_000;
    const previousTween = motionTweens[index - 1];
    const previousEndMs = previousTween === undefined
      ? 0
      : readNumber(previousTween, 'delay', 0) * 1_000 + readNumber(previousTween, 'time') * 1_000;
    if (tweenDelayMs < 0 || durationMs <= 0 || tweenDelayMs < previousEndMs) {
      throw new Error('Expected ordered, non-overlapping tween segments with positive durations.');
    }
    if (itemDurationMs !== null && tweenDelayMs + durationMs > itemDurationMs) {
      throw new Error('Every tween segment must finish within the image duration.');
    }

    const previousDestinationX = previousTween === undefined
      ? targetX
      : readSourceCoordinate(previousTween, 'x') / SOURCE_PIXELS_PER_CQW - outerWidth / 2;
    const previousDestinationY = previousTween === undefined
      ? targetY
      : readSourceCoordinate(previousTween, 'y') / SOURCE_PIXELS_PER_CQW - outerHeight / 2;
    const startAt = itemDelayMs + tweenDelayMs;
    if (
      (effects.includes('growDown') || effects.includes('fromLeft'))
      && index === 0
      && startAt < itemDelayMs + DEFAULT_EFFECT_DURATION_MS
    ) {
      throw new Error('The first tween cannot overlap the image entry effect.');
    }

    return {
      eventName: `${itemId}:motion:${index + 1}`,
      startAt,
      fromX: previousDestinationX,
      fromY: previousDestinationY,
      toX: readSourceCoordinate(tween, 'x') / SOURCE_PIXELS_PER_CQW - outerWidth / 2,
      toY: readSourceCoordinate(tween, 'y') / SOURCE_PIXELS_PER_CQW - outerHeight / 2,
      durationMs,
    };
  });

  const growDown = effects.includes('growDown');
  const grow = effects.includes('grow');
  const fromLeft = effects.includes('fromLeft');
  const fromRight = effects.includes('fromRight');
  const startScale = growDown ? scale + 0.5 : scale;
  const startWidth = options.imageSize.width * startScale / SOURCE_PIXELS_PER_CQW + backgroundPadding * 2;
  const startHeight = options.imageSize.height * startScale / SOURCE_PIXELS_PER_CQW + backgroundPadding * 2;
  const entryX = centerX - startWidth / 2 + (
    fromLeft ? -SOURCE_EXIT_DISTANCE / SOURCE_PIXELS_PER_CQW
      : fromRight ? SOURCE_EXIT_DISTANCE / SOURCE_PIXELS_PER_CQW
        : 0
  );
  const entryY = centerY - startHeight / 2;
  const initialFrame = {
    x: fromLeft || growDown ? entryX : targetX,
    y: growDown ? entryY : targetY,
    width: growDown ? startWidth : outerWidth,
    height: growDown ? startHeight : outerHeight,
  };
  const appearEvent = `${itemId}:appear`;
  const alpha = readNumber(image, 'alpha', 1);
  if (alpha < 0 || alpha > 1) throw new Error('Expected an image alpha between zero and one.');
  const motionActions = Object.fromEntries(motionSegments.map((segment) => [segment.eventName, {
    style: {
      x: { from: segment.fromX, to: segment.toX, duration: segment.durationMs, ease: 'outSine' },
      y: { from: segment.fromY, to: segment.toY, duration: segment.durationMs, ease: 'outSine' },
    },
  }])) as ImageActions;
  const appearAction = {
    style: {
      opacity: { from: 0, to: alpha, duration: DEFAULT_EFFECT_DURATION_MS, ease: 'outSine' },
      ...(growDown ? {
        x: { from: entryX, to: targetX, duration: DEFAULT_EFFECT_DURATION_MS, ease: 'outSine' },
        y: { from: entryY, to: targetY, duration: DEFAULT_EFFECT_DURATION_MS, ease: 'outSine' },
        width: { from: startWidth, to: outerWidth, duration: DEFAULT_EFFECT_DURATION_MS, ease: 'outSine' },
        height: { from: startHeight, to: outerHeight, duration: DEFAULT_EFFECT_DURATION_MS, ease: 'outSine' },
      } : fromLeft || fromRight ? {
        x: { from: entryX, to: targetX, duration: DEFAULT_EFFECT_DURATION_MS, ease: 'outSine' },
      } : grow ? {
        scaleX: { from: 0.5, to: 1, duration: DEFAULT_EFFECT_DURATION_MS, ease: 'outSine' },
        scaleY: { from: 0.5, to: 1, duration: DEFAULT_EFFECT_DURATION_MS, ease: 'outSine' },
      } : {}),
    },
  };
  const alphaTweens = tweenNodes.flatMap((tween, index) => {
    if (tween.hasAttribute('targetItem') || !tween.hasAttribute('alpha')) return [];
    const delayMs = readNumber(tween, 'delay', 0) * 1_000;
    const durationMs = readNumber(tween, 'time') * 1_000;
    const targetAlpha = readNumber(tween, 'alpha');
    if (delayMs < 0 || durationMs <= 0 || targetAlpha < 0 || targetAlpha > 1) {
      throw new Error('Expected a valid image alpha tween.');
    }
    return [{
      eventName: `${itemId}:alpha:${index + 1}`,
      startAt: itemDelayMs + delayMs,
      action: {
        style: {
          opacity: { from: alpha, to: targetAlpha, duration: durationMs, ease: 'linear' },
        },
      },
    }];
  });
  const eventimes: SceneEventime[] = [
    { name: appearEvent, startAt: itemDelayMs },
    ...motionSegments.map(({ eventName, startAt }) => ({ name: eventName, startAt })),
    ...alphaTweens.map(({ eventName, startAt }) => ({ name: eventName, startAt })),
  ];
  const finalMotion = motionSegments.at(-1);
  const finalX = finalMotion?.toX ?? targetX;
  const exitEvent = `${itemId}:exit`;
  const removeEvent = `${itemId}:remove`;
  const exitStartMs = itemDurationMs === null ? null : itemDelayMs + itemDurationMs + DEFAULT_EXIT_DELAY_MS;
  const exitEndAt = exitStartMs === null ? null : exitStartMs + DEFAULT_EFFECT_DURATION_MS;
  const exitActions: ImageActions = exitStartMs === null ? {} : {
    [exitEvent]: {
      style: {
        ...(effects.includes('toLeft') ? {
          x: {
            from: finalX,
            to: finalX - SOURCE_EXIT_DISTANCE / SOURCE_PIXELS_PER_CQW,
            duration: DEFAULT_EFFECT_DURATION_MS,
            ease: 'inSine',
          },
        } : {}),
        opacity: { from: 1, to: 0, duration: DEFAULT_EFFECT_DURATION_MS, ease: 'inSine' },
      },
    },
    [removeEvent]: { style: { display: 'none' } },
  };
  const actions: ImageActions = {
    [appearEvent]: appearAction,
    ...motionActions,
    ...Object.fromEntries(alphaTweens.map(({ eventName, action }) => [eventName, action])),
    ...exitActions,
  };

  if (exitStartMs !== null && exitEndAt !== null) {
    eventimes.push(
      { name: exitEvent, startAt: exitStartMs },
      { name: removeEvent, startAt: exitEndAt },
    );
  }

  const assetBasePath = options.assetBasePath.replace(/\/$/, '');
  const mediaUrl = `${assetBasePath}/${source.replace(/^\/+/, '')}`;
  const perso = {
    id: itemId,
    type: 'img',
    initial: {
      src: mediaUrl,
      alt: itemId,
      className: `course-motion-image${background === 'Y' ? ' course-motion-image--background' : ''}`,
      img: { style: { width: '100%', height: '100%', objectFit: 'contain' } },
      style: {
        position: 'absolute',
        left: 0,
        top: 0,
        ...initialFrame,
        opacity: 0,
        ...(grow ? { scaleX: 0.5, scaleY: 0.5 } : {}),
        zIndex: 1,
        ...(background === 'Y' ? {
          boxSizing: 'border-box',
          padding: `${backgroundPadding}cqw`,
          borderRadius: `${8 / scale / SOURCE_PIXELS_PER_CQW}cqw`,
          backgroundColor: '#fff',
          boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
        } : {}),
      },
      move: { target: options.stageId },
    },
    actions,
  } satisfies ImagePerso;

  return { perso, eventimes, exitEndAt, initialFrame };
}

/** Converts one motion-focused XML image into a complete SceneDoc for facade tests. */
export function convertLegacyMotionItem(xml: string, options: LegacyImageConversionOptions): SceneDoc {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const image = document.documentElement;
  if (document.querySelector('parsererror')) throw new Error('Expected one valid legacy <img> element.');
  const converted = convertLegacyImageElement(image, options);
  if (image.children.length === 0 || converted.exitEndAt === null) {
    throw new Error('The motion fixture requires an image duration and at least one <tween>.');
  }
  if (converted.eventimes.length !== image.children.length + 3) {
    throw new Error('Every child <tween> must produce one motion event.');
  }

  return {
    id: `course-motion-${converted.perso.id}`,
    stories: {
      main: {
        id: 'main',
        persos: [converted.perso],
        eventimes: converted.eventimes,
      },
    },
    eventimes: [{ name: 'sequence:end', startAt: converted.exitEndAt }],
  };
}

/** Exposes source canvas dimensions to the page-sequence converter. */
export const LEGACY_SOURCE_CANVAS = Object.freeze({
  width: SOURCE_CANVAS_WIDTH,
  height: SOURCE_CANVAS_HEIGHT,
  pixelsPerCqw: SOURCE_PIXELS_PER_CQW,
});
