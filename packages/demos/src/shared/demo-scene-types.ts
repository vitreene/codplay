import type { PlayerPublicEventInput, SceneDoc } from 'codplay/player/types'
import type { StrapCollection } from 'codplay/player'
import type { ResourceManifestEntry } from 'codplay/builder/types'
import type { RuntimeComponentClass } from 'codplay/runtime/components'

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
	extraResources?: ResourceManifestEntry[];
	/** Custom component classes keyed by perso type, registered before init. */
	components?: Record<string, RuntimeComponentClass>;
	/** Called each ticker frame after animejs — use for Three.js or similar. */
	renderFrame?: (nowMs: number) => void;
};
