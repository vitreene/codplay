import type { SceneDoc } from 'codplay/scene/types'
import { convertLegacyImageElement, formatLegacyResourceId, LEGACY_SOURCE_CANVAS } from './legacy-image-converter'

type SceneStory = SceneDoc['stories'][string]
type ScenePerso = SceneStory['persos'][number]
type SceneEventime = Readonly<{ name: string; startAt: number }>
type ImagePerso = Extract<ScenePerso, { type: 'img' }>
type ImageActions = NonNullable<ImagePerso['actions']>
type ImageSize = Readonly<{ width: number; height: number }>
type LegacyPageOptions = Readonly<{
  assetBasePath: string
  audioBasePath: string
  audioDurationsMs: Readonly<Record<string, number>>
  chapterId: string
  globalPropertiesXml: string
  imageSizes: Readonly<Record<string, ImageSize>>
  textXml: string
}>
type ItemContext = Readonly<{
  delayMs: number
  durationMs: number | null
  parentId: string
}>
type TargetTween = Readonly<{
  durationMs: number
  eventName: string
  startAt: number
  targetAlpha: number
  targetId: string
}>
type ConvertedSequence = Readonly<{
  durationMs: number
  eventimes: readonly SceneEventime[]
  persos: readonly ScenePerso[]
  targetTweens: readonly TargetTween[]
  story: SceneStory
  storyId: string
}>

const PIXELS_PER_CQW = LEGACY_SOURCE_CANVAS.width / 100
const PAGE_ID = 'p02'

/** Reads a finite numeric XML attribute, using its fallback only when absent. */
function readNumber(element: Element, name: string, fallback?: number): number {
  const value = element.getAttribute(name)
  if (value === null && fallback !== undefined) return fallback
  if (value === null || value.trim() === '') throw new Error(`Expected a finite number for ${name}.`)
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`Expected a finite number for ${name}.`)
  return parsed
}

/** Converts a source hexadecimal color to a CSS hexadecimal color. */
function formatLegacyColor(value: string): string {
  return value.replace(/^0x/i, '#')
}

/** Rejects source attributes that are outside the page p02 mapping. */
function requireAttributes(element: Element, allowed: readonly string[]): void {
  if ([...element.attributes].some(({ name }) => !allowed.includes(name))) {
    throw new Error(`The source <${element.tagName}> uses an unsupported attribute.`)
  }
}

/** Parses named global source properties for the item types used by p02. */
function readGlobalProperties(xml: string): ReadonlyMap<string, Element> {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  const root = document.documentElement
  if (document.querySelector('parsererror') || root.tagName !== 'data') {
    throw new Error('Expected one valid global-properties XML document.')
  }
  const globalProperties = Array.from(root.children).find((node) => node.tagName === 'globalProperties')
  if (globalProperties === undefined) throw new Error('The source has no <globalProperties> element.')
  return Array.from(globalProperties.children).reduce((properties, property) => {
    if (property.tagName !== 'properties') throw new Error('Only <properties> entries are supported in globalProperties.')
    const name = property.getAttribute('name')
    if (!name || properties.has(name)) throw new Error('Every source property must have one unique name.')
    properties.set(name, property)
    return properties
  }, new Map<string, Element>())
}

/** Reads translated strings referenced by p02 sub items. */
function readTranslations(xml: string): ReadonlyMap<string, string> {
  const document = new DOMParser().parseFromString(xml, 'application/xml')
  if (document.querySelector('parsererror') || document.documentElement.tagName !== 'lang') {
    throw new Error('Expected one valid source translation XML document.')
  }
  return Array.from(document.documentElement.children).reduce((translations, item) => {
    if (item.tagName !== 'tr') throw new Error('Only <tr> entries are supported in source translations.')
    const key = item.getAttribute('key')
    if (!key || translations.has(key)) throw new Error('Every source translation must have one unique key.')
    translations.set(key, (item.textContent ?? '').replaceAll('&nbsp;', '\u00a0'))
    return translations
  }, new Map<string, string>())
}

/** Resolves and validates a list of source property names. */
function resolveProperties(element: Element, properties: ReadonlyMap<string, Element>): ReadonlyMap<string, string> {
  const names = element.getAttribute('properties')?.split(',').map((name) => name.trim()).filter(Boolean) ?? []
  return names.reduce((values, name) => {
    const property = properties.get(name)
    if (property === undefined) throw new Error(`The source references missing property ${name}.`)
    for (const attribute of Array.from(property.attributes)) {
      if (attribute.name !== 'name') values.set(attribute.name, attribute.value)
    }
    return values
  }, new Map<string, string>())
}

