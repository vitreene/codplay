import type { PersoDoc, StoryDoc } from 'codplay/scene/types'
import type { CompiledRecord } from 'codplay/scene/compiled'
import { QUESTION_PRESET_ID } from '../question-config'
import { QUESTION_EVENTS } from '../question-config'
import { QUESTION_DEFAULTS, QUESTION_TYPE_CONFIG } from '../question-config'
import {
  ELCE_QUESTION_RUNTIME_KEY,
  resetQuestionStrap,
  restoreQuestionStrap,
  selectQuestionAnswerStrap,
  validateQuestionAnswerStrap,
  type QuestionRuntimeConfiguration,
} from './question-runtime'
import type { CardPresetBuild } from '../../../../core/presets/card-preset-builder-types'
import { ElceCardPresetBuilder } from '../../../../core/presets/card-preset-builder'
import type { ResourceBdc } from '../../../document/resource-document-types'
import type { QuestionAnswer, QuestionContent } from '../domain/question-types'
import { appendClassToMarkupElement } from '../../../../builders/scene-style/scene-style-classes'

type QuestionStoryState = Readonly<{
  readonly selectedAnswerIds: readonly string[]
  readonly submitted: boolean
  readonly [ELCE_QUESTION_RUNTIME_KEY]: QuestionRuntimeConfiguration
}>

/** Builds only the optional Question hosts whose authored content is present. */
export function buildQuestionCardPreset(
  rootId: string,
  partPrefix: string,
  question: Pick<QuestionContent, 'title' | 'mediaId'>,
  presetBuilder: ElceCardPresetBuilder,
  appearanceClassName?: string,
): CardPresetBuild {
  const contentByZone = {
    title: question.title.trim().length === 0
      ? ''
      : `<header id="${rootId}-title-host"><!-- data-part="${partPrefix}:title" --></header>`,
    illustration: question.mediaId === null
      ? ''
      : `<div id="${rootId}-illustration" class="elce-question-illustration"><!-- data-part="${partPrefix}:illustration" --></div>`,
  }
  const card = presetBuilder.build(QUESTION_PRESET_ID, rootId, partPrefix, contentByZone)
  return {
    ...card,
    markup: appendClassToMarkupElement(card.markup, rootId, appearanceClassName ?? 'question bdc'),
  }
}

/** Builds the shared interactive CodPlay story for one Question BDC. */
export function buildQuestionBdcStory(
  pageId: string,
  bdc: ResourceBdc,
  zones: Readonly<Record<string, string>>,
  completionEventName?: string,
  completionEventData?: CompiledRecord,
): StoryDoc<string> {
  const question = bdc.question
  if (question === null) throw new Error(`Le bdc Question ${bdc.id} n’a pas de contenu.`)
  const prefix = `${pageId}:${bdc.id}`
  const title = question.title.trim().length > 0
    ? [createQuestionTextPerso(`${prefix}:title`, 'h2', question.title, requireQuestionZone(zones, 'title', bdc.id))]
    : []
  const prompt = createQuestionTextPerso(`${prefix}:prompt`, 'legend', question.prompt, requireQuestionZone(zones, 'question', bdc.id))
  const answersZone = requireQuestionZone(zones, 'answers', bdc.id)
  const instructions = createQuestionTextPerso(
    `${prefix}:instructions`,
    'p',
    QUESTION_TYPE_CONFIG[question.type].instruction,
    answersZone,
    'elce-question-instructions',
  )
  const resetEvent = QUESTION_EVENTS.RESET
  const validationZone = requireQuestionZone(zones, 'validation', bdc.id)
  const answerPersos = question.answers.map((answer) => createQuestionAnswerPerso(
    pageId, bdc, prefix, answer, question, answersZone,
  ))
  return {
    id: `${pageId}-${bdc.id}`,
    state: {
      selectedAnswerIds: [],
      submitted: false,
      [ELCE_QUESTION_RUNTIME_KEY]: {
        pageId,
        bdcId: bdc.id,
        prefix,
        questionType: question.type,
        title: question.title,
        prompt: question.prompt,
        answerIds: question.answers.map((answer) => answer.id),
        answerLabels: question.answers.map((answer) => answer.label),
        correctAnswerIds: question.answers.filter((answer) => answer.correct).map((answer) => answer.id),
        selection: QUESTION_TYPE_CONFIG[question.type].selection,
        ...(completionEventName === undefined ? {} : { completionEventName }),
        ...(completionEventData === undefined ? {} : { completionEventData }),
      },
    } satisfies QuestionStoryState,
    straps: {
      [`${prefix}:select-answer`]: selectQuestionAnswerStrap,
      [`${prefix}:validate-answer`]: validateQuestionAnswerStrap,
      [`${prefix}:reset-question`]: resetQuestionStrap,
      [`${prefix}:restore-question`]: restoreQuestionStrap,
    },
    listen: [
      { on: `${prefix}:answer:select`, straps: [`${prefix}:select-answer`] },
      { on: `${prefix}:validate`, straps: [`${prefix}:validate-answer`] },
      { on: resetEvent, straps: [`${prefix}:reset-question`] },
      { on: QUESTION_EVENTS.RESTORE, straps: [`${prefix}:restore-question`] },
    ],
    persos: [
      ...title,
      prompt,
      instructions,
      ...answerPersos,
      createQuestionValidatePerso(
        bdc.id,
        prefix,
        validationZone,
        question.validationLabel ?? QUESTION_DEFAULTS.VALIDATE_LABEL,
      ),
      createQuestionFeedbackPerso(bdc.id, prefix, validationZone),
    ],
  }
}

