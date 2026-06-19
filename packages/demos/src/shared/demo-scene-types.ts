import type { PlayerPublicEventInput, SceneDoc } from 'codplay/player/types'
import type { StrapCollection } from 'codplay/player'
import type { ResourceManifestEntry } from 'codplay/builder/types'
import type { RuntimeComponentClass } from 'codplay/runtime/components'
import type { RenderAdapter } from 'codplay/player/render-adapter-types'

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
	activeDemo?: string;
	actions?: PlayerSceneDemoAction[];
	extraResources?: ResourceManifestEntry[];
	/** Custom component classes keyed by perso type, registered before init. */
	components?: Record<string, RuntimeComponentClass>;
	/** External render adapters (Three.js, Lottie, Rive, PixiJS…) coupled to CodPlay's ticker. */
	renderAdapters?: RenderAdapter[];
	/** Show only time + event name in the trace panel; errors are always shown in full. */
	compactTrace?: boolean;
};
