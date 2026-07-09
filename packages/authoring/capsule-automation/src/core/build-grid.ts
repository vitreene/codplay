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
 * Fixed class name for the scene-root fill concern — deliberately NOT mixed into the grid class
 * name/rule (`buildGridClassName`, which only ever encodes grid position/structure: type/rows/
 * cols/mode). Dimension (`width:100%;height:100%`) and grid layout are separate CSS concerns; one
 * fixed, unparameterized class for the former composes cleanly alongside any grid class rather
 * than requiring a `-scene-root` variant of every possible grid class name. `ac-` prefix matches
 * every other class this package generates (`ac-grid-...`, `ac-cell-...`, `ac-list-...`).
 *
 * `grid-area:1/-1` is required alongside `width`/`height`: the real host container (ex. the
 * player's `mountTarget`) is itself commonly `display:grid` (demo shells, layout containers) —
 * without an explicit placement, a grid child auto-places into a single implicit cell, and
 * `width:100%;height:100%` then only fills THAT cell, not the parent grid's full area. `1/-1`
 * spans from the first to the last line on both axes regardless of how many tracks the parent
 * grid actually has — unlike a ghost-zone placement (`buildPlacementCssRule`), which needs to
 * know the resolved row/col count, this needs no such knowledge since it targets an EXTERNAL
 * container this package has no visibility into.
 *
 * `min-width:0;min-height:0` overrides the CSS Grid default of `min-width:auto`/`min-height:auto`
 * on a grid item — that default means the item refuses to shrink below its own content's
 * intrinsic size, which pushes the PARENT's implicit track (sized `auto` when the host container
 * has no explicit `grid-template`, ex. the demo shell's `.container`) to grow to fit it — so
 * `width:100%;height:100%` alone doesn't actually bound the capsule if its own children are
 * larger than the real container: the track grows around the content instead of the content
 * being constrained to the track. `overflow:hidden` is the final backstop once the size is
 * actually bounded, containing anything (ex. oversized child content) that still doesn't fit.
 */
const SCENE_ROOT_CLASS_NAME = "ac-scene-root";
const SCENE_ROOT_CSS_RULE = `.${SCENE_ROOT_CLASS_NAME}{width:100%;height:100%;grid-area:1/-1;min-width:0;min-height:0;overflow:hidden;}`;

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

	// The scene-root capsule fills its real host container instead of sizing to its own
	// intrinsic content — every other (nested) capsule keeps sizing from its own grid/content,
	// since only the scene-root bridges to a real external container (`capsule.sceneRoot`). Kept
	// as a separate, fixed class (`SCENE_ROOT_CLASS_NAME`) rather than folded into the grid class/
	// inline style — dimension and grid layout are independent CSS concerns.
	const sceneRootClassName = capsule.sceneRoot ? SCENE_ROOT_CLASS_NAME : null;

	const classTokens = [grid.containerClassName, grid.className, generatedGridToken, sceneRootClassName].filter(
		(token): token is string => Boolean(token && token.trim())
	);
	const className = [...new Set(classTokens)].join(" ");
	const cssRules = [
		...(generatedGridToken ? [`.${generatedGridToken}{${buildGridDeclarations(inlineStyle)}}`] : []),
		...(sceneRootClassName ? [SCENE_ROOT_CSS_RULE] : [])
	];

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
