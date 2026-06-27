/** Converts one degree value to radians. */
function degToRad(value: number): number {
  return (value * Math.PI) / 180
}

/** Resolves one authored property value, supporting per-target callback values. */
function resolveAuthoredValue(rawValue: unknown, target: unknown, index: number): unknown {
  return typeof rawValue === 'function'
    ? (rawValue as (target: unknown, index: number) => unknown)(target, index)
    : rawValue
}

/** Sets one scalar/vector-like property on one target object. */
function applyProperty(target: Record<string, unknown>, property: string, value: unknown): void {
  if (property === 'rotateX' || property === 'rotateY' || property === 'rotateZ') {
    const axis = property[property.length - 1]!.toLowerCase()
    const rotation = target.rotation as Record<string, unknown> | undefined
    if (rotation && typeof value === 'number') {
      rotation[axis] = degToRad(value)
    }
    return
  }

  if (property === 'scale') {
    const scale = target.scale as Record<string, unknown> | undefined
    if (scale && typeof value === 'number') {
      scale.x = value
      scale.y = value
      scale.z = value
    }
    return
  }

  if (property === 'scaleX' || property === 'scaleY' || property === 'scaleZ') {
    const axis = property[property.length - 1]!.toLowerCase()
    const scale = target.scale as Record<string, unknown> | undefined
    if (scale && typeof value === 'number') {
      scale[axis] = value
    }
    return
  }

  if ((property === 'x' || property === 'y' || property === 'z') && !(property in target)) {
    const position = target.position as Record<string, unknown> | undefined
    if (position) {
      position[property] = value
      return
    }
  }

  const current = target[property]
  if (
    current &&
    typeof current === 'object' &&
    typeof (current as { set?: (value: unknown) => void }).set === 'function' &&
    (typeof value === 'string' || typeof value === 'number')
  ) {
    ;(current as { set: (value: unknown) => void }).set(value)
    return
  }

  target[property] = value
}

/** Applies one authored values record to one target or target array. */
export function applyThreejsValues(target: unknown, values: Record<string, unknown>): void {
  if (Array.isArray(target)) {
    for (let index = 0; index < target.length; index += 1) {
      const item = target[index] as Record<string, unknown> | undefined
      if (!item || typeof item !== 'object') continue
      for (const [property, rawValue] of Object.entries(values)) {
        applyProperty(item, property, resolveAuthoredValue(rawValue, item, index))
      }
    }
    return
  }

  if (typeof target !== 'object' || target === null) return
  const targetObject = target as Record<string, unknown>
  for (const [property, rawValue] of Object.entries(values)) {
    applyProperty(targetObject, property, resolveAuthoredValue(rawValue, targetObject, 0))
  }
}
