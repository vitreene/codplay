import type { PlayerPublicEventInput, SceneDoc } from '../../player/types'

/**
 * Defines one navigation link rendered in the shared demo shell.
 */
export type PlayerSceneDemoLink = {
	label: string;
	href: string;
	active?: boolean;
};

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
	rootNodeIds: string[];
	demoLinks?: PlayerSceneDemoLink[];
	actions?: PlayerSceneDemoAction[];
};
