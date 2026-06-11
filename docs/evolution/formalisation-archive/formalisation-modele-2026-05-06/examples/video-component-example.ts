/**
 * Describes metadata for one specification example artifact.
 */
export type SpecExampleInfo = {
  id: string
  version: string
  status: 'draft' | 'review' | 'stable'
  updatedAt: string
}

/**
 * Provides versioning information for this example file.
 */
export const VIDEO_COMPONENT_EXAMPLE_INFO: SpecExampleInfo = {
  id: 'video-component-example',
  version: '0.1.0',
  status: 'draft',
  updatedAt: '2026-04-17'
}

/**
 * Represents one warning emitted by a permissive component.
 */
export type ComponentWarning = {
  code: string
  message: string
  details?: Record<string, unknown>
}

/**
 * Reports one component warning to the player trace channel.
 */
export type WarningReporter = (warning: ComponentWarning) => void

/**
 * Defines the DOM adapter contract expected by this example component.
 */
export type DomAdapter = {
  createFragmentFromTemplate: (template: string) => DocumentFragment
  setText: (node: HTMLElement, value: string) => void
  applyStyle: (node: HTMLElement, patch: Record<string, unknown>) => void
  applyClassName: (node: HTMLElement, patch: string | { add?: string; remove?: string }) => void
  applyAttr: (node: HTMLElement, patch: Record<string, unknown>) => void
}

/**
 * Defines the player payload forwarded to one component update call.
 */
export type ComponentUpdateInput = {
  persoId: string
  eventId: string
  eventSeq: number
  action: Record<string, unknown>
}

/**
 * Defines base visual patch fields reused by all component actions.
 */
export type BasePatch = {
  style?: Record<string, unknown>
  className?: string | { add?: string; remove?: string }
  attr?: Record<string, unknown>
}

/**
 * Defines the action shape supported by VideoComponentExample.
 */
export type VideoAction = BasePatch & {
  partId?: 'root' | 'surface' | 'video' | 'controls' | 'title' | 'progress'
  targetId?: string
  media?: {
    play?: boolean
    pause?: boolean
    seekMs?: number
    muted?: boolean
    sourceUrl?: string
  }
  controls?: {
    visible?: boolean
    title?: string
  }
}

type VideoRefs = {
  root: HTMLElement
  byPartId: Map<NonNullable<VideoAction['partId']>, HTMLElement>
}

/**
 * Stores the local component model managed by update layers.
 */
type VideoModel = {
  title: string
  sourceUrl: string
  controlsVisible: boolean
  isPlaying: boolean
  muted: boolean
  currentTimeMs: number
  durationMs: number
  childrenPersoIds: string[]
}

/**
 * Applies shared style/className/attr patches.
 */
class BasePatchLayer {
  /**
   * Keeps the adapter used to apply DOM patches.
   */
  private readonly adapter: DomAdapter

  /**
   * Creates one base patch helper bound to one adapter instance.
   */
  constructor(adapter: DomAdapter) {
    this.adapter = adapter
  }

  /**
   * Applies style/className/attr changes to one target node.
   */
  apply(node: HTMLElement, patch: BasePatch): void {
    if (patch.style) {
      this.adapter.applyStyle(node, patch.style)
    }

    if (patch.className !== undefined) {
      this.adapter.applyClassName(node, patch.className)
    }

    if (patch.attr) {
      this.adapter.applyAttr(node, patch.attr)
    }
  }
}

/**
 * Handles media commands routed by update.
 */
class VideoMediaLayer {
  /**
   * Points to shared mutable model data.
   */
  private readonly model: VideoModel

  /**
   * Points to shared part references.
   */
  private readonly refs: VideoRefs

  /**
   * Applies DOM operations through the injected adapter.
   */
  private readonly adapter: DomAdapter

  /**
   * Creates one media layer bound to shared model/refs/adapter.
   */
  constructor(model: VideoModel, refs: VideoRefs, adapter: DomAdapter) {
    this.model = model
    this.refs = refs
    this.adapter = adapter
  }

  /**
   * Applies media commands (source, play/pause, seek, muted).
   */
  apply(action: VideoAction['media']): void {
    if (!action) {
      return
    }

    const videoNode = resolvePart(this.refs, 'video') as HTMLVideoElement

    if (typeof action.sourceUrl === 'string') {
      this.model.sourceUrl = action.sourceUrl
      this.adapter.applyAttr(videoNode, { src: action.sourceUrl })
    }

    if (typeof action.seekMs === 'number') {
      this.model.currentTimeMs = Math.max(0, action.seekMs)
      videoNode.currentTime = this.model.currentTimeMs / 1000
    }

    if (typeof action.muted === 'boolean') {
      this.model.muted = action.muted
      videoNode.muted = action.muted
    }

    if (action.play === true) {
      this.model.isPlaying = true
      void videoNode.play().catch(() => undefined)
    }

    if (action.pause === true) {
      this.model.isPlaying = false
      videoNode.pause()
    }
  }
}

/**
 * Handles controls commands and sync.
 */
