import { describe, expect, it } from 'vitest'
import { BuilderFacade } from 'codplay/builder/create-builder'
import { buildSceneDoc } from '../../src/builder/build-scene'
import type { EditorScene } from '../../src/app/commands/types'

function emptyMeta(overrides?: Partial<EditorScene['meta']>): EditorScene['meta'] {
  return {
    title: 'ed2 demo',
    durationMs: 3000,
    durationSource: 'arbitrary',
    timeUnit: 's',
    capsuleOrder: 'forward',
    ...overrides,
  }
}

function fixtureScene(): EditorScene {
  return {
    id: 'ed2-demo-scene',
    meta: emptyMeta(),
    rootDecorId: 'root-decor',
    decors: {
      'root-decor': { id: 'root-decor', style: { background: '#1a1a2e' } },
      'text-decor': { id: 'text-decor', style: { color: '#ffffff', fontSize: '2rem' } },
    },
    contents: {
      'text-content': { id: 'text-content', type: 'text', text: 'Bonjour ed2' },
    },
    items: [
      {
        id: 'item-1',
        type: 'text',
        parentId: null,
        order: 'mmm',
        visible: true,
        contentId: 'text-content',
        initialDecorId: 'text-decor',
        keyframes: [
          { id: 'kf-intro', timeMs: 0, decorId: 'text-decor', transitionIn: { kind: 'named', name: 'fade', durationMs: 400 } },
          { id: 'kf-outro', timeMs: 3000, decorId: 'text-decor', transitionOut: { kind: 'named', name: 'fade', durationMs: 400 } },
        ],
      },
    ],
    zones: {},
    markerTracks: {},
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

    // preRollMs=400 (this item's own transitionIn duration) shifts the whole timeline: intro
    // still triggers at 0 (it ends exactly at the pre-rolled kf, (0+400)-400=0, coincidence of a
    // single item) ; outro never subtracts (§2.2) — it simply moves with the shift, 3000+400.
    // The first keyframe's own decor is folded into `initial.style` (buildItemPerso), never its
    // own action/eventime — one authority per property, no race with the segment that follows.
    // The outro keyframe reuses the SAME decor as the intro (no diff) — emits nothing (Principe B).
    expect(story.eventimes).toEqual([
      { name: 'item-1-intro', startAt: 0 },
      { name: 'item-1-outro', startAt: 3400 },
    ])
  })

  it('the first keyframe\'s own decor (background-color etc.) is folded into initial.style, not a competing action — the actual bug this closes: two authorities (a cut action AND the following segment\'s animation) racing on the same property at the same instant', () => {
    const scene = fixtureScene()
    scene.decors['kf-only-decor'] = { id: 'kf-only-decor', style: { 'background-color': '#ff00ff' } }
    scene.items[0]!.keyframes[0]!.decorId = 'kf-only-decor'

    const { sceneDoc } = buildSceneDoc(scene)
    const item = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'item-1')!

    expect(item.initial).toMatchObject({ style: { 'background-color': '#ff00ff' } })
    expect(item.actions['item-1-kf-kf-intro']).toBeUndefined()
  })

  it('an empty/absent decor on the first keyframe contributes nothing to initial.style — nothing invented (Principe B)', () => {
    const scene = fixtureScene()
    scene.decors['empty-decor'] = { id: 'empty-decor' }
    scene.items[0]!.keyframes[0]!.decorId = 'empty-decor'

    const { sceneDoc } = buildSceneDoc(scene)
    const item = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'item-1')!

    // Still gets `opacity:0` from the intro transition's own `from` — just nothing extra from the
    // (empty) first-kf decor.
    expect(item.initial).toMatchObject({ style: { opacity: 0 } })
  })
})

/**
 * §2.2 "Transition d'état de décor" — le Builder doit calculer une vraie animation depuis le diff
 * entre décors adjacents, pas un simple cut, quand le segment porte une transition interpolée.
 */
