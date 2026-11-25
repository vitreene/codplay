/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { CodPlay } from 'codplay'
import type { EditorScene, Item } from '../../src/app/commands/types'
import { buildSceneDocV2, EDITOR_V2_STORY_ID } from '../../src/builder-v2'
import { EDITOR_ENGINE_OPTIONS } from '../../src/item-presentation/engine-options'

/** Text item with the given pose keyframes. */
function textItem(id: string, parentId: string | null, order: string, keyframes: Item['keyframes'] = []): Item {
  return { id, type: 'text', parentId, order, visible: true, contentId: 'content', initialDecorId: 'decor', keyframes }
}

/** Scene shell owning its decor and text content. */
function sceneOf(items: Item[]): EditorScene {
  return {
    id: 'cut-entry-exit',
    meta: { title: 'Cut entry', durationMs: 6000, durationSource: 'arbitrary', timeUnit: 'ms', capsuleOrder: 'forward' },
    rootDecorId: 'decor',
    decors: { decor: { id: 'decor', style: {} } },
    contents: { content: { id: 'content', type: 'text', text: 'x' } },
    items,
    zones: {},
    markerTracks: {},
  }
}

describe('Builder — exit transition after an entry without style', () => {
  let owner: CodPlay | undefined
  afterEach(() => { owner?.destroy(); document.body.replaceChildren() })

  /** Builds, compiles and instantiates the scene in the real CodPlay V2 runtime. */
  function instantiate(scene: EditorScene) {
    const result = buildSceneDocV2(scene)
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics))
    owner = new CodPlay({ engine: EDITOR_ENGINE_OPTIONS })
    const compiled = owner.build({ scene: result.sceneDoc })
    if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics))
    const root = document.createElement('div')
    document.body.append(root)
    const instance = owner.instances.create({ instanceId: scene.id, ...compiled, root })
    return { result, instance }
  }

  it('starts the default fade-out from its resting opacity after an explicit cut entry', async () => {
    const { result, instance } = instantiate(sceneOf([textItem('item', null, 'a', [
      { id: 'in', timeMs: 500, decorId: 'decor', channel: 'pose', transitionIn: { kind: 'named', name: 'cut', durationMs: 0 } },
      { id: 'out', timeMs: 2000, decorId: 'decor', channel: 'pose' },
    ])]))
    const persos = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos
    const exit = Object.values(persos.find((perso) => perso.id === 'item')!.actions)
      .find((action) => (action as { style?: { opacity?: unknown } }).style?.opacity !== undefined)
    expect(exit).toMatchObject({ style: { opacity: { from: 1, to: 0, duration: 300 } } })
    await expect(instance.telco.seek(2150 + result.preRollMs)).resolves.not.toThrow()
  })

  it('plays a capsule whose edge children are fused (cut) through their default exits', async () => {
    const { result, instance } = instantiate(sceneOf([
      {
        id: 'cap', type: 'capsule', parentId: null, order: 'a', visible: true, contentId: null, initialDecorId: 'decor',
        keyframes: [{ id: 'cap-in', timeMs: 1000, decorId: 'decor', channel: 'pose' }, { id: 'cap-out', timeMs: 4000, decorId: 'decor', channel: 'pose' }],
        capsule: { kind: 'carousel', distribution: { mode: 'sequential' } },
      },
      textItem('free-a', 'cap', 'a'),
      textItem('free-b', 'cap', 'b'),
    ]))
    const capsule = result.sceneDoc.stories[EDITOR_V2_STORY_ID]!.persos.find((perso) => perso.id === 'cap')!
    expect(capsule.initial).toMatchObject({ style: { opacity: 0 } })
    for (const timeMs of [500, 1500, 2650, 3500, 4150, 4600]) {
      await expect(instance.telco.seek(timeMs + result.preRollMs)).resolves.not.toThrow()
    }
  })
})
