import type { SceneDoc } from 'codplay/scene/types';
import { CourseSourceReader } from '@codplay/course-import/course-source-reader';
import { PageConverter } from '@codplay/course-import/page-converter';
import { findElements, getElementChildren, readTextContent } from '@codplay/course-import/xml-document-reader';
import type { PageConversionContext } from '@codplay/course-import/page-converter';
import type { SourceResolution, XmlElement } from '@codplay/course-import/source-model';
import {
  formatLegacyResourceId,
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
  targetId: string,
): Readonly<{ perso: ScenePerso; eventimes: readonly SceneEventime[]; exitEndAt: number }> {
  requireAttributes(container, ['id', 'properties', 'delay', 'duration']);
  if (container.children.length > 0 || container.textContent?.trim()) {
    throw new Error('Source panel containers cannot contain child elements or text.');
  }
  const sourceId = container.getAttribute('id');
  const id = targetId;
  const propertyNames = container.getAttribute('properties')?.split(',') ?? [];
  if (!sourceId || propertyNames.length !== 2 || propertyNames[0] !== 'effectPanelCircle') {
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

/** Converts the selected source sequence, its referenced properties, and its media into a SceneDoc. */
export function convertLegacyPageSequence(
  sequenceXml: string,
  options: LegacyPageSequenceConversionOptions,
): SceneDoc {
  const reader = new CourseSourceReader();
  const pageDocument = reader.readDocument({ documentId: '02_circulation.xml', xml: `<page id="page2">${sequenceXml}</page>` });
  const sequenceElements = getElementChildren(pageDocument.root).filter(({ name }) => name === 'sequency');
  if (pageDocument.root.name !== 'page' || sequenceElements.length !== 1 || pageDocument.root.attributes.id !== 'page2') {
    throw new Error('Expected one source <sequency> from page2.');
  }
  const sourceSequence = sequenceElements[0]!;
  if (!Number.isFinite(options.audioDurationMs) || options.audioDurationMs <= 0) {
    throw new Error('Expected a positive finite source audio duration.');
  }

  const properties = readGlobalProperties(options.globalPropertiesXml);
  const sourceProperties = reader.readDocument({ documentId: '02_circulation-global-properties.xml', xml: options.globalPropertiesXml });
  const sourceElements = getElementChildren(sourceSequence);
  const soundElements = sourceElements.filter(({ name }) => name === 'sound');
  if (soundElements.length !== 1 || sourceElements[0]?.name !== 'sound') {
    throw new Error('The source sequence must start with exactly one <sound>.');
  }
  const sound = soundElements[0]!;
  const soundFile = readTextContent(sound).trim();
  if (!soundFile || soundFile.includes('/') || soundFile.includes('\\') || soundFile === '.' || soundFile === '..') {
    throw new Error('The source <sound> must contain one local file name.');
  }

  const domDocument = new DOMParser().parseFromString(sequenceXml, 'application/xml');
  const domSequence = domDocument.documentElement;
  if (domDocument.querySelector('parsererror') || domSequence.tagName !== 'sequency') {
    throw new Error('Expected one valid legacy <sequency> element.');
  }
  const domElements = Array.from(domSequence.children);
  if (domElements.length !== sourceElements.length) throw new Error('The source parser views of the sequence do not match.');

  const imageBasePath = options.assetBasePath.replace(/\/$/, '');
  const audioBasePath = options.audioBasePath.replace(/\/$/, '');
  const resources = Object.fromEntries([
    ...findElements(sourceSequence, 'img').map((element) => [element.attributes.src!, `${imageBasePath}/${element.attributes.src!.replace(/^\/+/, '')}`]),
    [soundFile, `${audioBasePath}/${soundFile}`],
  ]);
  const sourceCanvasWidth = LEGACY_SOURCE_CANVAS.width;
  const resolveAttributes = (element: XmlElement): SourceResolution<Readonly<Record<string, string>>> => {
    const propertyNames = element.attributes.properties?.split(',').map((name) => name.trim()).filter(Boolean) ?? [];
    const resolvedProperties = propertyNames.map((name) => reader.resolveProperty([sourceProperties], name));
    const unresolvedProperty = resolvedProperties.find((resolution) => resolution.status !== 'resolved' || resolution.value === undefined);
    if (unresolvedProperty !== undefined) {
      return { status: unresolvedProperty.status === 'ambiguous' ? 'ambiguous' : 'missing', candidates: [] };
    }
    const propertyValues = resolvedProperties.map(({ value }) => Object.fromEntries(
      Object.entries(value!.attributes).filter(([name]) => name !== 'name'),
    ));
    const id = element.attributes.id ?? (element.name === 'img' && element.attributes.src !== undefined
      ? `img_${options.chapterId}_${formatLegacyResourceId(element.attributes.src)}`
      : undefined);
    const attributes = {
      ...Object.assign({}, ...propertyValues),
      ...element.attributes,
      ...(id === undefined ? {} : { id }),
    };
    return { status: 'resolved', value: attributes, candidates: [attributes] };
  };
  const resolveImageGeometry = (attributes: Readonly<Record<string, string>>) => {
    const source = attributes.src;
    if (source === undefined) return undefined;
    const imageSize = options.imageSizes[source];
    if (imageSize === undefined) return undefined;
    const scale = Number(attributes.scale ?? '1');
    if (!Number.isFinite(scale) || scale <= 0) return undefined;
    const width = imageSize.width * scale;
    const height = imageSize.height * scale;
    const centerX = readSourceCoordinateValue(attributes.x, 'x');
    const centerY = readSourceCoordinateValue(attributes.y, 'y');
    return {
      position: 'absolute',
      left: 0,
      top: 0,
      x: (centerX - width / 2) / SOURCE_PIXELS_PER_CQW,
      y: (centerY - height / 2) / SOURCE_PIXELS_PER_CQW,
      width: width / SOURCE_PIXELS_PER_CQW,
      height: height / SOURCE_PIXELS_PER_CQW,
    };
  };
  const context: PageConversionContext = {
    sceneId: 'course-motion-page2-sequence-1',
    sourceCanvasWidth,
    resolveAttributes: (element) => resolveAttributes(element),
    resolveResource: (sourcePath) => reader.resolveResource(sourcePath, resources),
    resolveMediaSync: (element) => element.name === 'sound' ? 'master' : undefined,
    resolveMediaStart: (element) => element.name === 'sound' ? 0 : undefined,
    resolveGeometry: (element, attributes) => {
      if (element.name === 'img') return resolveImageGeometry(attributes);
      const width = readSourceNumber(attributes.width, 0);
      const height = readSourceNumber(attributes.height, 0);
      const left = readSourcePosition(attributes.left ?? attributes.x, 'x', attributes.centered === 'Y');
      const top = readSourcePosition(attributes.top ?? attributes.y, 'y', attributes.centeredY === 'Y' || attributes.centered === 'Y');
      if (width === undefined || height === undefined || left === undefined || top === undefined) return undefined;
      return {
        position: 'absolute',
        left: 0,
        top: 0,
        x: left / SOURCE_PIXELS_PER_CQW,
        y: top / SOURCE_PIXELS_PER_CQW,
        width: width / SOURCE_PIXELS_PER_CQW,
        height: height / SOURCE_PIXELS_PER_CQW,
      };
    },
    resolveTween: (tween, owner, ownerTiming) => {
      if (owner?.name !== 'img' || ownerTiming === undefined || owner.attributes.src === undefined) return undefined;
      const attributes = resolveAttributes(owner);
      if (attributes.status !== 'resolved' || attributes.value === undefined) return undefined;
      const targetSourceId = attributes.value.id;
      if (targetSourceId === undefined) return undefined;
      const geometry = resolveImageGeometry(attributes.value);
      if (geometry === undefined) return undefined;
      const imageSize = options.imageSizes[owner.attributes.src];
      if (imageSize === undefined) return undefined;
      const scaledWidth = imageSize.width * Number(attributes.value.scale ?? '1');
      const scaledHeight = imageSize.height * Number(attributes.value.scale ?? '1');
      const siblingTweens = getElementChildren(owner).filter(({ name }) => name === 'tween');
      const tweenIndex = siblingTweens.indexOf(tween);
      const previousTweens = siblingTweens.slice(0, tweenIndex).reverse();
      const initialX = Number(geometry.x);
      const initialY = Number(geometry.y);
      const readTweenPosition = (rawValue: string | undefined, axis: 'x' | 'y') => {
        if (rawValue === undefined) return undefined;
        const center = readSourceCoordinateValue(rawValue, axis);
        return (center - (axis === 'x' ? scaledWidth : scaledHeight) / 2) / SOURCE_PIXELS_PER_CQW;
      };
      const previousX = previousTweens.find(({ attributes: previous }) => previous.x !== undefined)?.attributes.x;
      const previousY = previousTweens.find(({ attributes: previous }) => previous.y !== undefined)?.attributes.y;
      const targetX = readTweenPosition(tween.attributes.x, 'x');
      const targetY = readTweenPosition(tween.attributes.y, 'y');
      if (targetX === undefined && targetY === undefined) return undefined;
      const delayMs = readSourceNumber(tween.attributes.delay, 0);
      const durationSeconds = readSourceNumber(tween.attributes.time);
      if (delayMs === undefined || durationSeconds === undefined || durationSeconds <= 0) return undefined;
      return {
        targetSourceId,
        startAtMs: ownerTiming.startAtMs + delayMs * 1_000,
        durationMs: durationSeconds * 1_000,
        ease: 'outSine',
        style: {
          ...(targetX === undefined ? {} : { x: { from: readTweenPosition(previousX, 'x') ?? initialX, to: targetX } }),
          ...(targetY === undefined ? {} : { y: { from: readTweenPosition(previousY, 'y') ?? initialY, to: targetY } }),
        },
      };
    },
  };
  const converted = new PageConverter().convertPage(pageDocument.root, context);
  const importedScene = converted.scene;
  const importedStory = importedScene === undefined ? undefined : Object.values(importedScene.stories)[0];
  if (importedStory === undefined) throw new Error('The shared course importer did not produce a story for page2.');
  const genericPersos = importedStory.persos as readonly ScenePerso[];
  if (genericPersos.length !== sourceElements.length) throw new Error('The shared course importer did not preserve each source sequence element.');

  const seenIds = new Set([options.stageId]);
  const persos: ScenePerso[] = [createStage(options.stageId)];
  const eventimes: SceneEventime[] = [...(importedStory.eventimes ?? [])];
  let latestExitEndAt = 0;

  for (const [index, sourceElement] of domElements.entries()) {
    const genericPerso = genericPersos[index]!;
    if (genericPerso.id === undefined || seenIds.has(genericPerso.id)) throw new Error(`Duplicate or missing imported perso id ${genericPerso.id}.`);
    seenIds.add(genericPerso.id);
    if (sourceElement.tagName === 'sound' && genericPerso.type === 'media') {
      persos.push({
        ...genericPerso,
        initial: { ...(genericPerso.initial ?? {}), move: { target: options.stageId } },
      } as ScenePerso);
      continue;
    }
    if (sourceElement.tagName === 'container' && genericPerso.type === 'layout') {
      const panel = convertPanel(sourceElement, properties, options.stageId, genericPerso.id);
      const startEvent = `${genericPerso.id}:source-timing:start`;
      const endEvent = `${genericPerso.id}:source-timing:end`;
      const genericActions: Record<string, unknown> = { ...(genericPerso.actions ?? {}) };
      const panelOpenEvent = `${genericPerso.id}:open`;
      const panelActions: Record<string, unknown> = { ...panel.perso.actions };
      const genericInitial = (genericPerso.initial ?? {}) as Readonly<Record<string, unknown>>;
      const panelInitial = (panel.perso.initial ?? {}) as Readonly<Record<string, unknown>>;
      const startAction = genericActions[startEvent] as Readonly<{ style?: Readonly<Record<string, unknown>> }> | undefined;
      const openAction = panelActions[panelOpenEvent] as Readonly<{ style?: Readonly<Record<string, unknown>> }> | undefined;
      const mergedPanelOpen = startAction !== undefined && openAction !== undefined;
      if (startAction !== undefined && openAction !== undefined) {
        genericActions[startEvent] = { ...startAction, ...openAction, style: { ...startAction.style, ...openAction.style } };
        delete panelActions[panelOpenEvent];
      }
      delete genericActions[endEvent];
      const actions = { ...genericActions, ...panelActions };
      eventimes.push(...panel.eventimes.filter(({ name }) => !(mergedPanelOpen && name === panelOpenEvent)));
      eventimes.splice(0, eventimes.length, ...eventimes.filter(({ name }) => name !== endEvent));
      persos.push({
        ...genericPerso,
        initial: {
          ...genericInitial,
          ...panelInitial,
          move: { target: options.stageId },
          style: {
            ...(genericInitial.style as Readonly<Record<string, unknown>> | undefined),
            ...(panelInitial.style as Readonly<Record<string, unknown>> | undefined),
          },
        },
        actions,
      } as ScenePerso);
      latestExitEndAt = Math.max(latestExitEndAt, panel.exitEndAt);
      continue;
    }
    if (sourceElement.tagName !== 'img' || genericPerso.type !== 'img') {
      throw new Error(`The source sequence has unsupported or mismatched <${sourceElement.tagName}> content.`);
    }

    const source = sourceElement.getAttribute('src');
    if (!source) throw new Error('Every source image must declare src.');
    const imageSize = options.imageSizes[source];
    if (imageSize === undefined) throw new Error(`The intrinsic image size for ${source} is missing.`);
    const image = convertLegacyImageElement(sourceElement, {
      assetBasePath: options.assetBasePath,
      chapterId: options.chapterId,
      imageSize,
      stageId: options.stageId,
      targetId: genericPerso.id,
    });
    const startEvent = `${genericPerso.id}:source-timing:start`;
    const endEvent = `${genericPerso.id}:source-timing:end`;
    const appearEvent = `${genericPerso.id}:appear`;
    const genericActions: Record<string, unknown> = { ...(genericPerso.actions ?? {}) };
    const imageActions: Record<string, unknown> = { ...(image.perso.actions ?? {}) };
    const startAction = genericActions[startEvent] as Readonly<{ style?: Readonly<Record<string, unknown>> }> | undefined;
    const appearAction = imageActions[appearEvent] as Readonly<{ style?: Readonly<Record<string, unknown>> }> | undefined;
    const mergedImageAppear = startAction !== undefined && appearAction !== undefined;
    if (startAction !== undefined && appearAction !== undefined) {
      genericActions[startEvent] = { ...startAction, ...appearAction, style: { ...startAction.style, ...appearAction.style } };
      delete imageActions[appearEvent];
    }
    delete genericActions[endEvent];
    const adapterActions = Object.fromEntries(Object.entries(imageActions).filter(([name]) => !name.includes(':motion:')));
    const genericInitial = (genericPerso.initial ?? {}) as Readonly<Record<string, unknown>>;
    const adapterInitial = (image.perso.initial ?? {}) as Readonly<Record<string, unknown>>;
    const genericStyle = genericInitial.style as Readonly<Record<string, unknown>> | undefined;
    const adapterStyle = adapterInitial.style as Readonly<Record<string, unknown>>;
    const effects = sourceElement.getAttribute('effect')?.split(',').filter(Boolean) ?? [];
    const entryStyle = Object.fromEntries(Object.entries(adapterStyle).filter(([name]) => (
      ['opacity', 'zIndex', 'boxSizing', 'padding', 'borderRadius', 'backgroundColor', 'boxShadow'].includes(name)
      || (effects.includes('growDown') && ['x', 'y', 'width', 'height'].includes(name))
      || ((effects.includes('fromLeft') || effects.includes('fromRight')) && name === 'x')
      || (effects.includes('grow') && (name === 'scaleX' || name === 'scaleY'))
    )));
    persos.push({
      ...genericPerso,
      initial: {
        ...genericInitial,
        alt: adapterInitial.alt,
        className: adapterInitial.className,
        img: adapterInitial.img,
        move: { target: options.stageId },
        style: { ...genericStyle, ...entryStyle },
      },
      actions: { ...genericActions, ...adapterActions },
    } as ScenePerso);
    eventimes.push(...image.eventimes.filter(({ name }) => !name.includes(':motion:') && !(mergedImageAppear && name === appearEvent)));
    eventimes.splice(0, eventimes.length, ...eventimes.filter(({ name }) => name !== endEvent));
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

/** Reads one finite source number, using the fallback only when it is absent. */
function readSourceNumber(rawValue: string | undefined, fallback?: number): number | undefined {
  if (rawValue === undefined) return fallback;
  if (rawValue.trim() === '') return undefined;
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : undefined;
}

/** Resolves one image-centre coordinate on the fixed source canvas. */
function readSourceCoordinateValue(rawValue: string | undefined, axis: 'x' | 'y'): number {
  if (rawValue === undefined || rawValue === 'center') {
    return axis === 'x' ? LEGACY_SOURCE_CANVAS.width / 2 : LEGACY_SOURCE_CANVAS.height / 2;
  }
  const value = Number(rawValue);
  if (!Number.isFinite(value)) throw new Error(`The source ${axis} coordinate ${rawValue} is invalid.`);
  return value;
}

/** Resolves an absolute container position, including centre and percentage values. */
function readSourcePosition(rawValue: string | undefined, axis: 'x' | 'y', centered: boolean): number | undefined {
  const canvasLength = axis === 'x' ? LEGACY_SOURCE_CANVAS.width : LEGACY_SOURCE_CANVAS.height;
  if (centered || rawValue === 'center') return canvasLength / 2;
  if (rawValue === undefined) return 0;
  if (rawValue.endsWith('%')) {
    const percentage = readSourceNumber(rawValue.slice(0, -1));
    return percentage === undefined ? undefined : canvasLength * percentage / 100;
  }
  return readSourceNumber(rawValue);
}
