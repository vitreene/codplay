import type { PersoDoc, StoryDoc } from 'codplay'
import type {
  ConversionReport,
  ImportIssue,
  InteractionRecipe,
  PageConversionResult,
  SourceResolution,
  XmlElement,
} from './source-model'
import {
  isJavaScriptArray,
  isJavaScriptObject,
  parseJavaScriptCalls,
  type JavaScriptCall,
  type JavaScriptExpression,
} from './javascript-call-reader'
import { factorRepeatedInteractions, type SourceInteraction } from './interaction-factor'
import { getElementChildren, readTextContent } from './xml-document-reader'
import type { SourceStyleReader } from './source-style-reader'

/** Supplies project-resolved data without embedding project rules in the engine. */
export type PageConversionContext = Readonly<{
  sceneId?: string
  sourceCanvasWidth?: number
  styleReader?: SourceStyleReader
  resolveAttributes?: (element: XmlElement, page: XmlElement) => SourceResolution<Readonly<Record<string, string>>>
  resolveText?: (element: XmlElement, attributes: Readonly<Record<string, string>>) => SourceResolution<string>
  resolveResource?: (sourcePath: string, element: XmlElement) => SourceResolution<string>
  resolveMediaSync?: (element: XmlElement, sourcePath: string) => 'auto' | 'master' | 'independent' | undefined
  resolveMediaStart?: (element: XmlElement, sourcePath: string) => number | undefined
  resolveGeometry?: (element: XmlElement, attributes: Readonly<Record<string, string>>) => Readonly<Record<string, unknown>> | undefined
  resolveCallbackTrigger?: (attributeName: string, element: XmlElement) => ResolvedCallbackTrigger | undefined
  resolveGsapStart?: (input: Readonly<{
    call: JavaScriptCall
    sender: XmlElement
    target: XmlElement
    property: 'opacity'
    trigger: ResolvedCallbackTrigger
  }>) => number | undefined
  resolveTarget?: (reference: string, elements: readonly XmlElement[]) => SourceResolution<string>
  resolveVisibilityCall?: (
    callee: 'showItem' | 'hideItem',
    target: XmlElement,
    arguments_: readonly JavaScriptExpression[],
  ) => Readonly<Record<string, unknown>> | undefined
  resolveTween?: (tween: XmlElement, owner: XmlElement | undefined, ownerTiming: ResolvedItemTiming | undefined) => ResolvedSourceTween | undefined
  easeMappings?: Readonly<Record<string, string>>
}>

/** Describes a visual item's cumulative start and inherited visible duration. */
export type ResolvedItemTiming = Readonly<{
  startAtMs: number
  durationMs?: number
}>

/** States whether one source callback maps to a DOM event or a resolved time. */
export type ResolvedCallbackTrigger = Readonly<
  | { kind: 'emit'; event: string }
  | { kind: 'time'; startAtMs: number }
>

/** Describes a tween after its source-specific timing and channels are resolved. */
export type ResolvedSourceTween = Readonly<{
  targetSourceId: string
  startAtMs: number
  durationMs: number
  ease?: string
  style: Readonly<Record<string, Readonly<{ from: string | number; to: string | number }>>>
}>

type MutablePerso = {
  id: string
  type: string
  initial: Record<string, unknown>
  actions: Record<string, unknown>
  emit: Record<string, unknown>
  sourceId: string
  source: XmlElement
  attributes: Readonly<Record<string, string>>
}

type ConvertedElementProfile = Readonly<{
  initial: Record<string, unknown>
  actions?: Record<string, unknown>
  eventimes?: readonly Readonly<Record<string, unknown>>[]
}>

type StoryBuild = {
  id: string
  source: XmlElement
  persos: MutablePerso[]
  bySourceId: Map<string, MutablePerso[]>
  elements: XmlElement[]
  itemTimings: Map<XmlElement, ResolvedItemTiming>
  eventimes: Readonly<Record<string, unknown>>[]
  interactions: SourceInteraction[]
}

type PageBuild = {
  sceneId: string
  pageId: string
  issues: ImportIssue[]
  stories: Record<string, StoryDoc<string>>
  recipes: InteractionRecipe[]
  convertedPersos: number
  convertedCallbacks: number
  convertedTweens: number
}

const SUPPORTED_ELEMENT_TYPES: Readonly<Record<string, string>> = {
  container: 'layout',
  img: 'img',
  sound: 'media',
  sub: 'tag',
  video: 'media',
}

const TIMING_ATTRIBUTES = new Set([
  'delay', 'duration', 'effect', 'effectEase', 'effectTime', 'effectTimeOut', 'repeat', 'repeatDelay', 'showAfter', 'time', 'yoyo',
])
const VISUAL_ELEMENT_TYPES = new Set(['container', 'img', 'sub'])

const COMMON_ATTRIBUTES = new Set([
  'alpha', 'alt', 'backgroundColor', 'centered', 'centeredY', 'class', 'color', 'cssClass', 'cssStyle', 'fontFamily',
  'fontSize', 'fontWeight', 'height', 'id', 'left', 'lineHeight', 'opacity', 'properties', 'right', 'src',
  'rotation', 'rotate', 'scale', 'tag', 'textAlign', 'textColor', 'textSize', 'textWeight', 'top', 'bottom', 'width', 'x', 'y',
])

