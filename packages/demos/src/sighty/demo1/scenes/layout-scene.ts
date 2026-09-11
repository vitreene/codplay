import type { SceneDoc } from 'codplay/scene/types';
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../scene-root-capsule';

/** Declarative layout scene that exposes exactly the two Sighty host slots. */
export const layoutScene: SceneDoc<string> = {
	id: 'sighty-layout-scene',
	stories: {
		main: {
			id: 'main',
			persos: [
				{
					id: 'layout-shell',
					type: 'layout',
					initial: {
						move: '@root',
						className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} sighty-layout-shell`,
						markup: `
              <div class="sighty-layout-shell">
                <section class="sighty-layout-shell__header">
                  <span class="sighty-layout-shell__eyebrow">LAYOUT</span>
                  <strong>Deux scènes, deux timelines</strong>
                </section>
                <section class="sighty-layout-shell__grid">
                  <div class="sighty-layout-shell__panel">
                    <span class="sighty-layout-shell__slot-label">slot A</span>
                    <div id="slot-a" data-part="sighty-layout:slot-a"></div>
                  </div>
                  <div class="sighty-layout-shell__panel">
                    <span class="sighty-layout-shell__slot-label">slot B</span>
                    <div id="slot-b" data-part="sighty-layout:slot-b"></div>
                  </div>
                </section>
              </div>
            `,
					},
					actions: {},
				},
				{
					id: 'layout-slot-a',
					name: 'A',
					type: 'slot',
					initial: {
						move: { target: 'sighty-layout:slot-a' },
						className: 'sighty-slot',
					},
					actions: {},
				},
				{
					id: 'layout-slot-b',
					name: 'B',
					type: 'slot',
					initial: {
						move: { target: 'sighty-layout:slot-b' },
						className: 'sighty-slot',
					},
					actions: {},
				},
			],
			eventimes: [],
		},
	},
	eventimes: [{ name: 'sequence:end', startAt: 10_000 }],
	listen: [],
	tracks: {},
};
