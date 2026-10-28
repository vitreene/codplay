import { CHAPTER_TYPE } from '../organization/learning-organization-config'
import type { LearningDocument } from '../document/learning-document'
import type { ProfileProperty, ProfileValue } from '../profile/domain/learning-profile-types'
import { learningProfileService } from '../profile/domain/learning-profile-service'
import { learningTestStateService } from './learning-test-state-service'
import { learningEvaluationSessionService } from '../evaluation/learning-evaluation-session-service'
import { DEFAULT_EVALUATION_THRESHOLD } from '../evaluation/learning-evaluation-config'
import { ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY } from '../../../scorm/scorm-types'
import type { ElceRuntimeData } from './learning-scenario-types'

/** Owns profile gates, chapter prerequisites, completion, and reader exit decisions. */
export class LearningProgressionService {
  /** Checks profile visibility and chapter prerequisites for a full document. */
  public pageProfileConstraintsAllowAccess(
    document: LearningDocument,
    pageId: string,
    context: Readonly<Record<string, unknown>>,
    questionBdcByPage: Readonly<Record<string, string>>,
  ): boolean {
    if (context.profileEnabled === false) return true
    return learningProfileService.pageVisibilityAllowsAccess(
      document,
      pageId,
      learningTestStateService.readProfileValues(context.profileValues),
    ) && this.chapterReadingRequirementMet(document, pageId, context, questionBdcByPage)
  }

  /** Validates the current profile form payload before Sighty admits its destination. */
  public isValidProfileSubmission(
    properties: readonly ProfileProperty[],
    fieldPropertyIds: readonly string[],
    data: unknown,
  ): boolean {
    if (!this.isRecord(data) || !this.isRecord(data.profileValues)) return false
    const values = learningTestStateService.readProfileValues(data.profileValues)
    return learningProfileService.validateProfileValues(properties, fieldPropertyIds, values).length === 0
  }

  /** Checks the configured chapter prerequisite against completed reader progress. */
  public chapterReadingRequirementMet(
    document: LearningDocument,
    pageId: string,
    context: Readonly<Record<string, unknown>>,
    questionBdcByPage: Readonly<Record<string, string>>,
  ): boolean {
    const page = document.pages.find((candidate) => candidate.id === pageId)
    if (page?.chapterId === null || page?.chapterId === undefined) return true
    const chapterIndex = document.chapters.findIndex((candidate) => candidate.id === page.chapterId)
    const constraint = document.data.profile.readingConstraints.find((candidate) => candidate.target.id === page.chapterId)
    if (constraint === undefined) return true
    const requiredChapterIds = constraint.requirement.kind === 'chapters'
      ? constraint.requirement.chapterIds
      : document.chapters[chapterIndex - 1] === undefined
        ? []
        : [document.chapters[chapterIndex - 1]!.id]
    return requiredChapterIds.every((requiredChapterId) => {
      const requiredChapter = document.chapters.find((candidate) => candidate.id === requiredChapterId)
      return requiredChapter !== undefined
        && requiredChapter.pageIds.every((requiredPageId) => this.isPageComplete(requiredPageId, context, questionBdcByPage))
    })
  }

  /** Requires scroll-end and a submitted Question answer when the page owns one. */
  public isPageComplete(
    pageId: string,
    context: Readonly<Record<string, unknown>>,
    questionBdcByPage: Readonly<Record<string, string>>,
  ): boolean {
    if (!learningTestStateService.readFinishedPages(context).includes(pageId)) return false
    return questionBdcByPage[pageId] === undefined
      || Object.hasOwn(learningTestStateService.readQuestionResults(context), pageId)
  }

  /** Applies page completion and the final Evaluation chapter threshold before exit. */
  public canLeavePage(
    runtime: ElceRuntimeData,
    pageId: string,
    context: Readonly<Record<string, unknown>>,
  ): boolean {
    if (runtime.summary.pageContinuationMode !== 'free'
      && !this.isPageComplete(pageId, context, runtime.questionBdcByPage)) return false
    const page = runtime.pages[pageId]
    if (page === undefined || page.chapterId === null) return true
    const chapter = runtime.chapters[page.chapterId]
    if (chapter?.type !== CHAPTER_TYPE.EVALUATION || chapter.pageIds.at(-1) !== pageId) return true
    const questionPageIds = chapter.pageIds.filter((questionPageId) => runtime.questionBdcByPage[questionPageId] !== undefined)
    const evaluation = learningEvaluationSessionService.evaluateChapter(
      questionPageIds,
      learningTestStateService.readQuestionResults(context),
      this.readEvaluationThresholdOverride(context) ?? chapter.evaluationThreshold ?? DEFAULT_EVALUATION_THRESHOLD,
    )
    return evaluation.passed !== false
  }

  /** Checks compact profile visibility and prerequisites in serialized scenario data. */
  public runtimePageProfileConstraintsAllowAccess(
    runtime: ElceRuntimeData,
    pageId: string,
    context: Readonly<Record<string, unknown>>,
  ): boolean {
    if (context.profileEnabled === false) return true
    const visibility = runtime.profile.pageVisibility[pageId]
    const profileValues = learningTestStateService.readProfileValues(context.profileValues)
    const properties = new Map(runtime.profile.properties.map((property) => [property.id, property]))
    if (visibility?.unmetBehavior === 'lock'
      && !learningProfileService.profileVisibilityMatches(visibility.conditions, properties, profileValues)) return false
    const page = runtime.pages[pageId]
    if (page?.chapterId === null || page?.chapterId === undefined) return true
    const constraint = runtime.profile.readingConstraints.find((candidate) => candidate.target.id === page.chapterId)
    if (constraint === undefined) return true
    const chapterIndex = runtime.chapterIds.indexOf(page.chapterId)
    const requiredChapterIds = constraint.requirement.kind === 'chapters'
      ? constraint.requirement.chapterIds
      : runtime.chapterIds[chapterIndex - 1] === undefined
        ? []
        : [runtime.chapterIds[chapterIndex - 1]!]
    return requiredChapterIds.every((requiredChapterId) => {
      const requiredChapter = runtime.chapters[requiredChapterId]
      return requiredChapter !== undefined
        && requiredChapter.pageIds.every((requiredPageId) => this.isPageComplete(requiredPageId, context, runtime.questionBdcByPage))
    })
  }

  /** Checks a chapter's compact visibility rule for presentation and navigation. */
  public runtimeChapterVisibilityAllowsAccess(
    runtime: ElceRuntimeData,
    chapterId: string,
    profileValues: Readonly<Record<string, ProfileValue>>,
  ): boolean {
    const visibility = runtime.profile.chapterVisibility[chapterId]
    return visibility === undefined
      || visibility.unmetBehavior !== 'lock'
      || learningProfileService.profileVisibilityMatches(
        visibility.conditions,
        new Map(runtime.profile.properties.map((property) => [property.id, property])),
        profileValues,
      )
  }

  /** Reads the optional Evaluation threshold without treating arbitrary context as a port. */
  private readEvaluationThresholdOverride(context: Readonly<Record<string, unknown>>): number | undefined {
    const value = context[ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY]
    if (!this.isRecord(value) || typeof value.getEvaluationThresholdOverride !== 'function') return undefined
    return value.getEvaluationThresholdOverride.call(value) as number | undefined
  }

  /** Checks one dynamic boundary for an object with string keys. */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
}

export const learningProgressionService = new LearningProgressionService()
