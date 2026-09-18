import type { DiagnosticCollector } from '../../diagnostics'
import type { CompiledScene } from './types'

/** Warns about relation identities that cannot be resolved in one compiled scene. */
export function validateCompiledRelTargets(
  scene: CompiledScene,
  diagnostics: DiagnosticCollector,
): void {
  const persoIds = new Set<string>()
  for (const story of Object.values(scene.scene.stories)) {
    for (const perso of story.persos) persoIds.add(perso.id)
  }

  for (const [storyId, story] of Object.entries(scene.scene.stories)) {
    for (const perso of story.persos) {
      const target = perso.rel?.target
      if (target === undefined) continue

      if (target.scene !== scene.scene.id) {
        diagnostics.warning(
          'AUTHOR_REL_TARGET_SCENE_UNKNOWN',
          `rel.target.scene does not identify the compiled scene: ${target.scene}.`,
          {
            refs: { sceneId: scene.scene.id, storyId, persoId: perso.id },
            context: { targetScene: target.scene, targetPerso: target.perso },
          },
        )
        continue
      }

      if (target.perso !== undefined && !persoIds.has(target.perso)) {
        diagnostics.warning(
          'AUTHOR_REL_TARGET_PERSO_UNKNOWN',
          `rel.target.perso does not identify a perso in the compiled scene: ${target.perso}.`,
          {
            refs: { sceneId: scene.scene.id, storyId, persoId: perso.id },
            context: { targetScene: target.scene, targetPerso: target.perso },
          },
        )
      }
    }
  }
}