class VideoControlsLayer {
  /**
   * Points to shared mutable model data.
   */
  private readonly model: VideoModel

  /**
   * Points to shared part references.
   */
  private readonly refs: VideoRefs

  /**
   * Applies DOM operations through the injected adapter.
   */
  private readonly adapter: DomAdapter

  /**
   * Creates one controls layer bound to shared model/refs/adapter.
   */
  constructor(model: VideoModel, refs: VideoRefs, adapter: DomAdapter) {
    this.model = model
    this.refs = refs
    this.adapter = adapter
  }

  /**
   * Applies controls commands then triggers one controls sync.
   */
  apply(action: VideoAction['controls']): void {
    if (!action) {
      return
    }

    if (typeof action.visible === 'boolean') {
      this.model.controlsVisible = action.visible
    }

    if (typeof action.title === 'string') {
      this.model.title = action.title
    }

    this.sync()
  }

  /**
   * Syncs controls title/progress/visibility from model to DOM.
   */
  sync(): void {
    const controlsNode = resolvePart(this.refs, 'controls')
    const titleNode = resolvePart(this.refs, 'title')
    const progressNode = resolvePart(this.refs, 'progress')

    this.adapter.setText(titleNode, this.model.title)
    this.adapter.setText(progressNode, `${Math.floor(this.model.currentTimeMs)} / ${Math.floor(this.model.durationMs)} ms`)
    this.adapter.applyClassName(controlsNode, {
      add: this.model.controlsVisible ? 'is-visible' : '',
      remove: this.model.controlsVisible ? '' : 'is-visible'
    })
  }
}

/**
 * Provides the DOM fragment template used by this component.
 */
const VIDEO_TEMPLATE = `
<article data-part="root" class="video-component">
  <div data-part="surface" class="video-surface">
    <video data-part="video" preload="metadata"></video>
  </div>
  <div data-part="controls" class="video-controls is-visible">
    <p data-part="title" class="video-title"></p>
    <p data-part="progress" class="video-progress"></p>
  </div>
</article>
`

/**
 * Example component: one fragment, one update entry point, routed to sub-layers.
 */
export class VideoComponentExample {
  /**
   * Declares action properties handled by this component.
   */
  static readonly handledProps = ['media', 'controls']

  /**
   * Stores the adapter used by all layers.
   */
  private readonly adapter: DomAdapter

  /**
   * Reports warnings through the player channel.
   */
  private readonly warn: WarningReporter

  /**
   * Stores the current perso identifier for trace payloads.
   */
  private readonly persoId: string

  /**
   * Holds root and part references after init.
   */
  private refs: VideoRefs | null = null

  /**
   * Holds local component state updated by media/controls actions.
   */
  private readonly model: VideoModel = {
    title: 'Video',
    sourceUrl: '',
    controlsVisible: true,
    isPlaying: false,
    muted: false,
    currentTimeMs: 0,
    durationMs: 0,
    childrenPersoIds: []
  }

  /**
   * Applies base patch operations (style/className/attr).
   */
  private basePatchLayer: BasePatchLayer | null = null

  /**
   * Applies media-specific operations.
   */
  private mediaLayer: VideoMediaLayer | null = null

  /**
   * Applies controls-specific operations.
   */
  private controlsLayer: VideoControlsLayer | null = null

  /**
   * Deduplicates warnings per eventSeq and warning code.
   */
  private readonly warningKeys = new Set<string>()

  /**
   * Creates one component instance bound to one perso runtime context.
   */
  constructor(input: { persoId: string; adapter: DomAdapter; warn: WarningReporter }) {
    this.persoId = input.persoId
    this.adapter = input.adapter
    this.warn = input.warn
  }

  /**
   * Initializes DOM refs, layers, and model values from perso.initial.
   */
  init(initial: Record<string, unknown>): void {
    const fragment = this.adapter.createFragmentFromTemplate(VIDEO_TEMPLATE)
    const rootNode = fragment.firstElementChild
    if (!(rootNode instanceof HTMLElement)) {
      this.warnOnce(0, 'W_COMPONENT_INIT_FAILED', { persoId: this.persoId, reason: 'root-missing' })
      return
    }

    this.refs = {
      root: rootNode,
      byPartId: collectParts(rootNode)
    }
    this.basePatchLayer = new BasePatchLayer(this.adapter)
    this.mediaLayer = new VideoMediaLayer(this.model, this.refs, this.adapter)
    this.controlsLayer = new VideoControlsLayer(this.model, this.refs, this.adapter)

    this.model.title = typeof initial.title === 'string' ? initial.title : this.model.title
    this.model.sourceUrl = typeof initial.src === 'string' ? initial.src : this.model.sourceUrl
    this.model.durationMs = typeof initial.durationMs === 'number' ? Math.max(0, initial.durationMs) : 0
    this.controlsLayer.sync()
  }

  /**
   * Returns the root node once initialization completed.
   */
  render(): HTMLElement {
    if (!this.refs) {
      throw new Error(`Component not initialized: ${this.persoId}`)
    }

    return this.refs.root
  }

