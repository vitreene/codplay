import type { SightySceneSourceValue } from '@codplay/sighty'
import { BDC_TYPE, PAGE_TYPE } from '../learning-definition'
import { CHAPTER_TYPE } from '../organization/learning-organization-config'
import { buildFluxScene } from '../../../resources/pages/flux/flux-scene-builder'
import type { FluxSceneBuildOptions } from '../../../resources/pages/flux/flux-scene-builder-types'
import { buildDiapoScene } from '../../../resources/pages/diapo/diapo-scene-builder'
import { resetQuestionScene } from './learning-scenario-actions'
import type { LearningDocument } from '../document/learning-document'
import { pageAppearanceClassNames } from '../../../builders/scene-style/appearance-class-names'
import { mediaTypeFromMimeType } from '../../../domain/media/media-resource-service'
import type { PageSceneCache } from '../../../core/reading/page-scene-cache'
import { ElceEditorSettingsResolver } from '../../../domain/editor-settings/editor-settings-resolver'
import { createLearningSceneBuilders } from './learning-scene-builders'
import { createLearningAdditionalBdcBuilder } from '../evaluation/reading/learning-additional-bdc-builder'
import type { LearningPlayerOptions } from './learning-player-types'
import { withPageMediaStop } from '../../../core/reading/media-playback/page-media-playback'

const editorSettingsResolver = new ElceEditorSettingsResolver()

/** Builds the scene catalogue for pages that belong to the player scenario. */
export class LearningPageSceneCatalog {
  public build(
    document: LearningDocument,
    mediaSources: LearningPlayerOptions['mediaSources'],
    cache?: PageSceneCache,
  ): Readonly<{ scenes: Readonly<Record<string, SightySceneSourceValue>> }> {
  const sceneBuilders = createLearningSceneBuilders()
  const pageIds = scenarioPageIds(document)
  const activePageIds = new Set(pageIds)
  for (const cachedPageId of cache?.keys() ?? []) {
    if (!activePageIds.has(cachedPageId)) cache?.delete(cachedPageId)
  }
  const scenes = Object.fromEntries(pageIds.map((pageId) => {
    const page = document.pages.find((candidate) => candidate.id === pageId)
    if (page === undefined) throw new Error(`Page absente du document : ${pageId}`)
    const pageBdcs = page.bdcIds.map((bdcId) => document.bdcs.find((bdc) => bdc.id === bdcId))
    const chapterType = page.chapterId === null
      ? undefined
      : document.chapters.find((chapter) => chapter.id === page.chapterId)?.type
    const sceneChapterType = chapterType === CHAPTER_TYPE.EVALUATION ? CHAPTER_TYPE.EVALUATION : undefined
    const pageBdcIds = new Set(pageBdcs.flatMap((bdc) => bdc === undefined ? [] : [bdc.id]))
    const childBdcs = document.bdcs.filter((bdc) => bdc.parentBdcId !== null && pageBdcIds.has(bdc.parentBdcId))
    const sceneBdcs = pageBdcs.flatMap((bdc) => bdc === undefined ? [] : [bdc]).concat(childBdcs)
    const mediaIds = new Set(sceneBdcs.flatMap((bdc) => {
      switch (bdc.type) {
        case BDC_TYPE.CARD:
          return bdc.card?.mediaId == null ? [] : [bdc.card.mediaId]
        case BDC_TYPE.QUESTION:
          return bdc.question?.mediaId == null ? [] : [bdc.question.mediaId]
        default:
          return []
      }
    }))
    const pageMediaSources = Object.fromEntries([...mediaIds].flatMap((mediaId) => {
      const source = mediaSources?.[mediaId]
      return source === undefined ? [] : [[mediaId, source]]
    }))
    const pageMediaTypes = Object.fromEntries([...mediaIds].flatMap((mediaId) => {
      const media = document.medias.find((candidate) => candidate.id === mediaId)
      if (media === undefined) return []
      const type = mediaTypeFromMimeType(media.mimeType)
      return type === null ? [] : [[mediaId, type]]
    }))
    const editorSettings = editorSettingsResolver.resolvePage(page, document.bdcs, document.data.revelationDefaults)
    const scenePage = {
      id: page.id,
      type: page.type,
      bdcIds: page.bdcIds,
      appearance: page.appearance,
      chapterType: sceneChapterType,
    }
    const signature = JSON.stringify([scenePage, sceneBdcs, document.data.appearance, pageMediaSources, pageMediaTypes, editorSettings])
    const cached = cache?.get(pageId)
    if (cached?.signature === signature) {
      return [`scene-${page.id}`, cached.source]
    }
    const appearanceClassNamesByTarget = pageAppearanceClassNames(
      document.data,
      page,
      sceneBdcs,
      (bdc) => bdc.type === BDC_TYPE.EVALUATION_RESULT ? 'evaluation-result' : undefined,
    )
    const scene = buildPageScene(page, document.bdcs, {
      mediaSources: pageMediaSources,
      mediaTypes: pageMediaTypes,
      editorSettings,
      appearanceClassNamesByTarget,
      ...sceneBuilders,
      buildAdditionalBdc: createLearningAdditionalBdcBuilder(
        document,
        sceneBuilders.presetBuilder,
        appearanceClassNamesByTarget,
      ),
    })
    const questionReset = scene.questionReset
    const sceneDoc = withPageMediaStop(scene.sceneDoc)
    const styleSheets = [...scene.styleSheets]
    const styleSheet = styleSheets.join('\n')
    const source: SightySceneSourceValue = questionReset === undefined && styleSheet.length === 0 ? sceneDoc : {
      sceneDoc,
      ...(styleSheet.length === 0 ? {} : { styleSheet }),
      ...(questionReset === undefined ? {} : { onReset: resetQuestionScene }),
    }
    cache?.set(pageId, { signature, source, styleSheets })
    return [`scene-${page.id}`, source]
  }))
    return { scenes }
  }
}

/** Dispatches each page type to the scene builder that owns its presentation. */
function buildPageScene(
  page: LearningDocument['pages'][number],
  bdcs: LearningDocument['bdcs'],
  options: FluxSceneBuildOptions,
) {
  switch (page.type) {
    case PAGE_TYPE.FLUX:
      return buildFluxScene(page, bdcs, options)
    case PAGE_TYPE.DIAPO:
      return buildDiapoScene(page, bdcs, options)
  }
}

/** Reads the same page order used by the Sighty scenario builder. */
function scenarioPageIds(document: LearningDocument): readonly string[] {
  return document.scenarioPageIds
}

