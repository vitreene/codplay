import {
	CAPSULE_TYPE,
	GRID_MODE,
	PLACEMENT_POLICY,
	type AutoCapsuleType,
	type AutoCapsuleTypeBehavior
} from "../types/public";

/**
 * Default portable behavior registry.
 *
 * Main variables:
 * - `gridMode`: grid mode fixed for the type — not caller-adjustable
 * - `defaultRows` / `defaultCols`: default manual grid step for the type
 * - `placementPolicy`: default placement behavior for children
 */
export const AUTO_CAPSULE_TYPE_BEHAVIORS: Record<AutoCapsuleType, AutoCapsuleTypeBehavior> = {
	[CAPSULE_TYPE.carousel]: {
		gridMode: GRID_MODE.forced,
		defaultRows: 1,
		defaultCols: 1,
		placementPolicy: PLACEMENT_POLICY.auto,
		defaultIntroRef: "fade",
		defaultOutroRef: "fade",
		defaultGenerateDefaultOutro: true
	},
	[CAPSULE_TYPE.rangee]: {
		gridMode: GRID_MODE.derived,
		defaultRows: 9,
		defaultCols: 16,
		placementPolicy: PLACEMENT_POLICY.mixed,
		defaultIntroRef: "fade",
		defaultOutroRef: null,
		defaultGenerateDefaultOutro: false
	},
	[CAPSULE_TYPE.liste]: {
		gridMode: GRID_MODE.list,
		defaultRows: 9,
		defaultCols: 16,
		placementPolicy: PLACEMENT_POLICY.mixed,
		defaultIntroRef: "fade",
		defaultOutroRef: null,
		defaultGenerateDefaultOutro: false
	},
	[CAPSULE_TYPE.grille]: {
		gridMode: GRID_MODE.manual,
		defaultRows: 9,
		defaultCols: 16,
		placementPolicy: PLACEMENT_POLICY.mixed,
		defaultIntroRef: "fade",
		defaultOutroRef: "fade",
		defaultGenerateDefaultOutro: true
	},
	[CAPSULE_TYPE.card]: {
		gridMode: GRID_MODE.manual,
		defaultRows: 9,
		defaultCols: 16,
		placementPolicy: PLACEMENT_POLICY.explicitOnly,
		defaultIntroRef: "fade",
		defaultOutroRef: "fade",
		defaultGenerateDefaultOutro: true
	}
};
