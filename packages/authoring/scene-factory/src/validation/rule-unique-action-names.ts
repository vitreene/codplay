import { SCENE_VALIDATION_LEVEL } from './types'
import type { SceneDef } from 'codplay-v1/builder/types'
import type { SceneValidationDiagnostic } from './types'

/**
 * Flags two persos of the same story declaring the same key in their own `actions` —
 * an event routes to EVERY perso whose `actions` carries a key of that name (Codplay's own
 * dispatch, not scoped to one perso), so a shared name makes both react to the same eventime
 * at once (Principe A, `2026-07-08-builder-plan.md`: the Builder's own convention is
 * `${persoId}-intro`/`${persoId}-outro`, unique by construction — this rule is the guard for
 * when that convention is broken, by a bug in the Builder or a future hand-authored action).
 */
export function ruleUniqueActionNames(sceneDoc: SceneDef): SceneValidationDiagnostic[] {
  const diagnostics: SceneValidationDiagnostic[] = []

  for (const story of Object.values(sceneDoc.stories)) {
    const persoIdsByActionName = new Map<string, string[]>()

    for (const perso of story.persos) {
      for (const actionName of Object.keys(perso.actions ?? {})) {
        const owners = persoIdsByActionName.get(actionName) ?? []
        owners.push(perso.id)
        persoIdsByActionName.set(actionName, owners)
      }
    }

    for (const [actionName, ownerPersoIds] of persoIdsByActionName) {
      if (ownerPersoIds.length <= 1) continue

      diagnostics.push({
        level: SCENE_VALIDATION_LEVEL.error,
        code: 'ED2_DUPLICATE_ACTION_NAME',
        message: `Action name '${actionName}' is declared by ${ownerPersoIds.length} persos in story '${story.id}' (${ownerPersoIds.join(', ')}) — an eventime targeting it would fire on all of them at once`,
        context: { storyId: story.id, actionName },
      })
    }
  }

  return diagnostics
}
