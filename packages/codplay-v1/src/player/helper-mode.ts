import type { HelperMode } from './helper-types'

export type HelperModeResolution = {
  mode: HelperMode
  warnings: string[]
}

/**
 * Resolves one requested helper mode against currently compatible modes.
 */
export function resolveHelperMode(input: {
  helperName: string
  requestedMode?: HelperMode
  defaultMode: HelperMode
  compatibleModes: readonly HelperMode[]
  fallbackMode?: HelperMode
  reason?: string
}): HelperModeResolution {
  const requestedMode = input.requestedMode ?? input.defaultMode
  if (input.compatibleModes.includes(requestedMode)) {
    return {
      mode: requestedMode,
      warnings: []
    }
  }

  const fallbackMode = input.fallbackMode ?? input.defaultMode
  const reasonSuffix = input.reason ? ` (${input.reason})` : ''
  return {
    mode: fallbackMode,
    warnings: [`helper ${input.helperName} mode ${requestedMode} falls back to ${fallbackMode}${reasonSuffix}`]
  }
}