/** Reads a number from an item's own value first, then from its resolved properties. */
function readItemNumber(element: Element, properties: ReadonlyMap<string, string>, name: string, fallback?: number): number {
  const value = element.hasAttribute(name) ? element.getAttribute(name) : properties.get(name)
  if (value === null || value === undefined) {
    if (fallback !== undefined) return fallback
    throw new Error(`Expected a finite source value for ${name}.`)
  }
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`Expected a finite source value for ${name}.`)
  return parsed
}

/** Creates an explicit and deterministic ID for a source item without one. */
function createItemId(storyId: string, tagName: string, itemIndex: number): string {
  return `${storyId}-${tagName}-${itemIndex}`
}

/** Creates one sequence layout and preserves the final stage at scene end. */
function createStage(stageId: string, endAt: number, isFinalSequence: boolean): Readonly<{
  perso: ScenePerso
  eventimes: readonly SceneEventime[]
}> {
  const showEvent = `${stageId}:show`
  const hideEvent = `${stageId}:hide`
  const actions = {
    [showEvent]: { style: { display: 'block' } },
    ...(!isFinalSequence ? { [hideEvent]: { style: { display: 'none' } } } : {}),
  }
  return {
    perso: {
      id: stageId,
      type: 'layout',
      initial: {
        move: '@root',
        markup: `<section id="${stageId}"></section>`,
        className: 'course-access-stage',
        style: { display: 'none' },
      },
      actions,
    },
    eventimes: [
      { name: showEvent, startAt: 0 },
      ...(!isFinalSequence ? [{ name: hideEvent, startAt: endAt + DEFAULT_EFFECT_DURATION_MS }] : []),
    ],
  }
}

/** Creates one source audio perso and schedules its start within the page timeline. */
function createAudioPerso(audioId: string, src: string, stageId: string): Readonly<{
  perso: ScenePerso
  eventime: SceneEventime
}> {
  const startEvent = `${audioId}:start`
  return {
    perso: {
      id: audioId,
      type: 'media',
      initial: {
        tag: 'audio',
        src,
        sync: 'master',
        video: { style: { display: 'none' } },
        move: { target: stageId },
      },
      actions: { [startEvent]: { broadcast: { type: 'START' } } },
    },
    eventime: { name: startEvent, startAt: 0 },
  }
}

