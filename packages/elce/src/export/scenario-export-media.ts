import type { LearningDocument } from '../mods/learning/document/learning-document'
import type { MediaId } from '../core/document/content-document-types'
import { createElcePlayerScenario } from '../mods/learning/reading/learning-player'

const MISSING_MEDIA_SOURCE_PREFIX = 'elce-export-missing://'

/** Finds media referenced by the exact Sighty scene catalog used by preview and export. */
export function scenarioExportMediaIds(
  document: LearningDocument,
  availableMediaSources: Readonly<Record<MediaId, string>>,
): ReadonlySet<MediaId> {
  const sourceMediaIds = new Map<string, Set<MediaId>>()
  const scenarioMediaSources: Record<MediaId, string> = {}
  for (const media of document.medias) {
    const source = availableMediaSources[media.id] ?? `${MISSING_MEDIA_SOURCE_PREFIX}${encodeURIComponent(media.id)}`
    scenarioMediaSources[media.id] = source
    const mediaIds = sourceMediaIds.get(source) ?? new Set<MediaId>()
    mediaIds.add(media.id)
    sourceMediaIds.set(source, mediaIds)
  }

  const scenario = createElcePlayerScenario({ document, mediaSources: scenarioMediaSources })
  const referenced = new Set<MediaId>()
  visitSceneSources(scenario.scenes ?? {}, sourceMediaIds, referenced, new WeakSet<object>())
  return referenced
}

/** Walks the scenario's static scene values and records exact media-source strings. */
function visitSceneSources(
  value: unknown,
  sourceMediaIds: ReadonlyMap<string, ReadonlySet<MediaId>>,
  referenced: Set<MediaId>,
  visited: WeakSet<object>,
): void {
  if (typeof value === 'string') {
    for (const mediaId of sourceMediaIds.get(value) ?? []) referenced.add(mediaId)
    return
  }
  if (value === null || typeof value !== 'object' || visited.has(value)) return
  visited.add(value)
  if (Array.isArray(value)) {
    for (const child of value) visitSceneSources(child, sourceMediaIds, referenced, visited)
    return
  }
  for (const child of Object.values(value)) visitSceneSources(child, sourceMediaIds, referenced, visited)
}
