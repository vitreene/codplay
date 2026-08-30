import { isPlainRecord } from '../../../shared'
import type { RuntimePreloadResourceMetadata } from '../../preload'
import { BaseHTMLComponent } from '../base-html-component'
import type { HTMLComponentInput, ComponentUpdateInput } from '../component-types'
import type { MediaTransition } from '../component-surface-types'
import type { MediaInitial, MediaPartState, MediaState, MediaTag } from './media-types'

/** V2 media component that preserves one materialized native media node per source. */
export class MediaComponent extends BaseHTMLComponent<MediaInitial> {
  /** Services declared by the component author, in application order. */
  static readonly declaredServices = ['className', 'style', 'attr'] as const

  /** One persistent native media node per source; inactive nodes remain detached here. */
  private readonly mediaBySrc = new Map<string, unknown>()
  /** Source currently attached to the component root. */
  private activeSrc: string | null = null
  /** Metadata produced by the external preload boundary. */
  private readonly resourceMetadata: ReadonlyMap<string, RuntimePreloadResourceMetadata>
  /** Effective playback window supplied by the media-sync module. */
  private playbackWindow: { startMs: number; endMs: number | null } = { startMs: 0, endMs: null }
  /** Native playback rate applied to every persistent source node. */
  private playbackRate = 1

  /** Creates one media component with its declared core services. */
  constructor(input: HTMLComponentInput<MediaInitial>) {
    super(input)
    this.services.declare(MediaComponent.declaredServices)
    this.resourceMetadata = input.resourceMetadata ?? new Map()
  }

  /** Returns the authored media wrapper; native media nodes belong to its private media part. */
  render(): string {
    return '<div class="codplay-media-root"></div>'
  }

  /** Applies root services and selects the persistent native media node for the resolved source. */
  update(input: ComponentUpdateInput<MediaState>): void {
    if (this.node === null) throw new Error(`Media component is not materialized: ${this.perso.id}`)
    this.services.apply(this.node, {
      className: input.state.className,
      style: input.state.style,
      attr: input.state.attr,
    })
    this.ensureStaticSourceNodes()
    this.setActiveSource(input.state.src)
    const active = this.activeMediaNode()
    if (active !== undefined) this.applyMediaPartState(active, input.state.video)
  }

  /** Creates every statically declared source node once before the first presentation. */
  private ensureStaticSourceNodes(): void {
    for (const src of this.staticSrcs()) this.ensureNodeForSource(src)
  }

  /** Creates or reuses one source node and attaches it as the sole media child. */
  private setActiveSource(src: string): void {
    const root = this.node
    if (!isParentNode(root)) return
    const active = this.ensureNodeForSource(src)
    if (!isNode(active)) return
    const previous = this.activeSrc === null ? undefined : this.mediaBySrc.get(this.activeSrc)
    if (isNode(previous) && previous !== active && previous.parentNode === root) root.removeChild(previous)
    if (active.parentNode !== root) root.appendChild(active)
    if (this.activeSrc !== src) this.playbackWindow = { startMs: 0, endMs: null }
    this.activeSrc = src
  }

  /** Returns one cached source node, assigning its source only at first creation. */
  private ensureNodeForSource(src: string): unknown {
    const existing = this.mediaBySrc.get(src)
    if (existing !== undefined) return existing
    const node = createMediaNode(resolveMediaTag(
      src,
      this.perso.initial.tag,
      this.resourceMetadata.get(src),
    ))
    setMediaSource(node, src)
    if (this.perso.initial.controls === true) setMediaControls(node)
    this.applyMediaPartState(node, this.perso.initial.video)
    setNativePlaybackRate(node, this.playbackRate)
    this.mediaBySrc.set(src, node)
    return node
  }

  /** Seeks the active persistent source without replacing or reassigning its node. */
  seekTo(mediaMs: number): void {
    const node = this.activeMediaNode()
    if (!isMediaElementLike(node)) return
    node.currentTime = this.clampPlaybackMs(mediaMs) / 1000
  }

