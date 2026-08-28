import type { ApiResult, BuilderCompileOutput, ResourceManifest, SceneDef } from '../builder/types'
import { BuilderFacade } from '../builder/create-builder'
import { Player } from '../player'
import type { StoryEvent } from '../player'
import type { CreatePlayerOptions } from '../player/create-player'
import { createTelco } from '../telco/create-telco'
import type { TelcoApi } from '../telco/types'
import type { CodPlayApi, CodPlayLoadInput } from './types'

function createRafTickSubscriber(callback: () => void): () => void {
  const frameId = globalThis.requestAnimationFrame(callback)
  return () => { globalThis.cancelAnimationFrame(frameId) }
}

export class CodPlay implements CodPlayApi {
  private readonly builder = new BuilderFacade()
  readonly player: Player
  readonly telco: TelcoApi

  constructor(options: CreatePlayerOptions = {}) {
    this.player = new Player(options)
    this.telco = createTelco(this.player, { subscribeOnTick: createRafTickSubscriber })
  }

  /**
   * Compile la scène puis initialise le player en une seule opération.
   */
  async load(input: CodPlayLoadInput): Promise<ApiResult<BuilderCompileOutput>> {
    // SceneDoc (type auteur) et SceneDef (type builder) partagent la même structure mais leurs
    // hooks de cycle de vie ont des signatures incompatibles pour TypeScript. Le cast est isolé ici.
    const compileResult = this.builder.compile({ scene: input.scene as unknown as SceneDef })
    if (!compileResult.ok) return compileResult

    const { compiledScene, diagnostics } = compileResult.data
    const resourceManifest: ResourceManifest = input.extraResources?.length
      ? { entries: [...compileResult.data.resourceManifest.entries, ...input.extraResources] }
      : compileResult.data.resourceManifest

    const initResult = await this.player.init({
      mountTarget: input.mountTarget,
      compiledScene,
      resourceManifest,
      strapCollection: input.strapCollection,
      enableInteractionLock: input.enableInteractionLock,
      mode: input.mode,
    })
    if (!initResult.ok) return initResult

    return { ok: true, data: { compiledScene, resourceManifest, diagnostics } }
  }

  emit(input: StoryEvent): Promise<ApiResult<void>> {
    return this.player.emit(input)
  }
}
