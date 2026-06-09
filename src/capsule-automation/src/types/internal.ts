import type {
	AutoCapsuleChildInput,
	AutoCapsuleConfig,
	AutoCapsuleDefinition,
	AutoCapsuleDiagnostic,
	AutoCapsuleEventDefinition,
	AutoCapsuleEventTimeInput,
	AutoCapsuleGridArtifact,
	AutoCapsuleOptions,
	AutoCapsuleResolvedChildEvents,
	AutoCapsuleResolvedChildPlacement,
	AutoCapsuleResolvedTimeRange
} from "./public";

export type AutoCapsuleNormalizedState = {
	capsule: AutoCapsuleDefinition;
	children: AutoCapsuleChildInput[];
	eventTimes: AutoCapsuleEventTimeInput[];
	eventDefinitions: Record<string, AutoCapsuleEventDefinition>;
	config: AutoCapsuleConfig;
	options: Required<AutoCapsuleOptions>;
};

export type AutoCapsuleOrderedChild = AutoCapsuleChildInput & {
	index: number;
};

export type AutoCapsuleGridComputation = {
	artifact: AutoCapsuleGridArtifact;
	diagnostics: AutoCapsuleDiagnostic[];
};

export type AutoCapsuleTimingComputation = {
	byChildId: Record<string, AutoCapsuleResolvedTimeRange>;
	usedAutoTimingByChildId: Record<string, boolean>;
	diagnostics: AutoCapsuleDiagnostic[];
};

export type AutoCapsulePlacementEntry = {
	placement: AutoCapsuleResolvedChildPlacement;
	usedAutoPlacement: boolean;
};

export type AutoCapsulePlacementComputation = {
	byChildId: Record<string, AutoCapsulePlacementEntry>;
	diagnostics: AutoCapsuleDiagnostic[];
};

export type AutoCapsuleEventComputation = {
	byChildId: Record<string, AutoCapsuleResolvedChildEvents>;
	usedSyntheticEventsByChildId: Record<string, boolean>;
	diagnostics: AutoCapsuleDiagnostic[];
};
