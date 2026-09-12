import type { SceneDoc } from 'codplay/scene/types';
import { SIGHTY_SCENE_ROOT_CLASS_NAME } from '../../scene-root-capsule';

/** Declarative layout scene that exposes exactly the two Sighty host slots. */
export const layoutScene: SceneDoc<string> = {
	id: 'sighty-layout-scene',
	stories: {
		main: {
			id: 'main',
			persos: [
				{
					id: 'layout-frame',
					type: 'layout',
					initial: {
						move: '@root',
            className: `${SIGHTY_SCENE_ROOT_CLASS_NAME} sighty-scene-layout`,
            markup: '<div></div>',
					},
					actions: {},
				},
				{
					id: 'layout-slot-a',
					name: 'A',
					type: 'slot',
					initial: {
						move: { target: 'layout-frame' },
						className: 'sighty-slot',
					},
					actions: {},
				},
				{
					id: 'layout-slot-b',
					name: 'B',
					type: 'slot',
					initial: {
						move: { target: 'layout-frame' },
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
