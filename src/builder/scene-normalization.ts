import type { SceneDef, StoryDef } from './types'

type MutableStoryDef = Partial<StoryDef> & { id: string; entries?: string[]; persos?: StoryDef['persos'] }
type MutableSceneDef = Partial<SceneDef> & { stories: Record<string, unknown> }

/**
 * Returns true when one value is one plain object.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Normalizes one authored story into the canonical V1 shape.
 */
export function normalizeStoryDef(story: MutableStoryDef): StoryDef {
  story.initial = story.initial ?? undefined
  story.straps = Array.isArray(story.straps) && story.straps.length > 0 ? story.straps : undefined
  story.listen = Array.isArray(story.listen) ? story.listen : []
  story.eventimes = Array.isArray(story.eventimes) && story.eventimes.length > 0 ? story.eventimes : undefined
  story.tracks = isPlainObject(story.tracks) ? story.tracks : undefined
  story.state = isPlainObject(story.state) ? story.state : undefined

  return story as StoryDef
}

/**
 * Normalizes one authored scene into the canonical V1 shape.
 */
export function normalizeSceneDef(scene: SceneDef | MutableSceneDef): SceneDef {
  scene.initial = scene.initial ?? undefined
  scene.straps = Array.isArray(scene.straps) && scene.straps.length > 0 ? scene.straps : undefined
  scene.listen = Array.isArray(scene.listen) ? scene.listen : []
  scene.tracks = isPlainObject(scene.tracks) ? scene.tracks : {}
  scene.state = isPlainObject(scene.state) ? scene.state : undefined

  for (const [storyId, story] of Object.entries(scene.stories ?? {})) {
    scene.stories[storyId] = normalizeStoryDef(story as MutableStoryDef)
  }

  return scene as SceneDef
}