/** Converts one XML page to a partial SceneDoc and a provenance-rich report. */
export class PageConverter {
  /** Converts supported page sections independently so one gap does not stop the rest. */
  convertPage(page: XmlElement, context: PageConversionContext = {}): PageConversionResult {
    const pageId = page.attributes.id ?? ''
    const sceneId = context.sceneId ?? pageId
    const build: PageBuild = {
      sceneId,
      pageId,
      issues: [],
      stories: {},
      recipes: [],
      convertedPersos: 0,
      convertedCallbacks: 0,
      convertedTweens: 0,
    }
    if (page.name !== 'page') {
      addIssue(build, page, 'source-node-not-page', 'blocker', `Expected a <page> element, received <${page.name}>.`)
      return { report: this.createReport(page, build) }
    }
    if (sceneId === '') {
      addIssue(build, page, 'scene-id-missing', 'blocker', 'The source page has no ID and no scene ID was supplied.')
      return { report: this.createReport(page, build) }
    }

    const sections = getElementChildren(page).filter(({ name }) => name === 'sequency')
    if (sections.length === 0) {
      addIssue(build, page, 'page-sections-missing', 'blocker', 'The page contains no direct <sequency> sections.')
      return { scene: { id: sceneId, stories: {} }, report: this.createReport(page, build) }
    }

    sections.forEach((section, index) => this.convertStory(section, index, page, context, build))
    addIssue(build, page, 'story-sequencing-not-authored', 'blocker', 'The source section order is preserved as StoryDocs, but this partial SceneDoc does not schedule the next story when one section completes.', undefined, 'Resolve the media end and story activation contract before marking the page ready for playback.')
    return {
      scene: { id: sceneId, stories: build.stories },
      report: this.createReport(page, build),
    }
  }

  /** Builds one ordered StoryDoc from the direct elements of one <sequency>. */
  private convertStory(
    section: XmlElement,
    sectionIndex: number,
    page: XmlElement,
    context: PageConversionContext,
    build: PageBuild,
  ): void {
    const sourceStoryId = section.attributes.id ?? `section-${sectionIndex + 1}`
    const baseStoryId = `story-${sourceStoryId}`
    const storyId = Object.hasOwn(build.stories, baseStoryId) ? `${baseStoryId}-${sectionIndex + 1}` : baseStoryId
    const story: StoryBuild = {
      id: storyId,
      source: section,
      persos: [],
      bySourceId: new Map(),
      elements: [section],
      itemTimings: new Map(),
      eventimes: [],
      interactions: [],
    }
    const ancestors = [page, section]
    getElementChildren(section).forEach((element) => {
      if (element.name !== 'tween') this.convertElement(element, story, ancestors, context, build)
    })
    this.convertStoryTweens(story, context, build)
    this.convertStoryCallbacks(story, context, build)
    build.recipes.push(...factorRepeatedInteractions(story.interactions))
    build.convertedPersos += story.persos.length
    build.stories[storyId] = {
      id: storyId,
      persos: story.persos.map(({ id, type, initial, actions, emit }) => ({
        id,
        type,
        initial,
        actions,
        ...(Object.keys(emit).length === 0 ? {} : { emit }),
      } as PersoDoc<string>)),
      eventimes: story.eventimes,
    }
  }

  /** Converts one supported item and recursively preserves container ownership. */
  private convertElement(
    element: XmlElement,
    story: StoryBuild,
    ancestors: readonly XmlElement[],
    context: PageConversionContext,
    build: PageBuild,
    parentId = '@root',
    parentTiming: ResolvedItemTiming = { startAtMs: 0 },
  ): MutablePerso | undefined {
    const type = SUPPORTED_ELEMENT_TYPES[element.name]
    if (type === undefined) {
      addIssue(build, element, 'source-element-unrecognized', 'blocker', `No generic rule is registered for <${element.name}>.`, readTextContent(element))
      return undefined
    }
    const attributes = this.resolveElementAttributes(element, pageFromAncestors(ancestors), context, build)
    if (attributes === undefined) return undefined

    const sourceId = attributes.id ?? `generated-${element.name}-${element.location.line}-${element.location.column}`
    const baseId = `${story.id}/${sourceId}`
    const usedIds = new Set(story.persos.map(({ id }) => id))
    const id = createUniqueId(baseId, usedIds)
    if (id !== baseId) {
      addIssue(build, element, 'source-perso-id-duplicate', 'blocker', `The source ID ${sourceId} is duplicated or collides with another generated identity; target references to it remain ambiguous.`, sourceId)
    }
    const style = this.resolveElementStyle(element, ancestors, attributes, context, build)
    const className = attributes.cssClass ?? attributes.class
    const initial = {
      move: parentId === '@root' ? '@root' : { target: parentId },
      ...(className === undefined ? {} : { className }),
      ...(Object.keys(style).length === 0 ? {} : { style }),
    }
    const timing = this.resolveItemTiming(element, attributes, parentTiming, build)
    if (attributes.id === undefined) addIssue(build, element, 'source-id-generated', 'warning', `A stable target ID was generated as ${sourceId}.`)
    const profile = this.convertElementProfile(element, id, story.id, initial, attributes, context, build)
    if (profile === undefined) return undefined
    const timedProfile = this.applyItemTiming(profile, timing, id)
    const perso: MutablePerso = { id, type, initial: timedProfile.initial, actions: timedProfile.actions ?? {}, emit: {}, sourceId, source: element, attributes }
    story.itemTimings.set(element, timing)
    story.eventimes.push(...(timedProfile.eventimes ?? []))
    const candidates = story.bySourceId.get(sourceId) ?? []
    candidates.push(perso)
    story.bySourceId.set(sourceId, candidates)
    story.persos.push(perso)
    story.elements.push(element)
    this.inspectAttributes(element, attributes, timing, context, build)

    if (element.name === 'container') {
      getElementChildren(element).forEach((child) => {
        if (child.name !== 'tween') this.convertElement(child, story, [...ancestors, element], context, build, id, timing)
      })
    } else if (getElementChildren(element).some(({ name }) => name !== 'tween')) {
      addIssue(build, element, 'source-nested-content-unresolved', 'blocker', `Nested XML elements inside <${element.name}> are not flattened into a guessed target structure.`)
    }
    return perso
  }

  /** Adds the element's delay and inherited duration using its visual ancestors. */
  private resolveItemTiming(
    element: XmlElement,
    attributes: Readonly<Record<string, string>>,
    parentTiming: ResolvedItemTiming,
    build: PageBuild,
  ): ResolvedItemTiming {
    if (!VISUAL_ELEMENT_TYPES.has(element.name)) return parentTiming
    const delaySeconds = readTimingNumber(attributes.delay, 'delay', element, build, 0)
    const ownDurationSeconds = attributes.duration === undefined
      ? undefined
      : readTimingNumber(attributes.duration, 'duration', element, build, 0)
    const startAtMs = parentTiming.startAtMs + delaySeconds * 1_000
    const durationSeconds = ownDurationSeconds === undefined || ownDurationSeconds === 0
      ? parentTiming.durationMs === undefined ? undefined : parentTiming.durationMs / 1_000
      : ownDurationSeconds
    return {
      startAtMs,
      ...(durationSeconds === undefined || durationSeconds === 0 ? {} : { durationMs: durationSeconds * 1_000 }),
    }
  }

