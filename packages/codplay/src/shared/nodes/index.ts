/**
 * Structural guards for DOM-like nodes. The runtime works with real DOM nodes
 * and lightweight doubles alike, so it checks only the members it uses.
 */

/** Narrows one value to the parent link used to walk up or detach a node. */
export function hasParentNode(value: unknown): value is Readonly<{ parentNode: unknown | null }> {
  return typeof value === 'object' && value !== null && 'parentNode' in value
}

/** Narrows one value to a parent able to append a child. */
export function canAppendChild<Value>(value: Value): value is Value & { appendChild: (child: unknown) => unknown } {
  return typeof value === 'object' && value !== null && 'appendChild' in value
    && typeof (value as { appendChild?: unknown }).appendChild === 'function'
}

/** Narrows one value to a parent able to remove a child. */
export function canRemoveChild<Value>(value: Value): value is Value & { removeChild: (child: unknown) => unknown } {
  return typeof value === 'object' && value !== null && 'removeChild' in value
    && typeof (value as { removeChild?: unknown }).removeChild === 'function'
}

/** Lists the root nodes of one materialization: a single root or fragment roots. */
export function listMaterializedRoots(root: unknown): readonly unknown[] {
  if (root === undefined || root === null) return []
  return Array.isArray(root) ? root : [root]
}
