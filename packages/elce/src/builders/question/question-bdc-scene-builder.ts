import type { PersoDoc, StoryDoc } from 'codplay/scene/types'
import type { CompiledRecord } from 'codplay/scene/compiled'
import { DEFAULT_PRESET_ID, ELCE_EVENTS, QUESTION_DEFAULTS, QUESTION_TYPE_CONFIG } from '../../config/document-config'
import {
  ELCE_QUESTION_RUNTIME_KEY,
  resetQuestionStrap,
  selectQuestionAnswerStrap,
  validateQuestionAnswerStrap,
  type QuestionRuntimeConfiguration,
} from '../scene-functions/question'
import type { CardPresetBuild } from '../card/card-preset-builder-types'
import { ElceCardPresetBuilder } from '../card/card-preset-builder'
import type { Bdc } from '../../domain/document/document-types'
import type { QuestionAnswer, QuestionContent } from '../../domain/question/question-types'
import type { TestAnswerState } from '../../domain/summary-profile/test-state-types'
import { appendClassToMarkupElement } from '../scene-style/scene-style-classes'
import { plainTextFromValue } from '../../domain/inline-text/inline-text-value'
import { createInlineTextSceneParts } from '../inline-text/inline-text-scene'

const cardPresetBuilder = new ElceCardPresetBuilder()

type QuestionStoryState = Readonly<{
  readonly selectedAnswerIds: readonly string[]
  readonly submitted: boolean
  readonly [ELCE_QUESTION_RUNTIME_KEY]: QuestionRuntimeConfiguration
}>

/** Builds only the optional Question hosts whose authored content is present. */
export function buildQuestionCardPreset(
  rootId: string,
  partPrefix: string,
  question: Pick<QuestionContent, 'title' | 'mediaId'> & Partial<Pick<QuestionContent, 'prompt' | 'answers'>>,
  appearanceClassName?: string,
): CardPresetBuild {
  const titlePrefix = `${partPrefix}:inline:title`
  const promptPrefix = `${partPrefix}:inline:prompt`
  const promptValue = question.prompt ?? ''
  const answers = question.answers ?? []
  const inlineTitle = typeof question.title === 'string' ? null : createInlineTextSceneParts(question.title, titlePrefix)
  const inlinePrompt = typeof promptValue === 'string' ? null : createInlineTextSceneParts(promptValue, promptPrefix)
  const answerRows = answers.map((answer) => {
    const labelPrefix = `${partPrefix}:inline:answer:${answer.id}`
    const labelTarget = `${partPrefix}:answer:${answer.id}:label`
    const inputTarget = `${partPrefix}:answer:${answer.id}:input`
    const labelContent = typeof answer.label === 'string'
      ? `<!-- data-part="${labelTarget}" -->`
      : `<span id="${rootId}-answer-${answer.id}-label">${createInlineTextSceneParts(answer.label, labelPrefix).markup}</span>`
    return `<div id="${rootId}-answer-${answer.id}" class="elce-question-answer-row">${labelContent}<!-- data-part="${inputTarget}" --></div>`
  }).join('')
  const contentByZone = {
    title: plainTextFromValue(question.title).trim().length === 0
      ? ''
      : inlineTitle === null
        ? `<header id="${rootId}-title-host"><!-- data-part="${partPrefix}:title" --></header>`
        : `<header id="${rootId}-title-host"><h2 id="${rootId}-title">${inlineTitle.markup}</h2></header>`,
    illustration: question.mediaId === null
      ? ''
      : `<div id="${rootId}-illustration" class="elce-question-illustration"><!-- data-part="${partPrefix}:illustration" --></div>`,
  }
  const card = cardPresetBuilder.build(DEFAULT_PRESET_ID.QUESTION, rootId, partPrefix, contentByZone)
  const markup = card.markup
    .replace(`<!-- data-part="${partPrefix}:question" -->`, inlinePrompt === null
      ? `<!-- data-part="${partPrefix}:question" -->`
      : `<legend id="${rootId}-prompt">${inlinePrompt.markup}</legend>`)
    .replace(`<!-- data-part="${partPrefix}:answers" -->`, `<!-- data-part="${partPrefix}:answers" -->${answerRows}`)
  const zonePartIds = Object.fromEntries([
    ...Object.entries(card.zonePartIds),
    ...answers.flatMap((answer) => [
      [`answer:${answer.id}:label`, `${partPrefix}:answer:${answer.id}:label`] as const,
      [`answer:${answer.id}:input`, `${partPrefix}:answer:${answer.id}:input`] as const,
    ]),
  ])
  return {
    ...card,
    zonePartIds,
    markup: appendClassToMarkupElement(markup, rootId, appearanceClassName ?? 'question bdc'),
  }
}

