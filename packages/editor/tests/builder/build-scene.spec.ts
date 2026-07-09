import { describe, expect, it } from 'vitest'
import { BuilderFacade } from 'codplay/builder/create-builder'
import { buildSceneDoc } from '../../src/builder/build-scene'
import type { EditorScene } from '../../src/sequence-editor/types'

function fixtureScene(): EditorScene {
  return {
    id: 'ed2-demo-scene',
    title: 'ed2 demo',
    durationMs: 3000,
    durationSource: 'arbitrary',
    decors: {
      'root-decor': { id: 'root-decor', data: { style: { background: '#1a1a2e' } } },
      'text-decor': { id: 'text-decor', data: { content: 'Bonjour ed2', style: { color: '#ffffff', fontSize: '2rem' } } },
    },
    rootDecorId: 'root-decor',
    tracks: [
      {
        id: 'item-1',
        kind: 'element',
        label: 'Texte',
        visible: true,
        contentType: 'text',
        keyframes: [
          { id: 'kf-intro', timeMs: 0, decorId: 'text-decor', transitionIn: { kind: 'named', name: 'fade', durationMs: 400 } },
          { id: 'kf-outro', timeMs: 3000, decorId: null, transitionOut: { kind: 'named', name: 'fade', durationMs: 400 } },
        ],
      },
    ],
    cues: [],
    markerTracks: [],
  }
}

describe('buildSceneDoc — minimal increment (one item, root capsule, fade)', () => {
  it('builds a root capsule perso, moved at @root, list type, with the resolved decor style', () => {
    const { sceneDoc } = buildSceneDoc(fixtureScene())
    const story = sceneDoc.stories['story-main']!
    const root = story.persos.find((p) => p.id === 'story-main__root')!

    expect(root.type).toBe('list')
    expect(root.initial).toMatchObject({ move: '@root', style: { background: '#1a1a2e' } })
    expect(root.actions).toEqual({})
  })

  it('carries the ac-scene-root class (bridges to the real host container) and its dedicated CSS rule — never as inline style', () => {
    const { sceneDoc, styleSheet } = buildSceneDoc(fixtureScene())
    const root = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'story-main__root')!

    expect((root.initial as { className?: string }).className!.split(' ')).toContain('ac-scene-root')
    expect(root.initial).not.toHaveProperty(['style', 'width'])
    expect(root.initial).not.toHaveProperty(['style', 'height'])
    expect(styleSheet).toContain('.ac-scene-root{width:100%;height:100%;grid-area:1/-1;min-width:0;min-height:0;overflow:hidden;}')
  })

  it('builds the item perso as a child of the root capsule, flip:false, placed on the ghost zone (full grid surface)', () => {
    const { sceneDoc } = buildSceneDoc(fixtureScene())
    const story = sceneDoc.stories['story-main']!
    const item = story.persos.find((p) => p.id === 'item-1')!

    expect(item.type).toBe('text')
    expect(item.initial).toMatchObject({
      move: { parentId: 'story-main__root', flip: false },
      // Root capsule is `card` with zero named zones — no explicit placement given, so this
      // resolves to the ghost zone: the full resolved grid (9x16, card's own type default).
      // `ed2-style-check` rides alongside it — a visual-proof marker, not a real placement class.
      className: 'ac-cell-r1-c1-rs9-cs16 ed2-style-check',
      content: 'Bonjour ed2',
      // `opacity: 0` comes from the resolved `fade` transition's own `from` value, not a
      // hardcoded Builder default — matching whatever named transition the keyframe chose.
      style: { opacity: 0, color: '#ffffff', fontSize: '2rem' },
    })
  })

  it('declares intro/outro as named actions on the perso, resolved from the keyframes\' own named transition — never as eventime payload (Principe A)', () => {
    const { sceneDoc } = buildSceneDoc(fixtureScene())
    const story = sceneDoc.stories['story-main']!
    const item = story.persos.find((p) => p.id === 'item-1')!

    // durationMs (400) comes from the keyframe's own `transitionIn/Out.durationMs`, overriding
    // the `fade` catalog default (300) — an author choice, not a Builder-invented value.
    expect(item.actions['item-1-intro']).toEqual({ style: { opacity: { from: 0, to: 1, duration: 400 } } })
    expect(item.actions['item-1-outro']).toEqual({ style: { opacity: { to: 0, duration: 400 } } })
  })

  it('eventimes are pure triggers — a name and a startAt, no data', () => {
    const { sceneDoc } = buildSceneDoc(fixtureScene())
    const story = sceneDoc.stories['story-main']!

    expect(story.eventimes).toEqual([
      { name: 'item-1-intro', startAt: 0 },
      { name: 'item-1-outro', startAt: 3000 },
    ])
  })

  it('compiles cleanly through the real Codplay BuilderFacade', () => {
    const { sceneDoc } = buildSceneDoc(fixtureScene())
    const compileResult = new BuilderFacade().compile({ scene: sceneDoc })
    expect(compileResult.ok).toBe(true)
  })

  it('emits the resolved grid + ghost-zone placement CSS — meant for Blob/extraResources, never inline', () => {
    const { sceneDoc, styleSheet } = buildSceneDoc(fixtureScene())
    const root = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'story-main__root')!

    // The grid layout itself is never inline on the root perso's own style — only its class.
    expect(root.initial).not.toHaveProperty(['style', 'display'])
    expect(styleSheet).toContain('.ac-grid-card-9x16-manual{display:grid;')
    expect(styleSheet).toContain('.ac-cell-r1-c1-rs9-cs16{grid-row:1 / span 9;grid-column:1 / span 16;}')
  })

  it('also emits the visual-proof marker rule, appended alongside the real capsule-automation CSS', () => {
    const { styleSheet } = buildSceneDoc(fixtureScene())
    expect(styleSheet).toContain('.ed2-style-check{box-sizing:border-box;border:4px dashed #f7b32b;}')
  })
})

