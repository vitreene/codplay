import type { SceneDoc } from 'codplay/scene/types';
import {
  convertLegacyImageElement,
  LEGACY_SOURCE_CANVAS,
  type LegacyImageConversionOptions,
} from './legacy-image-converter';

const DEFAULT_EFFECT_DURATION_MS = 500;
const DEFAULT_EXIT_DELAY_MS = 100;
const SOURCE_EXIT_DISTANCE = 200;
const SOURCE_PIXELS_PER_CQW = LEGACY_SOURCE_CANVAS.pixelsPerCqw;

type ScenePerso = SceneDoc['stories']['main']['persos'][number];
type SceneEventime = NonNullable<SceneDoc['stories']['main']['eventimes']>[number];
type ImageSize = Readonly<{ width: number; height: number }>;

export type LegacyPageSequenceConversionOptions = Readonly<
  Omit<LegacyImageConversionOptions, 'imageSize'> & {
    audioBasePath: string;
    audioDurationMs: number;
    globalPropertiesXml: string;
    imageSizes: Readonly<Record<string, ImageSize>>;
  }
>;

/** Reads and validates one finite numeric XML attribute. */
function readNumber(element: Element, name: string, fallback?: number): number {
  const value = element.getAttribute(name);
  if (value === null && fallback !== undefined) return fallback;
  if (value === null || value.trim() === '') throw new Error(`Expected a finite number for ${name}.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Expected a finite number for ${name}.`);
  return parsed;
}

/** Rejects attributes that the selected page-sequence mapping does not handle. */
function requireAttributes(element: Element, allowed: readonly string[]): void {
  if ([...element.attributes].some(({ name }) => !allowed.includes(name))) {
    throw new Error(`The legacy <${element.tagName}> uses an unsupported attribute.`);
  }
}

/** Reads the three global properties used by this source sequence. */
function readGlobalProperties(xml: string): ReadonlyMap<string, Element> {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  const root = document.documentElement;
  if (document.querySelector('parsererror') || root.tagName !== 'data') {
    throw new Error('Expected one valid global-properties XML document.');
  }
  const globalProperties = Array.from(root.children).find((node) => node.tagName === 'globalProperties');
  if (globalProperties === undefined) throw new Error('The global-properties XML has no <globalProperties> element.');

  return Array.from(globalProperties.children).reduce((properties, element) => {
    if (element.tagName !== 'properties') throw new Error('Only <properties> entries are supported in globalProperties.');
    const name = element.getAttribute('name');
    if (!name || properties.has(name)) throw new Error('Every global property must have one unique name.');
    properties.set(name, element);
    return properties;
  }, new Map<string, Element>());
}

/** Validates the circle-panel property and returns its target size and duration. */
function readCirclePanelProperty(properties: ReadonlyMap<string, Element>): Readonly<{ diameter: number; durationMs: number }> {
  const property = properties.get('effectPanelCircle');
  if (property === undefined) throw new Error('The source global property effectPanelCircle is missing.');
  requireAttributes(property, ['name', 'left', 'top', 'centered', 'width', 'height', 'cssClass', 'effect']);
  if (
    property.getAttribute('left') !== '50%'
    || property.getAttribute('top') !== '50%'
    || property.getAttribute('centered') !== 'Y'
    || property.getAttribute('width') !== '0'
    || property.getAttribute('height') !== '0'
    || property.getAttribute('cssClass') !== 'outerContainer under in-circle'
    || property.getAttribute('effect') !== 'noDefault,toBottom'
  ) {
    throw new Error('The source effectPanelCircle property uses an unsupported shape.');
  }
  const tweens = Array.from(property.children);
  if (tweens.length !== 1 || tweens[0]?.tagName !== 'tween') {
    throw new Error('effectPanelCircle must contain exactly one <tween>.');
  }
  const tween = tweens[0];
  requireAttributes(tween, ['width', 'height', 'time', 'ease']);
  const width = tween.getAttribute('width')?.match(/^([\d.]+)px$/);
  const height = tween.getAttribute('height')?.match(/^([\d.]+)px$/);
  if (width === null || width === undefined || height === null || height === undefined || width[1] !== height[1]) {
    throw new Error('effectPanelCircle must expand to a square pixel size.');
  }
  if (tween.getAttribute('ease') !== 'sine.in') throw new Error('effectPanelCircle uses an unsupported easing value.');
  const durationMs = readNumber(tween, 'time') * 1_000;
  const diameter = Number(width[1]) / SOURCE_PIXELS_PER_CQW;
  if (diameter <= 0 || durationMs <= 0) throw new Error('effectPanelCircle dimensions and duration must be positive.');
  return { diameter, durationMs };
}