/** Creates a hidden source container with its resolved position and style. */
function createContainerPerso(
  element: Element,
  properties: ReadonlyMap<string, string>,
  id: string,
  parentId: string,
  zIndex: number,
): ScenePerso {
  requireAttributes(element, ['id', 'delay', 'duration', 'showAfter', 'backgroundColor', 'properties', 'x', 'y', 'width', 'height', 'cssClass', 'effect'])
  const full = properties.get('cssClass')?.split(/\s+/).includes('full') ?? false
  const x = element.hasAttribute('x') ? element.getAttribute('x') : properties.get('x')
  const y = element.hasAttribute('y') ? element.getAttribute('y') : properties.get('y')
  const width = element.hasAttribute('width') ? readNumber(element, 'width') : properties.has('width') ? readItemNumber(element, properties, 'width') : undefined
  const height = element.hasAttribute('height') ? readNumber(element, 'height') : properties.has('height') ? readItemNumber(element, properties, 'height') : undefined
  const sourceClass = element.getAttribute('cssClass') ?? properties.get('cssClass') ?? ''
  const relative = sourceClass.split(/\s+/).includes('is-relative')
  const backgroundColor = element.getAttribute('backgroundColor') ?? properties.get('backgroundColor')
  const left = x === 'center' ? LEGACY_SOURCE_CANVAS.width / 2 - (width ?? LEGACY_SOURCE_CANVAS.width) / 2 : Number(x ?? 0)
  const top = y === 'center' ? LEGACY_SOURCE_CANVAS.height / 2 - (height ?? LEGACY_SOURCE_CANVAS.height) / 2 : Number(y ?? 0)
  if (!Number.isFinite(left) || !Number.isFinite(top)) throw new Error(`The source container ${id} has an invalid position.`)
  const showEvent = `${id}:show`
  const hideEvent = `${id}:hide`
  const sourceEffect = element.getAttribute('effect') ?? properties.get('effect') ?? ''
  const enterX = sourceEffect.includes('fromRight') ? SOURCE_EXIT_CQW : sourceEffect.includes('fromLeft') ? -SOURCE_EXIT_CQW : 0
  const className = ['course-access-container', sourceClass].filter(Boolean).join(' ')
  const display = sourceClass.split(/\s+/).includes('is-flex-list') ? 'flex' : 'block'
  const initialStyle = {
    position: full || !relative ? 'absolute' : 'relative',
    ...(!full && !relative ? {
      left: `${left / PIXELS_PER_CQW}cqw`,
      top: `${top / PIXELS_PER_CQW}cqw`,
    } : {}),
    width: full ? `${LEGACY_SOURCE_CANVAS.width / PIXELS_PER_CQW}cqw` : width === undefined ? 'auto' : `${width / PIXELS_PER_CQW}cqw`,
    height: full ? `${LEGACY_SOURCE_CANVAS.height / PIXELS_PER_CQW}cqw` : height === undefined ? 'auto' : `${height / PIXELS_PER_CQW}cqw`,
    display: 'none',
    opacity: 0,
    zIndex,
    ...(backgroundColor === undefined ? {} : { backgroundColor: formatLegacyColor(backgroundColor) }),
    ...(enterX === 0 ? {} : { x: enterX }),
  }
  return {
    id,
    type: 'layout',
    initial: {
      move: { target: parentId },
      markup: `<div id="${id}"></div>`,
      className,
      style: initialStyle,
    },
    actions: {
      [showEvent]: {
        style: {
          display,
          opacity: { from: 0, to: 1, duration: DEFAULT_EFFECT_DURATION_MS, ease: 'outSine' },
          ...(enterX === 0 ? {} : { x: { from: enterX, to: 0, duration: DEFAULT_EFFECT_DURATION_MS, ease: 'outSine' } }),
        },
      },
      [hideEvent]: { style: { display: 'none' } },
    },
  }
}

/** Creates one translated text perso mounted in its source container. */
function createTextPerso(
  element: Element,
  properties: ReadonlyMap<string, string>,
  id: string,
  parentId: string,
  translations: ReadonlyMap<string, string>,
  zIndex: number,
): ScenePerso {
  requireAttributes(element, ['id', 'src', 'delay', 'duration', 'showAfter', 'cssClass', 'properties', 'effect', 'textAlign', 'textColor', 'textSize', 'width', 'x', 'y'])
  const source = element.getAttribute('src')
  const content = source === null ? element.textContent ?? '' : translations.get(source)
  if (content === undefined) throw new Error(`The source translation ${source} is missing.`)
  const fontSize = readItemNumber(element, properties, 'textSize', 24) / PIXELS_PER_CQW
  const textColor = element.getAttribute('textColor') ?? properties.get('textColor')
  const className = ['course-access-text', element.getAttribute('cssClass') ?? properties.get('cssClass')].filter(Boolean).join(' ')
  const display = className.split(/\s+/).includes('bullet') ? 'flex' : 'block'
  const showEvent = `${id}:show`
  const hideEvent = `${id}:hide`
  return {
    id,
    type: 'tag',
    initial: {
      tag: 'p',
      content,
      className,
      style: {
        position: 'relative',
        margin: 0,
        fontSize: `${fontSize}cqw`,
        textAlign: element.getAttribute('textAlign') ?? properties.get('textAlign') ?? 'left',
        ...(textColor === undefined ? {} : { color: formatLegacyColor(textColor) }),
        opacity: 0,
        zIndex,
      },
      move: { target: parentId },
    },
    actions: {
      [showEvent]: {
        style: {
          display,
          opacity: { from: 0, to: 1, duration: DEFAULT_EFFECT_DURATION_MS, ease: 'outSine' },
          ...(element.getAttribute('effect') === 'fromRight'
            ? { x: { from: SOURCE_EXIT_CQW, to: 0, duration: DEFAULT_EFFECT_DURATION_MS, ease: 'outSine' } }
            : {}),
        },
      },
      [hideEvent]: { style: { display: 'none' } },
    },
  }
}

const DEFAULT_EFFECT_DURATION_MS = 500
const DEFAULT_EXIT_DELAY_MS = 100
const SOURCE_EXIT_CQW = 200 / PIXELS_PER_CQW

