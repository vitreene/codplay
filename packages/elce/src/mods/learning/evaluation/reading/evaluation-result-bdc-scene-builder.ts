import type { PersoDoc, StoryDoc } from 'codplay/scene/types'
import { ELCE_EVENTS } from '../../reading/learning-reading-events'
import {
  EVALUATION_RESULT_BRANCH,
  EVALUATION_RESULT_CONFIG,
} from '../learning-evaluation-config'
import type {
  EvaluationResultAction,
  EvaluationResultBranch,
} from '../learning-evaluation-config'
import type { LearningBdc, LearningPage } from '../../document/learning-document-types'
import { ElceCardPresetBuilder } from '../../../../core/presets/card-preset-builder'
import { plainTextFromValue } from '../../inline-text/learning-inline-text-value'
import { wrapInlineTextSceneParts } from '../../inline-text/learning-inline-text-scene'
import type { ResourceInlineTextSceneFeature, ResourceInlineTextSceneParts } from '../../../../resources/document/resource-inline-text-feature'

export type EvaluationResultBdcSceneBuild = Readonly<{
  readonly mountPartId: string
  readonly mountMarkup: string
  readonly stories: readonly StoryDoc<string>[]
}>

/** Builds one CodPlay story per outcome for a Result BDC. */
export function buildEvaluationResultBdcScene(
  page: LearningPage,
  bdc: LearningBdc,
  presetBuilder: ElceCardPresetBuilder,
  appearanceClassName?: string,
  inlineTextSceneFeature?: ResourceInlineTextSceneFeature,
): EvaluationResultBdcSceneBuild {
  if (bdc.evaluationResult == null) throw new Error(`Le bdc Résultat ${bdc.id} n’a pas de contenu.`)
  const prefix = `${page.id}:${bdc.id}`
  const partId = `${prefix}:evaluation-result`
  const result = bdc.evaluationResult

  return {
    mountPartId: partId,
    mountMarkup: `<!-- data-part="${partId}" -->`,
    stories: [
      createEvaluationResultBranchStory(page, bdc, presetBuilder, partId, EVALUATION_RESULT_BRANCH.SUCCESS, result.success, prefix, appearanceClassName, inlineTextSceneFeature),
      createEvaluationResultBranchStory(page, bdc, presetBuilder, partId, EVALUATION_RESULT_BRANCH.FAILURE, result.failure, prefix, appearanceClassName, inlineTextSceneFeature),
    ],
  }
}

/** Builds the requested result branch as an initially unmounted CodPlay story. */
function createEvaluationResultBranchStory(
  page: LearningPage,
  bdc: LearningBdc,
  presetBuilder: ElceCardPresetBuilder,
  mountPartId: string,
  branch: EvaluationResultBranch,
  content: NonNullable<LearningBdc['evaluationResult']>['success'],
  prefix: string,
  appearanceClassName?: string,
  inlineTextSceneFeature?: ResourceInlineTextSceneFeature,
): StoryDoc<string> {
  const branchPrefix = `${prefix}:${branch}`
  const rootId = `${page.id}-${bdc.id}-${branch}`
  const messageParts = typeof content.message === 'string'
    ? null
    : inlineTextSceneFeature?.build(content.message, `${branchPrefix}:inline:message`) ?? null
  const card = presetBuilder.build(bdc.presetId, rootId, branchPrefix, {
    branch: resultBranchMarkup(rootId, branchPrefix, branch, messageParts),
  })
  const eventName = branch === EVALUATION_RESULT_BRANCH.SUCCESS
    ? ELCE_EVENTS.EVALUATION_RESULT_SUCCESS
    : ELCE_EVENTS.EVALUATION_RESULT_FAILURE

  return {
    id: rootId,
    persos: [
      {
        id: `${bdc.id}-${branch}-result-card`,
        type: 'layout',
        initial: {
          move: '@off',
          className: `elce-card--evaluation-result ${appearanceClassName ?? 'evaluation-result bdc'}`,
          markup: card.markup,
        },
        actions: {
          [eventName]: { move: { target: mountPartId } },
        },
      },
      ...resultBranchPersos(page, bdc, branch, content, card.zonePartIds, branchPrefix, messageParts),
    ],
  }
}

/** Creates the one visible section and its branch-specific CodPlay anchors. */
function resultBranchMarkup(
  rootId: string,
  partPrefix: string,
  branch: EvaluationResultBranch,
  messageParts: ResourceInlineTextSceneParts | null,
): string {
  const label = EVALUATION_RESULT_CONFIG[branch].label
  const messageMarkup = messageParts === null
    ? `<!-- data-part="${partPrefix}:${branch}-message" -->`
    : wrapInlineTextSceneParts(messageParts, `${rootId}-message`, 'p')
  return `
    <section id="${rootId}-section" class="elce-evaluation-result__branch elce-evaluation-result__branch--${branch}">
      <h2 id="${rootId}-title">${label}</h2>
      ${messageMarkup}
      <!-- data-part="${partPrefix}:${branch}-action" -->
    </section>
  `
}

/** Creates the message and optional action button for one Result branch. */
function resultBranchPersos(
  page: LearningPage,
  bdc: LearningBdc,
  branch: EvaluationResultBranch,
  content: NonNullable<LearningBdc['evaluationResult']>['success'],
  zones: Readonly<Record<string, string>>,
  prefix: string,
  messageParts: ResourceInlineTextSceneParts | null,
): readonly PersoDoc<string>[] {
  const messageZone = zones[`${branch}-message`]
  const actionZone = zones[`${branch}-action`]
  if (messageZone === undefined || actionZone === undefined) {
    throw new Error(`Les zones du résultat ${branch} manquent au bdc ${bdc.id}.`)
  }
  const label = EVALUATION_RESULT_CONFIG[branch].actions.find((candidate) => candidate.value === content.action)?.label
  const actionPersos = label === undefined || content.action === null
    ? []
    : [createEvaluationResultActionPerso(page, bdc, branch, content.action, label, actionZone, prefix)]
  const messagePersos = plainTextFromValue(content.message).length === 0
    ? []
    : messageParts !== null
      ? messageParts.persos
      : [{
      id: `${bdc.id}-${branch}-message`,
      type: 'tag',
      initial: { tag: 'p', content: plainTextFromValue(content.message), move: { target: messageZone } },
    } satisfies PersoDoc<string>]
  return [...messagePersos, ...actionPersos]
}

/** Creates the CodPlay button that reports its configured result action. */
function createEvaluationResultActionPerso(
  page: LearningPage,
  bdc: LearningBdc,
  branch: EvaluationResultBranch,
  action: EvaluationResultAction,
  label: string,
  target: string,
  prefix: string,
): PersoDoc<string> {
  return {
    id: `${bdc.id}-${branch}-action`,
    type: 'tag',
    initial: { tag: 'button', content: label, attr: { type: 'button' }, move: { target } },
    emit: {
      click: {
        event: {
          name: ELCE_EVENTS.EVALUATION_RESULT_ACTION,
          data: { pageId: page.id, chapterId: page.chapterId, bdcId: bdc.id, branch, action, prefix },
          visibility: 'public',
        },
      },
    },
  }
}
