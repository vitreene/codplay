import { buildSceneDoc } from '@codplay/editor/builder/build-scene'
import type { EditorScene } from '@codplay/editor/sequence-editor/types'
import type { SceneDoc } from 'codplay-v1/player/types'

/**
 * Fixture `EditorScene` for the ed2 Builder's step-6 increment (nested capsule): 2 levels deep,
 * mixed capsule types — root (card) -> capsule-a (grille, own fade in/out) -> [capsule-b (liste)
 * -> item-nested, item-flat]. Each level carries its own visible text/color so the nesting is
 * checkable by eye, not just by code (same spirit as the `ed2-style-check` marker) — replaces the
 * step-3 single-flat-item fixture this file previously had, same as every prior increment.
 * Exercises the real Builder → SceneDocEditor → SceneDef pipeline, then hands the result to the
 * same `runCodPlaySceneDemo` every other demo uses.
 */
function fixtureScene(): EditorScene {
  return {
    id: 'ed2-builder-demo-scene',
    title: 'ed2 — capsule imbriquée construite par le Builder',
    durationMs: 3000,
    durationSource: 'arbitrary',
    decors: {
      'root-decor': {
        id: 'root-decor',
        data: { style: { background: 'linear-gradient(135deg, #0f2027, #203a43, #2c5364)' } },
      },
      'nested-decor': {
        id: 'nested-decor',
        data: { content: 'Capsule B (liste) → item imbriqué', style: { color: '#ffe066', fontSize: '1.5rem', fontWeight: 700 } },
      },
      'flat-decor': {
        id: 'flat-decor',
        data: { content: 'Capsule A (grille) → item plat', style: { color: '#66d9ef', fontSize: '1.5rem', fontWeight: 700 } },
      },
    },
    rootDecorId: 'root-decor',
    tracks: [
      {
        id: 'capsule-a',
        kind: 'capsule',
        label: 'Capsule A',
        visible: true,
        capsuleType: 'grille',
        // TEMPORARY (`sequence-editor/types.ts`, `TrackNode.grid`) — sized to this demo's 2 actual
        // children (capsule-b, item-flat) so each fills half of capsule-a rather than 1 cell out
        // of the type's own 9x16 default (`config/capsule-types.ts`), nearly invisible otherwise.
        // Not a real authored setting yet; a future `CapsulePatch.grid` panel replaces this.
        grid: { rows: 1, cols: 2 },
        // `grille` has no structural distribution default (only `carousel`'s single-cell grid
        // does, `CapsulePreset`) — the author's own choice here is "ligne 1x2, stagger:0": both
        // children coexist across the capsule's whole span, each in its own cell.
        distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 },
        keyframes: [
          { id: 'kf-a-intro', timeMs: 0, decorId: null, transitionIn: { kind: 'named', name: 'fade', durationMs: 400 } },
          { id: 'kf-a-outro', timeMs: 3000, decorId: null, transitionOut: { kind: 'named', name: 'fade', durationMs: 400 } },
        ],
        children: [
          {
            id: 'capsule-b',
            kind: 'capsule',
            label: 'Capsule B',
            visible: true,
            capsuleType: 'liste',
            distribution: { mode: 'stagger', staggerInMs: 0, staggerOutMs: 0 },
            // A single keyframe here made intro/outro resolve to the same instant (t=0), so the
            // outro action (opacity:1→0) fired right after intro (opacity:0→1) — undoing it before
            // it could ever progress, leaving capsule-b permanently at opacity:0. A second
            // keyframe (outro at t=3000) fixes the resolved time range, matching every other
            // track in this scene.
            keyframes: [
              { id: 'kf-b-intro', timeMs: 0, decorId: null },
              { id: 'kf-b-outro', timeMs: 3000, decorId: null },
            ],
            children: [
              {
                id: 'item-nested',
                kind: 'element',
                label: 'Item nested',
                visible: true,
                contentType: 'text',
                keyframes: [
                  { id: 'kf-nested-intro', timeMs: 0, decorId: 'nested-decor', transitionIn: { kind: 'named', name: 'fade', durationMs: 400 } },
                  { id: 'kf-nested-outro', timeMs: 3000, decorId: null, transitionOut: { kind: 'named', name: 'fade', durationMs: 400 } },
                ],
              },
            ],
          },
          {
            id: 'item-flat',
            kind: 'element',
            label: 'Item flat',
            visible: true,
            contentType: 'text',
            keyframes: [
              { id: 'kf-flat-intro', timeMs: 0, decorId: 'flat-decor', transitionIn: { kind: 'named', name: 'fade', durationMs: 400 } },
              { id: 'kf-flat-outro', timeMs: 3000, decorId: null, transitionOut: { kind: 'named', name: 'fade', durationMs: 400 } },
            ],
          },
        ],
      },
    ],
    cues: [],
    markerTracks: [],
  }
}

export type Ed2BuilderDemoScene = {
  scene: SceneDoc
  styleSheet: string
}

export function createEd2BuilderDemoScene(): Ed2BuilderDemoScene {
  const { sceneDoc, styleSheet } = buildSceneDoc(fixtureScene())
  return { scene: sceneDoc as unknown as SceneDoc, styleSheet }
}
