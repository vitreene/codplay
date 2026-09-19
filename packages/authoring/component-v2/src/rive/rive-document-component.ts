import {
  BaseHTMLComponent,
  type ComponentAnimation,
  type ComponentInput,
  type ComponentUpdateInput,
} from 'codplay'

import {
  type RiveAnimationInstance,
  type RiveArtboard,
  type RiveDocumentTarget,
  type RiveRenderer,
  type RiveRuntime,
} from './rive-context'
import { getRiveResource } from './rive-preload'
import type { RiveInitial } from './rive-types'

type RivePlayback = 'playing' | 'paused' | 'stopped'

/** Hosts one prepared Rive document and drives it from CodPlay presentation time. */
export class RiveDocumentComponent extends BaseHTMLComponent<RiveInitial> {
  static readonly declaredServices = ['className', 'style', 'attr'] as const

  private readonly runtime: RiveRuntime
  private readonly resource = getRiveResource(this.perso.initial.src)
  private readonly initial = this.perso.initial
  private readonly target: RiveDocumentTarget
  private canvas: HTMLCanvasElement | undefined
  private renderer: RiveRenderer | undefined
  private artboard: RiveArtboard | undefined
  private animationInstances: RiveAnimationInstance[] = []
  private playback: RivePlayback
  private lastTimeMs: number | undefined
  private revision = 0

  public constructor(input: ComponentInput<RiveInitial>) {
    super(input)
    this.runtime = input.runtime!.getLibrary<RiveRuntime>('rive')
    this.playback = this.initial.autoplay === false ? 'paused' : 'playing'
    this.target = {
      getRuntime: () => this.runtime,
      getArtboard: () => this.artboard,
      getRevision: () => this.revision,
    }
    this.services.declare(RiveDocumentComponent.declaredServices)
  }

  public render(): string {
    return '<canvas data-codplay-rive="document"></canvas>'
  }

  public initialize(): void {
    this.canvas = this.node as HTMLCanvasElement
    this.canvas.width = this.initial.width ?? 600
    this.canvas.height = this.initial.height ?? 600
    this.renderer = this.runtime.makeRenderer(this.canvas)
    this.createArtboard()
  }

  public update(input: ComponentUpdateInput): void {
    this.services.apply(this.node, {
      className: input.state.className,
      style: input.state.style,
      attr: input.state.attr,
    })
    this.applyBroadcast(input.activeActions)

    if (input.registerAnimation) {
      input.registerAnimation(this.createResetAnimation())
      input.registerAnimation(this.createAdvanceAnimation())
      input.registerAnimation(this.createRenderAnimation())
      return
    }

    this.advanceAt(input.timeMs)
    this.drawFrame()
  }

  public destroy(): void {
    this.deleteArtboard()
    this.renderer?.delete()
    this.renderer = undefined
    this.canvas = undefined
  }

  /** Returns the stable target consumed by future attached Rive components. */
  public getTarget(): RiveDocumentTarget {
    return this.target
  }

  /** Registers the reset stream that runs before attached content streams. */
  private createResetAnimation(): ComponentAnimation {
    return {
      id: 'rive-reset',
      startAt: 0,
      endAt: Number.POSITIVE_INFINITY,
      sample: (timeMs) => ({
        value: `${timeMs}:${this.revision}`,
        apply: () => this.resetAt(timeMs),
      }),
    }
  }

  /** Rebuilds the document before attached logical components present a seek. */
  private resetAt(timeMs: number): void {
    if (this.lastTimeMs !== undefined && timeMs < this.lastTimeMs) {
      this.createArtboard()
      this.lastTimeMs = 0
    }
  }

  /** Registers the absolute-time stream that advances the native document. */
  private createAdvanceAnimation(): ComponentAnimation {
    return {
      id: 'rive-advance',
      startAt: 0,
      endAt: Number.POSITIVE_INFINITY,
      presentationPhase: 'commit',
      sample: (timeMs) => ({
        value: `${timeMs}:${this.revision}:${this.playback}`,
        apply: () => this.advanceAt(timeMs),
      }),
    }
  }

