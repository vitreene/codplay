import { AUTO_CAPSULE_TYPE_BEHAVIORS } from "./capsule-types";
import { DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS } from "./event-definitions";
import { AREA_KIND } from "../types/public";
import type {
	AutoCapsuleAreaNamingInput,
	AutoCapsuleConfig,
	AutoCapsuleGridNamingInput,
	AutoCapsuleSyntheticEventNamingInput
} from "../types/public";

function buildGridClassName(input: AutoCapsuleGridNamingInput): string {
	return `ac-grid-${input.type}-${input.rows}x${input.cols}-${input.mode}`;
}

/**
 * Build the default placement class name for one resolved child slot.
 */
function buildAreaClassName(input: AutoCapsuleAreaNamingInput): string {
	if (input.kind === AREA_KIND.listRow) {
		const rowIndex = input.index ?? input.row;
		return `ac-list-r${rowIndex}`;
	}

	const rowSpan = Math.max(1, input.rowSpan ?? 1);
	const colSpan = Math.max(1, input.colSpan ?? 1);
	if (rowSpan > 1 || colSpan > 1 || input.kind === AREA_KIND.gridSpan) {
		return `ac-cell-r${input.row}-c${input.col}-rs${rowSpan}-cs${colSpan}`;
	}

	return `ac-cell-r${input.row}-c${input.col}`;
}

/**
 * Build the default generated name for a synthetic event created by the engine.
 */
function buildSyntheticEventName(input: AutoCapsuleSyntheticEventNamingInput): string {
	return `__auto_capsule_${input.capsuleId}_child_${input.childId}_${input.action}_${input.triggerMs}`;
}

/**
 * Default portable configuration.
 *
 * Responsibilities:
 * - provide the default type registry
 * - provide the default naming policies
 * - provide the default intro/outro refs
 * - expose the default named event definitions
 */
export const DEFAULT_AUTO_CAPSULE_CONFIG: AutoCapsuleConfig = {
	types: AUTO_CAPSULE_TYPE_BEHAVIORS,
	naming: {
		buildGridClassName,
		buildAreaClassName,
		buildListItemClassName: (index: number) => `ac-list-r${index}`,
		buildSyntheticEventName
	},
	transitions: {
		defaultIntroRef: "fade",
		defaultOutroRef: "fade"
	},
	defaultEventDefinitions: DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS
};

/**
 * Merge a partial portable config with the default one.
 */
export function mergeAutoCapsuleConfig(
	overrides: Partial<AutoCapsuleConfig> | undefined
): AutoCapsuleConfig {
	if (!overrides) return DEFAULT_AUTO_CAPSULE_CONFIG;

	return {
		types: {
			...DEFAULT_AUTO_CAPSULE_CONFIG.types,
			...(overrides.types || {})
		},
		naming: {
			...DEFAULT_AUTO_CAPSULE_CONFIG.naming,
			...(overrides.naming || {})
		},
		transitions: {
			...DEFAULT_AUTO_CAPSULE_CONFIG.transitions,
			...(overrides.transitions || {})
		},
		defaultEventDefinitions: {
			...DEFAULT_AUTO_CAPSULE_CONFIG.defaultEventDefinitions,
			...(overrides.defaultEventDefinitions || {})
		}
	};
}
