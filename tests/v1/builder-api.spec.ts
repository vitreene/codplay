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
        entries: ['title-perso'],
        initial: undefined,
        persos: [
          {
            id: 'title-perso',
            type: 'text',
            initial: { content: 'hello' },
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

  it('returns blocking validation error when story entries are invalid', () => {
    const builder = new BuilderFacade()
    const invalidScene = createValidSceneFixture()
    invalidScene.stories['story-main'].entries = ['unknown-perso']

    const report = builder.validate({ scene: invalidScene })

    expect(report.ok).toBe(false)
    expect(report.errors.some((error) => error.code === 'AUTHOR_STORY_ENTRIES_INVALID')).toBe(true)
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

  it('returns a non-blocking warning when a child story is referenced by multiple parents', () => {
    const builder = new BuilderFacade()
    const scene = createValidSceneFixture()

    scene.stories['story-parent-a'] = {
      id: 'story-parent-a',
      entries: ['title-perso'],
      initial: undefined,
      persos: [
        {
          id: 'title-perso',
          type: 'text',
          initial: { content: 'parent-a' },
          actions: {
            'title-perso': null
          }
        }
      ],
      straps: undefined,
      listen: [],
      children: ['story-main']
    }

    scene.stories['story-parent-b'] = {
      id: 'story-parent-b',
      entries: ['title-perso-b'],
      initial: undefined,
      persos: [
        {
          id: 'title-perso-b',
          type: 'text',
          initial: { content: 'parent-b' },
          actions: {
            'title-perso-b': null
          }
        }
      ],
      straps: undefined,
      listen: [],
      children: ['story-main']
    }

    scene.rootStories = ['story-parent-a', 'story-parent-b']

    const report = builder.validate({ scene })

    expect(report.ok).toBe(true)
    expect(report.errors).toEqual([])
    expect(report.warnings.some((warning) => warning.code === 'AUTHOR_MULTI_PARENT_STORY')).toBe(true)
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
    expect(compiledScene.scene.stories['story-main'].entries).toEqual(['title-perso'])

    expect(resourceManifest).toEqual({ entries: [] })
    expect(diagnostics.warnings).toEqual([])

    scene.rootStories.push('new-root')
    expect(compiledScene.scene.rootStories).toEqual(['story-main'])
  })

  it('fails compile when validation contains blocking errors', () => {
    const builder = new BuilderFacade()
    const invalidScene = createValidSceneFixture()
    invalidScene.stories['story-main'].entries = ['missing-perso']

    const compileResult = builder.compile({ scene: invalidScene })

    expect(compileResult.ok).toBe(false)

    if (compileResult.ok) {
      return
    }

    expect(compileResult.error.code).toBe('AUTHOR_STORY_ENTRIES_INVALID')
  })
})