  /** Adds default visibility boundaries while leaving source effects to the adapter. */
  private applyItemTiming(
    profile: ConvertedElementProfile,
    timing: ResolvedItemTiming,
    id: string,
  ): ConvertedElementProfile {
    const actions = { ...(profile.actions ?? {}) }
    const eventimes = [...(profile.eventimes ?? [])]
    const style = { ...(profile.initial.style as Readonly<Record<string, unknown>> | undefined) }
    if (timing.startAtMs > 0) {
      const startEvent = `${id}:source-timing:start`
      const display = style.display ?? 'block'
      style.display = 'none'
      actions[startEvent] = { style: { display } }
      eventimes.push({ name: startEvent, startAt: timing.startAtMs })
    }
    if (timing.durationMs !== undefined) {
      const endEvent = `${id}:source-timing:end`
      actions[endEvent] = { style: { display: 'none' } }
      eventimes.push({ name: endEvent, startAt: timing.startAtMs + timing.durationMs })
    }
    return {
      ...profile,
      initial: { ...profile.initial, ...(Object.keys(style).length === 0 ? {} : { style }) },
      actions,
      eventimes,
    }
  }

  /** Selects the dedicated conversion rule for one stable source element type. */
  private convertElementProfile(
    element: XmlElement,
    id: string,
    storyId: string,
    initial: Record<string, unknown>,
    attributes: Readonly<Record<string, string>>,
    context: PageConversionContext,
    build: PageBuild,
  ): ConvertedElementProfile | undefined {
    if (element.name === 'img') return this.convertImage(element, initial, attributes, context, build)
    if (element.name === 'sub') return this.convertText(element, initial, attributes, context, build)
    if (element.name === 'container') return this.convertContainer(id, initial)
    if (element.name === 'sound' || element.name === 'video') return this.convertMedia(element, id, storyId, initial, attributes, context, build)
    return undefined
  }

  /** Resolves one image source and preserves its available semantic metadata. */
  private convertImage(
    element: XmlElement,
    initial: Record<string, unknown>,
    attributes: Readonly<Record<string, string>>,
    context: PageConversionContext,
    build: PageBuild,
  ): ConvertedElementProfile | undefined {
    const src = this.resolveResource(attributes.src, element, context, build)
    if (src === undefined) return undefined
    initial.src = src
    if (attributes.alt !== undefined) initial.alt = attributes.alt
    return { initial }
  }

  /** Resolves literal or translated text into the shared V2 tag profile. */
  private convertText(
    element: XmlElement,
    initial: Record<string, unknown>,
    attributes: Readonly<Record<string, string>>,
    context: PageConversionContext,
    build: PageBuild,
  ): ConvertedElementProfile | undefined {
    const content = this.resolveElementText(element, attributes, context, build)
    if (content === undefined) return undefined
    initial.tag = attributes.tag ?? 'div'
    initial.content = content
    return { initial }
  }

  /** Creates an explicitly identified layout root for source container children. */
  private convertContainer(id: string, initial: Record<string, unknown>): ConvertedElementProfile {
    initial.markup = `<div id="${escapeAttribute(id)}"></div>`
    return { initial }
  }

  /** Resolves one audio or video source and schedules its established start. */
  private convertMedia(
    element: XmlElement,
    id: string,
    storyId: string,
    initial: Record<string, unknown>,
    attributes: Readonly<Record<string, string>>,
    context: PageConversionContext,
    build: PageBuild,
  ): ConvertedElementProfile | undefined {
    const sourcePath = attributes.src ?? readTextContent(element).trim()
    const src = this.resolveResource(sourcePath, element, context, build)
    if (src === undefined) return undefined
    const sync = context.resolveMediaSync?.(element, sourcePath)
    const startAtMs = context.resolveMediaStart?.(element, sourcePath)
    initial.tag = element.name === 'sound' ? 'audio' : 'video'
    initial.src = src
    initial.sync = sync ?? 'auto'
    if (sync === undefined) {
      addIssue(build, element, 'media-clock-role-unresolved', 'warning', 'The media is mapped to CodPlay media with sync auto; its source role does not establish whether it should drive the story.', sourcePath, 'Resolve the source playback role before selecting master or another sync mode.')
    }
    if (startAtMs === undefined) {
      addIssue(build, element, 'media-start-unresolved', 'blocker', 'The source autoplay or start condition is not resolved.', sourcePath, 'Supply the source start trigger and its story-relative time before treating the media as converted.')
      return { initial }
    }
    if (!Number.isFinite(startAtMs) || startAtMs < 0) {
      addIssue(build, element, 'media-start-time-invalid', 'blocker', 'The resolved media start time must be finite and non-negative.', String(startAtMs))
      return { initial }
    }
    const startEvent = `${build.sceneId}:${storyId}:${id}:media-start`
    return {
      initial,
      actions: { [startEvent]: { broadcast: { type: 'START' } } },
      eventimes: [{ name: startEvent, startAt: startAtMs }],
    }
  }

  /** Resolves effective source attributes before applying shared rules. */
  private resolveElementAttributes(
    element: XmlElement,
    page: XmlElement,
    context: PageConversionContext,
    build: PageBuild,
  ): Readonly<Record<string, string>> | undefined {
    const resolved = context.resolveAttributes?.(element, page)
    if (resolved?.status === 'resolved' && resolved.value !== undefined) return resolved.value
    const needsResolver = element.attributes.properties !== undefined || element.attributes.override !== undefined
    if (!needsResolver && (resolved === undefined || resolved.status === 'missing')) return element.attributes
    const status = resolved?.status ?? 'missing'
    const message = status === 'ambiguous'
      ? 'The source property references have multiple candidates; the engine will not choose a merge order.'
      : element.attributes.override !== undefined
        ? 'The source override behavior needs a project resolver before this element can be converted.'
        : 'The source property references need a project resolver before this element can be converted.'
    addIssue(build, element, status === 'ambiguous' ? 'source-properties-ambiguous' : 'source-properties-unresolved', 'blocker', message, element.attributes.properties ?? element.attributes.override, 'Resolve property precedence in the source adapter and return the final effective attributes.')
    return undefined
  }