/** Creates a page item ID based on an explicit source ID or its document position. */
function readItemId(element: Element, storyId: string, itemIndex: number, chapterId: string, usedIds: Set<string>): string {
  const id = element.getAttribute('id')
  const source = element.getAttribute('src')
  const sourceId = source === null ? null : `${element.tagName.toLowerCase()}_${chapterId}_${element.tagName === 'img' || element.tagName === 'svg'
    ? formatLegacyResourceId(source)
    : source.replace(/[^A-Za-z0-9_-]/g, '_')}`
  const baseId = id ?? sourceId ?? createItemId(storyId, element.tagName.toLowerCase(), itemIndex)
  if (!/^[A-Za-z_][A-Za-z0-9_.:@-]*$/.test(baseId)) throw new Error(`The source item id ${baseId} cannot be mapped.`)
  if (id !== null && usedIds.has(baseId)) throw new Error(`The source item id ${baseId} is duplicated.`)
  const uniqueId = id !== null || !usedIds.has(baseId)
    ? baseId
    : Array.from({ length: itemIndex }, (_, suffixIndex) => `${baseId}-${suffixIndex + 2}`).find((candidate) => !usedIds.has(candidate)) ?? `${baseId}-${itemIndex}`
  usedIds.add(uniqueId)
  return uniqueId
}

/** Converts one p02 page into one scene containing one ordered story per source sequence. */
export function convertLegacyPage(pageXml: string, options: LegacyPageOptions): SceneDoc {
  const document = new DOMParser().parseFromString(pageXml, 'application/xml')
  const page = document.documentElement
  if (document.querySelector('parsererror') || page.tagName !== 'page' || page.getAttribute('id') !== PAGE_ID) {
    throw new Error('Expected the source <page id="p02"> document.')
  }
  const properties = readGlobalProperties(options.globalPropertiesXml)
  const translations = readTranslations(options.textXml)
  const sequenceElements = Array.from(page.children).filter((element) => element.tagName === 'sequency')
  if (sequenceElements.length !== 4 || page.children.length !== sequenceElements.length + 1 || page.children[0]?.tagName !== 'default') {
    throw new Error('The p02 source must contain one default declaration and four sequences.')
  }

  const convertedSequences = sequenceElements.map((sequence, index) => convertSequence(
    sequence,
    index + 1,
    index === sequenceElements.length - 1,
    options,
    properties,
    translations,
  ))
  let offsetMs = 0
  const stories = Object.fromEntries(convertedSequences.map((sequence) => {
    const story = {
      ...sequence.story,
      eventimes: sequence.eventimes.map((eventime) => ({ ...eventime, startAt: eventime.startAt + offsetMs })),
    }
    offsetMs += sequence.durationMs
    return [sequence.storyId, story]
  }))

  return {
    id: `course-access-${PAGE_ID}`,
    stories,
    eventimes: [{ name: 'sequence:end', startAt: offsetMs }],
  }
}

/** Converts one source sequence into its story and time-relative page items. */
function convertSequence(
  sequence: Element,
  index: number,
  isFinalSequence: boolean,
  options: LegacyPageOptions,
  properties: ReadonlyMap<string, Element>,
  translations: ReadonlyMap<string, string>,
): ConvertedSequence {
  const storyId = `${PAGE_ID}-sequence-${index}`
  const sound = sequence.children[0]
  if (sound?.tagName !== 'sound' || sound.children.length > 0 || sound.textContent === null) {
    throw new Error(`The source ${storyId} must start with one sound filename.`)
  }
  requireAttributes(sound, [])
  const soundFile = sound.textContent.trim()
  const durationMs = options.audioDurationsMs[soundFile]
  if (!soundFile || durationMs === undefined || !Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error(`The source audio duration for ${soundFile} is missing or invalid.`)
  }
  const stageId = `${storyId}-stage`
  const audioId = `${storyId}-audio`
  const stage = createStage(stageId, durationMs, isFinalSequence)
  const audio = createAudioPerso(audioId, `${options.audioBasePath.replace(/\/$/, '')}/${soundFile}`, stageId)
  const persos: ScenePerso[] = [stage.perso, audio.perso]
  const eventimes: SceneEventime[] = [...stage.eventimes, audio.eventime]
  const targetTweens: TargetTween[] = []
  const persoById = new Map<string, ScenePerso>()
  const itemCounter = { value: 0, usedIds: new Set<string>() }

  Array.from(sequence.children).slice(1).forEach((element) => {
    const converted = convertItem(element, {
      delayMs: 0,
      durationMs: null,
      parentId: stageId,
    }, {
      audioDurationMs: durationMs,
      options,
      properties,
      isFinalSequence,
      sequenceId: storyId,
      translations,
      itemCounter,
    })
    converted.persos.forEach((perso) => {
      if (persoById.has(perso.id)) throw new Error(`Duplicate perso id ${perso.id} in ${storyId}.`)
      persoById.set(perso.id, perso)
      persos.push(perso)
    })
    eventimes.push(...converted.eventimes)
    targetTweens.push(...converted.targetTweens)
  })

  targetTweens.forEach((tween) => {
    const target = persoById.get(tween.targetId)
    if (target === undefined) throw new Error(`The source tween target ${tween.targetId} is missing in ${storyId}.`)
    const eventAction = {
      style: {
        opacity: { from: 1, to: tween.targetAlpha, duration: tween.durationMs, ease: 'linear' },
      },
    }
    const targetIndex = persos.findIndex((perso) => perso.id === tween.targetId)
    const actions = { ...(target.actions ?? {}), [tween.eventName]: eventAction }
    persos[targetIndex] = { ...target, actions }
    eventimes.push({ name: tween.eventName, startAt: tween.startAt })
  })

  return {
    durationMs,
    eventimes,
    persos,
    targetTweens,
    storyId,
    story: { id: storyId, persos, eventimes },
  }
}

