import type { SightyActionContext, SightyConditionContext } from '@codplay/sighty'
import type { SightySceneResetHandler } from '@codplay/sighty'
import { ELCE_EVENTS, ELCE_SCENARIO, ELCE_SCENARIO_HANDLERS } from './learning-reading-events'
import { QUESTION_TYPE } from '../../../resources/bdcs/question/question-config'
import { BDC_TYPE } from '../learning-definition'
import { CHAPTER_TYPE } from '../organization/learning-organization-config'
import { ELCE_SCORM_CHAPTER_CONTEXT_KEY, ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY } from '../../../scorm/scorm-types'
import type { ElceScormProgressSink, ScormQuestionInteraction } from '../../../scorm/scorm-types'
import type { QuestionType } from '../../../resources/bdcs/question/domain/question-types'
import type { ElceRuntimeData, ElceSceneKey, ElceSlotName, ScenarioBuildOptions } from './learning-scenario-types'
import { learningProfileService } from '../profile/domain/learning-profile-service'
import { learningTestStateService } from './learning-test-state-service'
import { learningProgressionService } from './learning-progression-service'
import { learningEvaluationSessionService } from '../evaluation/learning-evaluation-session-service'
import { learningPresentationService } from './learning-presentation-service'
import { menuPresentationEvent, pageIdFromSceneKey } from './learning-scenario-paths'

export class LearningScenarioActions {
  private readonly options: ScenarioBuildOptions

  /** Creates action handlers using the optional author-preview state port. */
  public constructor(options: ScenarioBuildOptions = {}) {
    this.options = options
  }

  /** Builds the named Sighty handlers while preserving host state callbacks. */
  public actionHandlers() {
    const onTestStateChange = this.options.onTestStateChange
    return {
      [ELCE_SCENARIO_HANDLERS.REFRESH_PRESENTATION]: (context: SightyActionContext<ElceSceneKey, ElceSlotName>) => this.refreshPresentationAction(context),
      [ELCE_SCENARIO_HANDLERS.OPEN_MENU_DRAWER]: (context: SightyActionContext<ElceSceneKey, ElceSlotName>) => this.openMenuDrawerAction(context),
      [ELCE_SCENARIO_HANDLERS.CLOSE_MENU_DRAWER]: (context: SightyActionContext<ElceSceneKey, ElceSlotName>) => this.closeMenuDrawer(context),
      [ELCE_SCENARIO_HANDLERS.MARK_PAGE_FINISHED]: onTestStateChange === undefined
        ? (context: SightyActionContext<ElceSceneKey, ElceSlotName>) => this.markPageFinishedAction(context)
        : this.createMarkPageFinished(onTestStateChange),
      [ELCE_SCENARIO_HANDLERS.RECORD_QUESTION_RESULT]: onTestStateChange === undefined
        ? (context: SightyActionContext<ElceSceneKey, ElceSlotName>) => this.recordQuestionResultAction(context)
        : this.createRecordQuestionResult(onTestStateChange),
      [ELCE_SCENARIO_HANDLERS.REFRESH_EVALUATION_RESULT]: onTestStateChange === undefined
        ? (context: SightyActionContext<ElceSceneKey, ElceSlotName>) => this.refreshEvaluationResultAction(context)
        : this.createRefreshEvaluationResult(onTestStateChange),
      [ELCE_SCENARIO_HANDLERS.NAVIGATE_SCORM_CHAPTER]: (context: SightyActionContext<ElceSceneKey, ElceSlotName>) => this.navigateScormChapterAction(context),
      [ELCE_SCENARIO_HANDLERS.SAVE_PROFILE_VALUES]: onTestStateChange === undefined
        ? (context: SightyActionContext<ElceSceneKey, ElceSlotName>) => this.saveProfileValuesAction(context)
        : this.createSaveProfileValues(onTestStateChange),
      [ELCE_SCENARIO_HANDLERS.SUBMIT_PROFILE]: onTestStateChange === undefined
        ? (context: SightyActionContext<ElceSceneKey, ElceSlotName>) => this.submitProfileAction(context)
        : this.createSubmitProfile(onTestStateChange),
    }
  }

  /** Builds the guards used by the scenario graph. */
  public guardHandlers() {
    return {
      [ELCE_SCENARIO_HANDLERS.PAGE_ACCESS]: (input: SightyConditionContext<ElceSceneKey>) => this.pageAccessGuard(input),
      [ELCE_SCENARIO_HANDLERS.PAGE_EXIT]: (input: SightyConditionContext<ElceSceneKey>) => this.pageExitGuard(input),
    }
  }

