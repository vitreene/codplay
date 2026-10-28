/** Rejects values JSON would omit, coerce, or corrupt, reporting their document path. */
export function assertJsonCompatible(value: unknown): void {
  const ancestors = new WeakMap<object, string>()

  /** Checks one value and reports a path for values JSON cannot preserve. */
  function visit(candidate: unknown, path: string): void {
    if (candidate === null || typeof candidate === 'string' || typeof candidate === 'boolean') return
    if (typeof candidate === 'number') {
      if (!Number.isFinite(candidate)) throw new Error(`La valeur numérique du document n’est pas sérialisable à ${path}.`)
      return
    }
    if (typeof candidate !== 'object') {
      throw new Error(`Le document contient une valeur non sérialisable en JSON à ${path} (${typeof candidate}).`)
    }
    const ancestorPath = ancestors.get(candidate)
    if (ancestorPath !== undefined) {
      throw new Error(`Le document contient une référence circulaire à ${path}, vers ${ancestorPath}.`)
    }
    const prototype = Object.getPrototypeOf(candidate)
    if (prototype !== Object.prototype && prototype !== null && !Array.isArray(candidate)) {
      throw new Error(`Le document contient un objet non compatible avec la persistance JSON à ${path}.`)
    }

    ancestors.set(candidate, path)
    for (const key of Reflect.ownKeys(candidate)) {
      if (typeof key !== 'string') throw new Error(`Le document contient une clé non sérialisable en JSON à ${path}.`)
      const childPath = Array.isArray(candidate)
        ? `${path}[${key}]`
        : `${path}[${JSON.stringify(key)}]`
      visit((candidate as Record<string, unknown>)[key], childPath)
    }
    ancestors.delete(candidate)
  }

  visit(value, '$')
}

/** Serializes plain document values after checking JSON compatibility. */
export function stringifyJson(value: unknown): string {
  assertJsonCompatible(value)
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new Error('Le document ne peut pas être sérialisé en JSON.')
  return serialized
}
