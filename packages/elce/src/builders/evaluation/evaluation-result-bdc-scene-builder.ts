import type { PersoDoc, StoryDoc } from 'codplay/scene/types'
import { ELCE_EVENTS, EVALUATION_RESULT_BRANCH, EVALUATION_RESULT_CONFIG } from '../../config/document-config'
import type { EvaluationResultAction, EvaluationResultBranch } from '../../config/document-config-types'
import type { Bdc, Page } from '../../domain/document/document-types'
import { ElceCardPresetBuilder } from '../card/card-preset-builder'

export type EvaluationResultBdcSceneBuild = Readonly<{
  readonly markup: string
  readonly story: StoryDoc<string>
}>

const cardPresetBuilder = new ElceCardPresetBuilder()

/** Builds the shared CodPlay markup and outcome story for a Result BDC. */
export function buildEvaluationResultBdcScene(page: Page, bdc: Bdc): EvaluationResultBdcSceneBuild {
  if (bdc.evaluationResult == null) throw new Error(`Le bdc Résultat ${bdc.id} n’a pas de contenu.`)
  const prefix = `${page.id}:${bdc.id}`
  const partId = `${prefix}:evaluation-result`
  const card = cardPresetBuilder.build(bdc.presetId, `${page.id}-${bdc.id}`, partId)
  const result = bdc.evaluationResult

  return {
    markup: card.markup,
    story: {
      id: `${page.id}-${bdc.id}`,
      persos: [
        {
          id: `${bdc.id}-result-card`,
          type: 'layout',
          initial: {
            move: '@root',
            className: 'elce-card--evaluation-result elce-evaluation-result--pending',
            markup: card.markup,
          },
          actions: {
            [ELCE_EVENTS.EVALUATION_RESULT_SUCCESS]: { className: 'elce-card--evaluation-result elce-evaluation-result--success' },
            [ELCE_EVENTS.EVALUATION_RESULT_FAILURE]: { className: 'elce-card--evaluation-result elce-evaluation-result--failure' },
          },
        },
        ...resultBranchPersos(page, bdc, EVALUATION_RESULT_BRANCH.SUCCESS, result.success, card.zonePartIds, prefix),
        ...resultBranchPersos(page, bdc, EVALUATION_RESULT_BRANCH.FAILURE, result.failure, card.zonePartIds, prefix),
      ],
    },
  }
}

/** Creates the message and optional action button for one Result branch. */
function resultBranchPersos(
  page: Page,
  bdc: Bdc,
  branch: EvaluationResultBranch,
  content: NonNullable<Bdc['evaluationResult']>['success'],
  zones: Readonly<Record<string, string>>,
  prefix: string,
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
  const messagePersos = content.message.length === 0
    ? []
    : [{
      id: `${bdc.id}-${branch}-message`,
      type: 'tag',
      initial: { tag: 'p', content: content.message, move: { target: messageZone } },
    } satisfies PersoDoc<string>]
  return [...messagePersos, ...actionPersos]
}

/** Creates the CodPlay button that reports its configured result action. */
function createEvaluationResultActionPerso(
  page: Page,
  bdc: Bdc,
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