  /** Starts playback on the active persistent source. */
  play(): void {
    const node = this.activeMediaNode()
    if (!isMediaElementLike(node) || typeof node.play !== 'function') return
    const result = node.play()
    if (result !== undefined && typeof result.then === 'function') void result.catch(() => undefined)
  }

  /** Pauses the active persistent source without releasing its node. */
  pause(): void {
    const node = this.activeMediaNode()
    if (!isMediaElementLike(node)) return
    node.pause?.()
  }

  /** Seeks and pauses the active source at one logical media position. */
  stopAt(mediaMs: number): void {
    this.seekTo(mediaMs)
    this.pause()
  }

  /** Reads the active source clock in milliseconds. */
  getCurrentTimeMs(): number {
    const node = this.activeMediaNode()
    return isMediaElementLike(node) && Number.isFinite(node.currentTime)
      ? this.clampPlaybackMs(node.currentTime * 1000)
      : 0
  }

  /** Reads native duration when metadata is available, otherwise returns null. */
  getDurationMs(): number | null {
    const metadata = this.activeSrc === null ? undefined : this.resourceMetadata.get(this.activeSrc)
    if (metadata?.durationMs !== undefined && Number.isFinite(metadata.durationMs)) {
      return Math.max(0, metadata.durationMs)
    }
    return null
  }

  /** Sets the effective broadcast window without changing the native source. */
  setPlaybackWindow(startMs: number, endMs: number | null): void {
    this.playbackWindow = {
      startMs: Math.max(0, startMs),
      endMs: endMs === null ? null : Math.max(startMs, endMs),
    }
  }

  /** Applies the player rate to every persistent native media node. */
  setRate(rate: number): void {
    this.playbackRate = rate
    for (const node of this.mediaBySrc.values()) setNativePlaybackRate(node, rate)
  }

  /** Applies one media transition at the supplied normalized progress. */
  applyTransition(transition: MediaTransition, progress: number): void {
    const node = this.activeMediaNode()
    if (!isMediaElementLike(node)) return
    const from = transition.from ?? {}
    const to = transition.to ?? {}
    const boundedProgress = Math.min(1, Math.max(0, progress))
    const properties = new Set([...Object.keys(from), ...Object.keys(to)])
    for (const property of properties) {
      const start = from[property]
      const end = to[property]
      const value = interpolateMediaProperty(start, end, boundedProgress)
      if (value !== undefined) setMediaProperty(node, property, value)
    }
  }

  /** Reports whether the active source is paused or unavailable. */
  isPaused(): boolean {
    const node = this.activeMediaNode()
    return !isMediaElementLike(node) || node.paused !== false
  }

  /** Returns the currently attached persistent media node. */
  private activeMediaNode(): unknown {
    return this.activeSrc === null ? undefined : this.mediaBySrc.get(this.activeSrc)
  }

  /** Applies the authored visual and attribute patch to the native media part. */
  private applyMediaPartState(node: unknown, state: MediaPartState | undefined): void {
    if (state === undefined) return
    this.services.apply(node, {
      className: state.className,
      style: state.style,
      attr: state.attr,
    })
  }

  /** Clamps one native position to the currently effective CodPlay window. */
  private clampPlaybackMs(mediaMs: number): number {
    const lowerBounded = Math.max(this.playbackWindow.startMs, mediaMs)
    return this.playbackWindow.endMs === null
      ? lowerBounded
      : Math.min(this.playbackWindow.endMs, lowerBounded)
  }

  /** Collects the statically declared source set of this component. */
  private staticSrcs(): readonly string[] {
    const srcs = new Set<string>()
    if (typeof this.perso.initial.src === 'string') srcs.add(this.perso.initial.src)
    for (const action of Object.values(this.perso.actions ?? {})) {
      if (!isPlainRecord(action) || typeof action.src !== 'string') continue
      srcs.add(action.src)
    }
    return [...srcs]
  }
}