  /**
   * Routes one aggregated action to media/controls/base patch layers.
   */
  update(input: ComponentUpdateInput): void {
    try {
      const refs = this.refs
      if (!refs || !this.basePatchLayer || !this.mediaLayer || !this.controlsLayer) {
        this.warnOnce(input.eventSeq, 'W_COMPONENT_NOT_INITIALIZED', { persoId: this.persoId, eventId: input.eventId })
        return
      }

      const action = input.action as VideoAction
      if (typeof action.targetId === 'string') {
        void action.targetId
      }

      this.mediaLayer.apply(action.media)
      this.controlsLayer.apply(action.controls)

      const partId = action.partId ?? 'root'
      const targetNode = refs.byPartId.get(partId)
      if (!targetNode) {
        this.warnOnce(input.eventSeq, 'W_COMPONENT_PART_UNKNOWN', {
          persoId: this.persoId,
          eventId: input.eventId,
          partId
        })
        return
      }

      this.basePatchLayer.apply(targetNode, action)
      this.controlsLayer.sync()
    } catch (error) {
      this.warnOnce(input.eventSeq, 'W_COMPONENT_UPDATE_FAILED', {
        persoId: this.persoId,
        eventId: input.eventId,
        message: error instanceof Error ? error.message : 'Unknown update error'
      })
    }
  }

  /**
   * Emits one warning once for one {eventSeq, code} key.
   */
  private warnOnce(eventSeq: number, code: string, details?: Record<string, unknown>): void {
    const key = `${eventSeq}:${code}`
    if (this.warningKeys.has(key)) {
      return
    }

    this.warningKeys.add(key)
    this.warn({ code, message: code, details })
  }
}

/**
 * Collects all nodes declaring data-part into a typed map.
 */
function collectParts(root: HTMLElement): Map<NonNullable<VideoAction['partId']>, HTMLElement> {
  const byPartId = new Map<NonNullable<VideoAction['partId']>, HTMLElement>()
  const pending: HTMLElement[] = [root]

  while (pending.length > 0) {
    const node = pending.pop()
    if (!node) {
      continue
    }

    const partId = node.dataset.part as NonNullable<VideoAction['partId']> | undefined
    if (partId) {
      byPartId.set(partId, node)
    }

    for (const child of [...node.children]) {
      if (child instanceof HTMLElement) {
        pending.push(child)
      }
    }
  }

  return byPartId
}

/**
 * Resolves one required part from refs and throws when missing.
 */
function resolvePart(refs: VideoRefs, partId: NonNullable<VideoAction['partId']>): HTMLElement {
  const node = refs.byPartId.get(partId)
  if (!node) {
    throw new Error(`Missing part: ${partId}`)
  }

  return node
}

/**
 * Creates one default DOM adapter implementation for this example.
 */
export function createDefaultDomAdapter(): DomAdapter {
  return {
    createFragmentFromTemplate: (template) => {
      const host = globalThis.document.createElement('template')
      host.innerHTML = template
      return host.content.cloneNode(true) as DocumentFragment
    },
    setText: (node, value) => {
      node.textContent = value
    },
    applyStyle: (node, patch) => {
      for (const [key, value] of Object.entries(patch)) {
        ;(node.style as unknown as Record<string, unknown>)[key] = value
      }
    },
    applyClassName: (node, patch) => {
      if (typeof patch === 'string') {
        node.className = patch
        return
      }

      const classSet = new Set(node.className.split(/\s+/).filter((token) => token.length > 0))
      for (const token of (patch.add ?? '').split(/\s+/)) {
        if (token.length > 0) {
          classSet.add(token)
        }
      }
      for (const token of (patch.remove ?? '').split(/\s+/)) {
        if (token.length > 0) {
          classSet.delete(token)
        }
      }
      node.className = [...classSet].join(' ')
    },
    applyAttr: (node, patch) => {
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === null || value === false) {
          node.removeAttribute(key)
          continue
        }

        node.setAttribute(key, String(value))
      }
    }
  }
}

/**
 * Demonstrates one full instantiation and usage flow for this component.
 */
export function createVideoComponentInstantiationExample(): {
  component: VideoComponentExample
  rootNode: HTMLElement
  warnings: ComponentWarning[]
} {
  const warnings: ComponentWarning[] = []
  const adapter = createDefaultDomAdapter()
  const component = new VideoComponentExample({
    persoId: 'perso-video-1',
    adapter,
    warn: (warning) => {
      warnings.push(warning)
    }
  })

  component.init({
    title: 'Intro video',
    src: '/media/intro.mp4',
    durationMs: 120000
  })

  const rootNode = component.render()

  component.update({
    persoId: 'perso-video-1',
    eventId: 'evt-1',
    eventSeq: 1,
    action: {
      controls: { title: 'Chapter 1', visible: true },
      media: { play: true },
      style: { borderRadius: '12px' }
    }
  })

  return {
    component,
    rootNode,
    warnings
  }
}