/**
 * Step 6 (`2026-07-08-builder-plan.md`, nested capsule) — 2 levels deep, mixing capsule types:
 * root (card) -> capsule-a (grille, own show/hide transition) -> [capsule-b (liste), item-flat]
 *                                                                    -> item-nested
 * `capsule-a` and `capsule-b` are BOTH `kind: 'capsule'`, each resolving its own grid/timing via
 * `resolveCapsule` — confirms the worklist recurses past one level, not just root -> leaf.
 */
function nestedFixtureScene(): EditorScene {
  return {
    id: 'ed2-nested-demo-scene',
    title: 'ed2 nested demo',
    durationMs: 3000,
    durationSource: 'arbitrary',
    decors: {},
    rootDecorId: null,
    tracks: [
      {
        id: 'capsule-a',
        kind: 'capsule',
        label: 'Capsule A',
        visible: true,
        capsuleType: 'grille',
        // Required for any non-carousel type (CapsulePreset.resolve — no structural default).
        distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 },
        keyframes: [
          { id: 'kf-a-intro', timeMs: 0, decorId: null, transitionIn: { kind: 'named', name: 'fade', durationMs: 300 } },
          { id: 'kf-a-outro', timeMs: 3000, decorId: null, transitionOut: { kind: 'named', name: 'fade', durationMs: 300 } },
        ],
        children: [
          {
            id: 'capsule-b',
            kind: 'capsule',
            label: 'Capsule B',
            visible: true,
            capsuleType: 'liste',
            distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 },
            keyframes: [{ id: 'kf-b-intro', timeMs: 0, decorId: null }],
            children: [
              {
                id: 'item-nested',
                kind: 'element',
                label: 'Item nested',
                visible: true,
                contentType: 'text',
                keyframes: [{ id: 'kf-nested', timeMs: 0, decorId: null }],
              },
            ],
          },
          {
            id: 'item-flat',
            kind: 'element',
            label: 'Item flat',
            visible: true,
            contentType: 'text',
            keyframes: [{ id: 'kf-flat', timeMs: 0, decorId: null }],
          },
        ],
      },
    ],
    cues: [],
    markerTracks: [],
  }
}

