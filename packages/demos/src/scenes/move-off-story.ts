import type { SceneDoc } from 'codplay/player/types'

/**
 * Minimal demo for move:"@off" (Phase 3 of
 * 2026-06-28-unify-action-execution-and-move-off-plan.md): one content perso
 * attached to a layout outlet, detached via a TweenAction fade chained into
 * a static move:"@off" step (ActionSequence), then reattached by a second
 * event. Single deterministic trigger mechanism (eventimes only) so seek and
 * scrubbing land on known, reproducible ms positions — a manual emit
 * alongside a scheduled eventime on the same actionKey would interrupt the
 * pending sequence (Cas 1) and make the scrub bar mapping ambiguous.
 * Validated by hand: normal playback, seek before/after the detachment,
 * scrubbing across the detach point, and replay after a backward seek.
 */
export function createMoveOffScene(): SceneDoc {
  return {
    id: 'move-off-scene',
    rootStories: ['move-off-story'],
    stories: {
      'move-off-story': {
        id: 'move-off-story',
        persos: [
          {
            id: 'move-off-root',
            type: 'list',
            initial: {
              move: '@root',
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px',
                padding: '24px',
              },
            },
            actions: {},
          },
          {
            id: 'move-off-layout',
            type: 'layout',
            initial: {
              move: { parentId: 'move-off-root' },
              markup: '<section class="move-off-shell"><main data-part="move-off-layout:slot"></main></section>',
              style: { width: '320px', minHeight: '140px' },
            },
            actions: {},
          },
          {
            id: 'move-off-panel',
            type: 'tag',
            initial: {
              move: { parentId: 'move-off-layout:slot' },
              content: 'Panneau de contenu — attaché.',
              style: {
                display: 'block',
                padding: '20px',
                borderRadius: '8px',
                backgroundColor: '#0f172a',
                color: '#e2e8f0',
                fontFamily: 'sans-serif',
                fontSize: '15px',
                opacity: '1',
              },
            },
            actions: {
              detach: [
                {
                  action: {
                    fn: ({ progress }: { progress: number }) => ({ style: { opacity: String(1 - progress) } }),
                    duration: 500,
                  },
                },
                { action: { move: '@off' } },
              ],
              attach: {
                move: { parentId: 'move-off-layout:slot' },
                content: 'Panneau de contenu — attaché.',
                style: { opacity: '1' },
              },
            },
          },
        ],
        eventimes: [
          { name: 'detach', startAt: 1000 },
          { name: 'attach', startAt: 3000 },
        ],
        listen: [],
      },
    },
    tracks: {},
  } as unknown as SceneDoc
}