  /** Combines source class rules, inline CSS, explicit text properties, and resolved geometry. */
  private resolveElementStyle(
    element: XmlElement,
    ancestors: readonly XmlElement[],
    attributes: Readonly<Record<string, string>>,
    context: PageConversionContext,
    build: PageBuild,
  ): Record<string, unknown> {
    const sourceStyle = context.styleReader?.resolve(element, ancestors, {
      sourceCanvasWidth: context.sourceCanvasWidth,
      elementAttributes: attributes,
    })
    sourceStyle?.issues.forEach((issue) => addIssueAt(build, issue.location, issue.code, 'blocker', issue.message, issue.source))
    const style: Record<string, unknown> = { ...(sourceStyle?.style ?? {}) }
    const importantProperties = new Set(sourceStyle?.importantProperties ?? [])
    if (attributes.cssStyle !== undefined) {
      Object.entries(parseInlineStyle(attributes.cssStyle, context.sourceCanvasWidth, element, build, style, importantProperties))
        .forEach(([property, value]) => { style[property] = value })
    }
    applyExplicitStyle(attributes, style, importantProperties, element, context, build)

    const geometryAttributes = ['x', 'y', 'left', 'top', 'right', 'bottom', 'centered', 'centeredY']
    const hasImageScale = element.name === 'img' && attributes.scale !== undefined
    if (geometryAttributes.some((name) => attributes[name] !== undefined) || hasImageScale) {
      const geometry = context.resolveGeometry?.(element, attributes)
      if (geometry === undefined) {
        const present = [...geometryAttributes.filter((name) => attributes[name] !== undefined), ...(hasImageScale ? ['scale'] : [])]
        addIssue(build, element, 'source-geometry-unresolved', 'blocker', `Source placement uses ${present.join(', ')}; its anchor and coordinate basis are not declared.`, JSON.stringify(Object.fromEntries(present.map((name) => [name, attributes[name]])), null, 2), 'Supply a source geometry resolver for the project canvas and anchor semantics.')
      } else {
        Object.entries(geometry)
          .filter(([property]) => !importantProperties.has(property))
          .forEach(([property, value]) => { style[property] = value })
      }
    }

    const cssClass = attributes.cssClass ?? attributes.class
    if (cssClass !== undefined && context.styleReader === undefined) {
      addIssue(build, element, 'source-class-rules-unresolved', 'warning', 'The source class name is retained, but no stylesheet resolver was supplied.', cssClass, 'Provide the project stylesheets to reconstruct the class declarations.')
    }
    if (cssClass !== undefined && sourceStyle !== undefined && sourceStyle.sources.length === 0) {
      addIssue(build, element, 'source-class-rules-unmatched', 'warning', 'No supplied stylesheet rule matched the source element classes.', cssClass, 'Check stylesheet imports, selectors, and the resolved class list.')
    }
    return style
  }

  /** Reads text from markup or delegates a keyed text source to the project reader. */
  private resolveElementText(
    element: XmlElement,
    attributes: Readonly<Record<string, string>>,
    context: PageConversionContext,
    build: PageBuild,
  ): string | undefined {
    if (getElementChildren(element).some(({ name }) => name !== 'tween')) {
      addIssue(build, element, 'source-text-markup-unresolved', 'blocker', 'Nested text markup is not flattened because its presentation semantics are unknown.', readTextContent(element))
      return undefined
    }
    const directText = readTextContent(element)
    if (directText.trim() !== '') return directText.trim()
    if (attributes.src === undefined) {
      addIssue(build, element, 'source-text-missing', 'blocker', 'The text element has neither literal text nor a text reference.')
      return undefined
    }
    const resolution = context.resolveText?.(element, attributes)
    if (resolution?.status === 'resolved' && resolution.value !== undefined) return resolution.value
    addIssue(build, element, 'source-text-unresolved', 'blocker', 'The source text reference could not be resolved uniquely.', attributes.src, 'Resolve the language key and return exactly one translated value.')
    return undefined
  }

  /** Resolves one source media path while preserving the declared reference when no copy map exists. */
  private resolveResource(
    sourcePath: string | undefined,
    element: XmlElement,
    context: PageConversionContext,
    build: PageBuild,
  ): string | undefined {
    if (sourcePath === undefined || sourcePath.trim() === '') {
      addIssue(build, element, 'media-source-missing', 'blocker', 'The media element has no source path.')
      return undefined
    }
    const resolution = context.resolveResource?.(sourcePath, element)
    if (resolution === undefined) {
      addIssue(build, element, 'media-resource-not-copied', 'warning', 'The source media path is retained; no project resource map was supplied.', sourcePath, 'Resolve and copy the resource when preparing an importable module.')
      return sourcePath
    }
    if (resolution.status === 'resolved' && resolution.value !== undefined) return resolution.value
    addIssue(build, element, 'media-resource-unresolved', 'blocker', 'The source media path does not resolve to one output resource.', sourcePath)
    return undefined
  }

  /** Converts simple declarative tweens after a source adapter resolves their semantics. */
  private convertStoryTweens(story: StoryBuild, context: PageConversionContext, build: PageBuild): void {
    const tweens = story.elements.flatMap((element) => getElementChildren(element).filter(({ name }) => name === 'tween').map((tween) => ({ tween, owner: element })))
    tweens.forEach(({ tween, owner }, index) => this.convertTween(tween, owner, index, story, context, build))
  }

