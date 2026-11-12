import type { MediaId } from '../../../core/document/content-document-types'
import type { QuizHuntDocument } from '../document/quiz-hunt-document-types'
import { createQuizHuntScenarioModel } from '../reading/quiz-hunt-scenario-builder'

const MISSING_MEDIA_SOURCE_PREFIX = 'quiz-hunt-export-missing://'

/** Finds the media referenced by the exact static scenes included in a Quiz Hunt scenario. */
export function quizHuntScenarioExportMediaIds(
  document: QuizHuntDocument,
  availableMediaSources: Readonly<Record<MediaId, string>>,
): ReadonlySet<MediaId> {
  const mediaIdsBySource = new Map<string, Set<MediaId>>()
  const scenarioMediaSources: Record<MediaId, string> = {}
  for (const media of document.medias) {
    const source = availableMediaSources[media.id]
      ?? `${MISSING_MEDIA_SOURCE_PREFIX}${encodeURIComponent(media.id)}`
    scenarioMediaSources[media.id] = source
    const mediaIds = mediaIdsBySource.get(source) ?? new Set<MediaId>()
    mediaIds.add(media.id)
    mediaIdsBySource.set(source, mediaIds)
  }

  const scenario = createQuizHuntScenarioModel(document, scenarioMediaSources, 'release').scenario
  const referenced = new Set<MediaId>()
  visitSceneSources(scenario.scenes ?? {}, mediaIdsBySource, referenced, new WeakSet<object>())
  return referenced
}

/** Walks static scene values and records the IDs behind their media source strings. */
function visitSceneSources(
  value: unknown,
  mediaIdsBySource: ReadonlyMap<string, ReadonlySet<MediaId>>,
  referenced: Set<MediaId>,
  visited: WeakSet<object>,
): void {
  if (typeof value === 'string') {
    for (const mediaId of mediaIdsBySource.get(value) ?? []) referenced.add(mediaId)
    return
  }
  if (value === null || typeof value !== 'object' || visited.has(value)) return
  visited.add(value)
  if (Array.isArray(value)) {
    for (const child of value) visitSceneSources(child, mediaIdsBySource, referenced, visited)
    return
  }
  for (const child of Object.values(value)) visitSceneSources(child, mediaIdsBySource, referenced, visited)
}
