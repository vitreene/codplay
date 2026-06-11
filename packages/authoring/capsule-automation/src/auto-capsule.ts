import { mergeAutoCapsuleConfig } from "./config/default-config";
import { buildAutoCapsuleGrid } from "./core/build-grid";
import { resolveAutoCapsuleEvents } from "./core/resolve-events";
import { resolveAutoCapsulePlacement } from "./core/resolve-placement";
import { renderAutoCapsuleStyleSheet } from "./core/render-stylesheet";
import { resolveAutoCapsuleTiming } from "./core/resolve-timing";
import type {
	AutoCapsuleChildElementArtifact,
	AutoCapsuleChildInput,
	AutoCapsuleChildPlacementInput,
	AutoCapsuleConfig,
	AutoCapsuleDefinition,
	AutoCapsuleDiagnostic,
	AutoCapsuleElementArtifact,
	AutoCapsuleEventDefinition,
	AutoCapsuleEventAction,
	AutoCapsuleEventInput,
	AutoCapsuleInput,
	AutoCapsuleOptions,
	AutoCapsuleResult,
	AutoCapsuleSerializableState,
	AutoCapsuleState,
	AutoCapsuleEventTimeInput,
	AutoCapsuleTimeRangeInput
} from "./types/public";
import type { AutoCapsuleNormalizedState, AutoCapsuleOrderedChild } from "./types/internal";

function cloneObject<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Build a deduplicated list of non-empty class tokens.
 */
function uniqueTokens(...sources: Array<string | null | undefined>): string[] {
	const tokens = sources
		.flatMap((source) => String(source || "").split(/\s+/))
		.map((token) => token.trim())
		.filter(Boolean);
	return [...new Set(tokens)];
}

/**
 * Order visible children deterministically for timing and placement resolution.
 */
function orderVisibleChildren(children: AutoCapsuleChildInput[]): AutoCapsuleOrderedChild[] {
	return children
		.filter((child) => child.visible !== false)
		.slice()
		.sort((left, right) => {
			if (left.order !== right.order) return left.order - right.order;
			return left.id.localeCompare(right.id);
		})
		.map((child, index) => ({ ...child, index }));
}

/**
 * Normalize constructor input into the internal engine state.
 *
 * Main variables:
 * - `resolvedConfig`: final config after default merge
 * - `eventDefinitions`: merged registry from defaults and caller overrides
 */
function buildNormalizedState(
	input: AutoCapsuleInput,
	options: AutoCapsuleOptions | undefined
): AutoCapsuleNormalizedState {
	const resolvedConfig = mergeAutoCapsuleConfig(input.config);
	return {
		capsule: cloneObject(input.capsule),
		children: cloneObject(input.children),
		eventTimes: cloneObject(input.eventTimes || []),
		eventDefinitions: {
			...cloneObject(resolvedConfig.defaultEventDefinitions),
			...(cloneObject(input.eventDefinitions || {}) || {})
		},
		config: resolvedConfig,
		options: {
			autoResolveOnWrite: options?.autoResolveOnWrite ?? true,
			includeDiagnostics: options?.includeDiagnostics ?? true
		}
	};
}

/**
 * Project the capsule container into a DOM-facing artifact.
 */
function buildCapsuleArtifact(
	state: AutoCapsuleNormalizedState,
	gridClassName: string,
	gridInlineStyle: Record<string, string | number>,
	gridCssRules: string[]
): AutoCapsuleElementArtifact {
	const classTokens = uniqueTokens(state.capsule.className, gridClassName);
	return {
		id: state.capsule.id,
		className: classTokens.join(" "),
		classTokens,
		inlineStyle: {
			...gridInlineStyle,
			...(state.capsule.style || {})
		},
		cssRules: gridCssRules
	};
}

/**
 * Project one resolved child into a DOM-facing artifact.
 */
function buildChildArtifact(input: {
	child: AutoCapsuleOrderedChild;
	timeRange: AutoCapsuleResult["children"][number]["timeRange"];
	placement: AutoCapsuleResult["children"][number]["placement"];
	events: AutoCapsuleResult["children"][number]["events"];
	usedAutoPlacement: boolean;
	usedAutoTiming: boolean;
	usedSyntheticEvents: boolean;
}): AutoCapsuleChildElementArtifact {
	const classTokens = uniqueTokens(
		input.child.className,
		input.child.placement?.className,
		input.placement.placementClassName,
		input.placement.areaClassName
	);

	return {
		id: input.child.id,
		className: classTokens.join(" "),
		classTokens,
		inlineStyle: { ...(input.child.style || {}) },
		cssRules: input.placement.cssRules,
		placement: input.placement,
		timeRange: input.timeRange,
		events: input.events,
		meta: {
			usedAutoPlacement: input.usedAutoPlacement,
			usedAutoTiming: input.usedAutoTiming,
			usedSyntheticEvents: input.usedSyntheticEvents
		}
	};
}