  /** Registers the final commit stream that draws the current artboard. */
  private createRenderAnimation(): ComponentAnimation {
    return {
      id: 'rive-render',
      startAt: 0,
      endAt: Number.POSITIVE_INFINITY,
      presentationPhase: 'commit',
      sample: (timeMs) => ({
        value: `${timeMs}:${this.revision}:${this.playback}`,
        apply: () => this.drawFrame(),
      }),
    }
  }

  /** Creates the selected artboard and its linear animation instances. */
  private createArtboard(): void {
    this.deleteArtboard()
    const name = this.initial.artboard
    const artboard = name
      ? this.resource.file.artboardByName(name)
      : this.resource.file.defaultArtboard()
    if (!artboard) throw new Error(`Rive artboard "${name}" was not found.`)

    this.artboard = artboard
    this.animationInstances = this.resolveAnimations(artboard)
    this.revision += 1
  }

  /** Resolves the authored animation selection, or all linear animations by default. */
  private resolveAnimations(artboard: RiveArtboard): RiveAnimationInstance[] {
    const names = this.initial.animations
      ? typeof this.initial.animations === 'string'
        ? [this.initial.animations]
        : this.initial.animations
      : undefined
    const animations = names
      ? names.map((name) => artboard.animationByName(name))
      : Array.from({ length: artboard.animationCount() }, (_, index) => artboard.animationByIndex(index))
    return animations.map(
      (animation) => new this.runtime.LinearAnimationInstance(animation, artboard),
    )
  }

  /** Releases the current artboard and every animation instance it owns. */
  private deleteArtboard(): void {
    for (const animation of this.animationInstances) animation.delete()
    this.animationInstances = []
    this.artboard?.delete()
    this.artboard = undefined
  }

  /** Projects the latest broadcast occurrence onto the local playback state. */
  private applyBroadcast(activeActions: ComponentUpdateInput['activeActions']): void {
    const occurrence = [...(activeActions ?? [])]
      .reverse()
      .find((candidate) => candidate.action.broadcast !== undefined)
    const broadcast = occurrence?.action.broadcast
    const type = typeof broadcast === 'object' && broadcast !== null
      ? (broadcast as { type?: unknown }).type
      : undefined

    if (type === 'START') this.playback = 'playing'
    else if (type === 'PAUSE') this.playback = 'paused'
    else if (type === 'STOP') {
      this.playback = 'stopped'
      this.createArtboard()
      this.lastTimeMs = 0
    }
  }

  /** Reconstructs and advances the document from one absolute CodPlay time. */
  private advanceAt(timeMs: number): void {
    if (!this.artboard) return
    if (this.lastTimeMs !== undefined && timeMs < this.lastTimeMs) {
      this.createArtboard()
      this.lastTimeMs = 0
    }

    const deltaMs = Math.max(0, timeMs - (this.lastTimeMs ?? timeMs))
    if (this.playback === 'playing' && deltaMs > 0) {
      const seconds = deltaMs / 1000
      for (const animation of this.animationInstances) {
        animation.advance(seconds)
        animation.apply(1)
      }
      this.artboard.advance(seconds)
    }
    this.lastTimeMs = timeMs
  }

  /** Draws the current artboard during the host commit phase. */
  private drawFrame(): void {
    if (!this.canvas || !this.renderer || !this.artboard) return

    const fit = this.initial.fit ?? 'contain'
    const alignment = this.initial.alignment ?? 'center'
    const frame = {
      minX: 0,
      minY: 0,
      maxX: this.canvas.width,
      maxY: this.canvas.height,
    }
    this.renderer.clear()
    this.renderer.save()
    this.renderer.align(this.runtime.Fit[fit], this.runtime.Alignment[alignment], frame, this.artboard.bounds)
    this.artboard.draw(this.renderer)
    this.renderer.restore()
    this.runtime.resolveAnimationFrame()
  }
}
