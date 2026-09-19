import type { DiagnosticCollector } from '../../diagnostics'
import type { CompiledScene } from './types'

/** Warns about host identities that cannot be resolved in one compiled scene. */
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
      const relation = perso.rel
      if (relation === undefined || persoIds.has(relation.host)) continue

      diagnostics.warning(
        'AUTHOR_REL_HOST_UNKNOWN',
        `rel.host does not identify a component in the compiled scene: ${relation.host}.`,
        {
          refs: { sceneId: scene.scene.id, storyId, persoId: perso.id },
          context: { host: relation.host, target: relation.target },
        },
      )
    }
  }
}
