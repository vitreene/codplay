import { describe, expect, it } from 'vitest'

import { CodPlay } from '../../src'

/**
 * Creates one minimal strict perso fixture for end-to-end flow checks.
 */
function createPersoFixture() {
  return {
    id: 'title',
    type: 'text',
    initial: {
      content: 'hello'
    },
    actions: {}
  }
}

/**
 * Creates one minimal story fixture for end-to-end flow checks.
 */
function createStoryFixture() {
  const perso = createPersoFixture()

  return {
    id: 'story-main',
    children: [],
    entries: [perso.id],
    initial: undefined,
    persos: [perso],
    straps: undefined,
    listen: [],
    init: () => undefined
  }
}

describe('V1 - CodPlay flow', () => {
  it('authoring scene exports, compiles, and initializes the player', async () => {
    const studio = new CodPlay()

    expect(studio.create({ id: 'scene-main' })).toEqual({ ok: true, data: undefined })
    expect(studio.scene.rootStories.set({ value: ['story-main'] })).toEqual({ ok: true, data: undefined })
    expect(studio.upsertStory({ story: createStoryFixture() })).toEqual({ ok: true, data: undefined })

    const exportResult = studio.exportSceneDoc()
    expect(exportResult.ok).toBe(true)

    if (!exportResult.ok) {
      return
    }

    const compileResult = studio.builder.compile({ scene: exportResult.data })
    expect(compileResult.ok).toBe(true)

    if (!compileResult.ok) {
      return
    }

    const initResult = await studio.player.init({
      mountTarget: {},
      compiledScene: compileResult.data.compiledScene,
      resourceManifest: compileResult.data.resourceManifest
    })

    expect(initResult).toEqual({ ok: true })
    expect(studio.player.getState()).toMatchObject({
      initialized: true,
      status: 'ready',
      sceneId: 'scene-main'
    })
  })
})
