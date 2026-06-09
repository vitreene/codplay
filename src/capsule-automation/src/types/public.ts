type ValueOf<T> = T[keyof T];

/**
 * Public grid modes supported by AutoCapsule.
 */
export const GRID_MODE = {
	/** Force a `1 x 1` grid, typically used by one-item-at-a-time capsules. */
	forced: "forced",
	/** Derive the grid from child count and orientation. */
	derived: "derived",
	/** Build a one-column list-like grid. */
	list: "list",
	/** Keep an explicit grid with named areas. */
	areas: "areas",
	/** Use the explicit `rows` and `cols` step, with type defaults as fallback. */
	manual: "manual"
} as const;
export type AutoCapsuleGridMode = ValueOf<typeof GRID_MODE>;

/**
 * Public time distribution modes supported by AutoCapsule.
 */
export const TIME_MODE = {
	/** Split the capsule time range across visible children. */
	distributed: "distributed",
	/** Assign a fixed duration slot to each visible child. */
	fixed: "fixed"
} as const;
export type AutoCapsuleTimeMode = ValueOf<typeof TIME_MODE>;

/**
 * Portable capsule kind. These values intentionally mirror the current product language.
 */
export const CAPSULE_TYPE = {
	/** One visible child at a time, usually on a `1 x 1` grid. */
	carrousel: "carrousel",
	/** Linear capsule, typically horizontal or vertical. */
	rangee: "rangee",
	/** List-oriented capsule with one item per row. */
	liste: "liste",
	/** General-purpose grid capsule. */
	grille: "grille",
	/** Capsule that prefers explicit area-based positioning. */
	position: "position",
	/** Capsule that can rely on named areas or card-like templates. */
	card: "card",
	/** Fallback type when no specialized behavior is requested. */
	legacy: "legacy"
} as const;
export type AutoCapsuleType = ValueOf<typeof CAPSULE_TYPE>;

/**
 * Portable orientation constants used by derived grid modes.
 */
export const ORIENTATION = {
	/** Distribute or interpret the grid on the horizontal axis first. */
	horizontal: "horizontal",
	/** Distribute or interpret the grid on the vertical axis first. */
	vertical: "vertical"
} as const;
export type AutoCapsuleOrientation = ValueOf<typeof ORIENTATION>;

/**
 * Reserved event action constants used by the component.
 */
export const EVENT_ACTION = {
	/** Entry event of a child or state change. */
	intro: "intro",
	/** Exit event of a child or state change. */
	outro: "outro",
	/** Sustained event between entry and exit. */
	sustain: "sustain"
} as const;

/**
 * Public event action identifier.
 *
 * Reserved values in v1 are `EVENT_ACTION.intro`, `EVENT_ACTION.outro` and `EVENT_ACTION.sustain`, but the type stays open to
 * avoid coupling the portable API to the current event implementation.
 */
export type AutoCapsuleEventAction = string;

/**
 * Placement token categories used when generating child placement classes.
 */
export const AREA_KIND = {
	/** Single-cell grid placement. */
	gridArea: "grid-area",
	/** Multi-span grid placement. */
	gridSpan: "grid-span",
	/** List row placement. */
	listRow: "list-row"
} as const;
export type AutoCapsuleAreaKind = ValueOf<typeof AREA_KIND>;

/**
 * Grid interpretation policies attached to capsule types.
 */
export const GRID_POLICY = {
	/** Interpret the capsule as a single-cell stack. */
	stack: "stack",
	/** Interpret the capsule as a line derived from orientation. */
	line: "line",
	/** Interpret the capsule as a list. */
	list: "list",
	/** Interpret the capsule as a manual or parametric grid. */
	grid: "grid",
	/** Interpret the capsule as a named-area grid. */
	areas: "areas",
	/** Use fallback behavior compatible with a generic legacy capsule. */
	legacy: "legacy"
} as const;
export type AutoCapsuleGridPolicy = ValueOf<typeof GRID_POLICY>;

/**
 * Placement behavior policies attached to capsule types.
 */
export const PLACEMENT_POLICY = {
	/** Generate placement automatically when no explicit placement is provided. */
	auto: "auto",
	/** Require explicit placement and avoid generating automatic coordinates. */
	explicitOnly: "explicit-only",
	/** Allow explicit placement but keep automatic fallback behavior. */
	mixed: "mixed"
} as const;
export type AutoCapsulePlacementPolicy = ValueOf<typeof PLACEMENT_POLICY>;

