import { BaseComponent } from 'codplay/runtime/components/lib/base-component'
import { ComponentServiceBase } from 'codplay'
import { COMPONENT_DEFAULT_SERVICES } from 'codplay/runtime/components/lib/component-services'
import type { ComponentRenderResult, RuntimeComponentUpdateInput } from 'codplay/runtime/components/types'
import type { RenderTickInfo, RenderSeekInfo } from 'codplay/player/render-adapter-types'
import type { RiveContext } from './rive-context'
import type { RiveInitial } from './rive-types'
import { getRiveEntry } from './rive-preload'

export class RiveBaseComponent extends BaseComponent {
  protected _riveCtx: RiveContext | null = null
  private _rate = 1
  protected readonly _internalServices: ComponentServiceBase[] = []

  constructor(input: ConstructorParameters<typeof BaseComponent>[0]) {
    super(input)
    this.services.declare(COMPONENT_DEFAULT_SERVICES)
  }

  protected _addService(service: ComponentServiceBase): void {
    this._internalServices.push(service)
  }

  render(): ComponentRenderResult {
    const initial = this.perso.initial as RiveInitial
    const canvas = this.buildNode('canvas') as HTMLCanvasElement
    canvas.width = initial.width ?? 600
    canvas.height = initial.height ?? 600
    this.services.apply(canvas, initial as Record<string, unknown>)
    return canvas
  }

  init(): void {
    this._internalServices.length = 0
    this._riveCtx = null
    const initial = this.perso.initial as RiveInitial
    const entry = getRiveEntry(initial.src)
    if (!entry || entry.status !== 'ready' || !entry.runtime || !entry.file) {
      throw new Error(`[rive] resource not ready: ${initial.src} — ensure preload ran before player.init()`)
    }
    const artboard = initial.artboard
      ? entry.file.artboardByName(initial.artboard)
      : entry.file.defaultArtboard()
    if (!artboard) throw new Error(`[rive] artboard "${initial.artboard}" not found in ${initial.src}`)
    const renderer = entry.runtime.makeRenderer(this.node as HTMLCanvasElement)
    this._riveCtx = { runtime: entry.runtime, artboard, renderer }
  }

  protected _doAdvance(sec: number): void {
    for (const s of this._internalServices) s.advance?.(sec)
    this._riveCtx!.artboard.advance(sec)
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
    this._resetServices()
    for (const s of this._internalServices) s.destroy?.()
    this._internalServices.length = 0
    this._riveCtx = null
  }

  protected _resetServices(): void {
    for (const s of this._internalServices) s.reset()
  }

  update(input: RuntimeComponentUpdateInput): void {
    this.services.apply(this.node, input.action)
  }
}
