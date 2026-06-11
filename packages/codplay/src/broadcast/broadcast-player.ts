import { animate, engine } from 'animejs'
import { createAnimationAdapter } from '../animation/adapter'
import { Player } from '../player/player'
import { createTelco } from '../telco/create-telco'
import type { TickSubscriber } from '../telco/create-telco'
import type { CompiledScene, ListenRule } from '../builder/types'
import type { StrapCollection, StrapFn, StrapMeta } from '../player/strap-types'
import type { PlayerStateSnapshot } from '../player/types'
import type { StoryEvent } from '../player/helper-types'
import type { TelcoApi } from '../telco/types'
import type { BroadcastPlayerApi, DataScene, PlayerHookFn, PlayerHookResult } from './types'

const HOOK_EVENT = {
  success: 'hook:success',
  error: 'hook:error',
} as const

/**
 * Préfixe les URLs du ResourceManifest qui ne sont pas déjà absolues.
 */
function prefixManifestUrls(scene: CompiledScene, base: string): CompiledScene {
  const normalized = base.endsWith('/') ? base : `${base}/`
  return {
    ...scene,
    resources: {
      entries: scene.resources.entries.map((entry) => {
        const isAbsolute =
          entry.url.startsWith('http://') ||
          entry.url.startsWith('https://') ||
          entry.url.startsWith('//')
        return isAbsolute ? entry : { ...entry, url: normalized + entry.url }
      }),
    },
  }
}

/**
 * Construit un strap synthétique pour un hook externe.
 * Appelle tous les handlers enregistrés et réinjecte hook:success ou hook:error
 * sans données propres du handler.
 */
function buildHookStrap(eventName: string, handlers: Set<PlayerHookFn>): StrapFn {
  return async ({ event, state, meta }: { event: StoryEvent; state: Parameters<StrapFn>[0]['state']; meta: StrapMeta }) => {
    const results = await Promise.allSettled(
      [...handlers].map((fn) => fn({ event, state, meta }))
    )

    const events: StoryEvent[] = []
    for (const result of results) {
      if (result.status === 'rejected') {
        events.push({ name: HOOK_EVENT.error, data: { on: eventName } })
        continue
      }
      const value = result.value as PlayerHookResult
      if (value?.status === 'success') {
        events.push({ name: HOOK_EVENT.success, data: { on: eventName } })
      } else if (value?.status === 'error') {
        events.push({ name: HOOK_EVENT.error, data: { on: eventName, code: value.code } })
      }
    }

    return events.length > 0 ? { events } : undefined
  }
}

/**
 * Player de diffusion autonome.
 * Bundles anime.js, câble les événements DOM, et monte les noeuds racines automatiquement.
 */
export class BroadcastPlayer implements BroadcastPlayerApi {
  /**
   * Accès au player interne — réservé à l'usage de telco() et aux intégrations avancées.
   * Ne pas appeler init() directement : le BroadcastPlayer le gère en interne.
   */
  readonly _inner: Player

  private readonly compiledScene: CompiledScene
  private readonly strapCollection: StrapCollection | undefined
  private readonly mountTarget: HTMLElement
  private readonly hooks = new Map<string, Set<PlayerHookFn>>()
  private initialized = false

  constructor(selector: string | HTMLElement, datascene: DataScene) {
    engine.useDefaultMainLoop = false

    const animationAdapter = createAnimationAdapter(
      (params) => {
        const { targets, ...rest } = params as Record<string, unknown>
        return animate(
          targets as Parameters<typeof animate>[0],
          rest as Parameters<typeof animate>[1]
        )
      },
      { renderFrame: () => { engine.update() } }
    )

    this._inner = new Player({
      animationAdapter,
      createElementOptions: {
        emitRuntimeEvent: (event) => {
          void this._inner.emit({
            name: event.name,
            data: event.data,
            cascade: event.cascade,
            scopeStoryId: event.scopeStoryId,
            source: event.source,
            ms: event.ms,
          })
        },
        getCurrentTimelineMs: () => this._inner.getState().timelineMs,
      },
    })

    this.compiledScene = datascene.resourceBaseUrl
      ? prefixManifestUrls(datascene.compiled, datascene.resourceBaseUrl)
      : datascene.compiled

    this.strapCollection = datascene.straps

    if (typeof selector === 'string') {
      const el = globalThis.document?.querySelector<HTMLElement>(selector)
      if (el === null || el === undefined) {
        throw new Error(`BroadcastPlayer: aucun élément trouvé pour "${selector}"`)
      }
      this.mountTarget = el
    } else {
      this.mountTarget = selector
    }
  }