/** Creates one internal native media node for the component's private media part. */
function createMediaNode(tag: MediaTag): unknown {
  if (typeof globalThis.document !== 'undefined') return globalThis.document.createElement(tag)
  const node: {
    tagName: string
    parentNode: unknown
    src: string
    currentTime: number
    duration: number
    paused: boolean
    volume: number
    muted: boolean
    playbackRate: number
    play: () => void
    pause: () => void
  } = {
    tagName: tag.toUpperCase(),
    parentNode: null,
    src: '',
    currentTime: 0,
    duration: Number.NaN,
    paused: true,
    volume: 1,
    muted: false,
    playbackRate: 1,
    play: () => undefined,
    pause: () => undefined,
  }
  node.play = () => { node.paused = false }
  node.pause = () => { node.paused = true }
  return node
}

/** Resolves the native element kind from preload metadata, author hint, or source suffix. */
function resolveMediaTag(
  src: string,
  explicitTag: MediaTag | undefined,
  metadata: RuntimePreloadResourceMetadata | undefined,
): MediaTag {
  if (metadata?.type === 'audio') return 'audio'
  if (metadata?.type === 'video') return 'video'
  if (explicitTag !== undefined) return explicitTag
  return /\.(?:aac|flac|m4a|mp3|oga|ogg|wav)(?:$|[?#])/i.test(src) ? 'audio' : 'video'
}

/** Assigns one source exactly once to a freshly created media node. */
function setMediaSource(node: unknown, src: string): void {
  if (typeof node !== 'object' || node === null) return
  ;(node as { src?: string }).src = src
}

/** Applies the fixed author option to each source node when it is created. */
function setMediaControls(node: unknown): void {
  if (typeof node !== 'object' || node === null) return
  const candidate = node as { setAttribute?: (name: string, value: string) => void }
  candidate.setAttribute?.('controls', '')
}

/** Applies the native playback rate without touching the media current time. */
function setNativePlaybackRate(node: unknown, rate: number): void {
  if (typeof node !== 'object' || node === null) return
  ;(node as { playbackRate?: number }).playbackRate = rate
}

/** Interpolates one authored media property without ever interpolating a non-numeric value. */
function interpolateMediaProperty(start: unknown, end: unknown, progress: number): unknown {
  if (typeof start === 'number' && typeof end === 'number') return start + (end - start) * progress
  if (progress <= 0 && start !== undefined) return start
  if (progress >= 1 && end !== undefined) return end
  return end ?? start
}

/** Applies one supported transition property to the active native media node. */
function setMediaProperty(node: unknown, property: string, value: unknown): void {
  if (typeof node !== 'object' || node === null) return
  if (property === 'currentTime' || property === 'src' || property === 'playbackRate') return
  if (property === 'volume' && typeof value === 'number') {
    ;(node as { volume?: number }).volume = Math.min(1, Math.max(0, value))
    return
  }
  if (property === 'muted' && typeof value === 'boolean') {
    ;(node as { muted?: boolean }).muted = value
    return
  }
  if (property in node) (node as Record<string, unknown>)[property] = value
}

/** Checks the DOM-like parent surface needed by source selection. */
function isParentNode(value: unknown): value is {
  appendChild: (child: unknown) => unknown
  removeChild: (child: unknown) => unknown
} {
  return typeof value === 'object'
    && value !== null
    && 'appendChild' in value
    && typeof value.appendChild === 'function'
    && 'removeChild' in value
    && typeof value.removeChild === 'function'
}

/** Checks the DOM-like node surface needed by source selection. */
function isNode(value: unknown): value is { parentNode: unknown } {
  return typeof value === 'object' && value !== null && 'parentNode' in value
}

/** Checks the native media surface used by the player-scoped sync capability. */
function isMediaElementLike(value: unknown): value is {
  currentTime: number
  duration: number
  paused: boolean
  play?: () => void | Promise<unknown>
  pause?: () => void
} {
  return typeof value === 'object'
    && value !== null
    && 'currentTime' in value
    && typeof (value as { currentTime?: unknown }).currentTime === 'number'
    && 'duration' in value
    && typeof (value as { duration?: unknown }).duration === 'number'
    && 'paused' in value
    && typeof (value as { paused?: unknown }).paused === 'boolean'
}