  /** Sends the drawer-open event to the existing persistent menu scene. */
  private async openMenuDrawer(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
    await context.send(ELCE_SCENARIO.SUMMARY_MENU_SCENE, {
      name: ELCE_EVENTS.MENU_DRAWER_OPEN,
    }, { scope: 'story', storyId: 'main' })
  }

  /** Refreshes the page chrome through the scenario data and the existing Sighty operations. */
  public async refreshPresentationAction(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
    await this.refreshPresentation(context)
  }

  /** Opens the persistent menu drawer and refreshes its accessible page states. */
  public async openMenuDrawerAction(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
    await this.openMenuDrawer(context)
    await this.refreshPresentation(context)
  }

  /** Sends the scene-level Question reset event for supported reset keys. */
  public resetQuestionScene(keys: readonly string[]): ReturnType<SightySceneResetHandler> {
    return keys.includes('all') || keys.includes('quiz')
      ? { name: ELCE_EVENTS.QUESTION_RESET, data: { keys: [...keys] } }
      : undefined
  }

  /** Sends a responsive close request through the persistent menu scene. */
  public async closeMenuDrawer(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
    await context.send(ELCE_SCENARIO.SUMMARY_MENU_SCENE, {
      name: ELCE_EVENTS.MENU_DRAWER_CLOSE,
    }, { scope: 'story', storyId: 'main' })
  }

  /** Evaluates the page access condition from compact scenario data and call parameters. */
  public pageAccessGuard(input: SightyConditionContext<ElceSceneKey>): boolean {
    const { sceneKey, event, context } = input
    const runtime = this.readScenarioRuntimeData(input.data)
    const scormChapter = learningPresentationService.scopedScormChapter(runtime, context)
    if (sceneKey === ELCE_SCENARIO.PROFILE_FORM_SCENE) {
      return learningProfileService.shouldCollectProfile(runtime.profile.fieldPropertyIds, learningTestStateService.testStateFromScenarioContext(context))
    }
    if (sceneKey === ELCE_SCENARIO.PROFILE_COMPLETE_SCENE) {
      return event?.name === ELCE_EVENTS.PROFILE_SUBMIT
          && learningProgressionService.isValidProfileSubmission(runtime.profile.properties, runtime.profile.fieldPropertyIds, event.data)
        || context.profileSubmitted === true
    }
    if (sceneKey === ELCE_SCENARIO.SUMMARY_SCENE) {
      return scormChapter === undefined && runtime.summary.showAtRoot
        && (!learningProfileService.shouldCollectProfile(runtime.profile.fieldPropertyIds, learningTestStateService.testStateFromScenarioContext(context)) || context.profileSubmitted === true)
    }
    const pageId = pageIdFromSceneKey(sceneKey)
    if (pageId === undefined || pageId === ELCE_SCENARIO.EMPTY_PAGE) return true
    if (!runtime.pageIds.includes(pageId)) return false
    // Sighty initializes the complete exported scenario before the SCO can
    // route to its chapter. The launch page stays hidden during that transition.
    if (event?.name === ELCE_EVENTS.RUNTIME_INITIALIZE) return true
    if (scormChapter !== undefined && !scormChapter.pageIds.includes(pageId)) return false
    if (!learningProgressionService.runtimePageProfileConstraintsAllowAccess(runtime, pageId, context)) return false
    const submitsProfile = event?.name === ELCE_EVENTS.PROFILE_SUBMIT
      && learningProgressionService.isValidProfileSubmission(runtime.profile.properties, runtime.profile.fieldPropertyIds, event.data)
    if (learningProfileService.shouldCollectProfile(runtime.profile.fieldPropertyIds, learningTestStateService.testStateFromScenarioContext(context)) && !submitsProfile) return false
    const accessPageIds = scormChapter?.pageIds ?? runtime.pageIds
    const pageIndex = accessPageIds.indexOf(pageId)
    if (pageIndex <= 0) return pageIndex === 0
    const previewStartPageId = scormChapter?.pageIds[0] ?? runtime.previewStartPageId
    if (pageId === previewStartPageId) return true
    if (runtime.summary.pageContinuationMode === 'free' && !runtime.evaluationResultPageIds.includes(pageId)) return true
    const previewStartIndex = accessPageIds.indexOf(previewStartPageId)
    const prefixStartIndex = pageIndex > previewStartIndex && !runtime.evaluationResultPageIds.includes(pageId)
      ? previewStartIndex
      : 0
    return accessPageIds.slice(prefixStartIndex, pageIndex)
      .every((candidate) => learningProgressionService.isPageComplete(candidate, context, runtime.questionBdcByPage))
  }

