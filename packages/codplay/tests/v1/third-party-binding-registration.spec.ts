import { describe, expect, it } from 'vitest'

import { SceneDocEditor } from '../../../authoring/scene-factory/src/scene-doc-editor'
import { BuilderFacade } from '../../src/builder/create-builder'
import { Player } from '../../src/player'
import { PlayerFacade } from '../../src/player/create-player'
import type { RenderAdapter } from '../../src/player/render-adapter-types'
import type { RuntimeComponentClass } from '../../src/runtime/components'
import type { ThirdPartyBinding } from '../../src/player/third-party-binding'

/**
 * Never instantiated — registration only checks the constructor's identity
 * against the registry's duplicate guard, so the shape doesn't need to be a
 * real working component.
 */
const StubComponent = class {} as unknown as RuntimeComponentClass

function makeRenderAdapter(): RenderAdapter & { rateChanges: number[] } {
  const rateChanges: number[] = []
  return {
    tick() {},
    seek() {},
    rateChange(rate) { rateChanges.push(rate) },
    rateChanges,
  }
}

describe('CreatePlayerOptions.bindings — expands into the same registries as components/renderAdapters', () => {
  it('registers binding.components into the same component registry as options.components', () => {
    const binding: ThirdPartyBinding = {
      components: { 'stub-binding-type': StubComponent },
    }
    const facade = new PlayerFacade({ bindings: [binding] })

    // Re-registering the same type must hit the duplicate guard — proof the
    // binding's component already occupies that slot.
    const result = facade.component.register({ type: 'stub-binding-type', component: StubComponent })

    expect(result).toMatchObject({
      ok: false,
      error: { code: 'RUNTIME_COMPONENT_ALREADY_REGISTERED' },
    })
  })

  it('includes binding.renderAdapter in the same RenderSync as options.renderAdapters', () => {
    const adapter = makeRenderAdapter()
    const binding: ThirdPartyBinding = {
      components: {},
      renderAdapter: adapter,
    }
    const facade = new PlayerFacade({ bindings: [binding] })

    facade.setRate(2)

    expect(adapter.rateChanges).toContain(2)
  })
})

describe('CreatePlayerOptions.bindings — preload strategy registration (Player level)', () => {
  function createMinimalCompiledScene() {
    const editor = new SceneDocEditor()
    editor.create({ id: 'scene-binding-preload' })
    editor.scene.rootStories.set({ value: ['story-main'] })
    editor.upsertStory({
      story: {
        id: 'story-main',
        name: 'main',
        initial: undefined,
        persos: [{ id: 'title', name: 'title', type: 'tag', initial: { content: 'hello', move: '@root' }, actions: {} }],
        straps: undefined,
        listen: [],
        init: () => undefined,
      },
    })
    const exportResult = editor.exportSceneDoc()
    if (!exportResult.ok) throw new Error('fixture export failed')
    const compileResult = new BuilderFacade().compile({ scene: exportResult.data })
    if (!compileResult.ok) throw new Error('fixture compile failed')
    return compileResult.data.compiledScene
  }

  it('dispatches a resource of a non-built-in type to the strategy registered via binding.preload', async () => {
    const seenUrls: string[] = []
    const binding: ThirdPartyBinding = {
      components: {},
      preload: [
        {
          type: 'stub-binding-resource',
          load: async (url) => { seenUrls.push(url) },
        },
      ],
    }

    const player = new Player({ bindings: [binding] })
    const result = await player.init({
      mountTarget: {},
      compiledScene: createMinimalCompiledScene(),
      resourceManifest: {
        entries: [
          { url: 'stub://resource-1', type: 'stub-binding-resource', policy: { cache: 'default' } },
        ],
      },
    })

    expect(result).toEqual({ ok: true })
    expect(seenUrls).toEqual(['stub://resource-1'])
  })

  it('fails the resource with a clear error when no strategy is registered for its type', async () => {
    const player = new Player()
    const result = await player.init({
      mountTarget: {},
      compiledScene: createMinimalCompiledScene(),
      mode: 'author',
      resourceManifest: {
        entries: [
          { url: 'stub://resource-2', type: 'unregistered-type', policy: { cache: 'default' } },
        ],
      },
    })

    expect(result.ok).toBe(false)
  })
})