/**
 * Pure portable capsule engine.
 *
 * Responsibilities:
 * - own a serializable capsule state
 * - build the capsule grid context
 * - resolve child placement and timing
 * - emit DOM-ready artifacts without touching the DOM
 *
 * Main variables:
 * - `state`: normalized internal state owned by the instance
 * - `lastResult`: last resolved artifact set, reused by `renderStyleSheet()`
 */
export class AutoCapsule {
	private state: AutoCapsuleNormalizedState;
	private lastResult: AutoCapsuleResult | null = null;

	/**
	 * Create a portable AutoCapsule instance.
	 */
	constructor(input: AutoCapsuleInput, options?: AutoCapsuleOptions) {
		this.state = buildNormalizedState(input, options);
		if (this.state.options.autoResolveOnWrite) {
			this.lastResult = this.resolve();
		}
	}

	/**
	 * Return a deep-cloned snapshot of the current runtime state.
	 */
	getState(): AutoCapsuleState {
		return {
			capsule: cloneObject(this.state.capsule),
			children: cloneObject(this.state.children),
			eventTimes: cloneObject(this.state.eventTimes),
			eventDefinitions: cloneObject(this.state.eventDefinitions),
			config: {
				...this.state.config,
				types: { ...this.state.config.types },
				naming: { ...this.state.config.naming },
				transitions: { ...this.state.config.transitions },
				defaultEventDefinitions: cloneObject(this.state.config.defaultEventDefinitions)
			}
		};
	}

	/**
	 * Return a deep-cloned serializable payload without config functions.
	 */
	getSerializableState(): AutoCapsuleSerializableState {
		return {
			capsule: cloneObject(this.state.capsule),
			children: cloneObject(this.state.children),
			eventTimes: cloneObject(this.state.eventTimes),
			eventDefinitions: cloneObject(this.state.eventDefinitions)
		};
	}

	/**
	 * Return the current generic event times registry.
	 */
	getEventTimes(): AutoCapsuleEventTimeInput[] {
		return cloneObject(this.state.eventTimes);
	}

	/**
	 * Return the current named event definitions registry.
	 */
	getEventDefinitions(): Record<string, AutoCapsuleEventDefinition> {
		return cloneObject(this.state.eventDefinitions);
	}

	/**
	 * Update the capsule root definition.
	 */
	setCapsule(patch: Partial<AutoCapsuleDefinition>): AutoCapsuleResult {
		this.state.capsule = {
			...this.state.capsule,
			...cloneObject(patch),
			grid: patch.grid ? { ...this.state.capsule.grid, ...cloneObject(patch.grid) } : this.state.capsule.grid,
			timing: patch.timing
				? { ...(this.state.capsule.timing || {}), ...cloneObject(patch.timing) }
				: this.state.capsule.timing,
			defaults: patch.defaults
				? { ...(this.state.capsule.defaults || {}), ...cloneObject(patch.defaults) }
				: this.state.capsule.defaults
		};
		return this.commitWrite();
	}

	/**
	 * Update only the grid input of the capsule.
	 */
	setGrid(patch: Partial<AutoCapsuleDefinition["grid"]>): AutoCapsuleResult {
		this.state.capsule.grid = {
			...this.state.capsule.grid,
			...cloneObject(patch)
		};
		return this.commitWrite();
	}

	/**
	 * Update the visible time range of the capsule.
	 */
	setTimeRange(timeRange: AutoCapsuleTimeRangeInput): AutoCapsuleResult {
		this.state.capsule.timeRange = cloneObject(timeRange);
		return this.commitWrite();
	}

	/**
	 * Add or replace a child by id.
	 */
	upsertChild(child: AutoCapsuleChildInput): AutoCapsuleResult {
		const next = cloneObject(child);
		const index = this.state.children.findIndex((entry) => entry.id === next.id);
		if (index >= 0) this.state.children[index] = next;
		else this.state.children.push(next);
		return this.commitWrite();
	}

	/**
	 * Remove a child from the capsule.
	 */
	removeChild(childId: string): AutoCapsuleResult {
		this.state.children = this.state.children.filter((child) => child.id !== childId);
		return this.commitWrite();
	}

	/**
	 * Reorder children explicitly from an ordered list of ids.
	 */
	reorderChildren(childIds: string[]): AutoCapsuleResult {
		const orderById = new Map(childIds.map((id, index) => [id, index]));
		this.state.children = this.state.children.map((child) => ({
			...child,
			order: orderById.has(child.id) ? orderById.get(child.id)! : child.order
		}));
		return this.commitWrite();
	}

	/**
	 * Set or clear a child placement override.
	 */
	setChildPlacement(childId: string, placement: AutoCapsuleChildPlacementInput | null): AutoCapsuleResult {
		this.state.children = this.state.children.map((child) =>
			child.id === childId ? { ...child, placement: cloneObject(placement) } : child
		);
		return this.commitWrite();
	}