/** Builds the shared interactive CodPlay story for one Question BDC. */
export function buildQuestionBdcStory(
  pageId: string,
  bdc: Bdc,
  zones: Readonly<Record<string, string>>,
  completionEventName?: string,
  completionEventData?: CompiledRecord,
  initialAnswer?: TestAnswerState,
): StoryDoc<string> {
  const question = bdc.question
  if (question === null) throw new Error(`Le bdc Question ${bdc.id} n’a pas de contenu.`)
  const prefix = `${pageId}:${bdc.id}`
  const title = plainTextFromValue(question.title).trim().length === 0
    ? []
    : typeof question.title === 'string'
      ? [createQuestionTextPerso(`${prefix}:title`, 'h2', question.title, requireQuestionZone(zones, 'title', bdc.id))]
      : createInlineTextSceneParts(question.title, `${prefix}:inline:title`).persos
  const prompt = typeof question.prompt === 'string'
    ? [createQuestionTextPerso(`${prefix}:prompt`, 'legend', question.prompt, requireQuestionZone(zones, 'question', bdc.id))]
    : createInlineTextSceneParts(question.prompt, `${prefix}:inline:prompt`).persos
  const answersZone = requireQuestionZone(zones, 'answers', bdc.id)
  const instructions = createQuestionTextPerso(
    `${prefix}:instructions`,
    'p',
    QUESTION_TYPE_CONFIG[question.type].instruction,
    answersZone,
    'elce-question-instructions',
  )
  const resetEvent = ELCE_EVENTS.QUESTION_RESET
  const validationZone = requireQuestionZone(zones, 'validation', bdc.id)
  const answerPersos = question.answers.flatMap((answer) => {
    const labelZone = requireQuestionZone(zones, `answer:${answer.id}:label`, bdc.id)
    const inputZone = requireQuestionZone(zones, `answer:${answer.id}:input`, bdc.id)
    const labelPersos = typeof answer.label === 'string'
      ? [createQuestionTextPerso(`${prefix}:answer:${answer.id}:label`, 'span', answer.label, labelZone, 'elce-question-answer__label')]
      : createInlineTextSceneParts(answer.label, `${prefix}:inline:answer:${answer.id}`).persos
    return [
      ...labelPersos,
      createQuestionAnswerPerso(pageId, bdc, prefix, answer, question, inputZone, initialAnswer),
    ]
  })
  return {
    id: `${pageId}-${bdc.id}`,
    state: {
      selectedAnswerIds: initialAnswer?.selectedAnswerIds ?? [],
      submitted: initialAnswer !== undefined,
      [ELCE_QUESTION_RUNTIME_KEY]: {
        pageId,
        bdcId: bdc.id,
        prefix,
        questionType: question.type,
        title: plainTextFromValue(question.title),
        prompt: plainTextFromValue(question.prompt),
        answerIds: question.answers.map((answer) => answer.id),
        answerLabels: question.answers.map((answer) => plainTextFromValue(answer.label)),
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
    },
    listen: [
      { on: `${prefix}:answer:select`, straps: [`${prefix}:select-answer`] },
      { on: `${prefix}:validate`, straps: [`${prefix}:validate-answer`] },
      { on: resetEvent, straps: [`${prefix}:reset-question`] },
    ],
    persos: [
      ...title,
      ...prompt,
      instructions,
      ...answerPersos,
      createQuestionValidatePerso(
        bdc.id,
        prefix,
        validationZone,
        plainTextFromValue(question.validationLabel ?? QUESTION_DEFAULTS.VALIDATE_LABEL),
      ),
      createQuestionFeedbackPerso(bdc.id, prefix, validationZone, initialAnswer),
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
  bdc: Bdc,
  prefix: string,
  answer: QuestionAnswer,
  question: QuestionContent,
  answersZone: string,
  initialAnswer?: TestAnswerState,
): PersoDoc<string> {
  const correctAnswerIds = question.answers.filter((candidate) => candidate.correct).map((candidate) => candidate.id)
  const selectedAnswerIds = new Set(initialAnswer?.selectedAnswerIds ?? [])
  const expectedAnswerIds = new Set(initialAnswer?.expectedAnswerIds ?? [])
  const selected = selectedAnswerIds.has(answer.id)
  const submitted = initialAnswer !== undefined
  const visualState = !submitted ? selected ? 'selected' : 'idle'
    : selected ? expectedAnswerIds.has(answer.id) ? 'revealed-correct' : 'revealed-incorrect'
      : expectedAnswerIds.has(answer.id) ? 'revealed-missed-correct' : 'disabled'
  return {
    id: `${pageId}-${bdc.id}-answer-${answer.id}`,
    type: 'input',
    initial: {
      inputType: QUESTION_TYPE_CONFIG[question.type].inputType,
      name: `${prefix}:answer-group`,
      value: answer.id,
      label: plainTextFromValue(answer.label),
      hint: '',
      checked: selected,
      disabled: submitted,
      ...(submitted ? { selectedAnswerIds: [...selectedAnswerIds], correctAnswerIds, disableAnswers: true, showCorrection: true } : {}),
      visualState,
      className: 'elce-question-answer-input',
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
  answer?: TestAnswerState,
): PersoDoc<string> {
  const message = answer === undefined ? '' : answer.isCorrect ? 'Bonne réponse.' : 'Réponse incorrecte.'
  return {
    id: `${bdcId}-feedback`,
    type: 'tag',
    initial: {
      tag: 'p',
      content: message,
      attr: { hidden: answer === undefined, 'aria-live': 'polite' },
      className: 'elce-question-feedback',
      move: { target },
    },
    actions: { [`${prefix}:feedback`]: {} },
  }
}
