import { STRAP_SCOPE_SCENE, STRAP_SCOPE_STORY, type StrapScope } from '../../config/strap-scope'
import type { CompiledScene } from '../../../scene/compiled'
import type { StrapCollection, StrapFunction } from './strap-executor'

/** Injected strap collections separated by their ownership scope. */
export type StrapCollections = Readonly<{
  scene: StrapCollection
  stories: Readonly<Record<string, StrapCollection>>
}>

/** Scope used when resolving one named strap. */
export type { StrapScope } from '../../config/strap-scope'

/** One missing or incorrectly scoped strap declaration. */
export type StrapCollectionIssue = Readonly<{
  code: string
  message: string
  scope: StrapScope
  storyId?: string
  strapName: string
}>

/** Resolves a scene strap without falling back to any story collection. */
export function resolveSceneStrap(name: string, collections: StrapCollections): StrapFunction | undefined {
  return collections.scene[name]
}

/** Resolves a story strap without falling back to the scene collection. */
export function resolveStoryStrap(
  storyId: string,
  name: string,
  collections: StrapCollections,
): StrapFunction | undefined {
  return collections.stories[storyId]?.[name]
}

/** Validates declared scene and story straps against their owned collections. */
export function validateStrapCollections(
  scene: CompiledScene,
  collections: StrapCollections,
): readonly StrapCollectionIssue[] {
  const issues: StrapCollectionIssue[] = []
  for (const strapName of scene.scene.straps ?? []) {
    if (resolveSceneStrap(strapName, collections) === undefined) {
      issues.push({
        code: 'AUTHOR_SCENE_STRAP_MISSING',
        message: `Scene strap is declared but not available: ${strapName}`,
        scope: STRAP_SCOPE_SCENE,
        strapName,
      })
    }
  }
  for (const [storyId, story] of Object.entries(scene.scene.stories)) {
    for (const strapName of story.straps ?? []) {
      if (resolveStoryStrap(storyId, strapName, collections) === undefined) {
        issues.push({
          code: 'AUTHOR_STORY_STRAP_MISSING',
          message: `Story strap is declared but not available: ${strapName}`,
          scope: STRAP_SCOPE_STORY,
          storyId,
          strapName,
        })
      }
    }
  }
  return issues
}