  /** Creates the page exit condition that follows Demo 5's scroll-end navigation. */
  /** Evaluates the page exit condition from compact scenario data and call parameters. */
  public pageExitGuard(input: SightyConditionContext<ElceSceneKey>): boolean {
    const { sceneKey, event, context } = input
    const runtime = this.readScenarioRuntimeData(input.data)
    const scormChapter = learningPresentationService.scopedScormChapter(runtime, context)
    if (sceneKey === ELCE_SCENARIO.PROFILE_FORM_SCENE) return event?.name === ELCE_EVENTS.PROFILE_SUBMIT
    if (sceneKey === ELCE_SCENARIO.PROFILE_COMPLETE_SCENE) return true
    if (sceneKey === ELCE_SCENARIO.SUMMARY_SCENE) return scormChapter === undefined
    const pageId = pageIdFromSceneKey(sceneKey)
    if (pageId === undefined || pageId === ELCE_SCENARIO.EMPTY_PAGE) return true
    if (scormChapter !== undefined) {
      const chapterIndex = scormChapter.pageIds.indexOf(pageId)
      if (chapterIndex < 0) {
        return event?.name?.startsWith(ELCE_EVENTS.MENU_PREFIX) === true
          && scormChapter.pageIds.includes(event.name.slice(ELCE_EVENTS.MENU_PREFIX.length))
      }
      switch (event?.name) {
        case ELCE_EVENTS.NAVIGATION_PREVIOUS:
          return true
        case ELCE_EVENTS.NAVIGATION_NEXT:
          return learningProgressionService.canLeavePage(runtime, pageId, context)
        case ELCE_EVENTS.MENU_SUMMARY:
          return false
        default:
          if (event?.name?.startsWith(ELCE_EVENTS.MENU_PREFIX) === true) {
            return scormChapter.pageIds.includes(event.name.slice(ELCE_EVENTS.MENU_PREFIX.length))
          }
          return event?.name?.startsWith(ELCE_EVENTS.MENU_PREFIX) === true
      }
    }
    switch (event?.name) {
      case ELCE_EVENTS.NAVIGATION_PREVIOUS:
        return true
      case ELCE_EVENTS.NAVIGATION_NEXT:
        return learningProgressionService.canLeavePage(runtime, pageId, context)
      case ELCE_EVENTS.MENU_SUMMARY:
        return runtime.summary.permanentAccess || learningProgressionService.isPageComplete(pageId, context, runtime.questionBdcByPage)
      default:
        return event?.name?.startsWith(ELCE_EVENTS.MENU_PREFIX) === true
    }
  }

  /** Records a functional page end and refreshes the fixed controls. */
  public async markPageFinishedAction(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
    await this.runMarkPageFinished(context)
  }

