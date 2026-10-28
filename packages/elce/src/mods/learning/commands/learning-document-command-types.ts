import { BDC_TYPE, DEFAULT_PRESET_ID } from '../learning-definition'
import type { PagePlacement } from '../organization/learning-page-placement'
import type { BdcPlacement } from '../../../core/document/content-location'
import type { PageType } from '../learning-definition'
import type { EvaluationRetryScope } from '../evaluation/learning-evaluation-config'
import type { BdcId, ChapterId, MediaId, MediaMetadata, PageId } from '../../../core/document/content-document-types'
import type { LearningChapter } from '../document/learning-document-types'
import type { RevelationTransitionDefaults } from '../../../resources/revelation/revelation-types'
import type { EvaluationResultContent } from '../evaluation/domain/learning-evaluation-result-types'
import type { ProfileDefinition, SummarySettings } from '../profile/domain/learning-profile-types'
import type { AppearanceSettings } from '../../../config/appearance/appearance-types'
import type { CardCommand } from '../../../resources/bdcs/card/authoring/card-command-types'
import type { QuestionCommand } from '../../../resources/bdcs/question/authoring/question-command-types'
import type { CarouselCommand } from '../../../resources/bdcs/carousel/authoring/carousel-command-types'
import type { StatisticalGraphCommand } from '../../../resources/bdcs/statistical-graph/authoring/statistical-graph-command-types'
import type { SectionCommand } from '../../../resources/bdcs/section/authoring/section-command-types'
import type { AnchorCommand } from '../../../resources/anchoring/authoring/anchor-command-types'
import type { AppearanceProperty, AppearanceTarget, AppearanceTargetForProperty } from '../../../domain/appearance/appearance-target-types'

export type { AppearanceProperty, AppearanceTarget, AppearanceTargetForProperty } from '../../../domain/appearance/appearance-target-types'

type AppearancePropertySetCommand = {
  [Property in Exclude<AppearanceProperty, 'background'>]: Readonly<{
    type: 'appearance.property.set'
    target: AppearanceTargetForProperty<Property>
    property: Property
    value: NonNullable<AppearanceSettings[Property]>
  }>
}[Exclude<AppearanceProperty, 'background'>]

type AppearancePropertyResetCommand = {
  [Property in AppearanceProperty]: Readonly<{
    type: 'appearance.property.reset'
    target: AppearanceTargetForProperty<Property>
    property: Property
  }>
}[AppearanceProperty]

export type CreatePageCommandInput = Readonly<{
  pageId: PageId
  bdcId: BdcId
  initialCardBdcId?: BdcId
  defaultBdcType?: typeof BDC_TYPE.SECTION | typeof BDC_TYPE.QUESTION
  pageType?: PageType
  name?: string
  placement: PagePlacement
}>

export type LearningDocumentCommand =
  | Readonly<{
      type: 'chapter.create'
      chapterId: ChapterId
      name: string
      chapterType?: LearningChapter['type']
    }>
  | Readonly<{ type: 'chapter.rename'; chapterId: ChapterId; name: string }>
  | Readonly<{
      type: 'chapter.evaluation.settings.update'
      chapterId: ChapterId
      attemptLimit: number | null
      retryScope: EvaluationRetryScope
    }>
  | Readonly<{ type: 'chapter.move'; chapterId: ChapterId; index?: number }>
  | Readonly<{ type: 'chapter.delete'; chapterId: ChapterId }>
  | (Readonly<{ type: 'page.create' }> & CreatePageCommandInput)
  | Readonly<{ type: 'page.rename'; pageId: PageId; name: string }>
  | Readonly<{ type: 'page.move'; pageId: PageId; placement: PagePlacement }>
  | Readonly<{ type: 'page.remove'; pageId: PageId }>
  | Readonly<{ type: 'page.delete'; pageId: PageId }>
  | Readonly<{
      type: 'bdc.create'
      bdcId: BdcId
      bdcType: typeof BDC_TYPE.EVALUATION_RESULT
      presetId: typeof DEFAULT_PRESET_ID.EVALUATION_RESULT
      placement: BdcPlacement
    }>
  | SectionCommand
  | QuestionCommand
  | CarouselCommand
  | CardCommand
  | StatisticalGraphCommand
  | Readonly<{ type: 'bdc.move'; bdcId: BdcId; placement: BdcPlacement }>
  | Readonly<{ type: 'bdc.remove'; bdcId: BdcId }>
  | Readonly<{ type: 'bdc.delete'; bdcId: BdcId }>
  | Readonly<{ type: 'bdc.evaluation-result.update'; bdcId: BdcId; evaluationResult: EvaluationResultContent }>
  | Readonly<{ type: 'summary.background.media.attach'; media: MediaMetadata }>
  | Readonly<{ type: 'bdc.evaluation-result.delete'; bdcId: BdcId }>
  | AnchorCommand
  | Readonly<{ type: 'media.add'; media: MediaMetadata }>
  | Readonly<{ type: 'media.merge'; canonicalMediaId: MediaId; duplicateMediaIds: readonly MediaId[] }>
  | Readonly<{ type: 'document.revelation.update'; revelationDefaults: RevelationTransitionDefaults }>
  | Readonly<{ type: 'summary.settings.update'; summary: SummarySettings }>
  | Readonly<{ type: 'profile.definition.update'; profile: ProfileDefinition }>
  | Readonly<{
      type: 'appearance.background.set'
      target: AppearanceTarget
      value: NonNullable<AppearanceSettings['background']>
    }>
  | Readonly<{
      type: 'appearance.typography.set'
      target: AppearanceTarget
      headingFontId: string
      bodyFontId: string
    }>
  | AppearancePropertySetCommand
  | AppearancePropertyResetCommand
  | Readonly<{ type: 'document.rename'; name: string }>
