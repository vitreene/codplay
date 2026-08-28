// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { BuilderFacade } from '../../src/builder/create-builder'
import { Player } from '../../src/player'
import type { SceneDef } from '../../src/builder/types'

/**
 * Conformance tests for PlayerApi.setNodePose (v1-author-api-spec.md): write-side symmetry of
 * getNodePose — writes a partial pose through anime.js (utils.set), immediately visible to a
 * subsequent getNodePose, only touching the keys present in the patch.
 */

function temp__createPosedSceneFixture(): SceneDef {
  return {
    id: 'scene-posed',
    initial: undefined,
    straps: undefined,
    listen: [],
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        initial: { move: '@root' },
        persos: [
          {
            id: 'item-1',
            name: 'item',
            type: 'tag',
            initial: {
              content: 'item',
              move: '@root',
              style: { x: 10, y: 20, rotate: 66, scaleX: 1, scaleY: 1, width: '100px', height: '50px' }
            },
            actions: {}
          }
        ],
        straps: undefined,
        listen: []
      }
    },
    tracks: {}
  }
}

async function temp__initPlayer(scene: SceneDef): Promise<Player> {
  const builder = new BuilderFacade()
  const compileResult = builder.compile({ scene })
  if (!compileResult.ok) {
    throw new Error('fixture scene failed to compile')
  }

  const mountTarget = document.createElement('div')
  const player = new Player()
  await player.init({
    mountTarget,
    compiledScene: compileResult.data.compiledScene,
    resourceManifest: compileResult.data.resourceManifest
  })
  return player
}

describe('V1 author-api - setNodePose', () => {
  it('writes a partial pose, immediately visible to a subsequent getNodePose', async () => {
    const player = await temp__initPlayer(temp__createPosedSceneFixture())

    player.setNodePose('item-1', { x: 42, rotate: 90 })

    expect(player.getNodePose('item-1')).toEqual({ x: 42, y: 20, rotate: 90, scaleX: 1, scaleY: 1, width: 100, height: 50 })
  })

  it('only touches the keys present in the patch — the rest of the pose stays untouched', async () => {
    const player = await temp__initPlayer(temp__createPosedSceneFixture())

    player.setNodePose('item-1', { width: 300 })

    expect(player.getNodePose('item-1')).toMatchObject({ x: 10, y: 20, rotate: 66, scaleX: 1, scaleY: 1, height: 50, width: 300 })
  })

  it('is a no-op when the persoId has no mounted node', async () => {
    const player = await temp__initPlayer(temp__createPosedSceneFixture())

    expect(() => player.setNodePose('unknown-perso', { x: 1 })).not.toThrow()
  })

  it('composes writes into style.transform (anime.js\'s own representation), never into discrete CSS properties — the mechanism 2026-07-18-pose-edit-architecture-study.md documents', async () => {
    const scene = temp__createPosedSceneFixture()
    const builder = new BuilderFacade()
    const compileResult = builder.compile({ scene })
    if (!compileResult.ok) {
      throw new Error('fixture scene failed to compile')
    }
    const mountTarget = document.createElement('div')
    const player = new Player()
    await player.init({
      mountTarget,
      compiledScene: compileResult.data.compiledScene,
      resourceManifest: compileResult.data.resourceManifest
    })
    const node = mountTarget.querySelector('#item-1') as HTMLElement

    player.setNodePose('item-1', { x: 5, y: 5 })

    expect(node.style.transform).toContain('translate(5px,5px)')
    expect(node.style.translate).toBe('')
  })
})