  /** Keeps the authoring preview's host persistence callback outside the exported runtime function. */
  private createMarkPageFinished(onTestStateChange: NonNullable<ScenarioBuildOptions['onTestStateChange']>) {
    return (context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> => this.runMarkPageFinished(context, onTestStateChange)
  }

  /** Records the page named by the public completion marker and refreshes presentation. */
  private async runMarkPageFinished(
    context: SightyActionContext<ElceSceneKey, ElceSlotName>,
    onTestStateChange?: ScenarioBuildOptions['onTestStateChange'],
  ): Promise<void> {
    const eventData = context.event.data
    if (!this.isRecord(eventData) || typeof eventData.pageId !== 'string') return
    const pageId = eventData.pageId
    const runtime = this.readScenarioRuntimeData(context.data)
    if (!Object.hasOwn(runtime.pages, pageId)) return
    if (!this.isPageInScormChapter(runtime, context.context, pageId)) return
    const finishedPages = learningTestStateService.readFinishedPages(context.context)
    const nextFinishedPages = finishedPages.includes(pageId) ? finishedPages : [...finishedPages, pageId]
    if (nextFinishedPages !== finishedPages) {
      await context.updateContext({ finishedPages: nextFinishedPages })
      onTestStateChange?.(learningTestStateService.testStateFromScenarioContext(context.context, { finishedPages: nextFinishedPages }))
    }
    await this.saveScormReaderState(
      context,
      pageId,
      learningTestStateService.testStateFromScenarioContext(context.context, { finishedPages: nextFinishedPages }),
    )
    await this.refreshPresentation(context)
  }

  /** Updates profile values in the shared Sighty context. */
  public async saveProfileValuesAction(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
    await this.runSaveProfileValues(context)
  }

  /** Keeps authoring-preview persistence outside the exported profile handler. */
  private createSaveProfileValues(onTestStateChange: NonNullable<ScenarioBuildOptions['onTestStateChange']>) {
    return (context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> => this.runSaveProfileValues(context, onTestStateChange)
  }

  /** Applies a profile edit and optionally reports it to the authoring host. */
  private async runSaveProfileValues(
    context: SightyActionContext<ElceSceneKey, ElceSlotName>,
    onTestStateChange?: ScenarioBuildOptions['onTestStateChange'],
  ): Promise<void> {
    const data = context.event.data
    if (data === undefined || !this.isRecord(data.profileValues)) return
    const profileValues = learningTestStateService.readProfileValues(data.profileValues)
    await context.updateContext({ profileValues })
    const state = learningTestStateService.testStateFromScenarioContext(context.context, { profileValues })
    onTestStateChange?.(state)
    await this.saveScormReaderState(context, undefined, state)
  }

  /** Commits a valid initial profile using the compact scenario definition. */
  public async submitProfileAction(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
    await this.runSubmitProfile(context)
  }

  /** Keeps authoring-preview persistence outside the exported profile handler. */
  private createSubmitProfile(onTestStateChange: NonNullable<ScenarioBuildOptions['onTestStateChange']>) {
    return (context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> => this.runSubmitProfile(context, onTestStateChange)
  }

  /** Validates profile values, updates Sighty state, and optionally reports the change to the host. */
  private async runSubmitProfile(
    context: SightyActionContext<ElceSceneKey, ElceSlotName>,
    onTestStateChange?: ScenarioBuildOptions['onTestStateChange'],
  ): Promise<void> {
    const runtime = this.readScenarioRuntimeData(context.data)
    const data = context.event.data
    if (!learningProgressionService.isValidProfileSubmission(runtime.profile.properties, runtime.profile.fieldPropertyIds, data)) return
    const profileValues = learningTestStateService.readProfileValues(this.isRecord(data) ? data.profileValues : undefined)
    await context.updateContext({ profileValues, profileSubmitted: true })
    const state = learningTestStateService.testStateFromScenarioContext(context.context, { profileValues, profileSubmitted: true })
    onTestStateChange?.(state)
    await this.saveScormReaderState(context, undefined, state)
  }

  /** Stores a validated answer in Sighty progress and its existing Evaluation state. */
  public async recordQuestionResultAction(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
    await this.runRecordQuestionResult(context)
  }

  /** Keeps authoring-preview persistence outside the exported question handler. */
  private createRecordQuestionResult(onTestStateChange: NonNullable<ScenarioBuildOptions['onTestStateChange']>) {
    return (context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> => this.runRecordQuestionResult(context, onTestStateChange)
  }

  /** Validates a Question result, updates Sighty state, and refreshes presentation. */
  private async runRecordQuestionResult(
    context: SightyActionContext<ElceSceneKey, ElceSlotName>,
    onTestStateChange?: ScenarioBuildOptions['onTestStateChange'],
  ): Promise<void> {
      const runtime = this.readScenarioRuntimeData(context.data)
      const pageId = pageIdFromSceneKey(context.event.sourceSceneKey)
      if (pageId === undefined || pageId === ELCE_SCENARIO.EMPTY_PAGE) return
      if (!this.isPageInScormChapter(runtime, context.context, pageId)) return
      const payload = context.event.data as {
        pageId?: unknown
        bdcId?: unknown
        isCorrect?: unknown
        answerIds?: unknown
        answerLabels?: unknown
        selectedAnswerIds?: unknown
        expectedAnswerIds?: unknown
        questionType?: unknown
        description?: unknown
      } | undefined
      const expectedBdcId = runtime.questionBdcByPage[pageId]
      if (payload?.pageId !== pageId || payload.bdcId !== expectedBdcId || typeof payload.isCorrect !== 'boolean') return

      const questionResults = learningTestStateService.readQuestionResults(context.context)
      const page = runtime.pages[pageId]
      const chapter = page?.chapterId === null || page?.chapterId === undefined
        ? undefined
        : runtime.chapters[page.chapterId]
      const evaluationChapter = chapter?.type === CHAPTER_TYPE.EVALUATION ? chapter : undefined
      const evaluationStates = learningTestStateService.readEvaluationStates(context.context)
      const questionInteraction = this.toScormQuestionInteraction(payload, context.event.timeMs, Date.now())
      const evaluationThresholdOverride = this.readScormProgressSink(context.context)?.getEvaluationThresholdOverride?.()
      const state = evaluationChapter === undefined
        ? undefined
        : learningEvaluationSessionService.recordEvaluationAnswer(
          runtime,
          evaluationChapter,
          pageId,
          payload,
          evaluationStates[evaluationChapter.id],
          questionInteraction,
          evaluationThresholdOverride,
        )
      const answerIds = learningTestStateService.readStringIds(payload.answerIds)
      const selectedAnswerIds = learningTestStateService.readStringIds(payload.selectedAnswerIds)
      const expectedAnswerIds = learningTestStateService.readStringIds(payload.expectedAnswerIds)
      const questionAnswers = answerIds === undefined || selectedAnswerIds === undefined || expectedAnswerIds === undefined
        ? learningTestStateService.readQuestionAnswers(context.context)
        : {
          ...learningTestStateService.readQuestionAnswers(context.context),
          [pageId]: { answerIds, selectedAnswerIds, expectedAnswerIds, isCorrect: payload.isCorrect },
        }
      const nextEvaluationStates = evaluationChapter === undefined || state === undefined
        ? evaluationStates
        : { ...evaluationStates, [evaluationChapter.id]: state }
      await context.updateContext({
        questionResults: { ...questionResults, [pageId]: payload.isCorrect },
        questionAnswers,
        evaluationStates: nextEvaluationStates,
      })
      const nextTestState = learningTestStateService.testStateFromScenarioContext(context.context, {
        questionAnswers,
        questionResults: { ...questionResults, [pageId]: payload.isCorrect },
        evaluationStates: nextEvaluationStates,
      })
      onTestStateChange?.(nextTestState)
      const scormSink = this.readScormProgressSink(context.context)
      if (evaluationChapter === undefined
        && questionInteraction !== undefined
        && scormSink?.recordQuestionInteraction !== undefined) {
        await scormSink.recordQuestionInteraction(nextTestState, pageId, questionInteraction)
      } else {
        await this.saveScormReaderState(context, pageId, nextTestState)
      }
      await this.refreshPresentation(context)
  }

  /** Reads the validated Question fields needed for an immediate or deferred CMI interaction. */
  private toScormQuestionInteraction(
    payload: Readonly<Record<string, unknown>> | undefined,
    timeMs: number | undefined,
    timestampMs: number,
  ): ScormQuestionInteraction | undefined {
    if (payload === undefined || typeof payload.isCorrect !== 'boolean') return undefined
    const questionType = this.readQuestionType(payload.questionType)
    const answerIds = learningTestStateService.readStringIds(payload.answerIds)
    const answerLabels = learningTestStateService.readStringIds(payload.answerLabels)
    const selectedAnswerIds = learningTestStateService.readStringIds(payload.selectedAnswerIds)
    const expectedAnswerIds = learningTestStateService.readStringIds(payload.expectedAnswerIds)
    if (questionType === undefined || answerIds === undefined || answerLabels === undefined
      || answerLabels.length !== answerIds.length
      || selectedAnswerIds === undefined || expectedAnswerIds === undefined) return undefined
    return {
      questionType,
      answerIds,
      answerLabels,
      selectedAnswerIds,
      expectedAnswerIds,
      description: typeof payload.description === 'string' ? payload.description : '',
      isCorrect: payload.isCorrect,
      ...(typeof timeMs === 'number' && Number.isFinite(timeMs) && timeMs >= 0 ? { latencyMs: timeMs } : {}),
      ...(Number.isFinite(timestampMs) && timestampMs >= 0 ? { timestampMs } : {}),
    }
  }

  /** Restricts serialized Question kinds to the editor's supported types. */
  private readQuestionType(value: unknown): QuestionType | undefined {
    return value === QUESTION_TYPE.TRUE_FALSE || value === QUESTION_TYPE.CHOICE || value === QUESTION_TYPE.MULTIPLE_CHOICE
      ? value
      : undefined
  }

  /** Reads Sighty's result state on page entry and sends it to the Result story. */
  public async refreshEvaluationResultAction(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
    await this.runRefreshEvaluationResult(context)
  }

  /** Persists the current page and requests the adjacent LMS chapter from its leaf navigation action. */
  public async navigateScormChapterAction(
    context: SightyActionContext<ElceSceneKey, ElceSlotName>,
  ): Promise<void> {
    const runtime = this.readScenarioRuntimeData(context.data)
    const chapterId = context.context[ELCE_SCORM_CHAPTER_CONTEXT_KEY]
    if (typeof chapterId !== 'string') return
    const direction = context.event.name === ELCE_EVENTS.NAVIGATION_NEXT
      ? 1
      : context.event.name === ELCE_EVENTS.NAVIGATION_PREVIOUS
        ? -1
        : 0
    if (direction === 0 || !learningPresentationService.hasAdjacentScormChapter(runtime, context.context, chapterId, direction)) return
    const chapter = runtime.chapters[chapterId]
    const pageSelection = context.scenarioState.current.find((selection) => selection.slotName === ELCE_SCENARIO.CONTENT_SLOT)
    const pageId = pageIdFromSceneKey(pageSelection?.sceneKey)
    if (chapter === undefined || pageId === undefined || pageId === ELCE_SCENARIO.EMPTY_PAGE) return
    const isAtBoundary = direction > 0
      ? chapter.pageIds.at(-1) === pageId
      : chapter.pageIds[0] === pageId
    if (!isAtBoundary || (direction > 0 && !learningProgressionService.canLeavePage(runtime, pageId, context.context))) return
    const targetChapterId = learningPresentationService.adjacentChapterId(runtime, chapterId, direction)
    const sink = this.readScormProgressSink(context.context)
    if (targetChapterId === undefined || sink?.navigateToChapter === undefined) return

    await this.runRefreshEvaluationResult(context)
    await sink.navigateToChapter(targetChapterId)
  }

  /** Keeps authoring-preview persistence outside the exported result handler. */
  private createRefreshEvaluationResult(onTestStateChange: NonNullable<ScenarioBuildOptions['onTestStateChange']>) {
    return (context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> => this.runRefreshEvaluationResult(context, onTestStateChange)
  }

  /** Refreshes the page chrome and sends a completed Evaluation result to its compiled scene. */
  private async runRefreshEvaluationResult(
    context: SightyActionContext<ElceSceneKey, ElceSlotName>,
    onTestStateChange?: ScenarioBuildOptions['onTestStateChange'],
  ): Promise<void> {
      const runtime = this.readScenarioRuntimeData(context.data)
      await this.refreshPresentation(context)
      const pageId = pageIdFromSceneKey(context.scenarioState.active?.sceneKey)
      if (pageId === undefined || pageId === ELCE_SCENARIO.EMPTY_PAGE) return
      if (!this.isPageInScormChapter(runtime, context.context, pageId)) return
      const page = runtime.pages[pageId]
    if (page?.chapterId === null || page?.chapterId === undefined) {
      await this.saveScormReaderState(context, pageId)
      return
    }
      const sourceChapter = runtime.chapters[page.chapterId]
      const chapter = sourceChapter?.type === CHAPTER_TYPE.EVALUATION ? sourceChapter : undefined
      const resultBdcId = page.bdcIds.find((bdcId) => runtime.bdcTypes[bdcId] === BDC_TYPE.EVALUATION_RESULT)
    if (chapter === undefined || resultBdcId === undefined) {
      await this.saveScormReaderState(context, pageId)
      return
    }

      const questionIds = learningEvaluationSessionService.evaluationQuestionPageIds(runtime, chapter)
    if (questionIds.length === 0) {
      await this.saveScormReaderState(context, pageId)
      return
    }
      const evaluationStates = learningTestStateService.readEvaluationStates(context.context)
      let state = evaluationStates[chapter.id]
    if (state === undefined || !questionIds.every((questionId) => state?.context.answers[questionId] !== undefined)) {
      await this.saveScormReaderState(context, pageId)
      return
    }
      const evaluationThresholdOverride = this.readScormProgressSink(context.context)?.getEvaluationThresholdOverride?.()
      const machine = learningEvaluationSessionService.createEvaluationMachine(chapter, questionIds, evaluationThresholdOverride)
      state = learningEvaluationSessionService.applyThreshold(state, evaluationThresholdOverride)
      if (state.value === 'attempting') state = machine.transition(state, { type: 'COMPLETE' })
      const passed = state.context.result?.passed
    if (passed === null || passed === undefined) {
      await this.saveScormReaderState(context, pageId)
      return
    }
    let persistedEvaluationStates = evaluationStates
      if (state !== evaluationStates[chapter.id]) {
      persistedEvaluationStates = { ...evaluationStates, [chapter.id]: state }
      await context.updateContext({ evaluationStates: persistedEvaluationStates })
      onTestStateChange?.(learningTestStateService.testStateFromScenarioContext(context.context, { evaluationStates: persistedEvaluationStates }))
      }
    await this.readScormProgressSink(context.context)?.recordEvaluationResult(
      learningTestStateService.testStateFromScenarioContext(context.context, { evaluationStates: persistedEvaluationStates }),
      pageId,
      { chapterId: chapter.id, evaluationState: state },
    )
      await context.send(`scene-${pageId}` as ElceSceneKey, {
        name: passed ? ELCE_EVENTS.EVALUATION_RESULT_SUCCESS : ELCE_EVENTS.EVALUATION_RESULT_FAILURE,
      }, { scope: 'scene' })
  }

  /** Saves the current Elcé test state when the host supplied the SCORM adapter. */
  private async saveScormReaderState(
    context: SightyActionContext<ElceSceneKey, ElceSlotName>,
    currentPageId?: string,
    state = learningTestStateService.testStateFromScenarioContext(context.context),
  ): Promise<void> {
    await this.readScormProgressSink(context.context)?.saveReaderState(state, currentPageId)
  }

  /** Reads the optional Elcé adapter from the application-owned Sighty runtime context. */
  private readScormProgressSink(
    context: Readonly<Record<string, unknown>>,
  ): ElceScormProgressSink | undefined {
    const candidate = context[ELCE_SCORM_PROGRESS_SINK_CONTEXT_KEY]
    if (typeof candidate !== 'object' || candidate === null) return undefined
    const sink = candidate as Partial<ElceScormProgressSink>
    return typeof sink.saveReaderState === 'function' && typeof sink.recordEvaluationResult === 'function'
      ? sink as ElceScormProgressSink
      : undefined
  }

  /** Refreshes menu, title, and navigation from the active Sighty page. */
  private async refreshPresentation(context: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
    const runtime = this.readScenarioRuntimeData(context.data)
    const activeScene = context.scenarioState.active?.sceneKey
    const activePageId = pageIdFromSceneKey(activeScene)
    const questionId = activePageId === undefined ? undefined : runtime.questionBdcByPage[activePageId]
    const answer = activePageId === undefined ? undefined : learningTestStateService.readQuestionAnswers(context.context)[activePageId]
    const restorablePageIds = context.context.restorableQuestionPageIds
    if (activeScene !== undefined && activePageId !== undefined && questionId !== undefined && answer !== undefined
      && Array.isArray(restorablePageIds) && restorablePageIds.includes(activePageId)) {
      await context.send(activeScene, {
        name: ELCE_EVENTS.QUESTION_RESTORE,
        data: { selectedAnswerIds: [...answer.selectedAnswerIds] },
      }, { scope: 'story', storyId: `${activePageId}-${questionId}` })
    }
    const presentation = await learningPresentationService.createPresentation(context.scenarioState, runtime, context.context)
    await context.send(ELCE_SCENARIO.TITLE_SCENE, {
      name: ELCE_EVENTS.PRESENTATION_TITLE,
      data: { content: presentation.title },
    }, { scope: 'story', storyId: 'main' })
    const activeSceneKeys = new Set(context.scenarioState.current.map((selection) => selection.sceneKey))
    if (activeSceneKeys.has(ELCE_SCENARIO.SUMMARY_MENU_SCENE)) {
      await context.send(ELCE_SCENARIO.SUMMARY_MENU_SCENE, {
        name: ELCE_EVENTS.PRESENTATION_MENU,
        data: { className: presentation.menuClassPatch },
      }, { scope: 'story', storyId: 'main' })
    }
    const summaryScenes: ElceSceneKey[] = activeSceneKeys.has(ELCE_SCENARIO.SUMMARY_MENU_SCENE)
      ? [ELCE_SCENARIO.SUMMARY_MENU_SCENE]
      : []
    if (context.scenarioState.current.some((selection) => selection.sceneKey === ELCE_SCENARIO.SUMMARY_SCENE)) {
      summaryScenes.push(ELCE_SCENARIO.SUMMARY_SCENE)
    }
    for (const sceneKey of summaryScenes) {
      for (const page of presentation.menuPageStates) {
        await context.send(sceneKey, {
          name: menuPresentationEvent(page.id),
          data: { attr: {
            'data-page-id': page.id,
            'data-active': String(page.active),
            'data-locked': String(!page.allowed),
            'aria-label': page.allowed ? page.title : `${page.title}, verrouillé`,
            disabled: !page.allowed,
          } },
        }, { scope: 'story', storyId: 'main' })
      }
    }
    await context.send(ELCE_SCENARIO.NAVIGATION_SCENE, {
      name: ELCE_EVENTS.PRESENTATION_NAVIGATION_PREVIOUS,
      data: { attr: presentation.previousAttributes },
    }, { scope: 'story', storyId: 'main' })
    await context.send(ELCE_SCENARIO.NAVIGATION_SCENE, {
      name: ELCE_EVENTS.PRESENTATION_NAVIGATION_STATUS,
      data: { content: presentation.navigationStatus },
    }, { scope: 'story', storyId: 'main' })
    await context.send(ELCE_SCENARIO.NAVIGATION_SCENE, {
      name: ELCE_EVENTS.PRESENTATION_NAVIGATION_NEXT,
      data: { attr: presentation.nextAttributes },
    }, { scope: 'story', storyId: 'main' })
    if (context.event.name === ELCE_EVENTS.MENU_SUMMARY || context.event.name.startsWith(ELCE_EVENTS.MENU_PREFIX)) {
      await this.closeMenuDrawer(context)
    }
  }

  /** Keeps SCORM progress writes inside the chapter of the current SCO. */
  private isPageInScormChapter(
    runtime: ElceRuntimeData,
    context: Readonly<Record<string, unknown>>,
    pageId: string,
  ): boolean {
    const chapterId = context[ELCE_SCORM_CHAPTER_CONTEXT_KEY]
    if (typeof chapterId !== 'string') return true
    return runtime.chapters[chapterId]?.pageIds.includes(pageId) === true
  }

  /** Reads the runtime configuration embedded in the compact scenario data. */
  private readScenarioRuntimeData(value: Readonly<Record<string, unknown>>): ElceRuntimeData {
    if (!Array.isArray(value.pageIds)
      || !this.isRecord(value.pageNames)
      || !this.isRecord(value.pagePaths)
      || !this.isRecord(value.pages)
      || !this.isRecord(value.chapters)
      || !this.isRecord(value.profile)) {
      throw new Error('Les données runtime du scénario Elcé sont absentes ou invalides.')
    }
    return value as unknown as ElceRuntimeData
  }

  /** Checks whether a scenario context field is a non-array object. */
  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
}

export const learningScenarioActions = new LearningScenarioActions()

/** Delegates the public refreshPresentationAction operation to the Learning action owner. */
export function refreshPresentationAction(input: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  return learningScenarioActions.refreshPresentationAction(input)
}

/** Delegates the public openMenuDrawerAction operation to the Learning action owner. */
export function openMenuDrawerAction(input: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  return learningScenarioActions.openMenuDrawerAction(input)
}

/** Delegates the public resetQuestionScene operation to the Learning action owner. */
export function resetQuestionScene(keys: readonly string[]): ReturnType<SightySceneResetHandler> {
  return learningScenarioActions.resetQuestionScene(keys)
}

/** Delegates the public closeMenuDrawer operation to the Learning action owner. */
export function closeMenuDrawer(input: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  return learningScenarioActions.closeMenuDrawer(input)
}

/** Delegates the public pageAccessGuard operation to the Learning action owner. */
export function pageAccessGuard(input: SightyConditionContext<ElceSceneKey>): boolean {
  return learningScenarioActions.pageAccessGuard(input)
}

/** Delegates the public pageExitGuard operation to the Learning action owner. */
export function pageExitGuard(input: SightyConditionContext<ElceSceneKey>): boolean {
  return learningScenarioActions.pageExitGuard(input)
}

/** Delegates the public markPageFinishedAction operation to the Learning action owner. */
export function markPageFinishedAction(input: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  return learningScenarioActions.markPageFinishedAction(input)
}

/** Delegates the public saveProfileValuesAction operation to the Learning action owner. */
export function saveProfileValuesAction(input: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  return learningScenarioActions.saveProfileValuesAction(input)
}

/** Delegates the public submitProfileAction operation to the Learning action owner. */
export function submitProfileAction(input: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  return learningScenarioActions.submitProfileAction(input)
}

/** Delegates the public recordQuestionResultAction operation to the Learning action owner. */
export function recordQuestionResultAction(input: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  return learningScenarioActions.recordQuestionResultAction(input)
}

/** Delegates the public refreshEvaluationResultAction operation to the Learning action owner. */
export function refreshEvaluationResultAction(input: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  return learningScenarioActions.refreshEvaluationResultAction(input)
}

/** Delegates the public navigateScormChapterAction operation to the Learning action owner. */
export function navigateScormChapterAction(input: SightyActionContext<ElceSceneKey, ElceSlotName>): Promise<void> {
  return learningScenarioActions.navigateScormChapterAction(input)
}
