// Shared diagnostic shape for every ed2 scene-validation rule — modeled after
// `AutoCapsuleDiagnostic` (capsule-automation), with a `context` bag instead of a single
// `childId` since ed2's own rules anchor to different things (a perso id, a story id, an
// action name) depending on the rule.

export const SCENE_VALIDATION_LEVEL = {
  error: 'error',
  warning: 'warning',
} as const

export type SceneValidationLevel = (typeof SCENE_VALIDATION_LEVEL)[keyof typeof SCENE_VALIDATION_LEVEL]

export type SceneValidationDiagnostic = {
  level: SceneValidationLevel
  code: string
  message: string
  context?: {
    storyId?: string
    persoId?: string
    actionName?: string
  }
}