function interpolatedFixtureScene(overrides: {
  transitionOnKfB?: EditorScene['items'][number]['keyframes'][number]['transitionIn']
} = {}): EditorScene {
  return {
    id: 'interp-scene',
    meta: emptyMeta({ durationMs: 3000 }),
    decors: {
      'd-a': { id: 'd-a', style: { 'background-color': '#ff0000' } },
      'd-b': { id: 'd-b', style: { 'background-color': '#00ff00' } },
    },
    contents: {},
    zones: {},
    markerTracks: {},
    items: [
      {
        id: 'item-1', type: 'text', parentId: null, order: 'mmm', visible: true, contentId: null, initialDecorId: 'd-a',
        keyframes: [
          { id: 'kf-a', timeMs: 0, decorId: 'd-a' },
          { id: 'kf-b', timeMs: 1000, decorId: 'd-b', transitionIn: overrides.transitionOnKfB },
        ],
      },
    ],
  }
}

describe('buildSceneDoc — interpolated decor-state transitions between adjacent keyframes', () => {
  it('a real transition on the segment produces an animated diff (to/duration/easing — no "from": the runtime interpolates from its own current value, StyleTransitionValue.from is optional), triggered at the source kf by default (direction:\'after\')', () => {
    const scene = interpolatedFixtureScene({
      transitionOnKfB: { kind: 'interpolated', durationMs: 300, easing: 'linear', direction: 'after' },
    })
    const { sceneDoc, preRollMs } = buildSceneDoc(scene)
    expect(preRollMs).toBe(0) // no NAMED transitionIn on the first kf — this scene's own preRoll stays 0
    const item = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'item-1')!

    expect(item.actions['item-1-kf-kf-b']).toEqual({
      style: { 'background-color': { to: '#00ff00', duration: 300, ease: 'linear' } },
    })
    expect(sceneDoc.stories['story-main']!.eventimes).toContainEqual({ name: 'item-1-kf-kf-b', startAt: 0 })
  })

  it('easing is normalized to CodPlay\'s historical naming (\'ease-in-out\' -> \'easeInOut\'), a pure nomenclature alignment — key is `ease`, confirmed against a real authored scene (s6-dnd-list-scene.ts), not `easing`', () => {
    const scene = interpolatedFixtureScene({
      transitionOnKfB: { kind: 'interpolated', durationMs: 300, easing: 'ease-in-out', direction: 'after' },
    })
    const { sceneDoc } = buildSceneDoc(scene)
    const item = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'item-1')!
    expect(item.actions['item-1-kf-kf-b']).toMatchObject({ style: { 'background-color': { ease: 'easeInOut' } } })
  })

  it('direction:\'before\' ends the transition AT the destination kf, not the source', () => {
    const scene = interpolatedFixtureScene({
      transitionOnKfB: { kind: 'interpolated', durationMs: 300, easing: 'linear', direction: 'before' },
    })
    const { sceneDoc } = buildSceneDoc(scene)
    // destKfTimeMs(1000) - durationMs(300) = 700
    expect(sceneDoc.stories['story-main']!.eventimes).toContainEqual({ name: 'item-1-kf-kf-b', startAt: 700 })
  })

  it('no explicit TransitionDef still interpolates automatically over the full interval — §2.2 "par défaut automatique, couvre tout l\'intervalle" — this is the DEFAULT, not an opt-in', () => {
    const scene = interpolatedFixtureScene()
    const { sceneDoc } = buildSceneDoc(scene)
    const item = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'item-1')!

    // kf-a at 0, kf-b at 1000 — full interval duration, default easing (DEFAULT_EASING normalized).
    expect(item.actions['item-1-kf-kf-b']).toEqual({
      style: { 'background-color': { to: '#00ff00', duration: 1000, ease: 'easeInOut' } },
    })
    // direction defaults to 'after' — starts at the source kf.
    expect(sceneDoc.stories['story-main']!.eventimes).toContainEqual({ name: 'item-1-kf-kf-b', startAt: 0 })
  })

  it('an explicit TransitionDef with durationMs:0 is the only way to get an instant cut on an interior segment', () => {
    const scene = interpolatedFixtureScene({ transitionOnKfB: { kind: 'interpolated', durationMs: 0, easing: 'linear', direction: 'after' } })
    const { sceneDoc } = buildSceneDoc(scene)
    const item = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'item-1')!

    expect(item.actions['item-1-kf-kf-b']).toEqual({ style: { 'background-color': '#00ff00' } })
    expect(sceneDoc.stories['story-main']!.eventimes).toContainEqual({ name: 'item-1-kf-kf-b', startAt: 1000 })
  })

  it('identical adjacent decors emit nothing for that segment (Principe B, no redundant cut)', () => {
    const scene = interpolatedFixtureScene()
    scene.items[0]!.keyframes[1]!.decorId = 'd-a' // same decor as kf-a — no real diff
    const { sceneDoc } = buildSceneDoc(scene)
    const item = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'item-1')!

    expect(item.actions['item-1-kf-kf-b']).toBeUndefined()
  })

  it('Decor.offset (translate/rotate/scale) resolves into the SAME style record as Decor.style — one merged diff, confirmed against a real authored scene (s6-dnd-list-scene.ts: x/y mixed with plain CSS in one style object)', () => {
    const scene = interpolatedFixtureScene()
    scene.decors['d-a']!.offset = { translate: { x: 0, y: 0 } }
    scene.decors['d-b']!.offset = { translate: { x: 120, y: -40 }, rotate: 15, scale: { x: 1.2, y: 0.9 } }
    const { sceneDoc } = buildSceneDoc(scene)
    const item = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'item-1')!

    expect(item.actions['item-1-kf-kf-b']).toEqual({
      style: {
        'background-color': { to: '#00ff00', duration: 1000, ease: 'easeInOut' },
        x: { to: 120, duration: 1000, ease: 'easeInOut' },
        y: { to: -40, duration: 1000, ease: 'easeInOut' },
        rotate: { to: 15, duration: 1000, ease: 'easeInOut' },
        scaleX: { to: 1.2, duration: 1000, ease: 'easeInOut' },
        scaleY: { to: 0.9, duration: 1000, ease: 'easeInOut' },
      },
    })
  })

  it('the first keyframe\'s offset folds into initial.style too, right alongside its own style — same single-authority merge, per the author\'s explicit instruction not to special-case it', () => {
    const scene = interpolatedFixtureScene()
    scene.decors['d-a']!.offset = { translate: { x: 10, y: 20 }, rotate: 5 }
    const { sceneDoc } = buildSceneDoc(scene)
    const item = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'item-1')!

    expect(item.initial).toMatchObject({ style: { x: 10, y: 20, rotate: 5, 'background-color': '#ff0000' } })
  })
})