  /** Converts one resolved source tween to an absolute CodPlay event and action. */
  private convertTween(
    tween: XmlElement,
    owner: XmlElement,
    tweenIndex: number,
    story: StoryBuild,
    context: PageConversionContext,
    build: PageBuild,
  ): void {
    const resolved = context.resolveTween?.(tween, owner, owner === undefined ? undefined : story.itemTimings.get(owner))
    if (resolved === undefined) {
      addIssue(build, tween, 'source-tween-unresolved', 'blocker', 'The tween target, time base, start values, or source channels are not fully resolved.', readTextContent(tween) || JSON.stringify(tween.attributes), 'Return a resolved tween only after the source adapter establishes its target, absolute start, duration, channel values, and easing.')
      return
    }
    const targetResolution = this.resolveTarget(resolved.targetSourceId, story, context, false)
    if (targetResolution.status !== 'resolved' || targetResolution.value === undefined) {
      addIssue(build, tween, 'source-tween-target-unresolved', 'blocker', 'The resolved tween target does not identify exactly one converted perso.', resolved.targetSourceId)
      return
    }
    if (!isValidResolvedTween(resolved)) {
      addIssue(build, tween, 'source-tween-values-invalid', 'blocker', 'The resolved tween must provide finite non-negative timing and explicit from/to values for at least one channel.')
      return
    }
    const eventName = `${build.sceneId}:${story.id}:tween:${tween.location.line}:${tweenIndex + 1}`
    targetResolution.value.actions[eventName] = {
      style: Object.fromEntries(Object.entries(resolved.style).map(([property, values]) => [
        property,
        resolved.durationMs === 0
          ? values.to
          : { ...values, duration: resolved.durationMs, ...(resolved.ease === undefined ? {} : { ease: resolved.ease }) },
      ])),
    }
    story.eventimes.push({ name: eventName, startAt: resolved.startAtMs })
    build.convertedTweens += 1
  }

  /** Parses and converts callback routines only when every call is understood. */
  private convertStoryCallbacks(story: StoryBuild, context: PageConversionContext, build: PageBuild): void {
    story.persos.forEach((sender) => {
      Object.entries(sender.attributes).filter(([name, source]) => /^on[A-Z]/.test(name) && source.trim() !== '').forEach(([attributeName, source]) => {
        const parsed = parseJavaScriptCalls(source)
        if (parsed.error !== undefined) {
          addIssue(build, sender.source, 'source-callback-unparsed', 'blocker', `The callback syntax is outside the literal call grammar: ${parsed.error}`, source, 'Keep the complete callback as a recipe for the project agent.')
          return
        }
        story.interactions.push({ location: sender.source.location, trigger: attributeName, source, calls: parsed.calls })
        const trigger = attributeName === 'onClick'
          ? { kind: 'emit' as const, event: 'click' }
          : context.resolveCallbackTrigger?.(attributeName, sender.source)
        if (trigger === undefined) {
          addIssue(build, sender.source, 'source-callback-trigger-unresolved', 'blocker', `The source callback phase ${attributeName} has no resolved CodPlay input trigger.`, source, 'Resolve the lifecycle phase in the source adapter or document the routine for manual reconstruction.')
          return
        }
        if (trigger.kind === 'time' && (!Number.isFinite(trigger.startAtMs) || trigger.startAtMs < 0)) {
          addIssue(build, sender.source, 'source-callback-time-invalid', 'blocker', `The resolved time for ${attributeName} must be finite and non-negative.`, String(trigger.startAtMs))
          return
        }
        if (trigger.kind === 'emit' && trigger.event.trim() === '') {
          addIssue(build, sender.source, 'source-callback-event-empty', 'blocker', `The resolved input event for ${attributeName} is empty.`, source)
          return
        }
        const triggerName = trigger.kind === 'emit' ? trigger.event : `at-${trigger.startAtMs}`
        const eventName = `${build.sceneId}:${story.id}:${sender.id}:${attributeName}:${triggerName}`
        const effects = parsed.calls.map((call) => this.convertCallbackCall(call, sender, story, context, build, source, trigger))
        if (effects.some((effect) => effect === undefined)) return
        const patches = new Map<MutablePerso, Record<string, unknown>>()
        let conflict = false
        effects.flatMap((effect) => effect ?? []).forEach(({ target, style }) => {
          const patch = patches.get(target) ?? {}
          if (Object.keys(style).some((property) => property in patch)) {
            conflict = true
            return
          }
          Object.assign(patch, style)
          patches.set(target, patch)
        })
        if (conflict || patches.size === 0) {
          addIssue(build, sender.source, conflict ? 'source-callback-property-conflict' : 'source-callback-no-actions', 'blocker', conflict
            ? 'The callback writes the same target style property more than once; its call order needs a source-specific rule.'
            : 'The callback produced no supported CodPlay action.', source)
          return
        }

        patches.forEach((style, target) => { target.actions[eventName] = { style } })
        if (trigger.kind === 'emit') {
          const emitRule = { event: { name: eventName, visibility: 'story' } }
          const previous = sender.emit[trigger.event]
          sender.emit[trigger.event] = previous === undefined
            ? emitRule
            : Array.isArray(previous) ? [...previous, emitRule] : [previous, emitRule]
        } else {
          story.eventimes.push({ name: eventName, startAt: trigger.startAtMs })
        }
        build.convertedCallbacks += 1
      })
    })
  }

  /** Maps one known visibility or GSAP call to target style patches. */
  private convertCallbackCall(
    call: JavaScriptCall,
    sender: MutablePerso,
    story: StoryBuild,
    context: PageConversionContext,
    build: PageBuild,
    source: string,
    trigger: ResolvedCallbackTrigger,
  ): readonly Readonly<{ target: MutablePerso; style: Readonly<Record<string, unknown>> }>[] | undefined {
    if (call.callee === 'showItem' || call.callee === 'hideItem') return this.convertVisibilityCall(call.callee, call, sender, story, context, build, source)
    if (call.callee === 'gsap.to') return this.convertGsapCall(call, sender, story, context, build, source, trigger)
    addIssue(build, sender.source, 'source-routine-untranslated', 'blocker', `The callback contains the project function ${call.callee}; its semantics remain a recipe.`, source, 'Document the complete routine and its dependencies before proposing a CodPlay reconstruction.')
    return undefined
  }

