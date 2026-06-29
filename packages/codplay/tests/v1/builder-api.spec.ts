import { describe, expect, it } from 'vitest'

import { BuilderFacade } from '../../src/builder/create-builder'
import type { SceneDef } from '../../src/builder/types'

/**
 * Creates one valid minimal V1 scene fixture.
 */
function createValidSceneFixture(): SceneDef {
  return {
    id: 'scene-fixture',
    rootStories: ['story-main'],
    initial: undefined,
    straps: undefined,
    listen: [
      {
        on: 'sequence:start',
        emit: [{ name: 'story-main' }]
      }
    ],
    tracks: {},
    stories: {
      'story-main': {
        id: 'story-main',
        name: 'main',
        initial: undefined,
        persos: [
          {
            id: 'title-perso',
            name: 'title-perso',
            type: 'tag',
            initial: { content: 'hello', move: '@root' },
            actions: {
              'title-perso': null
            }
          }
        ],
        straps: undefined,
        listen: []
      }
    }
  }
}

describe('Builder API V1', () => {
  it('returns blocking validation error when rootStories is missing or invalid', () => {
    const builder = new BuilderFacade()
    const invalidScene = createValidSceneFixture()
    invalidScene.rootStories = []

    const report = builder.validate({ scene: invalidScene })

    expect(report.ok).toBe(false)
    expect(report.errors.some((error) => error.code === 'AUTHOR_ROOT_STORIES_INVALID')).toBe(true)
  })

  it('returns blocking validation error when scene listen.on contains duplicates', () => {
    const builder = new BuilderFacade()
    const invalidScene = createValidSceneFixture()
    invalidScene.listen = [
      { on: 'sequence:start' },
      { on: 'sequence:start' }
    ]

    const report = builder.validate({ scene: invalidScene })

    expect(report.ok).toBe(false)
    expect(report.errors.some((error) => error.code === 'AUTHOR_DUPLICATE_LISTEN_ON')).toBe(true)
  })

  it('returns blocking validation error when one story or perso identity is invalid', () => {
    const builder = new BuilderFacade()
    const invalidScene = createValidSceneFixture()
    invalidScene.stories['story-main'].name = ' '
    invalidScene.stories['story-main'].persos[0].name = ''

    const report = builder.validate({ scene: invalidScene })

    expect(report.ok).toBe(false)
    expect(report.errors.some((error) => error.code === 'AUTHOR_IDENTITY_INVALID')).toBe(true)
  })

  it('returns blocking validation error when tracks is not a plain object', () => {
    const builder = new BuilderFacade()
    const invalidScene = createValidSceneFixture()
    invalidScene.tracks = [] as unknown as Record<string, unknown>

    const report = builder.validate({ scene: invalidScene })

    expect(report.ok).toBe(false)
    expect(report.errors.some((error) => error.code === 'AUTHOR_TRACKS_INVALID')).toBe(true)
  })

  it('compiles one valid scene while preserving story and perso names', () => {
    const builder = new BuilderFacade()
    const scene = createValidSceneFixture()

    const compileResult = builder.compile({ scene })
    expect(compileResult.ok).toBe(true)

    if (!compileResult.ok) {
      return
    }

    expect(compileResult.data.compiledScene.scene.stories['story-main']).toMatchObject({
      name: 'main',
      persos: [
        {
          id: 'title-perso',
          name: 'title-perso'
        }
      ]
    })
  })

  it('keeps compiled names immutable after source mutation', () => {
    const builder = new BuilderFacade()
    const scene = createValidSceneFixture()

    const compileResult = builder.compile({ scene })
    expect(compileResult.ok).toBe(true)

    if (!compileResult.ok) {
      return
    }

    scene.stories['story-main'].name = 'mutated-story'
    scene.stories['story-main'].persos[0].name = 'mutated-perso'

    expect(compileResult.data.compiledScene.scene.stories['story-main']).toMatchObject({
      name: 'main',
      persos: [
        {
          id: 'title-perso',
          name: 'title-perso'
        }
      ]
    })
  })

  it('compiles one valid scene with schemaVersion, createdAt and stable scene payload', () => {
    const builder = new BuilderFacade({ schemaVersion: 'v1-test' })
    const scene = createValidSceneFixture()

    const compileResult = builder.compile({ scene })

    expect(compileResult.ok).toBe(true)

    if (!compileResult.ok) {
      return
    }

    const { compiledScene, resourceManifest, diagnostics } = compileResult.data

    expect(compiledScene.schemaVersion).toBe('v1-test')
    expect(compiledScene.createdAt).toMatch(/\d{4}-\d{2}-\d{2}T/)
    expect(compiledScene.scene.id).toBe(scene.id)
    expect(compiledScene.scene.rootStories).toEqual(scene.rootStories)

    expect(resourceManifest).toEqual({ entries: [] })
    expect(diagnostics.warnings).toEqual([])

    scene.rootStories.push('new-root')
    expect(compiledScene.scene.rootStories).toEqual(['story-main'])
  })

  it('fails compile when validation contains blocking errors', () => {
    const builder = new BuilderFacade()
    const invalidScene = createValidSceneFixture()
    invalidScene.rootStories = []

    const compileResult = builder.compile({ scene: invalidScene })

    expect(compileResult.ok).toBe(false)

    if (compileResult.ok) {
      return
    }

    expect(compileResult.error.code).toBe('AUTHOR_ROOT_STORIES_INVALID')
  })
})