	/**
	 * Patch child constraints.
	 */
	setChildConstraint(
		childId: string,
		patch: Partial<NonNullable<AutoCapsuleChildInput["constraints"]>>
	): AutoCapsuleResult {
		this.state.children = this.state.children.map((child) =>
			child.id === childId
				? {
					...child,
					constraints: {
						...(child.constraints || {}),
						...cloneObject(patch)
					}
				}
				: child
		);
		return this.commitWrite();
	}

	/**
	 * Set or clear one child event.
	 */
	setChildEvent(childId: string, action: AutoCapsuleEventAction, event: AutoCapsuleEventInput | null): AutoCapsuleResult {
		this.state.children = this.state.children.map((child) => {
			if (child.id !== childId) return child;
			const events = { ...(child.events || {}) };
			if (event) events[action] = cloneObject(event);
			else delete events[action];
			return { ...child, events };
		});
		return this.commitWrite();
	}

	/**
	 * Add or replace one generic named event time.
	 */
	upsertEventTime(eventTime: AutoCapsuleEventTimeInput): AutoCapsuleResult {
		const next = cloneObject(eventTime);
		const index = this.state.eventTimes.findIndex((entry) => entry.name === next.name);
		if (index >= 0) this.state.eventTimes[index] = next;
		else this.state.eventTimes.push(next);
		return this.commitWrite();
	}

	/**
	 * Remove one generic named event time.
	 */
	removeEventTime(name: string): AutoCapsuleResult {
		this.state.eventTimes = this.state.eventTimes.filter((entry) => entry.name !== name);
		return this.commitWrite();
	}

	/**
	 * Add or replace one named event definition such as `fade`.
	 */
	upsertEventDefinition(key: string, definition: AutoCapsuleEventDefinition): AutoCapsuleResult {
		this.state.eventDefinitions = {
			...this.state.eventDefinitions,
			[key]: cloneObject(definition)
		};
		return this.commitWrite();
	}

	/**
	 * Remove one named event definition.
	 */
	removeEventDefinition(key: string): AutoCapsuleResult {
		const next = { ...this.state.eventDefinitions };
		delete next[key];
		this.state.eventDefinitions = next;
		return this.commitWrite();
	}

	/**
	 * Build only the grid artifact from the current state.
	 */
	buildGrid() {
		const orderedChildren = orderVisibleChildren(this.state.children);
		return buildAutoCapsuleGrid(this.state, orderedChildren.length).artifact;
	}

	/**
	 * Resolve the full capsule output.
	 */
	resolve(): AutoCapsuleResult {
		const diagnostics: AutoCapsuleDiagnostic[] = [];
		const orderedChildren = orderVisibleChildren(this.state.children);
		const gridComputation = buildAutoCapsuleGrid(this.state, orderedChildren.length);
		const timingComputation = resolveAutoCapsuleTiming(this.state, orderedChildren);
		const placementComputation = resolveAutoCapsulePlacement(this.state, orderedChildren, gridComputation.artifact);
		const eventComputation = resolveAutoCapsuleEvents(this.state, orderedChildren, timingComputation);

		diagnostics.push(
			...gridComputation.diagnostics,
			...timingComputation.diagnostics,
			...placementComputation.diagnostics,
			...eventComputation.diagnostics
		);

		const capsule = buildCapsuleArtifact(
			this.state,
			gridComputation.artifact.className,
			gridComputation.artifact.inlineStyle,
			gridComputation.artifact.cssRules
		);

		const children = orderedChildren.map((child) =>
			buildChildArtifact({
				child,
				timeRange: timingComputation.byChildId[child.id],
				placement: placementComputation.byChildId[child.id].placement,
				events: eventComputation.byChildId[child.id],
				usedAutoPlacement: placementComputation.byChildId[child.id].usedAutoPlacement,
				usedAutoTiming: timingComputation.usedAutoTimingByChildId[child.id],
				usedSyntheticEvents: eventComputation.usedSyntheticEventsByChildId[child.id]
			})
		);

		const allRules = [
			...capsule.cssRules,
			...children.flatMap((child) => child.cssRules)
		];
		const styleSheet = renderAutoCapsuleStyleSheet(allRules);

		const result: AutoCapsuleResult = {
			state: this.getSerializableState(),
			grid: gridComputation.artifact,
			capsule,
			children,
			styleSheet,
			diagnostics: this.state.options.includeDiagnostics ? diagnostics : []
		};

		this.lastResult = result;
		return result;
	}

	/**
	 * Render the latest stylesheet, computing it first if needed.
	 */
	renderStyleSheet(): string {
		return (this.lastResult || this.resolve()).styleSheet;
	}

	/**
	 * Export a serializable deep-cloned state.
	 */
	toJSON(): AutoCapsuleSerializableState {
		return this.getSerializableState();
	}

	private commitWrite(): AutoCapsuleResult {
		return this.resolve();
	}
}

export type { AutoCapsuleConfig };