  /** Converts one visibility call only after its target and effect are resolved. */
  private convertVisibilityCall(
    callee: 'showItem' | 'hideItem',
    call: JavaScriptCall,
    sender: MutablePerso,
    story: StoryBuild,
    context: PageConversionContext,
    build: PageBuild,
    source: string,
  ): readonly Readonly<{ target: MutablePerso; style: Readonly<Record<string, unknown>> }>[] | undefined {
    const reference = call.arguments[0]
    if (call.arguments.length !== 1 || typeof reference !== 'string') {
      addIssue(build, sender.source, 'visibility-call-arguments-unresolved', 'blocker', `${callee} requires one literal target reference.`, source)
      return undefined
    }
    const target = this.resolveTarget(reference, story, context, false)
    if (target.status !== 'resolved' || target.value === undefined) {
      addIssue(build, sender.source, 'visibility-call-target-unresolved', 'blocker', `${callee} does not resolve to one perso in this story.`, reference)
      return undefined
    }
    const style = context.resolveVisibilityCall?.(callee, target.value.source, call.arguments)
    if (style === undefined || Object.keys(style).length === 0) {
      addIssue(build, sender.source, 'visibility-call-semantics-unresolved', 'blocker', `The source method ${callee} has a known target but its display semantics are not supplied.`, source, 'Resolve the source visibility effect to CodPlay style values in the project adapter.')
      return undefined
    }
    return [{ target: target.value, style }]
  }

  /** Converts a literal opacity-only gsap.to call with a resolved start and easing. */
  private convertGsapCall(
    call: JavaScriptCall,
    sender: MutablePerso,
    story: StoryBuild,
    context: PageConversionContext,
    build: PageBuild,
    source: string,
    trigger: ResolvedCallbackTrigger,
  ): readonly Readonly<{ target: MutablePerso; style: Readonly<Record<string, unknown>> }>[] | undefined {
    const [targetExpression, varsExpression] = call.arguments
    if (call.arguments.length !== 2 || varsExpression === undefined || !isJavaScriptObject(varsExpression)) {
      addIssue(build, sender.source, 'gsap-call-shape-unresolved', 'blocker', 'Only gsap.to(target, literalVars) is considered by this rule.', source)
      return undefined
    }
    const references = readTargetReferences(targetExpression)
    if (references === undefined || references.length === 0) {
      addIssue(build, sender.source, 'gsap-target-unresolved', 'blocker', 'The GSAP target must be one literal ID selector or an array of literal ID selectors.', source)
      return undefined
    }
    const fields = varsExpression.fields
    if (fields.opacity !== undefined && fields.alpha !== undefined) {
      addIssue(build, sender.source, 'gsap-opacity-duplicate', 'blocker', 'The GSAP call declares both opacity and alpha; the source adapter must establish their precedence.', source)
      return undefined
    }
    const unsupported = Object.keys(fields).filter((key) => !['alpha', 'duration', 'ease', 'opacity'].includes(key))
    if (unsupported.length > 0) {
      addIssue(build, sender.source, 'gsap-properties-unresolved', 'blocker', `The GSAP properties ${unsupported.join(', ')} need channel-specific rules.`, source)
      return undefined
    }
    const to = fields.opacity ?? fields.alpha
    const durationSeconds = fields.duration
    const sourceEase = fields.ease
    if (typeof to !== 'number'
      || typeof durationSeconds !== 'number'
      || durationSeconds < 0
      || (durationSeconds > 0 && typeof sourceEase !== 'string')
      || !Number.isFinite(durationSeconds * 1_000)) {
      addIssue(build, sender.source, 'gsap-values-unresolved', 'blocker', 'GSAP opacity conversion requires a literal numeric destination and finite non-negative duration; an easing is required for a non-zero duration.', source)
      return undefined
    }
    const ease = typeof sourceEase === 'string' ? context.easeMappings?.[sourceEase] : undefined
    if (durationSeconds > 0 && ease === undefined) {
      addIssue(build, sender.source, 'gsap-easing-unresolved', 'blocker', `The source easing ${sourceEase} has no verified CodPlay mapping.`, source)
      return undefined
    }
    const targets = references.map((reference) => this.resolveTarget(reference, story, context, true))
    if (targets.some(({ status }) => status !== 'resolved')) {
      addIssue(build, sender.source, 'gsap-target-ambiguous', 'blocker', 'At least one GSAP target is missing or ambiguous within the source story.', source)
      return undefined
    }
    const converted = targets.map(({ value }) => {
      if (value === undefined) return undefined
      const startOpacity = durationSeconds === 0 ? undefined : context.resolveGsapStart?.({
        call,
        sender: sender.source,
        target: value.source,
        property: 'opacity',
        trigger,
      })
      if (durationSeconds > 0 && (startOpacity === undefined || !Number.isFinite(startOpacity))) {
        addIssue(build, sender.source, 'gsap-start-value-unresolved', 'blocker', `The opacity at the resolved callback trigger for ${value.sourceId} is not established by the source project.`, source, 'Resolve the value GSAP would read when this callback runs; an initial style alone may not represent the current value.')
        return undefined
      }
      const transition = durationSeconds === 0
        ? to
        : { from: startOpacity!, to, duration: durationSeconds * 1_000, ease: ease! }
      return { target: value, style: { opacity: transition } }
    })
    if (converted.some((effect) => effect === undefined)) return undefined
    return converted.filter((effect): effect is NonNullable<typeof effect> => effect !== undefined)
  }

  /** Resolves one literal source target without treating a selector as CodPlay syntax. */
  private resolveTarget(
    reference: string,
    story: StoryBuild,
    context: PageConversionContext,
    selector: boolean,
  ): SourceResolution<MutablePerso> {
    const sourceReference = selector
      ? /^#([\w-]+)$/.exec(reference)?.[1]
      : reference
    if (sourceReference === undefined) return { status: 'missing', candidates: [] }
    const sourceResolution = context.resolveTarget?.(reference, story.elements)
      ?? { status: 'resolved' as const, value: sourceReference, candidates: [sourceReference] }
    if (sourceResolution.status !== 'resolved' || sourceResolution.value === undefined) {
      return { status: sourceResolution.status, candidates: [] }
    }
    const candidates = story.bySourceId.get(sourceResolution.value) ?? []
    if (candidates.length === 0) return { status: 'missing', candidates: [] }
    if (candidates.length > 1) return { status: 'ambiguous', candidates }
    return { status: 'resolved', value: candidates[0], candidates }
  }

