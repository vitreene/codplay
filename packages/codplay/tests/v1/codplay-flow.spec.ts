import { describe, expect, it } from 'vitest'

import { SceneDocEditor } from '../../../authoring/scene-factory/src/scene-doc-editor'
import { BuilderFacade } from '../../src/builder/create-builder'
import { Player } from '../../src/player'

function createPersoFixture() {
  return {
    id: 'title',
    name: 'title',
    type: 'tag',
    initial: { content: 'hello', move: '@root' },
    actions: {}
  }
}

function createStoryFixture() {
  const perso = createPersoFixture()
  return {
    id: 'story-main',
    name: 'main',
    initial: undefined,
    persos: [perso],
    straps: undefined,
    listen: [],
    init: () => undefined
  }
}

describe('V1 - CodPlay flow', () => {
  it('authoring scene exports, compiles, and initializes the player', async () => {
    const editor = new SceneDocEditor()

    expect(editor.create({ id: 'scene-main' })).toEqual({ ok: true, data: undefined })
    expect(editor.scene.rootStories.set({ value: ['story-main'] })).toEqual({ ok: true, data: undefined })
    expect(editor.upsertStory({ story: createStoryFixture() })).toEqual({ ok: true, data: undefined })

    const exportResult = editor.exportSceneDoc()
    expect(exportResult.ok).toBe(true)
    if (!exportResult.ok) return

    const builder = new BuilderFacade()
    const compileResult = builder.compile({ scene: exportResult.data })
    expect(compileResult.ok).toBe(true)
    if (!compileResult.ok) return

    const player = new Player()
    const initResult = await player.init({
      mountTarget: {},
      compiledScene: compileResult.data.compiledScene,
      resourceManifest: compileResult.data.resourceManifest
    })

    expect(initResult).toEqual({ ok: true })
    expect(player.getState()).toMatchObject({
      initialized: true,
      status: 'ready',
      sceneId: 'scene-main'
    })
  })
})
