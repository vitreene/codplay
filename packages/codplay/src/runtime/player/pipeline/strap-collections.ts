import { STRAP_SCOPE_SCENE, STRAP_SCOPE_STORY, type StrapScope } from '../../config/strap-scope'
import type {
  CompiledFunctionCollection,
  CompiledScene,
  CompiledStrapDeclarations,
} from '../../../scene/compiled'
import type { StrapCollection, StrapFunction } from './strap-executor'

/** Optional reusable strap collections separated by their ownership scope. */
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

/** Lists the names declared by either local implementations or reusable references. */
export function declaredStrapNames(
  declarations: CompiledStrapDeclarations | undefined,
): readonly string[] {
  if (declarations === undefined) return []
  return Array.isArray(declarations) ? declarations : Object.keys(declarations)
}

/** Resolves the author-selected declaration into the one runtime collection. */
export function resolveStrapCollection(
  declarations: CompiledStrapDeclarations | undefined,
  reusable: StrapCollection,
  functions: CompiledFunctionCollection,
): StrapCollection {
  if (declarations === undefined) return {}
  if (Array.isArray(declarations)) return reusable

  const local: Record<string, StrapFunction> = {}
  for (const [name, reference] of Object.entries(declarations)) {
    const fn = functions[reference.ref]
    if (fn !== undefined) local[name] = fn as StrapFunction
  }
  return local
}

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
  collections: StrapCollections = { scene: {}, stories: {} },
  functions: CompiledFunctionCollection = {},
): readonly StrapCollectionIssue[] {
  const issues: StrapCollectionIssue[] = []
  const sceneCollection = resolveStrapCollection(scene.scene.straps, collections.scene, functions)
  for (const strapName of declaredStrapNames(scene.scene.straps)) {
    if (sceneCollection[strapName] === undefined) {
      issues.push({
        code: 'AUTHOR_SCENE_STRAP_MISSING',
        message: `Scene strap is declared but not available: ${strapName}`,
        scope: STRAP_SCOPE_SCENE,
        strapName,
      })
    }
  }
  for (const [storyId, story] of Object.entries(scene.scene.stories)) {
    const storyCollection = resolveStrapCollection(
      story.straps,
      collections.stories[storyId] ?? {},
      functions,
    )
    for (const strapName of declaredStrapNames(story.straps)) {
      if (storyCollection[strapName] === undefined) {
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
