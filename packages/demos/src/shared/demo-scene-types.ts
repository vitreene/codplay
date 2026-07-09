import type { PlayerPublicEventInput, SceneDoc } from 'codplay/player/types'
import type { StrapCollection } from 'codplay/player'
import type { Player } from 'codplay/player/player'
import type { TelcoApi } from 'codplay/telco/types'
import type { ResourceManifestEntry } from 'codplay/builder/types'
import type { RuntimeComponentClass } from 'codplay/runtime/components'
import type { RenderAdapter } from 'codplay/player/render-adapter-types'
import type { ThirdPartyBinding } from 'codplay/player/third-party-binding'
import type { DemoEntry } from './demo-registry'

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
	/** Restricts the sidebar menu to this subset instead of the full DEMO_REGISTRY. */
	demoLinks?: DemoEntry[];
	actions?: PlayerSceneDemoAction[];
	extraResources?: ResourceManifestEntry[];
	/** Custom component classes keyed by perso type, registered before init. */
	components?: Record<string, RuntimeComponentClass>;
	/** External render adapters (Three.js, Lottie, Rive, PixiJS…) coupled to CodPlay's ticker. */
	renderAdapters?: RenderAdapter[];
	/** Third-party library registrations (components + renderAdapter + preload bundled). */
	bindings?: ThirdPartyBinding[];
	/** Show only time + event name in the trace panel; errors are always shown in full. */
	compactTrace?: boolean;
	/** Optional external controls rendered in the shared demo sidebar. */
	onControlsReady?: (context: { player: Player; telco: TelcoApi; container: HTMLElement; sceneContainer: HTMLElement }) => void;
};