describe('buildSceneDoc — minimal increment, continued', () => {
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

describe('buildSceneDoc — pre-roll timing (TransitionTiming, grid-spec §2.2)', () => {
  it('exposes preRollMs as the max transitionIn duration across all items in the scene', () => {
    const { preRollMs } = buildSceneDoc(fixtureScene())
    expect(preRollMs).toBe(400)
  })

  it('a multi-item scene uses the max transitionIn duration for preRollMs, but each item still triggers with its OWN duration', () => {
    const scene: EditorScene = {
      id: 'multi-item-scene',
      meta: emptyMeta({ durationMs: 3000 }),
      decors: {},
      contents: {},
      zones: {},
      markerTracks: {},
      items: [
        {
          id: 'item-a', type: 'text', parentId: null, order: 'mmm', visible: true, contentId: null, initialDecorId: 'unused',
          keyframes: [
            { id: 'kf-a-intro', timeMs: 0, decorId: 'unused', transitionIn: { kind: 'named', name: 'fade', durationMs: 800 } },
            { id: 'kf-a-outro', timeMs: 3000, decorId: 'unused' },
          ],
        },
        {
          id: 'item-b', type: 'text', parentId: null, order: 'mmn', visible: true, contentId: null, initialDecorId: 'unused',
          keyframes: [
            { id: 'kf-b-intro', timeMs: 0, decorId: 'unused', transitionIn: { kind: 'named', name: 'fade', durationMs: 200 } },
            { id: 'kf-b-outro', timeMs: 3000, decorId: 'unused' },
          ],
        },
      ],
    }

    const { sceneDoc, preRollMs } = buildSceneDoc(scene)
    expect(preRollMs).toBe(800)

    const story = sceneDoc.stories['story-main']!
    // item-a ends its own 800ms transition exactly at the pre-rolled kf: (0+800)-800=0.
    expect(story.eventimes).toContainEqual({ name: 'item-a-intro', startAt: 0 })
    // item-b uses ITS OWN 200ms duration, not item-a's 800ms: (0+800)-200=600.
    expect(story.eventimes).toContainEqual({ name: 'item-b-intro', startAt: 600 })
  })

  it('applies the same scene-wide preRollMs consistently at every nested capsule level', () => {
    const { sceneDoc, preRollMs } = buildSceneDoc(nestedFixtureScene())
    // capsule-a's own transitionIn (300ms) is the only one in this fixture.
    expect(preRollMs).toBe(300)

    const story = sceneDoc.stories['story-main']!
    expect(story.eventimes).toContainEqual({ name: 'capsule-a-intro', startAt: 0 })
    expect(story.eventimes).toContainEqual({ name: 'capsule-a-outro', startAt: 3300 })
  })
})

/**
 * Step 6 (`2026-07-08-builder-plan.md`, nested capsule) — 2 levels deep, mixing capsule types:
 * root (card) -> capsule-a (grille, own show/hide transition) -> [capsule-b (liste), item-flat]
 *                                                                    -> item-nested
 * `capsule-a` and `capsule-b` are BOTH `type: 'capsule'`, each resolving its own grid/timing via
 * `resolveCapsule` — confirms the worklist recurses past one level, not just root -> leaf. Nesting
 * comes from `parentId` alone (flat `items[]`), never from a structural `children` field.
 */
function nestedFixtureScene(): EditorScene {
  return {
    id: 'ed2-nested-demo-scene',
    meta: emptyMeta(),
    decors: {},
    contents: {},
    zones: {},
    markerTracks: {},
    items: [
      {
        id: 'capsule-a',
        type: 'capsule',
        parentId: null,
        order: 'mmm',
        visible: true,
        contentId: null,
        initialDecorId: 'unused-a',
        // Required for any non-carousel type (CapsulePreset.resolve — no structural default).
        capsule: { kind: 'grille', distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 } },
        keyframes: [
          { id: 'kf-a-intro', timeMs: 0, decorId: 'unused-a', transitionIn: { kind: 'named', name: 'fade', durationMs: 300 } },
          { id: 'kf-a-outro', timeMs: 3000, decorId: 'unused-a', transitionOut: { kind: 'named', name: 'fade', durationMs: 300 } },
        ],
      },
      {
        id: 'capsule-b',
        type: 'capsule',
        parentId: 'capsule-a',
        order: 'mmm',
        visible: true,
        contentId: null,
        initialDecorId: 'unused-b',
        capsule: { kind: 'liste', distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 } },
        keyframes: [{ id: 'kf-b-intro', timeMs: 0, decorId: 'unused-b' }],
      },
      {
        id: 'item-nested',
        type: 'text',
        parentId: 'capsule-b',
        order: 'mmm',
        visible: true,
        contentId: null,
        initialDecorId: 'unused-nested',
        keyframes: [{ id: 'kf-nested', timeMs: 0, decorId: 'unused-nested' }],
      },
      {
        id: 'item-flat',
        type: 'text',
        parentId: 'capsule-a',
        order: 'mmn',
        visible: true,
        contentId: null,
        initialDecorId: 'unused-flat',
        keyframes: [{ id: 'kf-flat', timeMs: 0, decorId: 'unused-flat' }],
      },
    ],
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

describe('buildSceneDoc — nested capsule reads its own CapsuleDef.grid override (not just the scene root)', () => {
  it('a nested capsule with an explicit grid resolves to that grid, not the type default (9x16)', () => {
    const scene: EditorScene = {
      id: 'grid-override-scene',
      meta: emptyMeta(),
      decors: {},
      contents: {},
      zones: {},
      markerTracks: {},
      items: [
        {
          id: 'capsule-a',
          type: 'capsule',
          parentId: null,
          order: 'mmm',
          visible: true,
          contentId: null,
          initialDecorId: 'unused',
          capsule: { kind: 'grille', grid: { rows: 1, cols: 2 }, distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 } },
          keyframes: [
            { id: 'kf-a-intro', timeMs: 0, decorId: 'unused' },
            { id: 'kf-a-outro', timeMs: 3000, decorId: 'unused' },
          ],
        },
        {
          id: 'item-1', type: 'text', parentId: 'capsule-a', order: 'mmm', visible: true, contentId: null, initialDecorId: 'unused',
          keyframes: [{ id: 'kf-1', timeMs: 0, decorId: 'unused' }, { id: 'kf-1-out', timeMs: 3000, decorId: 'unused' }],
        },
        {
          id: 'item-2', type: 'text', parentId: 'capsule-a', order: 'mmn', visible: true, contentId: null, initialDecorId: 'unused',
          keyframes: [{ id: 'kf-2', timeMs: 0, decorId: 'unused' }, { id: 'kf-2-out', timeMs: 3000, decorId: 'unused' }],
        },
      ],
    }

    const { sceneDoc, styleSheet } = buildSceneDoc(scene)
    const capsuleA = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'capsule-a')!
    const gridClass = (capsuleA.initial as { className?: string }).className!.split(' ')[0]

    expect(gridClass).toBe('ac-grid-grille-1x2-manual')
    expect(styleSheet).toContain(`.${gridClass}{display:grid;grid-template-columns:repeat(2, minmax(0, 1fr));grid-template-rows:1fr;}`)
  })
})

