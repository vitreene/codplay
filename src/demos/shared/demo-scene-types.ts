import type { PlayerPublicEventInput, SceneDoc } from '../../player/types'
import type { StrapCollection } from '../../player'

/**
 * Defines one optional command button that emits one runtime event.
 */
export type PlayerSceneDemoAction = {
	id: string;
	label: string;
	event: PlayerPublicEventInput;
	className?: string;
};

/**
 * Defines one scene-based demo rendered through the shared shell.
 */
export type PlayerSceneDemoConfig = {
	title: string;
	subtitle: string;
	scene: SceneDoc;
	strapCollection?: StrapCollection;
	rootNodeIds: string[];
	activeDemo?: string;
	actions?: PlayerSceneDemoAction[];
};