/** Creates a plain-text perso for one fixed Question card zone. */
function createQuestionTextPerso(id: string, tag: string, content: string, target: string, className?: string): PersoDoc<string> {
  return {
    id,
    type: 'tag',
    initial: {
      tag,
      content,
      ...(className === undefined ? {} : { className }),
      move: { target },
    },
  }
}

/** Resolves a fixed zone emitted by the selected Question card preset. */
function requireQuestionZone(zones: Readonly<Record<string, string>>, zoneName: string, bdcId: string): string {
  const zoneId = zones[zoneName]
  if (zoneId === undefined) throw new Error(`La zone ${zoneName} manque au preset du bdc Question ${bdcId}.`)
  return zoneId
}

/** Creates one native CodPlay input with explicit selection and correction actions. */
function createQuestionAnswerPerso(
  pageId: string,
  bdc: ResourceBdc,
  prefix: string,
  answer: QuestionAnswer,
  question: QuestionContent,
  answersZone: string,
): PersoDoc<string> {
  const correctAnswerIds = question.answers.filter((candidate) => candidate.correct).map((candidate) => candidate.id)
  return {
    id: `${pageId}-${bdc.id}-answer-${answer.id}`,
    type: 'input',
    initial: {
      inputType: QUESTION_TYPE_CONFIG[question.type].inputType,
      name: `${prefix}:answer-group`,
      value: answer.id,
      label: answer.label,
      hint: '',
      checked: false,
      disabled: false,
      visualState: 'idle',
      selectionIcon: { className: 'elce-question-answer__selection' },
      correctionIcon: {
        className: 'elce-question-answer__correction',
        correctContent: '✓',
        incorrectContent: '×',
        missedCorrectContent: '✓',
      },
      move: { target: answersZone },
    },
    emit: { change: { event: { name: `${prefix}:answer:select`, data: { answerId: answer.id } } } },
    actions: {
      [`${prefix}:answer:${answer.id}:selected`]: { selectedAnswerIds: [answer.id], checked: true, visualState: 'selected' },
      [`${prefix}:answer:${answer.id}:idle`]: { selectedAnswerIds: [], checked: false, visualState: 'idle' },
      [`${prefix}:answer:${answer.id}:reset`]: {
        selectedAnswerIds: [], correctAnswerIds: [], checked: false, disabled: false,
        disableAnswers: false, showCorrection: false, visualState: 'idle',
      },
      [`${prefix}:answer:${answer.id}:revealed-correct`]: {
        selectedAnswerIds: [answer.id], correctAnswerIds, checked: true, disabled: true,
        disableAnswers: true, showCorrection: true, visualState: 'revealed-correct',
      },
      [`${prefix}:answer:${answer.id}:revealed-incorrect`]: {
        selectedAnswerIds: [answer.id], correctAnswerIds, checked: true, disabled: true,
        disableAnswers: true, showCorrection: true, visualState: 'revealed-incorrect',
      },
      [`${prefix}:answer:${answer.id}:revealed-missed-correct`]: {
        selectedAnswerIds: [], correctAnswerIds, checked: false, disabled: true,
        disableAnswers: true, showCorrection: true, visualState: 'revealed-missed-correct',
      },
      [`${prefix}:answer:${answer.id}:locked`]: {
        selectedAnswerIds: [], correctAnswerIds, checked: false, disabled: true,
        disableAnswers: true, showCorrection: true, visualState: 'disabled',
      },
    },
  }
}

/** Creates the validate action in the preset's validation zone. */
function createQuestionValidatePerso(bdcId: string, prefix: string, target: string, label: string): PersoDoc<string> {
  return {
    id: `${bdcId}-validate`,
    type: 'tag',
    initial: {
      tag: 'button',
      content: label,
      attr: { type: 'button', disabled: true },
      className: 'elce-question-validate',
      move: { target },
    },
    emit: { click: { event: { name: `${prefix}:validate` } } },
    actions: {
      [`${prefix}:selection:available`]: { attr: { type: 'button', disabled: false } },
      [`${prefix}:selection:empty`]: { attr: { type: 'button', disabled: true } },
      [`${prefix}:resolved`]: { attr: { type: 'button', disabled: true } },
    },
  }
}

/** Creates the live result text beneath the Question validation button. */
function createQuestionFeedbackPerso(
  bdcId: string,
  prefix: string,
  target: string,
): PersoDoc<string> {
  return {
    id: `${bdcId}-feedback`,
    type: 'tag',
    initial: {
      tag: 'p',
      content: '',
      attr: { hidden: true, 'aria-live': 'polite' },
      className: 'elce-question-feedback',
      move: { target },
    },
    actions: { [`${prefix}:feedback`]: {} },
  }
}