describe('buildSceneDoc — no noise: an item with no explicit transition emits no dangling intro/outro eventime', () => {
  it('a keyframe with no transitionIn/transitionOut resolves to `cut` (no style diff) — no action AND no eventime, not a silent no-op event', () => {
    const scene: EditorScene = {
      id: 'no-transition-scene',
      meta: emptyMeta({ durationMs: 5000 }),
      decors: { 'd1': { id: 'd1', style: { 'background-color': '#ff0000' } } },
      contents: {},
      zones: {},
      markerTracks: {},
      items: [
        {
          id: 'item-1', type: 'text', parentId: null, order: 'mmm', visible: true, contentId: null, initialDecorId: 'unused',
          keyframes: [
            { id: 'kf-a', timeMs: 0, decorId: 'd1' },
            { id: 'kf-b', timeMs: 5000, decorId: 'd1' },
          ],
        },
      ],
    }

    const { sceneDoc } = buildSceneDoc(scene)
    const item = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'item-1')!
    const story = sceneDoc.stories['story-main']!

    for (const [name, action] of Object.entries(item.actions)) {
      expect(action, `action '${name}' should never be an empty no-op`).not.toEqual({ style: {} })
    }
    for (const eventime of story.eventimes) {
      expect(item.actions[eventime.name], `eventime '${eventime.name}' triggers no action`).toBeDefined()
    }
  })
})

