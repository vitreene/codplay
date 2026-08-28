import { BaseComponent } from 'codplay-v1/runtime/components/lib/base-component'
import { ComponentServiceBase } from 'codplay-v1'
import { COMPONENT_DEFAULT_SERVICES } from 'codplay-v1/runtime/components/lib/component-services'
import type { ComponentRenderResult, RuntimeComponentUpdateInput } from 'codplay-v1/runtime/components/types'
import type { RenderTickInfo, RenderSeekInfo } from 'codplay-v1/player/render-adapter-types'
import type { RiveContext } from './rive-context'
import type { RiveInitial, RiveActionPayload } from './rive-types'
import { getRiveEntry } from './rive-preload'

type RivePlaybackState = 'playing' | 'paused' | 'stopped'

export class RiveBaseComponent extends BaseComponent {
  protected _riveCtx: RiveContext | null = null
  private _rate = 1
  private _playbackState: RivePlaybackState = 'playing'
  protected readonly _internalServices: ComponentServiceBase[] = []

  constructor(input: ConstructorParameters<typeof BaseComponent>[0]) {
    super(input)
    this.services.declare(COMPONENT_DEFAULT_SERVICES)
  }

  protected _addService(service: ComponentServiceBase): void {
    this._internalServices.push(service)
  }

  protected _initializeInternalServices(): void {}

  render(): ComponentRenderResult {
    const initial = this.perso.initial as RiveInitial
    const canvas = this.buildNode('canvas') as HTMLCanvasElement
    canvas.width = initial.width ?? 600
    canvas.height = initial.height ?? 600
    this.services.apply(canvas, initial as Record<string, unknown>)
    return canvas
  }

  init(): void {
    this._rebuildRuntimeState({ recreateRenderer: true })
  }

  protected _doAdvance(sec: number): void {
    for (const s of this._internalServices) s.advance?.(sec)
    this._riveCtx!.artboard.advance(sec)
  }

  /** Called by the hub via RenderAdapter.prepareSeek?(), once before the player replays seek events. */
  _prepareSeek(): void {
    if (!this._riveCtx) return
    this._rebuildRuntimeState({ recreateRenderer: false })
  }

  protected _drawFrame(): void {
    const { runtime, artboard, renderer } = this._riveCtx!
    const canvas = this.node as HTMLCanvasElement
    const frame = { minX: 0, minY: 0, maxX: canvas.width, maxY: canvas.height }
    renderer.clear()
    renderer.save()
    renderer.align(runtime.Fit.contain, runtime.Alignment.center, frame, artboard.bounds)
    artboard.draw(renderer)
    renderer.restore()
    runtime.resolveAnimationFrame()
  }

  _tick(info: RenderTickInfo): void {
    if (!this._riveCtx) return
    if (this._playbackState !== 'playing') return
    const sec = (info.deltaMs * this._rate) / 1000
    this._doAdvance(sec)
    this._drawFrame()
  }

  _seek(_info: RenderSeekInfo): void {
    if (!this._riveCtx) return
    this._doAdvance(0)
    this._drawFrame()
  }

  setRate(rate: number): void {
    this._rate = rate
  }

  _stop(): void {
    this._destroyRuntimeState({ destroyRenderer: true })
    this._playbackState = 'stopped'
  }

  protected _resetServices(): void {
    for (const s of this._internalServices) s.reset()
  }

  update(input: RuntimeComponentUpdateInput): void {
    this.services.apply(this.node, input.action, input.serviceContext)
    const action = input.action as RiveActionPayload
    if (!this._applyBroadcast(action.broadcast)) {
      return
    }
    this._applyAction(action)
  }

  protected _applyAction(_action: RiveActionPayload): void {}

  private _applyBroadcast(broadcast: RiveActionPayload['broadcast']): boolean {
    if (!broadcast) {
      return true
    }

    if (broadcast.type === 'START') {
      this._playbackState = 'playing'
      return true
    }

    if (broadcast.type === 'PAUSE') {
      this._playbackState = 'paused'
      return false
    }

    if (broadcast.type === 'STOP') {
      if (this._riveCtx) {
        this._rebuildRuntimeState({ recreateRenderer: false })
      }
      this._playbackState = 'stopped'
      this._drawFrame()
      return false
    }

    return true
  }

  private _rebuildRuntimeState(input: { recreateRenderer: boolean }): void {
    const initial = this.perso.initial as RiveInitial
    const entry = getRiveEntry(initial.src)
    if (!entry || entry.status !== 'ready' || !entry.runtime || !entry.file) {
      throw new Error(`[rive] resource not ready: ${initial.src} — ensure preload ran before player.init()`)
    }

    const previousRenderer = this._riveCtx?.renderer ?? null
    this._destroyRuntimeState({ destroyRenderer: input.recreateRenderer })

    const artboard = initial.artboard
      ? entry.file.artboardByName(initial.artboard)
      : entry.file.defaultArtboard()
    if (!artboard) throw new Error(`[rive] artboard "${initial.artboard}" not found in ${initial.src}`)

    const renderer = input.recreateRenderer || previousRenderer === null
      ? entry.runtime.makeRenderer(this.node as HTMLCanvasElement)
      : previousRenderer

    this._riveCtx = { runtime: entry.runtime, artboard, renderer }
    this._playbackState = this._resolveInitialPlaybackState()
    this._initializeInternalServices()
  }

  private _destroyRuntimeState(input: { destroyRenderer: boolean }): void {
    for (const service of this._internalServices) {
      service.destroy?.()
    }
    this._internalServices.length = 0

    if (this._riveCtx) {
      this._riveCtx.artboard.delete()
      if (input.destroyRenderer) {
        this._riveCtx.renderer.delete()
      }
    }

    this._riveCtx = null
  }

  private _resolveInitialPlaybackState(): RivePlaybackState {
    for (const action of Object.values(this.perso.actions ?? {})) {
      if (action === null || typeof action !== 'object' || Array.isArray(action)) {
        continue
      }

      const broadcast = (action as { broadcast?: { type?: unknown } }).broadcast
      if (broadcast?.type === 'START' || broadcast?.type === 'PAUSE' || broadcast?.type === 'STOP') {
        return 'stopped'
      }
    }

    return 'playing'
  }
}