type ConvertItemContext = Readonly<{
  audioDurationMs: number
  isFinalSequence: boolean
  options: LegacyPageOptions
  properties: ReadonlyMap<string, Element>
  sequenceId: string
  translations: ReadonlyMap<string, string>
  itemCounter: { value: number; usedIds: Set<string> }
}>
type ConvertedItem = Readonly<{
  eventimes: readonly SceneEventime[]
  persos: readonly ScenePerso[]
  targetTweens: readonly TargetTween[]
}>

/** Converts a container, image, SVG or translated sub item and its descendants. */
function convertItem(element: Element, parent: ItemContext, context: ConvertItemContext): ConvertedItem {
  const sourceDelayMs = readNumber(element, 'delay', 0) * 1_000
  const delayMs = parent.delayMs + sourceDelayMs
  const sourceDuration = element.getAttribute('duration')
  const durationMs = sourceDuration === null
    ? parent.durationMs
    : readNumber(element, 'duration') * 1_000
  if (delayMs < 0 || (durationMs !== null && durationMs <= 0)) throw new Error('Source item delay or duration is invalid.')
  const properties = resolveProperties(element, context.properties)
  context.itemCounter.value += 1
  const itemIndex = context.itemCounter.value
  const id = readItemId(element, context.sequenceId, itemIndex, context.options.chapterId, context.itemCounter.usedIds)
  const endAt = durationMs === null ? context.audioDurationMs : delayMs + durationMs
  if (endAt > context.audioDurationMs) throw new Error(`Source item ${id} outlasts its audio sequence.`)
  const item = element.tagName === 'container'
    ? convertContainer(element, properties, id, parent.parentId, itemIndex)
    : element.tagName === 'img'
      ? convertImage(element, properties, id, delayMs, parent.parentId, context, itemIndex)
      : element.tagName === 'svg'
      ? convertSvg(element, id, delayMs, parent.parentId, context, itemIndex)
        : element.tagName === 'sub'
          ? convertText(element, properties, id, parent.parentId, context, itemIndex)
          : undefined
  if (item === undefined) throw new Error(`The source page contains unsupported <${element.tagName}> content.`)

  const ownShowEvent = `${id}:show`
  const ownHideEvent = `${id}:hide`
  const ownEventimes: SceneEventime[] = element.tagName === 'img' || element.tagName === 'svg'
    ? [...item.eventimes]
    : [{ name: ownShowEvent, startAt: delayMs }]
  const itemPersos = [...item.persos]
  const itemIndexInOutput = itemPersos.findIndex((perso) => perso.id === id)
  const shouldHideAtEnd = durationMs !== null || !context.isFinalSequence
  if (itemIndexInOutput >= 0 && shouldHideAtEnd) {
    const perso = itemPersos[itemIndexInOutput]!
    const endActions = { ...(perso.actions ?? {}), [ownHideEvent]: { style: { display: 'none' } } }
    itemPersos[itemIndexInOutput] = { ...perso, actions: endActions }
  }
  const hideAt = durationMs === null
    ? context.audioDurationMs + DEFAULT_EFFECT_DURATION_MS
    : delayMs + durationMs + DEFAULT_EXIT_DELAY_MS + DEFAULT_EFFECT_DURATION_MS
  if (durationMs === null && !context.isFinalSequence) ownEventimes.push({ name: ownHideEvent, startAt: hideAt })
  if (durationMs !== null) ownEventimes.push({ name: ownHideEvent, startAt: hideAt })
  const childContext = { delayMs, durationMs, parentId: id }
  const children = element.tagName !== 'container'
    ? { eventimes: [], persos: [], targetTweens: [] } satisfies ConvertedItem
    : Array.from(element.children).reduce<ConvertedItem>((result, child) => {
      const converted = convertItem(child, childContext, context)
      return {
        eventimes: [...result.eventimes, ...converted.eventimes],
        persos: [...result.persos, ...converted.persos],
        targetTweens: [...result.targetTweens, ...converted.targetTweens],
      }
    }, { eventimes: [], persos: [], targetTweens: [] })

  return {
    eventimes: [...ownEventimes, ...children.eventimes],
    persos: [...itemPersos, ...children.persos],
    targetTweens: [...item.targetTweens, ...children.targetTweens],
  }
}