/**
 * Diagnostic severity levels emitted by the component.
 */
export const DIAGNOSTIC_LEVEL = {
	/** Informational message that does not indicate a failure. */
	info: "info",
	/** Non-blocking issue that may require caller attention. */
	warning: "warning",
	/** Blocking issue that should be treated as an error by the caller. */
	error: "error"
} as const;
export type AutoCapsuleDiagnosticLevel = ValueOf<typeof DIAGNOSTIC_LEVEL>;

/**
 * Time range input for the capsule and resolved child schedules.
 */
export type AutoCapsuleTimeRangeInput = {
	/** Start of the range in milliseconds. */
	startMs: number;
	/** End of the range in milliseconds. */
	endMs: number;
};

/**
 * Generic named event time. It can be used by host applications to anchor named events
 * without relying on application-specific timing vocabulary.
 */
export type AutoCapsuleEventTimeInput = {
	/** Stable name referenced by child events. */
	name: string;
	/** Start of the named event time in milliseconds. */
	startMs: number;
	/** End of the named event time in milliseconds. */
	endMs: number;
};

/**
 * Portable named event definition registry entry.
 *
 * A definition is referenced by `event.ref` and can describe how the host application
 * should interpret or animate that event.
 */
export type AutoCapsuleEventDefinition = {
	/** Human-readable label for tooling or UI. */
	label?: string;
	/** Optional class to associate with the definition. */
	className?: string | null;
	/** Optional style transitions grouped by action name. */
	style?: Partial<
		Record<
			AutoCapsuleEventAction,
			Record<string, { from?: string | number; to: string | number }> | undefined
		>
	>;
	/** Default duration applied when an event using this ref does not define its own duration. */
	durationMs?: number | null;
};

/**
 * Grid configuration of the capsule container.
 */
export type AutoCapsuleGridInput = {
	/** Grid mode used to compute the capsule container. */
	mode: AutoCapsuleGridMode;
	/** Optional extra class tokens applied to the grid container. */
	className?: string | null;
	/**
	 * Main explicit grid step. This is the primary mode for common usage.
	 * When omitted in `GRID_MODE.manual` or `GRID_MODE.areas`, type defaults are used.
	 */
	rows?: number | null;
	/**
	 * Main explicit grid step. This is the primary mode for common usage.
	 * When omitted in `GRID_MODE.manual` or `GRID_MODE.areas`, type defaults are used.
	 */
	cols?: number | null;
	/** Orientation used by derived grid modes. */
	orientation?: AutoCapsuleOrientation | null;
	/** Optional named areas contract for area-based layouts. */
	areas?: string[] | null;
	/** Shared CSS gap value applied when row and column gaps are identical. */
	gap?: string | null;
	/** CSS row-gap override. */
	rowGap?: string | null;
	/** CSS column-gap override. */
	columnGap?: string | null;
	/** Optional container class token emitted in addition to generated classes. */
	containerClassName?: string | null;
};

/**
 * Timing policy for automatic child distribution.
 */
export type AutoCapsuleTimingInput = {
	/** Automatic child time distribution strategy. */
	mode?: AutoCapsuleTimeMode | null;
	/** Fixed slot duration used when `mode === TIME_MODE.fixed`. */
	fixedDurationMs?: number | null;
};

/**
 * Default capsule transitions and behavior.
 */
export type AutoCapsuleDefaultsInput = {
	/** Default named event definition ref used for generated intro events. */
	introTransitionRef?: string | null;
	/** Default named event definition ref used for generated outro events. */
	outroTransitionRef?: string | null;
	/** Whether a missing outro should be generated automatically. */
	generateDefaultOutro?: boolean | null;
};

/**
 * Root capsule definition.
 */
