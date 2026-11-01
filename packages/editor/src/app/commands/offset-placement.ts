type PlacementGeometry = Readonly<{
  x?: number | null
  y?: number | null
  width?: number | null
  height?: number | null
  translate?: Readonly<{ x?: number | null; y?: number | null }>
}>

/** Reports whether author geometry overrides a zone's structural placement. */
export function hasExplicitPlacementGeometry(offset: PlacementGeometry | null | undefined): boolean {
  if (offset === undefined || offset === null) return false
  return offset.x != null
    || offset.y != null
    || offset.width != null
    || offset.height != null
    || offset.translate?.x != null
    || offset.translate?.y != null
}

/** Marks inherited position and size values as cleared while preserving rotation and scale. */
export function clearOffsetPlacementGeometry<T extends PlacementGeometry>(
  offset: T | null | undefined,
): T & { x: null; y: null; width: null; height: null; translate: { x: null; y: null } } {
  return {
    ...offset,
    x: null,
    y: null,
    width: null,
    height: null,
    translate: { ...offset?.translate, x: null, y: null },
  } as T & { x: null; y: null; width: null; height: null; translate: { x: null; y: null } }
}

/** Folds sparse pose geometry while retaining null markers that clear inherited values. */
export function mergePlacementGeometry<T extends PlacementGeometry>(
  base: T | undefined,
  addition: T | undefined,
): T | undefined {
  if (addition === undefined) return base
  return {
    ...base,
    ...addition,
    ...(base?.translate === undefined && addition.translate === undefined
      ? {}
      : { translate: { ...base?.translate, ...addition.translate } }),
  } as T
}

/** Returns only missing CSS dimensions needed for a zone-filled Editor visual. */
export function missingZoneFillStyle(
  style: Readonly<Record<string, string>> | undefined,
  custom: string | undefined,
): Record<string, string> {
  const additions: Record<string, string> = {}
  for (const dimension of ['width', 'height'] as const) {
    const hasStyleValue = Object.keys(style ?? {}).some((property) => property.toLowerCase() === dimension)
    const hasCustomValue = custom?.split(';').some((declaration) => {
      const separator = declaration.indexOf(':')
      return separator >= 0 && declaration.slice(0, separator).trim().toLowerCase() === dimension
    }) ?? false
    if (!hasStyleValue && !hasCustomValue) additions[dimension] = '100%'
  }
  return additions
}
