import { SCENE_VALIDATION_LEVEL } from './types'
import type { SceneDef, StoryDef } from 'codplay-v1/builder/types'
import type { SceneValidationDiagnostic } from './types'

const ROOT_TOKEN = '@root'

/**
 * Mirrors `isStoryHostMove` (`create-builder.ts`, duplicated there too to avoid a
 * builder→runtime dependency) — `'@root'` accepted either as the literal string or as an
 * object whose `parentId` is `'@root'`.
 */
function resolvesToRoot(move: unknown): boolean {
  if (move === ROOT_TOKEN) return true
  if (move !== null && typeof move === 'object') {
    return (move as { parentId?: unknown }).parentId === ROOT_TOKEN
  }
  return false
}

/**
 * The implicit root capsule (`2026-07-08-capsule-spec.md` §6) is the ONE perso that bridges a
 * story to the player's real `mountTarget` — `deriveRootNodeIds` (`create-builder.ts`) only
 * mounts a perso there when BOTH the story's own `initial.move` AND that perso's own
 * `initial.move` resolve to `'@root'`; either one posed wrong and the whole story silently
 * never mounts anything, with no error surfaced anywhere in the pipeline.
 *
 * ed2 never authors more than one story per scene today (`2026-07-08-builder-plan.md` §2), so
 * this rule checks every story present rather than assuming a single one — each story that
 * itself resolves to `'@root'` must have EXACTLY one perso that also does, no more, no fewer.
 */
export function ruleRootCapsuleInvariants(sceneDoc: SceneDef): SceneValidationDiagnostic[] {
  const diagnostics: SceneValidationDiagnostic[] = []

  for (const story of Object.values(sceneDoc.stories)) {
    if (!resolvesToRoot(story.initial?.move)) continue
    diagnostics.push(...checkStoryHasExactlyOneRootPerso(story))
  }

  return diagnostics
}

function checkStoryHasExactlyOneRootPerso(story: StoryDef): SceneValidationDiagnostic[] {
  const rootPersos = story.persos.filter((perso) => resolvesToRoot((perso.initial as Record<string, unknown> | undefined)?.move))

  if (rootPersos.length === 0) {
    return [
      {
        level: SCENE_VALIDATION_LEVEL.error,
        code: 'ED2_ROOT_CAPSULE_MISSING',
        message: `Story '${story.id}' resolves its own move to '@root' but none of its persos do — nothing will ever mount for this story`,
        context: { storyId: story.id },
      },
    ]
  }

  if (rootPersos.length > 1) {
    return [
      {
        level: SCENE_VALIDATION_LEVEL.error,
        code: 'ED2_ROOT_CAPSULE_DUPLICATED',
        message: `Story '${story.id}' has ${rootPersos.length} persos whose move resolves to '@root' (${rootPersos.map((p) => p.id).join(', ')}) — exactly one root capsule is expected`,
        context: { storyId: story.id },
      },
    ]
  }

  return []
}