/** Converts one source container into a CodPlay layout persona. */
function convertContainer(element: Element, properties: ReadonlyMap<string, string>, id: string, parentId: string, zIndex: number): ConvertedItem {
  const perso = createContainerPerso(element, properties, id, parentId, zIndex)
  return { eventimes: [], persos: [perso], targetTweens: [] }
}

/** Converts one source image using the shared image timeline converter. */
function convertImage(
  element: Element,
  properties: ReadonlyMap<string, string>,
  id: string,
  delayMs: number,
  parentId: string,
  context: ConvertItemContext,
  zIndex: number,
): ConvertedItem {
  requireAttributes(element, ['id', 'src', 'x', 'y', 'scale', 'delay', 'duration', 'effect', 'background', 'alpha', 'properties', 'showAfter'])
  const source = element.getAttribute('src')
  if (!source) throw new Error(`Source image ${id} has no src.`)
  const imageSize = context.options.imageSizes[source]
  if (imageSize === undefined) throw new Error(`Intrinsic image size for ${source} is missing.`)
  const synthetic = element.cloneNode(true) as Element
  synthetic.removeAttribute('properties')
  synthetic.removeAttribute('showAfter')
  synthetic.setAttribute('id', id)
  synthetic.setAttribute('delay', String(delayMs / 1_000))
  const full = properties.get('cssClass')?.split(/\s+/).includes('full') ?? false
  if (full) {
    synthetic.setAttribute('x', 'center')
    synthetic.setAttribute('y', 'center')
    synthetic.setAttribute('scale', '1')
  }
  const converted = convertLegacyImageElement(synthetic, {
    assetBasePath: context.options.assetBasePath,
    chapterId: context.options.chapterId,
    imageSize: full ? { width: LEGACY_SOURCE_CANVAS.width, height: LEGACY_SOURCE_CANVAS.height } : imageSize,
    stageId: parentId,
  })
  const persoIndex = converted.perso.id === id ? 0 : -1
  const sourcePerso = persoIndex >= 0 ? converted.perso : undefined
  if (sourcePerso === undefined) throw new Error(`The source image ${id} did not produce its expected persona.`)
  const fullTween = full ? Array.from(context.properties.get('fullOut')?.children ?? []).find((node) => node.tagName === 'tween') : undefined
  const fullScale = fullTween?.getAttribute('scale')
  const fullDurationMs = fullTween?.getAttribute('time') === null || fullTween?.getAttribute('time') === undefined
    ? undefined
    : readNumber(fullTween, 'time') * 1_000
  const appearEvent = `${id}:appear`
  const hideEvent = `${id}:hide`
  const imageStyle = sourcePerso.initial?.style
  const existingActions = sourcePerso.actions ?? {}
  const expandedActions: ImageActions = {
    ...existingActions,
    ...(fullScale === undefined || fullDurationMs === undefined ? {} : {
      [appearEvent]: {
        style: {
          opacity: { from: 0, to: 1, duration: DEFAULT_EFFECT_DURATION_MS, ease: 'outSine' },
          scaleX: { from: 1, to: Number(fullScale), duration: fullDurationMs, ease: 'linear' },
          scaleY: { from: 1, to: Number(fullScale), duration: fullDurationMs, ease: 'linear' },
        },
      },
    }),
    [hideEvent]: { style: { display: 'none' } },
  }
  const fullClass = full ? ' course-access-image--full' : ''
  const updatedPerso = {
    ...sourcePerso,
    initial: {
      ...sourcePerso.initial,
      className: `course-access-image${fullClass}`,
      img: { style: { width: '100%', height: '100%', objectFit: full ? 'cover' : 'contain' } },
      style: {
        ...imageStyle,
        ...(full ? {
          position: 'absolute',
          left: 0,
          top: 0,
          width: `${LEGACY_SOURCE_CANVAS.width / PIXELS_PER_CQW}cqw`,
          height: `${LEGACY_SOURCE_CANVAS.height / PIXELS_PER_CQW}cqw`,
          x: 0,
          y: 0,
        } : {}),
        zIndex,
      },
      move: { target: parentId },
    },
    actions: expandedActions,
  } satisfies ImagePerso
  const sourceTweens = Array.from(element.children).filter((child) => child.tagName === 'tween' && child.hasAttribute('targetItem'))
  const targetTweens = sourceTweens.map((tween, index) => {
    requireAttributes(tween, ['targetItem', 'alpha', 'time', 'delay'])
    const targetId = tween.getAttribute('targetItem')
    const targetAlpha = readNumber(tween, 'alpha')
    const durationMs = readNumber(tween, 'time') * 1_000
    const startAt = delayMs + readNumber(tween, 'delay', 0) * 1_000
    if (!targetId || targetAlpha < 0 || targetAlpha > 1 || durationMs <= 0) throw new Error(`The source tween on ${id} is invalid.`)
    return { targetId, targetAlpha, durationMs, startAt, eventName: `${id}:target:${index + 1}` }
  })
  return {
    persos: [updatedPerso],
    eventimes: converted.eventimes,
    targetTweens,
  }
}

