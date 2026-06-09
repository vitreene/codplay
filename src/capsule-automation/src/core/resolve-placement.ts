import type {
	AutoCapsuleDiagnostic,
	AutoCapsuleResolvedChildPlacement
} from "../types/public";
import { AREA_KIND, CAPSULE_TYPE, DIAGNOSTIC_LEVEL, GRID_MODE, PLACEMENT_POLICY } from "../types/public";
import type {
	AutoCapsuleGridComputation,
	AutoCapsuleNormalizedState,
	AutoCapsuleOrderedChild,
	AutoCapsulePlacementComputation,
	AutoCapsulePlacementEntry
} from "../types/internal";

function buildPlacementCssRule(token: string, row: number, col: number, rowSpan: number, colSpan: number): string {
	return `.${token}{grid-row:${row} / span ${rowSpan};grid-column:${col} / span ${colSpan};}`;
}

/**
 * Normalize a placement span to a positive integer.
 */
function normalizeSpan(value: number | null | undefined): number {
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) return 1;
	return Math.max(1, Math.floor(numeric));
}

/**
 * Build one resolved placement artifact from explicit row/column coordinates.
 */
function buildPlacementFromCoordinates(
	state: AutoCapsuleNormalizedState,
	child: AutoCapsuleOrderedChild,
	row: number,
	col: number,
	rowSpan: number,
	colSpan: number,
	kind: typeof AREA_KIND.gridArea | typeof AREA_KIND.gridSpan | typeof AREA_KIND.listRow,
	withCssRule: boolean
): AutoCapsuleResolvedChildPlacement {
	const token =
		kind === AREA_KIND.listRow
			? state.config.naming.buildListItemClassName(child.index + 1)
			: state.config.naming.buildAreaClassName({ row, col, rowSpan, colSpan, kind, index: child.index + 1 });

	return {
		areaClassName: token,
		placementClassName: token,
		cssRules: withCssRule ? [buildPlacementCssRule(token, row, col, rowSpan, colSpan)] : [],
		gridRow: `${row} / span ${rowSpan}`,
		gridColumn: `${col} / span ${colSpan}`
	};
}

/**
 * Convert a child explicit placement input into a resolved placement artifact.
 */
function buildExplicitPlacement(
	state: AutoCapsuleNormalizedState,
	child: AutoCapsuleOrderedChild
): AutoCapsuleResolvedChildPlacement | null {
	const placement = child.placement;
	if (!placement) return null;
	if (placement.area) {
		return {
			areaClassName: placement.area,
			placementClassName: placement.className || null,
			cssRules: [],
			gridRow: undefined,
			gridColumn: undefined
		};
	}

	if (typeof placement.row !== "number" || typeof placement.col !== "number") return null;
	const rowSpan = normalizeSpan(placement.rowSpan);
	const colSpan = normalizeSpan(placement.colSpan);
	const kind = rowSpan > 1 || colSpan > 1 ? AREA_KIND.gridSpan : AREA_KIND.gridArea;
	return buildPlacementFromCoordinates(
		state,
		child,
		Math.max(1, Math.floor(placement.row)),
		Math.max(1, Math.floor(placement.col)),
		rowSpan,
		colSpan,
		kind,
		true
	);
}

/**
 * Build the automatic placement of one child from the effective grid context.
 */
function buildAutoPlacement(
	state: AutoCapsuleNormalizedState,
	child: AutoCapsuleOrderedChild,
	grid: AutoCapsuleGridComputation["artifact"]
): AutoCapsuleResolvedChildPlacement {
	if (state.capsule.type === CAPSULE_TYPE.liste || grid.context.mode === GRID_MODE.list) {
		return buildPlacementFromCoordinates(state, child, child.index + 1, 1, 1, 1, AREA_KIND.listRow, false);
	}

	const totalCells = Math.max(1, grid.context.rows * grid.context.cols);
	const normalizedIndex = child.index % totalCells;
	const row = Math.floor(normalizedIndex / grid.context.cols) + 1;
	const col = (normalizedIndex % grid.context.cols) + 1;
	return buildPlacementFromCoordinates(state, child, row, col, 1, 1, AREA_KIND.gridArea, true);
}

/**
 * Resolve explicit and automatic child placement artifacts.
 *
 * Main variables:
 * - `explicitPlacement`: persisted placement override when present
 * - `behavior`: placement policy resolved from the capsule type
 * - `byChildId`: final placement map consumed by the projection layer
 */
export function resolveAutoCapsulePlacement(
	state: AutoCapsuleNormalizedState,
	orderedChildren: AutoCapsuleOrderedChild[],
	grid: AutoCapsuleGridComputation["artifact"]
): AutoCapsulePlacementComputation {
	const diagnostics: AutoCapsuleDiagnostic[] = [];
	const byChildId: Record<string, AutoCapsulePlacementEntry> = {};

	for (const child of orderedChildren) {
		const explicitPlacement = buildExplicitPlacement(state, child);
		if (explicitPlacement) {
			byChildId[child.id] = {
				placement: explicitPlacement,
				usedAutoPlacement: false
			};
			continue;
		}

		const behavior = state.config.types[state.capsule.type] || state.config.types.legacy;
		if (behavior.placementPolicy === PLACEMENT_POLICY.explicitOnly) {
			const placement: AutoCapsuleResolvedChildPlacement = {
				areaClassName: null,
				placementClassName: null,
				cssRules: []
			};
			byChildId[child.id] = { placement, usedAutoPlacement: false };
			diagnostics.push({
				level: DIAGNOSTIC_LEVEL.warning,
				code: "placement-explicit-required",
				message: `Child \"${child.id}\" has no explicit placement in a capsule type that prefers explicit placement.`,
				childId: child.id
			});
			continue;
		}

		byChildId[child.id] = {
			placement: buildAutoPlacement(state, child, grid),
			usedAutoPlacement: true
		};
	}

	return { byChildId, diagnostics };
}
