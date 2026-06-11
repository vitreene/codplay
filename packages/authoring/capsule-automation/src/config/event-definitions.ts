import { EVENT_ACTION } from "../types/public";
import type { AutoCapsuleEventDefinition } from "../types/public";

/**
 * Default portable named event definitions.
 *
 * These definitions provide a default registry for common visual event refs such as
 * `fade`, `cut` or `zoom`, while remaining simple portable data.
 */
export const DEFAULT_AUTO_CAPSULE_EVENT_DEFINITIONS: Record<string, AutoCapsuleEventDefinition> = {
	cut: {
		label: "cut",
		durationMs: 0,
		style: {
			[EVENT_ACTION.intro]: {},
			[EVENT_ACTION.outro]: {}
		}
	},
	fade: {
		label: "fade",
		durationMs: 300,
		style: {
			[EVENT_ACTION.intro]: {
				opacity: { from: 0, to: 1 }
			},
			[EVENT_ACTION.outro]: {
				opacity: { to: 0 }
			}
		}
	},
	"swipe-left": {
		label: "swipe-left",
		durationMs: 300,
		style: {
			[EVENT_ACTION.intro]: {
				opacity: { from: 0, to: 1 },
				x: { from: -250, to: 0 }
			},
			[EVENT_ACTION.outro]: {
				opacity: { to: 0 },
				x: { to: -250 }
			}
		}
	},
	"swipe-right": {
		label: "swipe-right",
		durationMs: 300,
		style: {
			[EVENT_ACTION.intro]: {
				opacity: { from: 0, to: 1 },
				x: { from: 250, to: 0 }
			},
			[EVENT_ACTION.outro]: {
				opacity: { to: 0 },
				x: { to: 250 }
			}
		}
	},
	"swipe-top": {
		label: "swipe-top",
		durationMs: 300,
		style: {
			[EVENT_ACTION.intro]: {
				opacity: { from: 0, to: 1 },
				y: { from: -250, to: 0 }
			},
			[EVENT_ACTION.outro]: {
				opacity: { to: 0 },
				y: { to: -250 }
			}
		}
	},
	"swipe-down": {
		label: "swipe-down",
		durationMs: 300,
		style: {
			[EVENT_ACTION.intro]: {
				opacity: { from: 0, to: 1 },
				y: { from: 250, to: 0 }
			},
			[EVENT_ACTION.outro]: {
				opacity: { to: 0 },
				y: { to: 250 }
			}
		}
	},
	zoom: {
		label: "zoom",
		durationMs: 300,
		style: {
			[EVENT_ACTION.intro]: {
				opacity: { from: 0, to: 1 },
				scale: { from: 0.2, to: 1 }
			},
			[EVENT_ACTION.outro]: {
				opacity: { to: 0 },
				scale: { to: 2.5 }
			}
		}
	}
};
