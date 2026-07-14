import type { SceneDoc } from 'codplay/player/types'

const ROOT_ID = 'cqp-root'
const BOX_ID = 'cqp-box'

/**
 * Minimal demo for container-query unit placement
 * (2026-07-14-container-query-resolution-spec.md): a fixed-size root perso
 * establishes the query container (`containerType: 'size'`), and one child
 * perso is placed/sized entirely in `cqw`/`cqh` — both at rest (`initial.style`)
 * and mid-transition (`move` action animating `left`/`top`/`width`/`height`
 * together), to exercise both `dom.ts` and `animation/adapter.ts` resolution
 * paths. The root node is resolved from `CompiledScene.rootNodeIds` by the
 * player, not discovered via `.ac-scene-root`.
 */
export function createContainerQueryPlacementScene(): SceneDoc {
  return {
    id: 'container-query-placement-scene',
    stories: {
      'cqp-story': {
        id: 'cqp-story',
        initial: { move: '@root' },
        persos: [
          {
            id: ROOT_ID,
            type: 'tag',
            initial: {
              move: '@root',
              style: {
                position: 'relative',
                width: '600px',
                height: '400px',
                margin: '24px auto',
                background: '#1a1a2e',
                borderRadius: '12px',
                containerType: 'size',
              },
            },
            actions: {},
          },
          {
            id: BOX_ID,
            type: 'tag',
            initial: {
              move: { parentId: ROOT_ID },
              content: 'x/y/w/h en cqw/cqh',
              style: {
                position: 'absolute',
                left: '10cqw',
                top: '10cqh',
                width: '30cqw',
                height: '20cqh',
                background: '#e2e8f0',
                color: '#0f172a',
                fontFamily: 'sans-serif',
                fontSize: '13px',
                padding: '8px',
                boxSizing: 'border-box',
                borderRadius: '6px',
              },
            },
            actions: {
              move_far_corner: {
                style: {
                  left: { to: '60cqw', duration: 900 },
                  top: { to: '70cqh', duration: 900 },
                  width: { to: '15cqw', duration: 900 },
                  height: { to: '10cqh', duration: 900 },
                },
              },
              move_origin: {
                style: {
                  left: { to: '10cqw', duration: 900 },
                  top: { to: '10cqh', duration: 900 },
                  width: { to: '30cqw', duration: 900 },
                  height: { to: '20cqh', duration: 900 },
                },
              },
            },
          },
        ],
        eventimes: [
          { name: 'move_far_corner', startAt: 1000 },
          { name: 'move_origin', startAt: 2500 },
        ],
      },
    },
    tracks: {},
  } as unknown as SceneDoc
}
