import {
	CAPSULE_TYPE,
	GRID_POLICY,
	PLACEMENT_POLICY,
	TIME_MODE,
	type AutoCapsuleType,
	type AutoCapsuleTypeBehavior
} from "../types/public";

const DEFAULT_FIXED_DURATION_MS = 2000;

/**
 * Default portable behavior registry.
 *
 * Main variables:
 * - `defaultRows` / `defaultCols`: default manual grid step for the type
 * - `defaultTimeMode`: default scheduling policy
 * - `gridPolicy`: default interpretation of the grid according to the type
 * - `placementPolicy`: default placement behavior for children
 */
export const AUTO_CAPSULE_TYPE_BEHAVIORS: Record<AutoCapsuleType, AutoCapsuleTypeBehavior> = {
	[CAPSULE_TYPE.carrousel]: {
		defaultTimeMode: TIME_MODE.distributed,
		defaultFixedDurationMs: DEFAULT_FIXED_DURATION_MS,
		defaultRows: 1,
		defaultCols: 1,
		gridPolicy: GRID_POLICY.stack,
		placementPolicy: PLACEMENT_POLICY.auto,
		defaultIntroRef: "fade",
		defaultOutroRef: "fade",
		defaultGenerateDefaultOutro: true
	},
	[CAPSULE_TYPE.rangee]: {
		defaultTimeMode: TIME_MODE.distributed,
		defaultFixedDurationMs: DEFAULT_FIXED_DURATION_MS,
		defaultRows: 9,
		defaultCols: 16,
		gridPolicy: GRID_POLICY.line,
		placementPolicy: PLACEMENT_POLICY.mixed,
		defaultIntroRef: "fade",
		defaultOutroRef: null,
		defaultGenerateDefaultOutro: false
	},
	[CAPSULE_TYPE.liste]: {
		defaultTimeMode: TIME_MODE.distributed,
		defaultFixedDurationMs: DEFAULT_FIXED_DURATION_MS,
		defaultRows: 9,
		defaultCols: 16,
		gridPolicy: GRID_POLICY.list,
		placementPolicy: PLACEMENT_POLICY.mixed,
		defaultIntroRef: "fade",
		defaultOutroRef: null,
		defaultGenerateDefaultOutro: false
	},
	[CAPSULE_TYPE.grille]: {
		defaultTimeMode: TIME_MODE.distributed,
		defaultFixedDurationMs: DEFAULT_FIXED_DURATION_MS,
		defaultRows: 9,
		defaultCols: 16,
		gridPolicy: GRID_POLICY.grid,
		placementPolicy: PLACEMENT_POLICY.mixed,
		defaultIntroRef: "fade",
		defaultOutroRef: "fade",
		defaultGenerateDefaultOutro: true
	},
	[CAPSULE_TYPE.position]: {
		defaultTimeMode: TIME_MODE.distributed,
		defaultFixedDurationMs: DEFAULT_FIXED_DURATION_MS,
		defaultRows: 9,
		defaultCols: 16,
		gridPolicy: GRID_POLICY.areas,
		placementPolicy: PLACEMENT_POLICY.explicitOnly,
		defaultIntroRef: "fade",
		defaultOutroRef: "fade",
		defaultGenerateDefaultOutro: true
	},
	[CAPSULE_TYPE.card]: {
		defaultTimeMode: TIME_MODE.distributed,
		defaultFixedDurationMs: DEFAULT_FIXED_DURATION_MS,
		defaultRows: 9,
		defaultCols: 16,
		gridPolicy: GRID_POLICY.areas,
		placementPolicy: PLACEMENT_POLICY.mixed,
		defaultIntroRef: "fade",
		defaultOutroRef: "fade",
		defaultGenerateDefaultOutro: true
	},
	[CAPSULE_TYPE.legacy]: {
		defaultTimeMode: TIME_MODE.distributed,
		defaultFixedDurationMs: DEFAULT_FIXED_DURATION_MS,
		defaultRows: 9,
		defaultCols: 16,
		gridPolicy: GRID_POLICY.legacy,
		placementPolicy: PLACEMENT_POLICY.mixed,
		defaultIntroRef: "fade",
		defaultOutroRef: "fade",
		defaultGenerateDefaultOutro: true
	}
};
