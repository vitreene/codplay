/**
 * Defines runtime animation defaults shared across transition derivation.
 */
export type AnimationRuntimeConfig = {
  defaultDurationMs: number
}

/**
 * Provides the default animation runtime configuration for V1.
 */
export const ANIMATION_RUNTIME_CONFIG: AnimationRuntimeConfig = {
  defaultDurationMs: 900
}
