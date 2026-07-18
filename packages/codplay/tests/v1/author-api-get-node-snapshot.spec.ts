// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'

import { BuilderFacade } from '../../src/builder/create-builder'
import { Player } from '../../src/player'
import type { SceneDef } from '../../src/builder/types'

/**
 * Conformance tests for PlayerApi.getNodeSnapshot (v1-author-api-spec.md) — generalization of
 * getNodePose to an arbitrary, caller-supplied property list, values returned as-is (no Number()
 * coercion, unlike getNodePose): always a string, unit-suffixed for lengths (confirmed empirically
 * — the 3-arg bare-number form of utils.get only works for anime's own fixed pose vocabulary).
 */

function temp__createStyledSceneFixture(): SceneDef {
  return {
    id: 'scene-styled',
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
              style: { x: 10, y: 20, 'background-color': 'oklch(0.6 0.24 25)', 'border-width': '8px' }
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

describe('V1 author-api - getNodeSnapshot', () => {
  it('reads an arbitrary property set resolved by anime.js — color and length both as CSS strings', async () => {
    const player = await temp__initPlayer(temp__createStyledSceneFixture())

    const snapshot = player.getNodeSnapshot('item-1', ['background-color', 'x'])

    expect(snapshot?.['background-color']).toBe('oklch(0.6 0.24 25)')
    expect(snapshot?.x).toBe('10px')
  })

  it('returns a length outside anime\'s own pose vocabulary unit-suffixed', async () => {
    const player = await temp__initPlayer(temp__createStyledSceneFixture())

    const snapshot = player.getNodeSnapshot('item-1', ['border-width'])

    expect(snapshot?.['border-width']).toBe('8px')
  })

  it('omits a property anime cannot resolve at all (not a real CSS property) rather than erroring', async () => {
    const player = await temp__initPlayer(temp__createStyledSceneFixture())

    const snapshot = player.getNodeSnapshot('item-1', ['background-color', 'not-a-real-property'])

    expect(Object.keys(snapshot ?? {})).toEqual(['background-color'])
  })

  it('returns null when the persoId has no mounted node', async () => {
    const player = await temp__initPlayer(temp__createStyledSceneFixture())

    expect(player.getNodeSnapshot('unknown-perso', ['background-color'])).toBeNull()
  })

  it('keeps reading the correct values from the fresh node after a full rebuild (destroy + re-init)', async () => {
    const scene = temp__createStyledSceneFixture()
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
    expect(player.getNodeSnapshot('item-1', ['background-color'])?.['background-color']).toBe('oklch(0.6 0.24 25)')
  })
})