export type AutoCapsuleDefinition = {
	/** Stable capsule identifier. */
	id: string;
	/** Capsule type used to resolve defaults and policies. */
	type: AutoCapsuleType;
	/** Optional display name. */
	name?: string;
	/** Visible time range of the capsule. */
	timeRange: AutoCapsuleTimeRangeInput;
	/** Grid definition used to build the capsule container context. */
	grid: AutoCapsuleGridInput;
	/** Optional timing override for child scheduling. */
	timing?: AutoCapsuleTimingInput;
	/** Optional defaults used when events must be generated. */
	defaults?: AutoCapsuleDefaultsInput;
	/** Optional extra class tokens applied to the capsule container. */
	className?: string | null;
	/** Optional inline style applied to the capsule container. */
	style?: Record<string, string | number>;
};

/**
 * Optional placement override for a child.
 */
export type AutoCapsuleChildPlacementInput = {
	/** Explicit area token used instead of row and column coordinates. */
	area?: string | null;
	/** Explicit grid row start. */
	row?: number | null;
	/** Explicit grid column start. */
	col?: number | null;
	/** Explicit grid row span. */
	rowSpan?: number | null;
	/** Explicit grid column span. */
	colSpan?: number | null;
	/** Optional extra placement class token. */
	className?: string | null;
};

/**
 * Optional child-level constraints.
 */
export type AutoCapsuleChildConstraintInput = {
	/** Locked time range that the automatic resolver must preserve for the child. */
	lockedTimeRange?: AutoCapsuleTimeRangeInput | null;
	/** Optional minimum duration kept for future timing strategies. */
	minDurationMs?: number | null;
	/** Optional maximum duration kept for future timing strategies. */
	maxDurationMs?: number | null;
	/** Prevent placement updates by external tooling. */
	lockPlacement?: boolean | null;
	/** Prevent automatic class generation for the child. */
	lockClassGeneration?: boolean | null;
};

/**
 * Event input attached to a child.
 */
export type AutoCapsuleEventInput = {
	/** Optional name linked to a named event time. */
	name?: string | null;
	/** Action carried by the event. */
	action: AutoCapsuleEventAction;
	/** Optional named event definition ref such as `fade` or `zoom`. */
	ref?: string | null;
	/** Duration override in milliseconds. */
	durationMs?: number | null;
	/** Optional class token attached to the event artifact. */
	className?: string | null;
	/** Optional inline style payload attached to the event artifact. */
	style?: Record<string, string | number>;
};

/**
 * Child entry used by the capsule engine.
 */
export type AutoCapsuleChildInput = {
	/** Stable child identifier. */
	id: string;
	/** Ordering key used by placement and timing resolution. */
	order: number;
	/** Whether the child participates in resolution and output. */
	visible?: boolean;
	/** Optional extra class tokens applied to the child. */
	className?: string | null;
	/** Optional inline style applied to the child. */
	style?: Record<string, string | number>;
	/** Optional explicit placement override. */
	placement?: AutoCapsuleChildPlacementInput | null;
	/** Optional timing and placement constraints. */
	constraints?: AutoCapsuleChildConstraintInput;
	/** Optional explicit event map keyed by action name. */
	events?: Partial<Record<AutoCapsuleEventAction, AutoCapsuleEventInput>>;
};

/**
 * Naming inputs used by the configuration.
 */
export type AutoCapsuleGridNamingInput = {
	type: AutoCapsuleType;
	rows: number;
	cols: number;
	mode: AutoCapsuleGridInput["mode"];
};

export type AutoCapsuleAreaNamingInput = {
	row: number;
	col: number;
	rowSpan?: number;
	colSpan?: number;
	index?: number;
	kind: AutoCapsuleAreaKind;
};

export type AutoCapsuleSyntheticEventNamingInput = {
	capsuleId: string;
	childId: string;
	action: AutoCapsuleEventAction;
	triggerMs: number;
};

/**
 * Behavior registry entry for one capsule type.
 */
export type AutoCapsuleTypeBehavior = {
	/** Default automatic child timing mode for the type. */
	defaultTimeMode: AutoCapsuleTimeMode;
	/** Default fixed duration used when the fixed mode is active. */
	defaultFixedDurationMs: number;
	/** Default row step used when manual rows are omitted. */
	defaultRows: number;
	/** Default column step used when manual columns are omitted. */
	defaultCols: number;
	/** Default grid interpretation policy of the type. */
	gridPolicy: AutoCapsuleGridPolicy;
	/** Default child placement policy of the type. */
	placementPolicy: AutoCapsulePlacementPolicy;
	/** Default intro ref used when generating intro events. */
	defaultIntroRef: string | null;
	/** Default outro ref used when generating outro events. */
	defaultOutroRef: string | null;
	/** Default policy for generating missing outro events. */
	defaultGenerateDefaultOutro: boolean;
};

