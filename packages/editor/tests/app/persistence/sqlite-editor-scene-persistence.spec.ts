import { rawSql } from 'remix/data-table'
import { afterEach, describe, expect, it } from 'vitest'
import type { EditorScene } from '../../../src/app/commands/types'
import { createEditorSceneApiRouter } from '../../../src/server/projects/editor-scene-api-router'
import { openEditorDatabase } from '../../../src/server/projects/sqlite/editor-database'
import { SqliteEditorScenePersistence } from '../../../src/server/projects/sqlite/sqlite-editor-scene-persistence'
import type { SqliteDatabase } from 'remix/data-table/sqlite'

describe('SQLite EditorScene persistence', () => {
  let database: SqliteDatabase | undefined

  afterEach(async () => {
    await database?.close()
    database = undefined
  })

  it('migrates a fresh database, round-trips complete scenes, and rejects stale writes', async () => {
    database = await openEditorDatabase(':memory:')
    const persistence = new SqliteEditorScenePersistence(database)
    const router = createEditorSceneApiRouter(persistence)
    const scenes = [createSceneFixture(), createSingleCellSceneFixture()]

    await database.exec(rawSql(`
      INSERT INTO media_resources (
        media_id, name, mime_type, size_bytes, content_sha256, storage_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, ['media-local-1', 'voice.webm', 'audio/webm', 2048, 'sha256-test', 'media/voice.webm', '2026-10-28T00:00:00.000Z']))

    for (const scene of scenes) {
      const saved = await router.fetch(jsonRequest('PUT', `/api/scenes/${scene.id}`, {
        scene,
        expectedRevision: null,
      }))
      expect(saved.status).toBe(200)
      expect(await saved.json()).toEqual({ kind: 'saved', revision: 0 })

      const opened = await router.fetch(new Request(`http://editor.test/api/scenes/${scene.id}`))
      expect(opened.status).toBe(200)
      expect(await opened.json()).toEqual({ scene, revision: 0 })
    }

    const firstScene = scenes[0]!
    const revisedScene: EditorScene = {
      ...firstScene,
      meta: { ...firstScene.meta, title: 'Scène révisée' },
    }
    const revised = await router.fetch(jsonRequest('PUT', `/api/scenes/${firstScene.id}`, {
      scene: revisedScene,
      expectedRevision: 0,
    }))
    expect(revised.status).toBe(200)
    expect(await revised.json()).toEqual({ kind: 'saved', revision: 1 })

    const stale = await router.fetch(jsonRequest('PUT', `/api/scenes/${firstScene.id}`, {
      scene: firstScene,
      expectedRevision: 0,
    }))
    expect(stale.status).toBe(409)
    expect(await stale.json()).toMatchObject({ kind: 'conflict', currentRevision: 1 })

    const catalogue = await router.fetch(new Request('http://editor.test/api/scenes'))
    expect(await catalogue.json()).toEqual({
      scenes: [
        { id: 'scene-root-one-cell', title: 'Racine une cellule', revision: 0 },
        { id: 'scene-author-complete', title: 'Scène révisée', revision: 1 },
      ],
      activeSceneId: 'scene-author-complete',
    })
  })
})

/** Creates a complete author document with nested capsules, zones, media, cues, markers and opaque decor. */
function createSceneFixture(): EditorScene {
  return {
    id: 'scene-author-complete',
    meta: {
      title: 'Scène auteur complète',
      durationMs: 8000,
      durationSource: 'mixed',
      timeUnit: 'ms',
      capsuleOrder: 'backward',
      sceneState: { theme: 'night', nested: { enabled: true } },
      hooks: { onStart: 'start-scene', onSequenceEnd: 'finish-scene' },
    },
    items: [
      {
        id: 'capsule-outer',
        type: 'capsule',
        label: 'Capsule extérieure',
        parentId: null,
        order: 'a0',
        visible: true,
        contentId: null,
        initialDecorId: 'decor-outer',
        keyframes: [],
        capsule: {
          kind: 'card',
          distribution: { mode: 'stagger', staggerInMs: 120, staggerOutMs: 240 },
          grid: { rows: 4, cols: 6, gap: { row: 2, col: 3 } },
          defaultTransitionIn: 'fade',
          defaultTransitionOut: 'swipe-left',
          behavior: 'preserve-order',
        },
      },
      {
        id: 'capsule-inner',
        type: 'capsule',
        parentId: 'capsule-outer',
        order: 'a0',
        visible: true,
        contentId: null,
        initialDecorId: 'decor-inner',
        keyframes: [],
        capsule: {
          kind: 'grille',
          distribution: { mode: 'sequential' },
          grid: { rows: 8, cols: 12 },
        },
      },
      {
        id: 'item-media',
        type: 'media',
        label: 'Voix source',
        parentId: 'capsule-inner',
        order: 'a0',
        visible: true,
        contentId: 'content-media',
        initialDecorId: 'decor-media-initial',
        keyframes: [
          {
            id: 'kf-media-start',
            timeMs: 0,
            channel: 'pose',
            decorId: 'decor-media-start',
            transitionIn: { kind: 'named', name: 'fade', durationMs: 300 },
            name: 'entrée',
            markerId: 'marker-start',
          },
          {
            id: 'kf-media-end',
            timeMs: 8000,
            channel: 'decor',
            decorId: 'decor-media-end',
            transitionOut: {
              kind: 'interpolated',
              durationMs: 500,
              easing: { kind: 'cubic-bezier', p1x: 0.2, p1y: 0.4, p2x: 0.8, p2y: 0.9 },
              direction: 'before',
            },
          },
        ],
      },
      {
        id: 'item-root',
        type: 'text',
        parentId: null,
        order: 'a1',
        visible: false,
        contentId: 'content-text',
        initialDecorId: 'decor-root-item',
        keyframes: [],
      },
    ],
    contents: {
      'content-media': {
        id: 'content-media',
        type: 'media',
        source: 'https://media.example.test/voice.webm',
        mediaId: 'media-local-1',
        lang: 'fr',
        waveform: {
          version: 1,
          sampleRate: 48000,
          durationSec: 8,
          points: 2,
          min: [-0.2, -0.1],
          max: [0.4, 0.3],
        },
        cues: [
          { id: 'cue-1', timeMs: 125, text: 'Bonjour' },
          { id: 'cue-2', timeMs: 900, text: 'tout' },
        ],
      },
      'content-text': {
        id: 'content-text',
        type: 'text',
        text: 'Repère racine',
        textAutoSize: { enabled: true },
      },
    },
    decors: {
      'decor-outer': { id: 'decor-outer', style: { color: 'white' } },
      'decor-inner': { id: 'decor-inner', style: { 'background-color': 'navy' } },
      'decor-media-initial': { id: 'decor-media-initial', zoneId: 'zone-inner' },
      'decor-media-start': {
        id: 'decor-media-start',
        zoneId: 'zone-inner',
        style: { 'font-size': '7.5cqw', color: 'white' },
        offset: { translate: { x: 12.5, y: 4 }, rotate: 17.25, width: 35, height: 18 },
        futureCapability: { source: 'author', values: [1, 2, 3] },
      },
      'decor-media-end': {
        id: 'decor-media-end',
        zoneId: 'zone-inner',
        style: { 'font-size': '9cqw', color: 'gold' },
        custom: 'filter: saturate(0.8);',
      },
      'decor-root-item': { id: 'decor-root-item', zoneId: 'zone-root', offset: { width: 15, height: 12 } },
      'decor-root': { id: 'decor-root', style: { 'background-color': 'black' } },
    },
    zones: {
      'zone-root': {
        id: 'zone-root',
        capsuleId: null,
        name: 'root-area',
        surfaces: {
          landscape: { row: 1, col: 1, rowSpan: 90, colSpan: 160 },
          portrait: { row: 1, col: 1, rowSpan: 160, colSpan: 90 },
        },
      },
      'zone-outer': {
        id: 'zone-outer',
        capsuleId: 'capsule-outer',
        name: 'outer-area',
        surfaces: {
          landscape: { row: 2, col: 3, rowSpan: 2, colSpan: 3 },
          portrait: { row: 3, col: 2, rowSpan: 4, colSpan: 2 },
        },
        container: {
          grid: { rows: 2, cols: 2, gap: { row: 1, col: 1 } },
          children: [{ row: 1, col: 1, rowSpan: 1, colSpan: 2 }],
        },
      },
      'zone-inner': {
        id: 'zone-inner',
        capsuleId: 'capsule-inner',
        name: 'inner-area',
        surfaces: {
          landscape: { row: 1, col: 2, rowSpan: 3, colSpan: 5 },
          portrait: { row: 2, col: 1, rowSpan: 5, colSpan: 3 },
        },
      },
    },
    markerTracks: {
      'markers-main': {
        id: 'markers-main',
        label: 'Repères',
        color: '#d34e4e',
        visible: true,
        markers: [{ id: 'marker-start', timeMs: 0, label: 'Début' }],
      },
    },
    rootDecorId: 'decor-root',
    rootCapsule: {
      kind: 'card',
      distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 60 },
      grid: { rows: 90, cols: 160 },
      defaultTransitionIn: 'fade',
      defaultTransitionOut: 'fade',
    },
    masterItemId: 'item-media',
  }
}

/** Creates the same author fixture with the single-cell root grid mode. */
function createSingleCellSceneFixture(): EditorScene {
  const scene = createSceneFixture()
  return {
    ...scene,
    id: 'scene-root-one-cell',
    meta: { ...scene.meta, title: 'Racine une cellule' },
    zones: {
      ...scene.zones,
      'zone-root': {
        ...scene.zones['zone-root']!,
        surfaces: {
          landscape: { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
          portrait: { row: 1, col: 1, rowSpan: 1, colSpan: 1 },
        },
      },
    },
    rootCapsule: {
      ...scene.rootCapsule!,
      grid: { rows: 1, cols: 1 },
    },
  }
}

/** Creates a JSON request with the API's local origin. */
function jsonRequest(method: string, path: string, body: unknown): Request {
  return new Request(`http://editor.test${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