/** Converts one source inline SVG asset to the shared CodPlay image component. */
function convertSvg(element: Element, id: string, delayMs: number, parentId: string, context: ConvertItemContext, zIndex: number): ConvertedItem {
  requireAttributes(element, ['id', 'src', 'delay', 'duration', 'x', 'y', 'width', 'height', 'effect', 'showAfter'])
  const source = element.getAttribute('src')
  const width = readNumber(element, 'width')
  const height = element.hasAttribute('height') ? readNumber(element, 'height') : width
  if (!source || width <= 0 || height <= 0) throw new Error(`Source SVG ${id} has invalid dimensions or src.`)
  const synthetic = document.createElement('img')
  synthetic.setAttribute('id', id)
  synthetic.setAttribute('src', source)
  synthetic.setAttribute('x', element.getAttribute('x') ?? 'center')
  synthetic.setAttribute('y', element.getAttribute('y') ?? 'center')
  synthetic.setAttribute('delay', String(delayMs / 1_000))
  synthetic.setAttribute('scale', '1')
  synthetic.setAttribute('effect', element.getAttribute('effect') ?? '')
  if (element.hasAttribute('duration')) synthetic.setAttribute('duration', element.getAttribute('duration')!)
  const converted = convertLegacyImageElement(synthetic, {
    assetBasePath: context.options.assetBasePath,
    chapterId: context.options.chapterId,
    imageSize: { width, height },
    stageId: parentId,
  })
  return {
    persos: [{
      ...converted.perso,
      type: 'img',
      initial: {
        ...converted.perso.initial,
        className: 'course-access-image course-access-image--svg',
        img: { style: { width: '100%', height: '100%', objectFit: 'contain' } },
        style: { ...converted.perso.initial?.style, zIndex },
        move: { target: parentId },
      },
      actions: { ...(converted.perso.actions ?? {}), [`${id}:hide`]: { style: { display: 'none' } } },
    }],
    eventimes: converted.eventimes,
    targetTweens: [],
  }
}

/** Converts one translated source sub item to a CodPlay tag component. */
function convertText(
  element: Element,
  properties: ReadonlyMap<string, string>,
  id: string,
  parentId: string,
  context: ConvertItemContext,
  zIndex: number,
): ConvertedItem {
  return {
    eventimes: [],
    persos: [createTextPerso(element, properties, id, parentId, context.translations, zIndex)],
    targetTweens: [],
  }
}