/**
 * Portable component configuration.
 */
export type AutoCapsuleConfig = {
	/** Type registry used by the resolver. */
	types: Record<AutoCapsuleType, AutoCapsuleTypeBehavior>;
	/** Naming hooks used to emit classes and synthetic event names. */
	naming: {
		/** Build the container grid class token. */
		buildGridClassName(input: AutoCapsuleGridNamingInput): string;
		/** Build one child placement class token. */
		buildAreaClassName(input: AutoCapsuleAreaNamingInput): string;
		/** Build the list-row class token for list-like placement. */
		buildListItemClassName(index: number): string;
		/** Build the synthetic event name used for generated events. */
		buildSyntheticEventName(input: AutoCapsuleSyntheticEventNamingInput): string;
	};
	/** Default refs used as a final fallback for generated intro/outro events. */
	transitions: {
		defaultIntroRef: string | null;
		defaultOutroRef: string | null;
	};
	/** Built-in named event definition registry. */
	defaultEventDefinitions: Record<string, AutoCapsuleEventDefinition>;
};

/**
 * Construction options for the AutoCapsule instance.
 */
export type AutoCapsuleOptions = {
	/** Kept for API stability; write methods currently resolve immediately. */
	autoResolveOnWrite?: boolean;
	/** Whether diagnostics should be included in resolved outputs. */
	includeDiagnostics?: boolean;
};

/**
 * Root input of the portable component.
 */
export type AutoCapsuleInput = {
	/** Root capsule definition. */
	capsule: AutoCapsuleDefinition;
	/** Child entries resolved inside the capsule. */
	children: AutoCapsuleChildInput[];
	/** Optional named event times registry. */
	eventTimes?: AutoCapsuleEventTimeInput[];
	/** Optional named event definitions registry overriding or extending defaults. */
	eventDefinitions?: Record<string, AutoCapsuleEventDefinition>;
	/** Optional partial config overriding the built-in defaults. */
	config?: Partial<AutoCapsuleConfig>;
};

/**
 * Resolved grid artifact.
 */
export type AutoCapsuleGridArtifact = {
	/** Final class string applied to the capsule grid container. */
	className: string;
	/** DOM-ready inline style representation of the grid container. */
	inlineStyle: Record<string, string | number>;
	/** CSS rules that can be injected by the host application. */
	cssRules: string[];
	/** Reusable grid context consumed by placement and host tooling. */
	context: {
		/** Effective resolved row count. */
		rows: number;
		/** Effective resolved column count. */
		cols: number;
		/** Effective named area contract, when present. */
		areas: string[];
		/** Effective grid mode used for resolution. */
		mode: AutoCapsuleGridInput["mode"];
	};
};

/**
 * Resolved child placement.
 */
export type AutoCapsuleResolvedChildPlacement = {
	/** Main placement area class token emitted for the child. */
	areaClassName: string | null;
	/** Full placement class token applied to the child. */
	placementClassName: string | null;
	/** Placement-specific CSS rules emitted by the resolver. */
	cssRules: string[];
	/** Resolved CSS grid-row value when applicable. */
	gridRow?: string;
	/** Resolved CSS grid-column value when applicable. */
	gridColumn?: string;
};

/**
 * Resolved time range for a child.
 */
export type AutoCapsuleResolvedTimeRange = {
	/** Resolved start time in milliseconds. */
	startMs: number;
	/** Resolved end time in milliseconds. */
	endMs: number;
	/** Resolved duration in milliseconds. */
	durationMs: number;
	/** Whether the range came from an explicit child-level lock. */
	locked: boolean;
};

/**
 * Resolved event artifact.
 */
