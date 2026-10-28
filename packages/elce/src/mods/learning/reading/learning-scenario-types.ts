import type { SightySceneSourceValue } from '@codplay/sighty'
import { ELCE_SCENARIO } from './learning-reading-events'
import type { LearningChapter } from '../document/learning-document-types'
import type { ProfileConstraint, ProfileProperty, ReadingConstraint, SummarySettings } from '../profile/domain/learning-profile-types'
import type { ProjectTestState } from './learning-test-state-types'
import type { SummaryEntry } from '../organization/reading/learning-summary-scene-builder'

export type ElceSceneKey =
  | typeof ELCE_SCENARIO.LAYOUT_SCENE
  | typeof ELCE_SCENARIO.MENU_SCENE
  | typeof ELCE_SCENARIO.TITLE_SCENE
  | typeof ELCE_SCENARIO.NAVIGATION_SCENE
  | typeof ELCE_SCENARIO.SUMMARY_SCENE
  | typeof ELCE_SCENARIO.SUMMARY_MENU_SCENE
  | typeof ELCE_SCENARIO.PROFILE_FORM_SCENE
  | typeof ELCE_SCENARIO.PROFILE_COMPLETE_SCENE
  | `scene-${string}`

export type ElceSlotName =
  | typeof ELCE_SCENARIO.MENU_SLOT
  | typeof ELCE_SCENARIO.TITLE_SLOT
  | typeof ELCE_SCENARIO.CONTENT_SLOT
  | typeof ELCE_SCENARIO.NAVIGATION_SLOT
  | typeof ELCE_SCENARIO.SUMMARY_MENU_SLOT

export type ElcePresentation = Readonly<{
  readonly title: string
  readonly menuClassPatch: Readonly<{ add: string; remove: string }>
  readonly menuPageStates: readonly Readonly<{ id: string; title: string; active: boolean; allowed: boolean }>[]
  readonly previousAttributes: Readonly<{ type: 'button'; disabled: boolean }>
  readonly nextAttributes: Readonly<{ type: 'button'; disabled: boolean }>
  readonly navigationStatus: string
}>

export type ElceRuntimeChapter = Pick<LearningChapter,
  'id' | 'name' | 'type' | 'pageIds' | 'evaluationThreshold' | 'evaluationAttemptLimit' | 'evaluationRetryScope'
>

export type ElceRuntimeData = Readonly<{
  pageIds: readonly string[]
  pageNames: Readonly<Record<string, string>>
  pagePaths: Readonly<Record<string, string>>
  questionBdcByPage: Readonly<Record<string, string>>
  previewStartPageId: string
  evaluationResultPageIds: readonly string[]
  chapterIds: readonly string[]
  pages: Readonly<Record<string, Readonly<{ chapterId: string | null; bdcIds: readonly string[] }>>>
  chapters: Readonly<Record<string, ElceRuntimeChapter>>
  bdcTypes: Readonly<Record<string, string>>
  summary: Pick<SummarySettings,
    'title' | 'showAtRoot' | 'endChapterDestination' | 'pageContinuationMode' | 'permanentAccess'
  >
  profile: Readonly<{
    fieldPropertyIds: readonly string[]
    properties: readonly ProfileProperty[]
    pageVisibility: Readonly<Record<string, ProfileConstraint>>
    chapterVisibility: Readonly<Record<string, ProfileConstraint>>
    readingConstraints: readonly ReadingConstraint[]
  }>
  summaryEntries: readonly SummaryEntry[]
}>

export type ScenarioBuildOptions = Readonly<{
  readonly testState?: ProjectTestState
  readonly mediaSources?: Readonly<Record<string, string>>
  readonly onTestStateChange?: (state: ProjectTestState) => void | Promise<void>
}>

export type ScenarioSceneCatalog = Readonly<Record<string, SightySceneSourceValue>>