  /** Adds a report item for every source attribute not consumed by a rule. */
  private inspectAttributes(
    element: XmlElement,
    attributes: Readonly<Record<string, string>>,
    timing: ResolvedItemTiming,
    _context: PageConversionContext,
    build: PageBuild,
  ): void {
    Object.keys(attributes).forEach((name) => {
      if (COMMON_ATTRIBUTES.has(name) || TIMING_ATTRIBUTES.has(name) || /^on[A-Z]/.test(name)) return
      addIssue(build, element, 'source-attribute-untranslated', 'warning', `The source attribute ${name} is preserved in provenance but has no generic mapping.`, `${name}="${attributes[name]}"`)
    })
    Object.keys(attributes).filter((name) => TIMING_ATTRIBUTES.has(name)
      && (!(name === 'delay' || name === 'duration') || !VISUAL_ELEMENT_TYPES.has(element.name))).forEach((name) => {
      addIssue(build, element, 'source-timing-unresolved', 'blocker', `The source timing field ${name} needs its source time base and lifecycle semantics.`, `${name}="${attributes[name]}"`)
    })
    if (timing.durationMs === undefined && element.name !== 'sound' && element.name !== 'video') {
      addIssue(build, element, 'source-no-duration-end-hide-unresolved', 'blocker', 'The source rule that hides items without a duration at the section boundary is not represented in this partial SceneDoc.', undefined, 'Resolve the section end boundary and map the source display policy before importing this page for playback.')
    }
    if (attributes.override !== undefined) {
      addIssue(build, element, 'source-override-unconsumed', 'blocker', 'The final resolved attributes still contain an override marker whose source precedence is not applied.')
    }
    if ((attributes.scale !== undefined && element.name !== 'img') || attributes.rotation !== undefined || attributes.rotate !== undefined) {
      addIssue(build, element, 'source-transform-unresolved', 'blocker', 'Source scale or rotation needs a channel and a coordinate basis before it is mapped.', JSON.stringify({ scale: attributes.scale, rotation: attributes.rotation, rotate: attributes.rotate }))
    }
  }

  /** Creates aggregate counts and stable issue IDs for one converted page. */
  private createReport(page: XmlElement, build: PageBuild): ConversionReport {
    return {
      sourceDocument: page.location.documentId,
      pageId: build.pageId,
      convertedStories: Object.keys(build.stories).length,
      convertedPersos: build.convertedPersos,
      convertedCallbacks: build.convertedCallbacks,
      convertedTweens: build.convertedTweens,
      issues: build.issues,
      recipes: build.recipes,
    }
  }
}

/** Parses one finite non-negative visual timing value in source seconds. */
function readTimingNumber(
  rawValue: string | undefined,
  name: 'delay' | 'duration',
  element: XmlElement,
  build: PageBuild,
  fallback: number,
): number {
  if (rawValue === undefined) return fallback
  const value = Number(rawValue)
  if (Number.isFinite(value) && value >= 0) return value
  addIssue(build, element, 'source-timing-value-invalid', 'blocker', `The visual ${name} must be a finite non-negative number of seconds.`, `${name}="${rawValue}"`)
  return fallback
}

/** Returns the containing page supplied as the first source ancestor. */
function pageFromAncestors(ancestors: readonly XmlElement[]): XmlElement {
  return ancestors[0]!
}

/** Converts simple source inline CSS declarations to CodPlay style names. */
function parseInlineStyle(
  source: string,
  sourceCanvasWidth: number | undefined,
  element: XmlElement,
  build: PageBuild,
  style: Record<string, unknown>,
  importantProperties: Set<string>,
): Record<string, unknown> {
  return splitCssDeclarations(source).reduce<Record<string, unknown>>((style, declaration) => {
    const separator = declaration.indexOf(':')
    if (separator < 1) {
      if (declaration.trim() !== '') addIssue(build, element, 'source-inline-style-invalid', 'warning', 'A CSS declaration has no property/value separator.', declaration)
      return style
    }
    const property = toStyleProperty(declaration.slice(0, separator).trim())
    const declaredValue = declaration.slice(separator + 1).trim()
    const important = /\s*!important\s*$/i.test(declaredValue)
    const rawValue = declaredValue.replace(/\s*!important\s*$/i, '').trim()
    if (!important && importantProperties.has(property)) return style
    const value = normalizePixelLength(rawValue, sourceCanvasWidth)
    if (value === undefined) {
      addIssue(build, element, 'source-inline-value-unresolved', 'blocker', `The inline CSS value for ${property} depends on source units or functions that are not resolved.`, declaration)
      return style
    }
    const normalizedValue = ['color', 'backgroundColor', 'borderColor'].includes(property) ? normalizeColor(value) : value
    style[property] = normalizedValue
    if (important) importantProperties.add(property)
    return style
  }, style)
}

/** Splits CSS declarations without breaking semicolons inside strings or functions. */
function splitCssDeclarations(source: string): readonly string[] {
  const declarations: string[] = []
  let current = ''
  let quote = ''
  let depth = 0
  for (const character of source) {
    if (quote !== '') {
      current += character
      if (character === quote) quote = ''
      continue
    }
    if (character === '"' || character === "'") quote = character
    if (character === '(') depth += 1
    if (character === ')') depth -= 1
    if (character === ';' && depth === 0) {
      declarations.push(current)
      current = ''
      continue
    }
    current += character
  }
  if (current !== '') declarations.push(current)
  return declarations
}

