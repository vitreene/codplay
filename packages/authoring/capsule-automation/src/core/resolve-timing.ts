import { DIAGNOSTIC_LEVEL, TIME_MODE } from "../types/public";
import type { AutoCapsuleDiagnostic, AutoCapsuleResolvedTimeRange } from "../types/public";
import type {
	AutoCapsuleNormalizedState,
	AutoCapsuleOrderedChild,
	AutoCapsuleTimingComputation
} from "../types/internal";

type TimeSlot = {
	startMs: number;
	endMs: number;
	locked: boolean;
};

type Lock = {
	index: number;
	startMs: number;
	endMs: number;
};

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

/**
 * Normalize an input time range into an ordered resolved range.
 */
function normalizeTimeRange(startMs: number, endMs: number): AutoCapsuleResolvedTimeRange {
	const normalizedStart = Math.min(startMs, endMs);
	const normalizedEnd = Math.max(startMs, endMs);
	return {
		startMs: normalizedStart,
		endMs: normalizedEnd,
		durationMs: Math.max(0, normalizedEnd - normalizedStart),
		locked: false
	};
}

/**
 * Split one free segment into evenly distributed child slots.
 */
function allocateEvenly(slots: Array<TimeSlot | undefined>, from: number, to: number, startMs: number, endMs: number) {
	if (to < from) return;
	const count = to - from + 1;
	const span = Math.max(0, endMs - startMs);
	for (let offset = 0; offset < count; offset++) {
		const slotStart = startMs + (span * offset) / count;
		const slotEnd = startMs + (span * (offset + 1)) / count;
		slots[from + offset] = { startMs: slotStart, endMs: slotEnd, locked: false };
	}
}

/**
 * Resolve child time ranges from capsule timing policy and child-level locks.
 *
 * Main variables:
 * - `capsuleRange`: normalized visible range of the capsule
 * - `timeMode`: effective time policy after applying type defaults
 * - `fixedDurationMs`: fixed slot size used in `TIME_MODE.fixed`
 * - `normalizedLocks`: ordered child time locks after clamping and overlap cleanup
 * - `slots`: resolved raw slot list before final child mapping
 */
export function resolveAutoCapsuleTiming(
	state: AutoCapsuleNormalizedState,
	orderedChildren: AutoCapsuleOrderedChild[]
): AutoCapsuleTimingComputation {
	const diagnostics: AutoCapsuleDiagnostic[] = [];
	const byChildId: Record<string, AutoCapsuleResolvedTimeRange> = {};
	const usedAutoTimingByChildId: Record<string, boolean> = {};

	const capsuleRange = normalizeTimeRange(state.capsule.timeRange.startMs, state.capsule.timeRange.endMs);
	if (capsuleRange.durationMs <= 0) {
		diagnostics.push({
			level: DIAGNOSTIC_LEVEL.warning,
			code: "capsule-empty-time-range",
			message: "Capsule timeRange is empty or inverted; children will collapse to the normalized range start."
		});
	}

	const behavior = state.config.types[state.capsule.type] || state.config.types.legacy;
	const timeMode = state.capsule.timing?.mode || behavior.defaultTimeMode;
	const fixedDurationMs = Math.max(1, state.capsule.timing?.fixedDurationMs || behavior.defaultFixedDurationMs || 1);
	const locks: Lock[] = [];

	orderedChildren.forEach((child, index) => {
		const lockedRange = child.constraints?.lockedTimeRange;
		if (!lockedRange) return;
		const startMs = clamp(Math.min(lockedRange.startMs, lockedRange.endMs), capsuleRange.startMs, capsuleRange.endMs);
		const endMs = clamp(Math.max(lockedRange.startMs, lockedRange.endMs), capsuleRange.startMs, capsuleRange.endMs);
		locks.push({ index, startMs, endMs });
	});

	const normalizedLocks = locks
		.sort((a, b) => a.index - b.index)
		.reduce<Lock[]>((acc, lock) => {
			const previousEnd = acc.length ? acc[acc.length - 1].endMs : capsuleRange.startMs;
			const startMs = Math.max(previousEnd, lock.startMs);
			const endMs = Math.max(startMs, lock.endMs);
			acc.push({ ...lock, startMs, endMs });
			return acc;
		}, []);

	const slots: Array<TimeSlot | undefined> = new Array(orderedChildren.length);
	if (timeMode === TIME_MODE.fixed) {
		for (const child of orderedChildren) {
			const startMs = Math.min(capsuleRange.startMs + child.index * fixedDurationMs, capsuleRange.endMs);
			const endMs = Math.min(startMs + fixedDurationMs, capsuleRange.endMs);
			slots[child.index] = { startMs, endMs, locked: false };
		}
		for (const lock of normalizedLocks) {
			slots[lock.index] = { startMs: lock.startMs, endMs: lock.endMs, locked: true };
		}
	} else {
		let previousIndex = -1;
		let previousEnd = capsuleRange.startMs;
		for (const lock of normalizedLocks) {
			allocateEvenly(slots, previousIndex + 1, lock.index - 1, previousEnd, lock.startMs);
			slots[lock.index] = { startMs: lock.startMs, endMs: lock.endMs, locked: true };
			previousIndex = lock.index;
			previousEnd = lock.endMs;
		}
		allocateEvenly(slots, previousIndex + 1, orderedChildren.length - 1, previousEnd, capsuleRange.endMs);
	}

	for (const child of orderedChildren) {
		const slot = slots[child.index] || {
			startMs: capsuleRange.startMs,
			endMs: capsuleRange.startMs,
			locked: false
		};
		const resolved: AutoCapsuleResolvedTimeRange = {
			startMs: slot.startMs,
			endMs: slot.endMs,
			durationMs: Math.max(0, slot.endMs - slot.startMs),
			locked: slot.locked
		};
		byChildId[child.id] = resolved;
		usedAutoTimingByChildId[child.id] = !slot.locked;

		if (child.constraints?.minDurationMs || child.constraints?.maxDurationMs) {
			diagnostics.push({
				level: DIAGNOSTIC_LEVEL.info,
				code: "duration-constraint-observed",
				message:
					"Duration constraints are recorded in the public model but are not redistributed across siblings in this first implementation.",
				childId: child.id
			});
		}
	}

	return { byChildId, usedAutoTimingByChildId, diagnostics };
}
