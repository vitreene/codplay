import type { AutoCapsuleResolvedTimeRange } from "../types/public";
import type {
	AutoCapsuleNormalizedState,
	AutoCapsuleOrderedChild,
	AutoCapsuleTimingComputation
} from "../types/internal";

/**
 * Resolve child time ranges as a trivial passthrough of `child.timeRange`.
 *
 * Timing is not computed here: it is fully resolved upstream (e.g. `CapsuleDistribution`) and
 * carried per child. Every resolved range is `locked: true` by construction — it comes from the
 * outside, never from an internal distribution strategy.
 */
export function resolveAutoCapsuleTiming(
	_state: AutoCapsuleNormalizedState,
	orderedChildren: AutoCapsuleOrderedChild[]
): AutoCapsuleTimingComputation {
	const byChildId: Record<string, AutoCapsuleResolvedTimeRange> = {};
	const usedAutoTimingByChildId: Record<string, boolean> = {};

	for (const child of orderedChildren) {
		const { startMs, endMs } = child.timeRange;
		byChildId[child.id] = {
			startMs,
			endMs,
			durationMs: Math.max(0, endMs - startMs),
			locked: true
		};
		usedAutoTimingByChildId[child.id] = false;
	}

	return { byChildId, usedAutoTimingByChildId, diagnostics: [] };
}