/** Maps stable explicit color, typography, opacity, and size attributes. */
function applyExplicitStyle(
  attributes: Readonly<Record<string, string>>,
  style: Record<string, unknown>,
  importantProperties: ReadonlySet<string>,
  element: XmlElement,
  context: PageConversionContext,
  build: PageBuild,
): void {
  const directProperties = [
    ['textColor', 'color'], ['color', 'color'], ['fontFamily', 'fontFamily'], ['fontWeight', 'fontWeight'],
    ['textWeight', 'fontWeight'], ['textAlign', 'textAlign'], ['lineHeight', 'lineHeight'],
    ['backgroundColor', 'backgroundColor'],
  ] as const
  directProperties.forEach(([sourceName, targetName]) => {
    const value = attributes[sourceName]
    if (value !== undefined && !importantProperties.has(targetName)) style[targetName] = normalizeColor(value)
  })
  const fontSize = attributes.textSize ?? attributes.fontSize
  if (fontSize !== undefined && !importantProperties.has('fontSize')) {
    const resolved = normalizeAuthoredLength(fontSize, context.sourceCanvasWidth)
    if (resolved === undefined) addIssue(build, element, 'source-font-size-unresolved', 'blocker', 'A numeric or pixel font size needs the known source canvas width for a responsive CodPlay value.', fontSize)
    else style.fontSize = resolved
  }
  const alpha = attributes.alpha ?? attributes.opacity
  if (alpha !== undefined && !importantProperties.has('opacity')) {
    const opacity = Number(alpha)
    if (Number.isFinite(opacity)) style.opacity = opacity
    else addIssue(build, element, 'source-opacity-invalid', 'blocker', 'The source opacity is not a finite number.', alpha)
  }
  for (const property of ['width', 'height'] as const) {
    const value = attributes[property]
    if (value === undefined || style[property] !== undefined) continue
    const resolved = normalizeAuthoredLength(value, context.sourceCanvasWidth)
    if (resolved === undefined) addIssue(build, element, 'source-dimension-unresolved', 'blocker', `A numeric or pixel ${property} needs the known source canvas width for a responsive CodPlay value.`, value)
    else if (!importantProperties.has(property)) style[property] = resolved
  }
}

/** Converts numeric source pixel lengths to cqw and keeps explicit CSS units. */
function normalizeAuthoredLength(value: string, sourceCanvasWidth: number | undefined): string | undefined {
  const sourceLength = /^(-?(?:\d+\.?\d*|\.\d+))(?:px)?$/i.exec(value.trim())
  if (sourceLength === null) return /px\b/i.test(value) ? undefined : value
  if (sourceCanvasWidth === undefined || !Number.isFinite(sourceCanvasWidth) || sourceCanvasWidth <= 0) return undefined
  return `${Number(sourceLength[1]) / sourceCanvasWidth * 100}cqw`
}

/** Converts a source hexadecimal color prefix to the CSS equivalent. */
function normalizeColor(value: string): string {
  return /^0x[\da-f]{3,8}$/i.test(value) ? `#${value.slice(2)}` : value
}

/** Converts simple px tokens in CSS to cqw when the source canvas is known. */
function normalizePixelLength(value: string, sourceCanvasWidth: number | undefined): string | undefined {
  if (/var\s*\(/i.test(value)) return undefined
  const withoutUrls = value.replace(/url\([^)]*\)/gi, '')
  if (/(?:var|calc)\s*\(/i.test(value)) return undefined
  if (!/\b-?(?:\d+\.?\d*|\.\d+)px\b/i.test(withoutUrls)) return value
  if (/url\s*\(/i.test(value)) return undefined
  if (sourceCanvasWidth === undefined || !Number.isFinite(sourceCanvasWidth) || sourceCanvasWidth <= 0) return undefined
  return value.replace(/(-?(?:\d+\.?\d*|\.\d+))px\b/gi, (_match, number: string) => `${Number(number) / sourceCanvasWidth * 100}cqw`)
}

/** Resolves a callback's literal target list without executing its source. */
function readTargetReferences(expression: JavaScriptExpression | undefined): readonly string[] | undefined {
  const values = typeof expression === 'string'
    ? [expression]
    : expression !== undefined && isJavaScriptArray(expression) && expression.items.every((item) => typeof item === 'string')
      ? expression.items as readonly string[]
      : undefined
  if (values === undefined || values.some((value) => !/^#[\w-]+$/.test(value))) return undefined
  return values
}

/** Checks the source adapter's tween result before turning it into an action. */
function isValidResolvedTween(tween: ResolvedSourceTween): boolean {
  return Number.isFinite(tween.startAtMs)
    && tween.startAtMs >= 0
    && Number.isFinite(tween.durationMs)
    && tween.durationMs >= 0
    && Object.keys(tween.style).length > 0
    && Object.values(tween.style).every(({ from, to }) => isScalar(from) && isScalar(to))
}

/** Checks whether one tween endpoint is an explicit serializable scalar. */
function isScalar(value: unknown): value is string | number {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
}

/** Converts camel or kebab CSS property names to CodPlay's camel case. */
function toStyleProperty(property: string): string {
  return property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())
}

/** Adds a deterministic suffix when one story already uses the base perso ID. */
function createUniqueId(baseId: string, usedIds: ReadonlySet<string>): string {
  if (!usedIds.has(baseId)) return baseId
  const suffix = Array.from({ length: usedIds.size + 1 }, (_value, index) => index + 1)
    .find((index) => !usedIds.has(`${baseId}--duplicate-${index}`))
  return `${baseId}--duplicate-${suffix}`
}

/** Escapes a generated XML ID for use in an explicit HTML attribute. */
function escapeAttribute(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

/** Adds a stable source issue and keeps its original element location. */
function addIssue(
  build: PageBuild,
  element: XmlElement,
  code: string,
  severity: ImportIssue['severity'],
  message: string,
  source?: string,
  nextStep?: string,
): void {
  addIssueAt(build, element.location, code, severity, message, source, nextStep)
}

/** Adds a stable report issue at an XML or stylesheet location. */
function addIssueAt(
  build: PageBuild,
  location: ImportIssue['location'],
  code: string,
  severity: ImportIssue['severity'],
  message: string,
  source?: string,
  nextStep?: string,
): void {
  const id = `${code}:${location.documentId}:${location.line}:${location.column}:${location.path}`
  if (build.issues.some((issue) => issue.id === id && issue.message === message && issue.source === source)) return
  build.issues.push({ id, code, severity, message, location, ...(source === undefined ? {} : { source }), ...(nextStep === undefined ? {} : { nextStep }) })
}
