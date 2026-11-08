import { CHAPTER_TYPE } from '../organization/learning-organization-config'
import { SCENARIO_ENTRY_KIND } from '../organization/learning-organization-config'
import {
  scenarioChapterAncestors,
  scenarioChapterPageIds,
  scenarioEntriesForParent,
  scenarioParentChapterId,
} from '../organization/learning-scenario-tree'
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
    const chapter = document.chapters.find((candidate) => candidate.id === page.chapterId)
    if (chapter === undefined) return true
    const chapterPath = [...scenarioChapterAncestors(document.data, chapter.id), chapter]
    const constraints = chapterPath.flatMap((ancestor) => document.data.profile.readingConstraints.filter(
      (candidate) => candidate.target.id === ancestor.id,
    ))
    return constraints.every((constraint) => {
      const requiredPageIds = constraint.requirement.kind === 'chapters'
        ? constraint.requirement.chapterIds.flatMap((requiredChapterId) => scenarioChapterPageIds(document.data, requiredChapterId))
        : this.previousDocumentEntryPageIds(document, constraint.target.id)
      return requiredPageIds.every((requiredPageId) => this.isPageComplete(requiredPageId, context, questionBdcByPage))
    })
  }

  /** Checks page completion unless early exit is allowed, then enforces Evaluation thresholds. */
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
    allowEarlyExit = false,
  ): boolean {
    if (runtime.summary.pageContinuationMode !== 'free'
      && !allowEarlyExit
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
    const visibility = runtime.profile.pageVisibility[pageId] ?? []
    const profileValues = learningTestStateService.readProfileValues(context.profileValues)
    const properties = new Map(runtime.profile.properties.map((property) => [property.id, property]))
    if (!visibility.every((constraint) => learningProfileService.profileVisibilityMatches(constraint.conditions, properties, profileValues))) return false
    const page = runtime.pages[pageId]
    if (page?.chapterId === null || page?.chapterId === undefined) return true
    const chapter = runtime.chapters[page.chapterId]
    if (chapter === undefined) return true
    const chapterPath = [...this.runtimeChapterAncestors(runtime, chapter.id), chapter]
    const constraints = chapterPath.flatMap((ancestor) => runtime.profile.readingConstraints.filter(
      (candidate) => candidate.target.id === ancestor.id,
    ))
    return constraints.every((constraint) => {
      const requiredPageIds = constraint.requirement.kind === 'chapters'
        ? constraint.requirement.chapterIds.flatMap((requiredChapterId) => runtime.chapters[requiredChapterId]?.subtreePageIds ?? [])
        : this.previousRuntimeEntryPageIds(runtime, constraint.target.id)
      return requiredPageIds.every((requiredPageId) => this.isPageComplete(requiredPageId, context, runtime.questionBdcByPage))
    })
  }

  /** Checks a chapter's compact visibility rule for presentation and navigation. */
  public runtimeChapterVisibilityAllowsAccess(
    runtime: ElceRuntimeData,
    chapterId: string,
    profileValues: Readonly<Record<string, ProfileValue>>,
  ): boolean {
    const visibility = runtime.profile.chapterVisibility[chapterId] ?? []
    const properties = new Map(runtime.profile.properties.map((property) => [property.id, property]))
    return visibility.every((constraint) => learningProfileService.profileVisibilityMatches(constraint.conditions, properties, profileValues))
  }

  /** Returns the ordered pages covered by the previous sibling entry of a chapter. */
  private previousDocumentEntryPageIds(document: LearningDocument, chapterId: string): readonly string[] {
    const parentChapterId = scenarioParentChapterId(document.data, chapterId)
    const entries = scenarioEntriesForParent(document.data, parentChapterId)
    const chapterIndex = entries.findIndex((entry) => entry.kind === SCENARIO_ENTRY_KIND.CHAPTER && entry.chapterId === chapterId)
    const previousEntry = chapterIndex > 0 ? entries[chapterIndex - 1] : undefined
    if (previousEntry === undefined) return []
    return previousEntry.kind === SCENARIO_ENTRY_KIND.PAGE
      ? [previousEntry.pageId]
      : scenarioChapterPageIds(document.data, previousEntry.chapterId)
  }

  /** Returns one chapter's ancestors from its runtime parent links. */
  private runtimeChapterAncestors(runtime: ElceRuntimeData, chapterId: string): readonly ElceRuntimeData['chapters'][string][] {
    const ancestors: ElceRuntimeData['chapters'][string][] = []
    let parentChapterId = runtime.chapters[chapterId]?.parentChapterId ?? null
    while (parentChapterId !== null) {
      const parent = runtime.chapters[parentChapterId]
      if (parent === undefined) break
      ancestors.unshift(parent)
      parentChapterId = parent.parentChapterId
    }
    return ancestors
  }

  /** Returns the ordered pages covered by the previous sibling entry at runtime. */
  private previousRuntimeEntryPageIds(runtime: ElceRuntimeData, chapterId: string): readonly string[] {
    const parentChapterId = runtime.chapters[chapterId]?.parentChapterId ?? null
    const entries = parentChapterId === null
      ? runtime.scenarioEntries
      : runtime.chapters[parentChapterId]?.entries ?? []
    const chapterIndex = entries.findIndex((entry) => entry.kind === SCENARIO_ENTRY_KIND.CHAPTER && entry.chapterId === chapterId)
    const previousEntry = chapterIndex > 0 ? entries[chapterIndex - 1] : undefined
    if (previousEntry === undefined) return []
    return previousEntry.kind === SCENARIO_ENTRY_KIND.PAGE
      ? [previousEntry.pageId]
      : runtime.chapters[previousEntry.chapterId]?.subtreePageIds ?? []
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
