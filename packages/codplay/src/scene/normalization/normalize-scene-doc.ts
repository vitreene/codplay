import type {
  AuthorRecord,
  CanonicalPersoDoc,
  CanonicalSceneDoc,
  CanonicalStoryDoc,
  PersoDoc,
  SceneListenRule,
  SceneDoc,
  StoryDoc,
} from '../types'
import type { AuthorEmitDeclaration } from '../capture'
import { isPlainRecord } from '../../shared'

/** Normalizes one authoring record without mutating the source payload. */
function cloneAuthorValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(cloneAuthorValue)
  }

  if (isPlainRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneAuthorValue(item)]))
  }

  return value
}

/** Normalizes one optional record while preserving the semantic absence of a value. */
function normalizeOptionalRecord(value: AuthorRecord | undefined): AuthorRecord | undefined {
  return value === undefined ? undefined : cloneAuthorValue(value) as AuthorRecord
}

/** Normalizes one perso and completes its canonical action self-reference. */
function normalizePerso(perso: PersoDoc): CanonicalPersoDoc {
  const actions: Record<string, unknown> = isPlainRecord(perso.actions)
    ? cloneAuthorValue(perso.actions) as Record<string, unknown>
    : {}
  actions[perso.id] = null

  return {
    ...perso,
    initial: normalizeOptionalRecord(perso.initial) ?? {},
    actions,
    list: normalizeOptionalRecord(perso.list),
    emit: perso.emit === undefined
      ? undefined
      : cloneAuthorValue(perso.emit) as AuthorEmitDeclaration,
  }
}

/** Normalizes one story while preserving undefined story placement. */
function normalizeStory(story: StoryDoc): CanonicalStoryDoc {
  return {
    ...story,
    initial: normalizeOptionalRecord(story.initial),
    persos: story.persos.map(normalizePerso),
    tracks: normalizeOptionalRecord(story.tracks) ?? {},
    straps: normalizeStrapDeclarations(story.straps),
    listen: story.listen === undefined ? [] : story.listen.map(cloneAuthorValue) as readonly SceneListenRule[],
    eventimes: story.eventimes?.map(cloneAuthorValue) as StoryDoc['eventimes'],
    state: normalizeOptionalRecord(story.state),
  }
}

/** Normalizes one scene document into the canonical V2 authoring shape. */
export function normalizeSceneDoc(scene: SceneDoc): CanonicalSceneDoc {
  const stories = Object.fromEntries(
    Object.entries(scene.stories).map(([storyId, story]) => [storyId, normalizeStory(story)]),
  )

  return {
    ...scene,
    initial: normalizeOptionalRecord(scene.initial),
    stories,
    straps: normalizeStrapDeclarations(scene.straps),
    listen: scene.listen === undefined ? [] : scene.listen.map(cloneAuthorValue) as readonly SceneListenRule[],
    state: normalizeOptionalRecord(scene.state),
    tracks: normalizeOptionalRecord(scene.tracks) ?? {},
    defaults: normalizeOptionalRecord(scene.defaults),
  }
}

/** Normalizes an optional string list while preserving the canonical empty-list convention. */
function normalizeStrapDeclarations(
  value: StoryDoc['straps'] | SceneDoc['straps'],
): StoryDoc['straps'] | SceneDoc['straps'] | undefined {
  if (value === undefined) return undefined
  if (Array.isArray(value)) return value.length === 0 ? undefined : [...value]
  return Object.fromEntries(Object.entries(value))
}
