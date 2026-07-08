import type { AutoCapsuleGridComputation, AutoCapsuleNormalizedState } from "../types/internal";
import { GRID_MODE, ORIENTATION } from "../types/public";
import type { AutoCapsuleDiagnostic } from "../types/public";

function positiveInt(value: number | null | undefined, fallback: number): number {
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) return fallback;
	return Math.max(1, Math.floor(numeric));
}

/**
 * Render a plain CSS declaration list from an inline-style-like object.
 */
function buildGridDeclarations(style: Record<string, string | number>): string {
	return Object.entries(style)
		.map(([key, value]) => `${toKebabCase(key)}:${String(value)};`)
		.join("");
}

function toKebabCase(value: string): string {
	return value.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
}

/**
 * Build the capsule grid artifact and its reusable context.
 *
 * Main variables:
 * - `behavior`: resolved type defaults for the current capsule, including its fixed `gridMode`
 * - `grid`: raw grid input of the capsule
 * - `rows` / `cols`: effective grid step after defaults and mode rules
 * - `inlineStyle`: DOM-ready inline style representation of the grid container
 */
export function buildAutoCapsuleGrid(
	state: AutoCapsuleNormalizedState,
	visibleChildCount: number
): AutoCapsuleGridComputation {
	const diagnostics: AutoCapsuleDiagnostic[] = [];
	const capsule = state.capsule;
	const behavior = state.config.types[capsule.type];
	const grid = capsule.grid;
	const mode = behavior.gridMode;

	let rows = positiveInt(grid.rows, behavior.defaultRows);
	let cols = positiveInt(grid.cols, behavior.defaultCols);

	if (mode === GRID_MODE.forced) {
		rows = 1;
		cols = 1;
	} else if (mode === GRID_MODE.derived) {
		if (grid.orientation === ORIENTATION.vertical) {
			rows = Math.max(1, visibleChildCount);
			cols = 1;
		} else {
			rows = 1;
			cols = Math.max(1, visibleChildCount);
		}
	} else if (mode === GRID_MODE.list) {
		rows = Math.max(1, visibleChildCount);
		cols = 1;
	}

	const generatedGridToken = state.config.naming.buildGridClassName({
		type: capsule.type,
		rows,
		cols,
		mode
	});

	const inlineStyle: Record<string, string | number> = {
		display: "grid",
		gridTemplateColumns: cols > 1 ? `repeat(${cols}, minmax(0, 1fr))` : "1fr",
		gridTemplateRows: rows > 1 ? `repeat(${rows}, minmax(0, 1fr))` : "1fr"
	};

	if (grid.gap) inlineStyle.gap = grid.gap;
	if (grid.rowGap) inlineStyle.rowGap = grid.rowGap;
	if (grid.columnGap) inlineStyle.columnGap = grid.columnGap;

	const classTokens = [grid.containerClassName, grid.className, generatedGridToken].filter(
		(token): token is string => Boolean(token && token.trim())
	);
	const className = [...new Set(classTokens)].join(" ");
	const cssRules = generatedGridToken
		? [`.${generatedGridToken}{${buildGridDeclarations(inlineStyle)}}`]
		: [];

	return {
		artifact: {
			className,
			inlineStyle,
			cssRules,
			context: {
				rows,
				cols,
				mode
			}
		},
		diagnostics
	};
}
