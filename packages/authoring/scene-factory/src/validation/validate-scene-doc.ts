import { ruleMoveParentIntegrity } from './rule-move-parent-integrity'
import { ruleRootCapsuleInvariants } from './rule-root-capsule-invariants'
import { ruleUniqueActionNames } from './rule-unique-action-names'
import type { SceneDef } from 'codplay/builder/types'
import type { SceneValidationDiagnostic } from './types'

export type SceneValidationReport = {
  ok: boolean
  diagnostics: SceneValidationDiagnostic[]
}

const RULES: Array<(sceneDoc: SceneDef) => SceneValidationDiagnostic[]> = [
  ruleMoveParentIntegrity,
  ruleUniqueActionNames,
  ruleRootCapsuleInvariants,
]

/**
 * Runs every ed2-specific scene-validation rule against a Builder-produced `SceneDef`, ahead
 * of `BuilderFacade.compile()` — catches conventions specific to ed2 (implicit root capsule,
 * `${persoId}-intro`/`-outro` action naming) that Codplay's own generic `BuilderValidator`
 * cannot know about (`2026-07-08-validation-engine-plan.md` §2). `ok` is false the moment any
 * rule reports an `error`-level diagnostic — a `warning` alone still leaves it `true`.
 */
export function validateSceneDoc(sceneDoc: SceneDef): SceneValidationReport {
  const diagnostics = RULES.flatMap((rule) => rule(sceneDoc))
  const ok = !diagnostics.some((d) => d.level === 'error')
  return { ok, diagnostics }
}
