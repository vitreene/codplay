import { describe, expect, it } from 'vitest'

import { PlayerFacade } from '../../src/player/create-player'
import {
  createS1CanariScene,
  createS2ReferenceScene,
  createS3RobustesseScene
} from '../../src/demos/scenes'

type RuntimeNodeFixture = {
  tagName: string
  style: Record<string, unknown>
  attributes: Record<string, unknown>
  className?: string
  textContent?: string
}

/**
 * Creates one plain runtime node fixture for one authored perso.
 */
function createRuntimeNodeFixture(tagName: string): RuntimeNodeFixture {
  return {
    tagName,
    style: {},
    attributes: {}
  }
}

describe('V1 - reference scenes', () => {
  it('loads S1 canari scene through the current player path', async () => {
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    const initResult = await player.init(createS1CanariScene())

    expect(initResult.ok).toBe(true)
    expect(player.getState()).toMatchObject({
      initialized: true,
      status: 'ready',
      sceneId: 's1-canari-scene',
      activeStoryId: 's1-canari-story'
    })
    expect(player.getRuntimeRegistry().getNodeById('canari-title')).not.toBeNull()
  })

  it('loads S2 reference scene with deterministic list child mounting', async () => {
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    const initResult = await player.init(createS2ReferenceScene())

    expect(initResult.ok).toBe(true)

    const referenceList = player.getRuntimeRegistry().getListById('reference-list')
    expect(referenceList?.getChildrenSnapshot()).toEqual(['reference-title', 'reference-caption'])
  })

  it('starts S2 reference scene only when play triggers onStart', async () => {
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    const initResult = await player.init(createS2ReferenceScene())

    expect(initResult.ok).toBe(true)

    const listNodeBeforePlay = player.getRuntimeRegistry().getNodeById('reference-list') as RuntimeNodeFixture | null
    expect(listNodeBeforePlay?.className).toBe('reference-list')

    const playResult = await player.play()
    expect(playResult.ok).toBe(true)

    const listNodeAfterPlay = player.getRuntimeRegistry().getNodeById('reference-list') as RuntimeNodeFixture | null
    expect(listNodeAfterPlay?.className).toContain('reference-list-live')
  })

  it('loads S3 robustness scene and keeps transfer-ready list state', async () => {
    const player = new PlayerFacade({
      createElementOptions: {
        nodeFactory: (perso) => createRuntimeNodeFixture(perso.type === 'list' ? 'SECTION' : 'DIV')
      }
    })

    const initResult = await player.init(createS3RobustesseScene())

    expect(initResult.ok).toBe(true)

    const registry = player.getRuntimeRegistry()
    expect(registry.getListById('robust-stage')?.getChildrenSnapshot()).toEqual(['robust-card'])
    expect(registry.getListById('robust-overlay')?.getChildrenSnapshot()).toEqual([])
    expect(registry.getParentListId('robust-card')).toBe('robust-stage')
    expect(registry.isMounted('robust-card')).toBe(true)
  })
})
