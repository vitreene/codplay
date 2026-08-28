// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { BuilderFacade } from '../../src/builder/create-builder'
import { Player } from '../../src/player'
import type { SceneDef } from '../../src/builder/types'

/**
 * Conformance tests for PlayerApi.getNodePose (v1-author-api-spec.md):
 * reads the pose anime.js resolved for a perso's node, survives a full
 * rebuild (new node, same persoId), returns null once the perso has no node.
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

describe('V1 author-api - getNodePose', () => {
  it('reads the pose anime.js resolved from the perso\'s authored style', async () => {
    const player = await temp__initPlayer(temp__createPosedSceneFixture())

    expect(player.getNodePose('item-1')).toEqual({ x: 10, y: 20, rotate: 66, scaleX: 1, scaleY: 1, width: 100, height: 50 })
  })

  it('returns null when the persoId has no mounted node', async () => {
    const player = await temp__initPlayer(temp__createPosedSceneFixture())

    expect(player.getNodePose('unknown-perso')).toBeNull()
  })

  it('keeps reading the correct pose from the fresh node after a full rebuild (destroy + re-init) — the exact scenario a discrete-CSS-property read loses', async () => {
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
    const firstNode = mountTarget.querySelector('#item-1')

    await player.destroy()
    await player.init({
      mountTarget,
      compiledScene: compileResult.data.compiledScene,
      resourceManifest: compileResult.data.resourceManifest
    })
    const secondNode = mountTarget.querySelector('#item-1')

    expect(secondNode).not.toBe(firstNode)
    expect(player.getNodePose('item-1')).toEqual({ x: 10, y: 20, rotate: 66, scaleX: 1, scaleY: 1, width: 100, height: 50 })
  })
})
