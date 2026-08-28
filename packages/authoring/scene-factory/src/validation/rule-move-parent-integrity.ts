import { SCENE_VALIDATION_LEVEL } from './types'
import type { SceneDef } from 'codplay-v1/builder/types'
import type { SceneValidationDiagnostic } from './types'

const ROOT_TOKEN = '@root'
const DETACH_TOKEN = '@off'

/**
 * Every real perso id in the scene, gathered across ALL stories — Codplay resolves
 * `move.parentId` against a single flat registry, not one scoped to the current story
 * (`RuntimeComponentOrchestrator.nodeByPersoId`, confirmed by reading the runtime resolver:
 * a perso in one story can validly parent under a perso from another story of the same
 * `SceneDef`). This rule mirrors that same scope, rather than a narrower per-story one that
 * would flag cross-story parenting as broken when Codplay itself allows it.
 */
function collectAllPersoIds(sceneDoc: SceneDef): Set<string> {
  const ids = new Set<string>()
  for (const story of Object.values(sceneDoc.stories)) {
    for (const perso of story.persos) ids.add(perso.id)
  }
  return ids
}

/**
 * `move` has 3 valid shapes (`runtime/perso-shared-types.ts`'s `MoveValue`): the literal
 * string `'@root'` (or `'@off'`), a `MoveCommand` (`{parentId: string, ...}`), or an
 * equivalent object with every field optional (`{parentId?: string, ...}`) — a perso moved
 * this way with `parentId` omitted has no static parent to check here at all (its move is
 * driven some other way, out of this rule's scope).
 */
function extractParentId(move: unknown): string | undefined {
  if (typeof move === 'string') return move
  if (move !== null && typeof move === 'object') {
    const parentId = (move as { parentId?: unknown }).parentId
    return typeof parentId === 'string' ? parentId : undefined
  }
  return undefined
}

/**
 * Flags any `perso.initial.move`/`move.parentId` that resolves to nothing real in the scene —
 * silently never-mounted today (`AUTHOR_LAYOUT_OUTLET_NOT_FOUND` only surfaces at runtime,
 * generic and hard to trace back to which perso/story authored the typo).
 *
 * `'@root'` and `'@off'` (detach, intentional) are never flagged — they're not references to
 * another perso's id, they're Codplay's own reserved tokens (`RUNTIME_CONFIG.move`).
 *
 * Only `initial.move` is checked, matching the same scope `BuilderValidator`'s existing
 * disabled-story-reference check already uses (`builder-validation.ts`) — action-level
 * (dynamic) moves are out of scope for a static, pre-compile pass like this one.
 */
export function ruleMoveParentIntegrity(sceneDoc: SceneDef): SceneValidationDiagnostic[] {
  const diagnostics: SceneValidationDiagnostic[] = []
  const allPersoIds = collectAllPersoIds(sceneDoc)

  for (const story of Object.values(sceneDoc.stories)) {
    for (const perso of story.persos) {
      const move = (perso.initial as Record<string, unknown> | undefined)?.move
      const parentId = extractParentId(move)
      if (parentId === undefined) continue
      if (parentId === ROOT_TOKEN || parentId === DETACH_TOKEN) continue
      if (allPersoIds.has(parentId)) continue

      diagnostics.push({
        level: SCENE_VALIDATION_LEVEL.error,
        code: 'ED2_MOVE_PARENT_NOT_FOUND',
        message: `Perso '${perso.id}' moves to parentId '${parentId}', which does not match any perso id in this scene`,
        context: { storyId: story.id, persoId: perso.id },
      })
    }
  }

  return diagnostics
}
