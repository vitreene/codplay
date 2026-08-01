import type { DiagnosticCollector } from '../../diagnostics'
import { isPlainRecord } from '../../shared'
import { GuardPipeline } from './guard-pipeline'
import { SCENE_DOC_VALIDATION_PATHS } from '../config/scene-validation'
import { GUARD_PHASE_SEMANTIC, GUARD_PHASE_SHAPE } from '../config/guard-phases'
import { resolveSceneValidationPath } from './validation-paths'
import type { CanonicalSceneDoc } from '../types'

/** Runs the first structural guard set for one canonical scene. */
export class SceneGuardEngine {
  private readonly pipeline = new GuardPipeline<CanonicalSceneDoc>()

  /**
   * Creates the minimal structural guard set for canonical scene data.
   */
  constructor() {
    this.pipeline.register({
      id: 'scene.identity',
      phase: GUARD_PHASE_SHAPE,
      run: (scene, context) => {
        if (scene.id.trim().length === 0) {
          context.diagnostics.error('AUTHOR_SCENE_ID_INVALID', 'scene.id must not be empty.', {
            refs: context.refs,
            context: { path: resolveSceneValidationPath(SCENE_DOC_VALIDATION_PATHS.id) },
          })
        }
      },
    })
    this.pipeline.register({
      id: 'scene.tracks',
      phase: GUARD_PHASE_SHAPE,
      run: (scene, context) => {
        if (!isPlainRecord(scene.tracks)) {
          context.diagnostics.error('AUTHOR_SCENE_TRACKS_INVALID', 'scene.tracks must be a plain object.', {
            refs: context.refs,
            context: { path: resolveSceneValidationPath(SCENE_DOC_VALIDATION_PATHS.tracks) },
          })
        }
      },
    })
    this.pipeline.register({
      id: 'scene.stories',
      phase: GUARD_PHASE_SEMANTIC,
      run: (scene, context) => {
        for (const [storyKey, story] of Object.entries(scene.stories)) {
          const storyRefs = { ...context.refs, storyId: story.id }
          const storyPath = resolveSceneValidationPath(SCENE_DOC_VALIDATION_PATHS.storyId, { '<storyId>': storyKey })
          if (story.id.trim().length === 0 || story.id !== storyKey) {
            context.diagnostics.error('AUTHOR_STORY_ID_INVALID', 'story.id must match its scene key.', {
              refs: storyRefs,
              context: { path: storyPath },
            })
          }

          for (const perso of story.persos) {
            const persoRefs = { ...storyRefs, persoId: perso.id }
            const replacements = { '<storyId>': storyKey, '<persoId>': perso.id }
            if (perso.id.trim().length === 0) {
              context.diagnostics.error('AUTHOR_PERSO_ID_INVALID', 'perso.id must not be empty.', {
                refs: persoRefs,
                context: { path: resolveSceneValidationPath(SCENE_DOC_VALIDATION_PATHS.persoId, replacements) },
              })
            }
            if (perso.type.trim().length === 0) {
              context.diagnostics.error('AUTHOR_PERSO_TYPE_INVALID', 'perso.type must not be empty.', {
                refs: persoRefs,
                context: { path: resolveSceneValidationPath(SCENE_DOC_VALIDATION_PATHS.persoType, replacements) },
              })
            }
            if (perso.actions[perso.id] !== null) {
              context.diagnostics.error('AUTHOR_PERSO_SELF_ACTION_INVALID', 'perso.actions[id] must be null.', {
                refs: persoRefs,
                context: { path: resolveSceneValidationPath(SCENE_DOC_VALIDATION_PATHS.actions, replacements) },
              })
            }
          }
        }
      },
    })
  }

  /**
   * Executes the registered structural rules against one canonical scene.
   */
  validate(scene: CanonicalSceneDoc, diagnostics: DiagnosticCollector): void {
    this.pipeline.run(scene, {
      path: resolveSceneValidationPath(SCENE_DOC_VALIDATION_PATHS.root),
      refs: { sceneId: scene.id },
      diagnostics,
    })
  }
}