/** Resolves one source panel colour property to its local CSS class mapping. */
function readPanelColor(properties: ReadonlyMap<string, Element>, name: string): string {
  if (name !== 'panelColor1' && name !== 'panelColor2') {
    throw new Error(`The source panel references unsupported global property ${name}.`);
  }
  const property = properties.get(name);
  if (property === undefined) throw new Error(`The source global property ${name} is missing.`);
  requireAttributes(property, ['name', 'cssStyle']);
  const expectedColor = name === 'panelColor1' ? '--panel-bg-color--1' : '--panel-bg-color--2';
  if (property.getAttribute('cssStyle') !== `backgroundColor:var(${expectedColor})`) {
    throw new Error(`The source global property ${name} uses an unsupported CSS style.`);
  }
  return name === 'panelColor1' ? 'course-motion-panel--color-1' : 'course-motion-panel--color-2';
}

/** Converts one source panel and its circle-entry and downward-exit timeline. */
function convertPanel(
  container: Element,
  properties: ReadonlyMap<string, Element>,
  stageId: string,
): Readonly<{ perso: ScenePerso; eventimes: readonly SceneEventime[]; exitEndAt: number }> {
  requireAttributes(container, ['id', 'properties', 'delay', 'duration']);
  if (container.children.length > 0 || container.textContent?.trim()) {
    throw new Error('Source panel containers cannot contain child elements or text.');
  }
  const id = container.getAttribute('id');
  const propertyNames = container.getAttribute('properties')?.split(',') ?? [];
  if (!id || propertyNames.length !== 2 || propertyNames[0] !== 'effectPanelCircle') {
    throw new Error('A source panel must declare an id and effectPanelCircle followed by one panel colour property.');
  }
  const color = readPanelColor(properties, propertyNames[1] ?? '');
  const { diameter, durationMs } = readCirclePanelProperty(properties);
  const delayMs = readNumber(container, 'delay', 0) * 1_000;
  const visibleDurationMs = readNumber(container, 'duration') * 1_000;
  if (delayMs < 0 || visibleDurationMs <= 0) throw new Error('Panel delay and duration are outside the supported range.');

  const centerX = LEGACY_SOURCE_CANVAS.width / 2 / SOURCE_PIXELS_PER_CQW;
  const centerY = LEGACY_SOURCE_CANVAS.height / 2 / SOURCE_PIXELS_PER_CQW;
  const expandedX = centerX - diameter / 2;
  const expandedY = centerY - diameter / 2;
  const openEvent = `${id}:open`;
  const closeEvent = `${id}:close`;
  const removeEvent = `${id}:remove`;
  const closeAt = delayMs + visibleDurationMs + DEFAULT_EXIT_DELAY_MS;
  const exitEndAt = closeAt + DEFAULT_EFFECT_DURATION_MS;
  const perso = {
    id,
    type: 'layout',
    initial: {
      move: { target: stageId },
      markup: `<div id="${id}" class="course-motion-panel outerContainer under in-circle ${color}"></div>`,
      style: {
        position: 'absolute',
        left: 0,
        top: 0,
        x: centerX,
        y: centerY,
        width: 0,
        height: 0,
        borderRadius: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      },
    },
    actions: {
      [openEvent]: {
        style: {
          x: { from: centerX, to: expandedX, duration: durationMs, ease: 'inSine' },
          y: { from: centerY, to: expandedY, duration: durationMs, ease: 'inSine' },
          width: { from: 0, to: diameter, duration: durationMs, ease: 'inSine' },
          height: { from: 0, to: diameter, duration: durationMs, ease: 'inSine' },
        },
      },
      [closeEvent]: {
        style: {
          y: {
            from: expandedY,
            to: expandedY + SOURCE_EXIT_DISTANCE / SOURCE_PIXELS_PER_CQW,
            duration: DEFAULT_EFFECT_DURATION_MS,
            ease: 'inSine',
          },
          opacity: { from: 1, to: 0, duration: DEFAULT_EFFECT_DURATION_MS, ease: 'inSine' },
        },
      },
      [removeEvent]: { style: { display: 'none' } },
    },
  } satisfies ScenePerso;

  return {
    perso,
    eventimes: [
      { name: openEvent, startAt: delayMs },
      { name: closeEvent, startAt: closeAt },
      { name: removeEvent, startAt: exitEndAt },
    ],
    exitEndAt,
  };
}