describe('buildSceneDoc — error paths (never silently guessed, Principe B)', () => {
  it('throws when a capsule item has no CapsuleDef — the Builder never guesses which sub-type pipeline to run', () => {
    const scene: EditorScene = {
      id: 'error-scene',
      meta: emptyMeta({ durationMs: 1000 }),
      decors: {},
      contents: {},
      zones: {},
      markerTracks: {},
      items: [
        {
          id: 'capsule-untyped', type: 'capsule', parentId: null, order: 'mmm', visible: true, contentId: null, initialDecorId: 'unused',
          // capsule intentionally omitted
          keyframes: [{ id: 'kf', timeMs: 0, decorId: 'unused' }],
        },
      ],
    }
    expect(() => buildSceneDoc(scene)).toThrow(/capsule-untyped.*CapsuleDef/)
  })

  it('maps a bloc item to an empty-content text perso — not a distinct ItemType, never a throw (item-model-spec §5)', () => {
    const scene: EditorScene = {
      id: 'bloc-scene',
      meta: emptyMeta({ durationMs: 1000 }),
      decors: { 'd1': { id: 'd1' } },
      contents: {},
      zones: {},
      markerTracks: {},
      items: [
        { id: 'item-bloc', type: 'bloc', parentId: null, order: 'mmm', visible: true, contentId: null, initialDecorId: 'd1', keyframes: [] },
      ],
    }
    const { sceneDoc } = buildSceneDoc(scene)
    const perso = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'item-bloc')!
    expect(perso.type).toBe('text')
    expect(perso.initial).toMatchObject({ tag: 'div', content: undefined })
  })

  it('maps an image item to an img perso with src from Content.source (builder-plan §5 — never the "image" perso type)', () => {
    const scene: EditorScene = {
      id: 'image-scene',
      meta: emptyMeta({ durationMs: 1000 }),
      decors: { 'd1': { id: 'd1' } },
      contents: { 'c1': { id: 'c1', type: 'image', source: '/assets/photo.jpg' } },
      zones: {},
      markerTracks: {},
      items: [
        { id: 'item-image', type: 'image', parentId: null, order: 'mmm', visible: true, contentId: 'c1', initialDecorId: 'd1', keyframes: [] },
      ],
    }
    const { sceneDoc } = buildSceneDoc(scene)
    const perso = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'item-image')!
    expect(perso.type).toBe('img')
    expect(perso.initial).toMatchObject({ src: '/assets/photo.jpg' })
  })

  it('maps a video item to a media perso with tag "video"', () => {
    const scene: EditorScene = {
      id: 'video-scene',
      meta: emptyMeta({ durationMs: 1000 }),
      decors: { 'd1': { id: 'd1' } },
      contents: { 'c1': { id: 'c1', type: 'video', source: '/assets/clip.mp4' } },
      zones: {},
      markerTracks: {},
      items: [
        { id: 'item-video', type: 'video', parentId: null, order: 'mmm', visible: true, contentId: 'c1', initialDecorId: 'd1', keyframes: [] },
      ],
    }
    const { sceneDoc } = buildSceneDoc(scene)
    const perso = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'item-video')!
    expect(perso.type).toBe('media')
    expect(perso.initial).toMatchObject({ tag: 'video', src: '/assets/clip.mp4', master: false })
  })

  it('maps a media item to a media perso with tag "audio", and master:true when it matches scene.masterItemId', () => {
    const scene: EditorScene = {
      id: 'media-scene',
      meta: emptyMeta({ durationMs: 1000 }),
      masterItemId: 'item-media',
      decors: { 'd1': { id: 'd1' } },
      contents: { 'c1': { id: 'c1', type: 'media', source: '/assets/track.mp3' } },
      zones: {},
      markerTracks: {},
      items: [
        { id: 'item-media', type: 'media', parentId: null, order: 'mmm', visible: true, contentId: 'c1', initialDecorId: 'd1', keyframes: [] },
      ],
    }
    const { sceneDoc } = buildSceneDoc(scene)
    const perso = sceneDoc.stories['story-main']!.persos.find((p) => p.id === 'item-media')!
    expect(perso.type).toBe('media')
    expect(perso.initial).toMatchObject({ tag: 'audio', src: '/assets/track.mp3', master: true })
  })

  it('throws when a non-carousel capsule has no distribution setting — CapsulePreset never guesses a mode (§3.3)', () => {
    // `distribution` is required by `CapsuleDef` — TypeScript prevents omitting it from a
    // normally-typed caller. This simulates a document read back from storage (serialized JSON,
    // no type-level guarantee) rather than a scenario a well-typed command could ever produce —
    // the Builder still must not guess a default at runtime, whatever the data's origin.
    const scene: EditorScene = {
      id: 'error-scene',
      meta: emptyMeta({ durationMs: 1000 }),
      decors: {},
      contents: {},
      zones: {},
      markerTracks: {},
      items: [
        {
          id: 'capsule-unconfigured', type: 'capsule', parentId: null, order: 'mmm', visible: true, contentId: null, initialDecorId: 'unused',
          capsule: { kind: 'grille' } as unknown as EditorScene['items'][number]['capsule'],
          keyframes: [{ id: 'kf-intro', timeMs: 0, decorId: 'unused' }, { id: 'kf-outro', timeMs: 1000, decorId: 'unused' }],
        },
      ],
    }
    expect(() => buildSceneDoc(scene)).toThrow(/has no structural default/)
  })
})