export type AutoCapsuleResolvedEvent = {
	/** Final event name. */
	name: string;
	/** Final event action. */
	action: AutoCapsuleEventAction;
	/** Resolved trigger time in milliseconds. */
	triggerMs: number;
	/** Final duration in milliseconds. */
	durationMs: number;
	/** Whether the event was generated by the engine. */
	isSynthetic: boolean;
	/** Named event definition ref used by the event. */
	ref?: string | null;
	/** Resolved named event definition when a ref is available. */
	definition?: AutoCapsuleEventDefinition | null;
	/** Optional class token attached to the event artifact. */
	className?: string | null;
	/** Optional style payload attached to the event artifact. */
	style?: Record<string, string | number>;
};

/**
 * Resolved event map of a child.
 */
export type AutoCapsuleResolvedChildEvents = Record<string, AutoCapsuleResolvedEvent>;

/**
 * Generic diagnostic emitted by the engine.
 */
export type AutoCapsuleDiagnostic = {
	/** Severity of the diagnostic. */
	level: AutoCapsuleDiagnosticLevel;
	/** Stable diagnostic code for machine handling. */
	code: string;
	/** Human-readable diagnostic message. */
	message: string;
	/** Optional child identifier when the diagnostic is child-specific. */
	childId?: string;
};

/**
 * DOM-facing capsule artifact.
 */
export type AutoCapsuleElementArtifact = {
	/** Capsule identifier. */
	id: string;
	/** Final class string applied to the capsule element. */
	className: string;
	/** Final class tokens before concatenation. */
	classTokens: string[];
	/** DOM-ready inline style payload. */
	inlineStyle: Record<string, string | number>;
	/** Capsule-level CSS rules to inject. */
	cssRules: string[];
};

/**
 * DOM-facing child artifact.
 */
export type AutoCapsuleChildElementArtifact = {
	/** Child identifier. */
	id: string;
	/** Final class string applied to the child element. */
	className: string;
	/** Final class tokens before concatenation. */
	classTokens: string[];
	/** DOM-ready inline style payload. */
	inlineStyle: Record<string, string | number>;
	/** Child-level CSS rules to inject. */
	cssRules: string[];
	/** Resolved placement artifact. */
	placement: AutoCapsuleResolvedChildPlacement;
	/** Resolved child time range. */
	timeRange: AutoCapsuleResolvedTimeRange;
	/** Resolved event map. */
	events: AutoCapsuleResolvedChildEvents;
	/** Resolution metadata useful to host tooling. */
	meta: {
		/** Whether placement was automatically generated. */
		usedAutoPlacement: boolean;
		/** Whether timing was automatically generated. */
		usedAutoTiming: boolean;
		/** Whether one or more events were generated automatically. */
		usedSyntheticEvents: boolean;
	};
};

/**
 * Runtime component state.
 */
export type AutoCapsuleState = {
	/** Current capsule definition. */
	capsule: AutoCapsuleDefinition;
	/** Current child list. */
	children: AutoCapsuleChildInput[];
	/** Current named event time registry. */
	eventTimes: AutoCapsuleEventTimeInput[];
	/** Current named event definition registry. */
	eventDefinitions: Record<string, AutoCapsuleEventDefinition>;
	/** Current resolved configuration, including functions. */
	config: AutoCapsuleConfig;
};

/**
 * Serializable state exported by `toJSON()`.
 */
export type AutoCapsuleSerializableState = {
	/** Capsule definition that can be serialized and rehydrated. */
	capsule: AutoCapsuleDefinition;
	/** Child list that can be serialized and rehydrated. */
	children: AutoCapsuleChildInput[];
	/** Named event times that can be serialized and rehydrated. */
	eventTimes: AutoCapsuleEventTimeInput[];
	/** Named event definitions that can be serialized and rehydrated. */
	eventDefinitions: Record<string, AutoCapsuleEventDefinition>;
};

/**
 * Main resolved output of the portable component.
 */
export type AutoCapsuleResult = {
	/** Serializable state snapshot returned with the result. */
	state: AutoCapsuleSerializableState;
	/** Resolved capsule grid artifact. */
	grid: AutoCapsuleGridArtifact;
	/** DOM-facing capsule artifact. */
	capsule: AutoCapsuleElementArtifact;
	/** DOM-facing child artifacts. */
	children: AutoCapsuleChildElementArtifact[];
	/** Aggregated stylesheet built from capsule and child CSS rules. */
	styleSheet: string;
	/** Diagnostics emitted during resolution. */
	diagnostics: AutoCapsuleDiagnostic[];
};
