import type {
	AutoCapsuleDiagnostic,
	AutoCapsuleResolvedChildEvents,
} from "../types/public";
import { DIAGNOSTIC_LEVEL, EVENT_ACTION } from "../types/public";
import type {
	AutoCapsuleEventComputation,
	AutoCapsuleNormalizedState,
	AutoCapsuleOrderedChild,
	AutoCapsuleTimingComputation
} from "../types/internal";

function buildEventTimeByName(state: AutoCapsuleNormalizedState): Map<string, { startMs: number; endMs: number }> {
	const eventTimeByName = new Map<string, { startMs: number; endMs: number }>();
	for (const eventTime of state.eventTimes) {
		eventTimeByName.set(eventTime.name, { startMs: eventTime.startMs, endMs: eventTime.endMs });
	}
	return eventTimeByName;
}

/**
 * Resolve the trigger time of one explicit child event.
 */
function resolveExplicitEventTriggerMs(
	action: string,
	eventName: string | null | undefined,
	childRange: { startMs: number; endMs: number },
	eventTimeByName: Map<string, { startMs: number; endMs: number }>
): number {
	if (eventName && eventTimeByName.has(eventName)) {
		return eventTimeByName.get(eventName)!.startMs;
	}
	if (action === EVENT_ACTION.outro) return childRange.endMs;
	return childRange.startMs;
}

/**
 * Resolve one named event definition from the local registry.
 */
function resolveEventDefinition(state: AutoCapsuleNormalizedState, ref: string | null | undefined) {
	if (!ref) return null;
	return state.eventDefinitions[ref] || null;
}

/**
 * Resolve explicit events and generate missing intro/outro anchors when needed.
 *
 * Main variables:
 * - `eventTimeByName`: generic named time anchors available to events
 * - `behavior`: event defaults inherited from the capsule type
 * - `generateDefaultOutro`: effective policy for missing outro generation
 * - `resolved`: final event map produced for one child
 */
export function resolveAutoCapsuleEvents(
	state: AutoCapsuleNormalizedState,
	orderedChildren: AutoCapsuleOrderedChild[],
	timing: AutoCapsuleTimingComputation
): AutoCapsuleEventComputation {
	const diagnostics: AutoCapsuleDiagnostic[] = [];
	const byChildId: Record<string, AutoCapsuleResolvedChildEvents> = {};
	const usedSyntheticEventsByChildId: Record<string, boolean> = {};
	const eventTimeByName = buildEventTimeByName(state);
	const behavior = state.config.types[state.capsule.type] || state.config.types.legacy;
	const generateDefaultOutro =
		state.capsule.defaults?.generateDefaultOutro ?? behavior.defaultGenerateDefaultOutro;

	for (const child of orderedChildren) {
		const childRange = timing.byChildId[child.id];
		const currentEvents = child.events || {};
		const resolved: AutoCapsuleResolvedChildEvents = {};
		let usedSyntheticEvents = false;

		for (const [action, event] of Object.entries(currentEvents)) {
			if (!event) continue;
			const triggerMs = resolveExplicitEventTriggerMs(action, event.name, childRange, eventTimeByName);
			const definition = resolveEventDefinition(state, event.ref);
			resolved[action] = {
				name:
					event.name ||
					state.config.naming.buildSyntheticEventName({
						capsuleId: state.capsule.id,
						childId: child.id,
						action,
						triggerMs
					}),
				action,
				triggerMs,
				durationMs: Math.max(0, event.durationMs ?? definition?.durationMs ?? 0),
				isSynthetic: !event.name,
				ref: event.ref,
				definition,
				className: event.className,
				style: event.style
			};

			if (action !== EVENT_ACTION.intro && action !== EVENT_ACTION.outro && !event.name && state.options.includeDiagnostics) {
				diagnostics.push({
					level: DIAGNOSTIC_LEVEL.info,
					code: "event-fallback-trigger",
					message:
						"A non intro/outro event without explicit event time falls back to the child start time in this first implementation.",
					childId: child.id
				});
			}
		}

		if (!resolved[EVENT_ACTION.intro]) {
			const triggerMs = childRange.startMs;
			const ref =
				state.capsule.defaults?.introTransitionRef ||
				behavior.defaultIntroRef ||
				state.config.transitions.defaultIntroRef;
			resolved[EVENT_ACTION.intro] = {
				name: state.config.naming.buildSyntheticEventName({
					capsuleId: state.capsule.id,
					childId: child.id,
					action: EVENT_ACTION.intro,
					triggerMs
				}),
				action: EVENT_ACTION.intro,
				triggerMs,
				durationMs: Math.max(0, resolveEventDefinition(state, ref)?.durationMs ?? 0),
				isSynthetic: true,
				ref,
				definition: resolveEventDefinition(state, ref)
			};
			usedSyntheticEvents = true;
		}

		if (!resolved[EVENT_ACTION.outro] && generateDefaultOutro) {
			const triggerMs = childRange.endMs;
			const ref =
				state.capsule.defaults?.outroTransitionRef ||
				behavior.defaultOutroRef ||
				state.config.transitions.defaultOutroRef;
			resolved[EVENT_ACTION.outro] = {
				name: state.config.naming.buildSyntheticEventName({
					capsuleId: state.capsule.id,
					childId: child.id,
					action: EVENT_ACTION.outro,
					triggerMs
				}),
				action: EVENT_ACTION.outro,
				triggerMs,
				durationMs: Math.max(0, resolveEventDefinition(state, ref)?.durationMs ?? 0),
				isSynthetic: true,
				ref,
				definition: resolveEventDefinition(state, ref)
			};
			usedSyntheticEvents = true;
		}

		usedSyntheticEventsByChildId[child.id] = usedSyntheticEvents;
		byChildId[child.id] = resolved;
	}

	return { byChildId, usedSyntheticEventsByChildId, diagnostics };
}