/** Creates the responsive stage that owns the converted page elements. */
function createStage(stageId: string): ScenePerso {
  return {
    id: stageId,
    type: 'layout',
    initial: {
      move: '@root',
      markup: `<section id="${stageId}" class="course-motion-stage"></section>`,
      style: {
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        containerType: 'inline-size',
      },
    },
    actions: {},
  };
}

/** Creates the hidden native audio perso used by the source sequence. */
function createAudioPerso(src: string, stageId: string): Readonly<{ perso: ScenePerso; eventime: SceneEventime }> {
  const startEvent = 'course-motion-audio:start';
  return {
    perso: {
      id: 'course-motion-audio',
      type: 'media',
      initial: {
        tag: 'audio',
        src,
        sync: 'auto',
        video: { style: { display: 'none' } },
        move: { target: stageId },
      },
      actions: { [startEvent]: { broadcast: { type: 'START' } } },
    },
    eventime: { name: startEvent, startAt: 0 },
  };
}

/** Converts the selected source sequence, its referenced properties, and its media into a SceneDoc. */
export function convertLegacyPageSequence(
  sequenceXml: string,
  options: LegacyPageSequenceConversionOptions,
): SceneDoc {
  const document = new DOMParser().parseFromString(sequenceXml, 'application/xml');
  const sequence = document.documentElement;
  if (document.querySelector('parsererror') || sequence.tagName !== 'sequency') {
    throw new Error('Expected one valid legacy <sequency> element.');
  }
  if (!Number.isFinite(options.audioDurationMs) || options.audioDurationMs <= 0) {
    throw new Error('Expected a positive finite source audio duration.');
  }

  const properties = readGlobalProperties(options.globalPropertiesXml);
  const soundElements = Array.from(sequence.children).filter((element) => element.tagName === 'sound');
  if (soundElements.length !== 1 || sequence.children[0]?.tagName !== 'sound') {
    throw new Error('The source sequence must start with exactly one <sound>.');
  }
  const sound = soundElements[0]!;
  requireAttributes(sound, []);
  if (sound.children.length > 0) throw new Error('The source <sound> cannot contain child elements.');
  const soundFile = sound.textContent?.trim();
  if (!soundFile || soundFile.includes('/') || soundFile.includes('\\') || soundFile === '.' || soundFile === '..') {
    throw new Error('The source <sound> must contain one local file name.');
  }

  const audioBasePath = options.audioBasePath.replace(/\/$/, '');
  const audio = createAudioPerso(`${audioBasePath}/${soundFile}`, options.stageId);
  const seenIds = new Set([options.stageId, audio.perso.id]);
  const persos: ScenePerso[] = [createStage(options.stageId), audio.perso];
  const eventimes: SceneEventime[] = [audio.eventime];
  let latestExitEndAt = 0;

  for (const element of Array.from(sequence.children).slice(1)) {
    if (element.tagName === 'container') {
      const panel = convertPanel(element, properties, options.stageId);
      if (seenIds.has(panel.perso.id)) throw new Error(`Duplicate perso id ${panel.perso.id} in the source sequence.`);
      seenIds.add(panel.perso.id);
      persos.push(panel.perso);
      eventimes.push(...panel.eventimes);
      latestExitEndAt = Math.max(latestExitEndAt, panel.exitEndAt);
      continue;
    }
    if (element.tagName !== 'img') throw new Error(`The source sequence contains unsupported <${element.tagName}> content.`);

    const source = element.getAttribute('src');
    if (!source) throw new Error('Every source image must declare src.');
    const imageSize = options.imageSizes[source];
    if (imageSize === undefined) throw new Error(`The intrinsic image size for ${source} is missing.`);
    const image = convertLegacyImageElement(element, {
      assetBasePath: options.assetBasePath,
      chapterId: options.chapterId,
      imageSize,
      stageId: options.stageId,
    });
    if (seenIds.has(image.perso.id)) throw new Error(`Duplicate perso id ${image.perso.id} in the source sequence.`);
    seenIds.add(image.perso.id);
    persos.push(image.perso);
    eventimes.push(...image.eventimes);
    if (image.exitEndAt !== null) latestExitEndAt = Math.max(latestExitEndAt, image.exitEndAt);
  }

  if (latestExitEndAt > options.audioDurationMs) {
    throw new Error('A source element outlasts the audio-defined sequence duration.');
  }

  return {
    id: 'course-motion-page2-sequence-1',
    stories: {
      main: {
        id: 'main',
        persos,
        eventimes,
      },
    },
    eventimes: [{ name: 'sequence:end', startAt: options.audioDurationMs }],
  };
}