describe('buildSceneDoc — nested capsule (2 levels deep, mixed capsule types)', () => {
  it('builds a perso for each capsule level (root, capsule-a, capsule-b), each type list', () => {
    const { sceneDoc } = buildSceneDoc(nestedFixtureScene())
    const story = sceneDoc.stories['story-main']!

    const root = story.persos.find((p) => p.id === 'story-main__root')!
    const capsuleA = story.persos.find((p) => p.id === 'capsule-a')!
    const capsuleB = story.persos.find((p) => p.id === 'capsule-b')!

    expect(root.type).toBe('list')
    expect(capsuleA.type).toBe('list')
    expect(capsuleB.type).toBe('list')
  })

  it('only the scene root carries ac-scene-root — nested capsules size from their own grid/content, never fill:100%', () => {
    const { sceneDoc } = buildSceneDoc(nestedFixtureScene())
    const story = sceneDoc.stories['story-main']!

    const root = story.persos.find((p) => p.id === 'story-main__root')!
    const capsuleA = story.persos.find((p) => p.id === 'capsule-a')!
    const capsuleB = story.persos.find((p) => p.id === 'capsule-b')!

    expect((root.initial as { className?: string }).className!.split(' ')).toContain('ac-scene-root')
    expect((capsuleA.initial as { className?: string }).className!.split(' ')).not.toContain('ac-scene-root')
    expect((capsuleB.initial as { className?: string }).className!.split(' ')).not.toContain('ac-scene-root')
  })

  it('chains move.parentId across all 3 levels — capsule-a under root, capsule-b under capsule-a, item-nested under capsule-b', () => {
    const { sceneDoc } = buildSceneDoc(nestedFixtureScene())
    const story = sceneDoc.stories['story-main']!

    const capsuleA = story.persos.find((p) => p.id === 'capsule-a')!
    const capsuleB = story.persos.find((p) => p.id === 'capsule-b')!
    const itemFlat = story.persos.find((p) => p.id === 'item-flat')!
    const itemNested = story.persos.find((p) => p.id === 'item-nested')!

    expect(capsuleA.initial).toMatchObject({ move: { parentId: 'story-main__root', flip: false } })
    expect(capsuleB.initial).toMatchObject({ move: { parentId: 'capsule-a', flip: false } })
    expect(itemFlat.initial).toMatchObject({ move: { parentId: 'capsule-a', flip: false } })
    expect(itemNested.initial).toMatchObject({ move: { parentId: 'capsule-b', flip: false } })
  })

  it('resolves capsule-a\'s own intro/outro as named actions (it is a child of root exactly like any item)', () => {
    const { sceneDoc } = buildSceneDoc(nestedFixtureScene())
    const story = sceneDoc.stories['story-main']!
    const capsuleA = story.persos.find((p) => p.id === 'capsule-a')!

    expect(capsuleA.actions['capsule-a-intro']).toEqual({ style: { opacity: { from: 0, to: 1, duration: 300 } } })
    expect(capsuleA.actions['capsule-a-outro']).toEqual({ style: { opacity: { to: 0, duration: 300 } } })
  })

  it('aggregates a distinct stylesheet contribution per capsule level (root + capsule-a + capsule-b)', () => {
    const { sceneDoc, styleSheet } = buildSceneDoc(nestedFixtureScene())
    const capsuleA = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'capsule-a')!
    const capsuleB = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'capsule-b')!

    // Each capsule's own resolved className must actually be backed by a rule in the aggregated
    // stylesheet — not just present on the perso with nothing behind it.
    const capsuleAGridClass = (capsuleA.initial as { className?: string }).className!.split(' ')[0]
    const capsuleBGridClass = (capsuleB.initial as { className?: string }).className!.split(' ')[0]
    expect(styleSheet).toContain(`.${capsuleAGridClass}{display:grid;`)
    expect(styleSheet).toContain(`.${capsuleBGridClass}{display:grid;`)
  })

  it('compiles cleanly through the real Codplay BuilderFacade', () => {
    const { sceneDoc } = buildSceneDoc(nestedFixtureScene())
    const compileResult = new BuilderFacade().compile({ scene: sceneDoc })
    expect(compileResult.ok).toBe(true)
  })
})

