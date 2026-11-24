/**
 * Compares the JSON-shaped document model without treating fresh no-op wrappers as edits. This is
 * the editor's single definition of "document modified": the facade keeps the previous reference
 * for a command without effect, so the controller, history, persistence and player all see no change.
 */
export function editorScenesEqual(left: unknown, right: unknown): boolean {
  const compared = new WeakMap<object, WeakSet<object>>()

  function equalValue(leftValue: unknown, rightValue: unknown): boolean {
    if (Object.is(leftValue, rightValue)) return true
    if (typeof leftValue !== 'object' || leftValue === null) return false
    if (typeof rightValue !== 'object' || rightValue === null) return false
    if (Array.isArray(leftValue) || Array.isArray(rightValue)) {
      return Array.isArray(leftValue)
        && Array.isArray(rightValue)
        && leftValue.length === rightValue.length
        && leftValue.every((value, index) => equalValue(value, rightValue[index]))
    }
    if (Object.getPrototypeOf(leftValue) !== Object.getPrototypeOf(rightValue)) return false
    const prototype = Object.getPrototypeOf(leftValue)
    if (prototype !== Object.prototype && prototype !== null) return false

    const knownPairs = compared.get(leftValue) ?? new WeakSet<object>()
    if (knownPairs.has(rightValue)) return true
    knownPairs.add(rightValue)
    compared.set(leftValue, knownPairs)

    const leftKeys = Reflect.ownKeys(leftValue).filter((key) => (leftValue as Record<PropertyKey, unknown>)[key] !== undefined)
    const rightKeys = Reflect.ownKeys(rightValue).filter((key) => (rightValue as Record<PropertyKey, unknown>)[key] !== undefined)
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key) => Object.hasOwn(rightValue, key)
        && equalValue(
          (leftValue as Record<PropertyKey, unknown>)[key],
          (rightValue as Record<PropertyKey, unknown>)[key],
        ))
  }

  return equalValue(left, right)
}