  async play(): Promise<void> {
    if (!this.initialized) {
      await this.initAndMount()
    }
    const result = await this._inner.play()
    if (!result.ok) throw new Error(`BroadcastPlayer: play échoué — ${result.error.code}`)
  }

  async pause(): Promise<void> {
    const result = await this._inner.pause()
    if (!result.ok) throw new Error(`BroadcastPlayer: pause échouée — ${result.error.code}`)
  }

  async seek(ms: number): Promise<void> {
    const result = await this._inner.seek({ timelineMs: ms })
    if (!result.ok) throw new Error(`BroadcastPlayer: seek échoué — ${result.error.code}`)
  }

  async emit(event: StoryEvent): Promise<void> {
    const result = await this._inner.emit(event)
    if (!result.ok) throw new Error(`BroadcastPlayer: emit échoué — ${result.error.code}`)
  }

  getState(): PlayerStateSnapshot {
    return this._inner.getState()
  }

  onChange(listener: (state: PlayerStateSnapshot) => void): () => void {
    return this._inner.onChange(listener)
  }

  on(eventName: string, fn: PlayerHookFn): () => void {
    if (this.initialized) {
      throw new Error(`BroadcastPlayer: player.on() doit être appelé avant play()`)
    }
    if (!this.hooks.has(eventName)) {
      this.hooks.set(eventName, new Set())
    }
    this.hooks.get(eventName)!.add(fn)
    return () => { this.hooks.get(eventName)?.delete(fn) }
  }

  async destroy(): Promise<void> {
    const result = await this._inner.destroy()
    if (!result.ok) throw new Error(`BroadcastPlayer: destroy échoué — ${result.error.code}`)
    this.initialized = false
  }

  private async initAndMount(): Promise<void> {
    const { compiledScene, augmentedStraps } = this.buildAugmentedScene()

    const result = await this._inner.init({
      mountTarget: this.mountTarget,
      compiledScene,
      strapCollection: augmentedStraps,
    })
    if (!result.ok) {
      throw new Error(`BroadcastPlayer: init échoué — ${result.error.code}`)
    }

    this.mountRootNodes()
    this.initialized = true
  }

  private mountRootNodes(): void {
    const registry = this._inner.getRuntimeRegistry()
    for (const id of this.compiledScene.rootNodeIds) {
      const nodeRef = registry.getNodeById(id)
      if (typeof globalThis.Node !== 'undefined' && nodeRef instanceof globalThis.Node) {
        this.mountTarget.appendChild(nodeRef)
      }
    }
  }

  private buildAugmentedScene(): { compiledScene: CompiledScene; augmentedStraps: StrapCollection } {
    const augmentedStraps: StrapCollection = { ...this.strapCollection }

    if (this.hooks.size === 0) {
      return { compiledScene: this.compiledScene, augmentedStraps }
    }

    const syntheticListenRules: ListenRule[] = []

    for (const [eventName, handlers] of this.hooks) {
      const strapName = `__hook__${eventName}`
      augmentedStraps[strapName] = buildHookStrap(eventName, handlers)
      syntheticListenRules.push({ on: eventName, straps: [strapName] })
    }

    const augmentedScene: CompiledScene = {
      ...this.compiledScene,
      scene: {
        ...this.compiledScene.scene,
        listen: [...(this.compiledScene.scene.listen ?? []), ...syntheticListenRules],
      },
    }

    return { compiledScene: augmentedScene, augmentedStraps }
  }
}

/**
 * Crée un telco autour d'un BroadcastPlayer.
 * Passe l'inner Player directement à createTelco — il satisfait PlayerApi.
 * La boucle RAF pour onProgress est bundlée par défaut.
 */
export function telco(
  player: BroadcastPlayer,
  options?: { subscribeOnTick?: TickSubscriber }
): TelcoApi {
  const subscribeOnTick: TickSubscriber =
    options?.subscribeOnTick ??
    ((cb) => {
      const id = globalThis.requestAnimationFrame(cb)
      return () => { globalThis.cancelAnimationFrame(id) }
    })

  return createTelco(player._inner, { subscribeOnTick })
}