describe('buildSceneDoc — nested capsule reads its own TrackNode.grid override (not just the scene root)', () => {
  it('a nested capsule with an explicit grid resolves to that grid, not the type default (9x16)', () => {
    const scene: EditorScene = {
      id: 'grid-override-scene', title: 'grid override', durationMs: 3000, durationSource: 'arbitrary',
      decors: {}, rootDecorId: null,
      tracks: [{
        id: 'capsule-a', kind: 'capsule', label: 'A', visible: true, capsuleType: 'grille',
        grid: { rows: 1, cols: 2 },
        distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 },
        keyframes: [
          { id: 'kf-a-intro', timeMs: 0, decorId: null },
          { id: 'kf-a-outro', timeMs: 3000, decorId: null },
        ],
        children: [
          { id: 'item-1', kind: 'element', label: '1', visible: true, contentType: 'text', keyframes: [{ id: 'kf-1', timeMs: 0, decorId: null }, { id: 'kf-1-out', timeMs: 3000, decorId: null }] },
          { id: 'item-2', kind: 'element', label: '2', visible: true, contentType: 'text', keyframes: [{ id: 'kf-2', timeMs: 0, decorId: null }, { id: 'kf-2-out', timeMs: 3000, decorId: null }] },
        ],
      }],
      cues: [], markerTracks: [],
    }

    const { sceneDoc, styleSheet } = buildSceneDoc(scene)
    const capsuleA = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'capsule-a')!
    const gridClass = (capsuleA.initial as { className?: string }).className!.split(' ')[0]

    expect(gridClass).toBe('ac-grid-grille-1x2-manual')
    expect(styleSheet).toContain(`.${gridClass}{display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));grid-template-rows:1fr;}`)
  })
})

describe('buildSceneDoc — error paths (never silently guessed, Principe B)', () => {
  it('throws when a capsule track has no capsuleType — the Builder never guesses which sub-type pipeline to run', () => {
    const scene: EditorScene = {
      id: 'error-scene', title: 'error', durationMs: 1000, durationSource: 'arbitrary',
      decors: {}, rootDecorId: null,
      tracks: [{
        id: 'capsule-untyped', kind: 'capsule', label: 'Untyped', visible: true,
        // capsuleType intentionally omitted
        keyframes: [{ id: 'kf', timeMs: 0, decorId: null }],
        children: [],
      }],
      cues: [], markerTracks: [],
    }
    expect(() => buildSceneDoc(scene)).toThrow(/capsule-untyped.*capsuleType/)
  })

  it('throws for any contentType other than text — the only mapped ItemType in this increment (§5 of the plan)', () => {
    const scene: EditorScene = {
      id: 'error-scene', title: 'error', durationMs: 1000, durationSource: 'arbitrary',
      decors: {}, rootDecorId: null,
      tracks: [{
        id: 'item-image', kind: 'element', label: 'Image', visible: true, contentType: 'image',
        keyframes: [{ id: 'kf', timeMs: 0, decorId: null }],
      }],
      cues: [], markerTracks: [],
    }
    expect(() => buildSceneDoc(scene)).toThrow(/unsupported contentType 'image'/)
  })

  it('throws when a non-carousel capsule has no distribution setting — CapsulePreset never guesses a mode (§3.3)', () => {
    const scene: EditorScene = {
      id: 'error-scene', title: 'error', durationMs: 1000, durationSource: 'arbitrary',
      decors: {}, rootDecorId: null,
      tracks: [{
        id: 'capsule-unconfigured', kind: 'capsule', label: 'Unconfigured', visible: true, capsuleType: 'grille',
        // distribution intentionally omitted — grille has no structural default (only carousel does)
        keyframes: [{ id: 'kf-intro', timeMs: 0, decorId: null }, { id: 'kf-outro', timeMs: 1000, decorId: null }],
        children: [],
      }],
      cues: [], markerTracks: [],
    }
    expect(() => buildSceneDoc(scene)).toThrow(/has no structural default/)
  })
})
