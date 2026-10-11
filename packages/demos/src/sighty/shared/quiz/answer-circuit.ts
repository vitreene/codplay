import type { SceneDoc } from 'codplay/scene/types'
import { correctionIconPartId, selectionIconPartId } from 'codplay/runtime/components/input'

/** Describes one answer that can be selected in an authored quiz scene. */
export type QuizAnswerDefinition = Readonly<{
  id: string
  label: string
}>

/** Describes the local answer contract shared by Sighty quiz scenes. */
export type QuizQuestionDefinition = Readonly<{
  type: 'boolean' | 'single' | 'multiple'
  prompt: string
  answers: readonly QuizAnswerDefinition[]
  correctAnswerIds: readonly string[]
}>

/** Holds one question's local selection and resolution state. */
export type QuizLocalState = Readonly<{
  question: QuizQuestionDefinition
  selectedAnswerIds: readonly string[]
  submitted: boolean
  solutionsExposed: boolean
}>

/** Names the CSS hooks used by the shared answer inputs. */
export type QuizAnswerClassNames = Readonly<{
  selectionIcon: string
  correctionIcon: string
}>

/** Names the scene-local identities used to create one answer circuit. */
export type QuizAnswerCircuitIds = Readonly<{
  persoPrefix: string
  eventPrefix: string
  storyId?: string
  iconContentMode?: 'component' | 'tag'
}>

type QuizPerso = SceneDoc<string>['stories'][string]['persos'][number]

/** Creates the independent local state carried by one quiz story. */
export function createQuizLocalState(question: QuizQuestionDefinition): QuizLocalState {
  return {
    question,
    selectedAnswerIds: [],
    submitted: false,
    solutionsExposed: false,
  }
}

/** Creates answer inputs and optionally authored icon tags for public component slots. */
export function createQuizAnswerPersos(
  question: QuizQuestionDefinition,
  ids: QuizAnswerCircuitIds,
  classNames: QuizAnswerClassNames,
): QuizPerso[] {
  return question.answers.flatMap((answer): QuizPerso[] => {
    const correctAnswerIds = [...question.correctAnswerIds]
    const multiSelect = question.type === 'multiple'
    const answerEventPrefix = `${ids.eventPrefix}:answer:${answer.id}`
    const answerPersoId = `${ids.persoPrefix}-answer-${answer.id}`
    const usesTagIcons = ids.iconContentMode === 'tag'
    const answerInput: QuizPerso = {
      id: answerPersoId,
      type: 'input',
      initial: {
        inputType: multiSelect ? 'checkbox' : 'radio',
        name: `${ids.persoPrefix}-answer-group`,
        value: answer.id,
        label: answer.label,
        hint: '',
        checked: false,
        disabled: false,
        visualState: 'idle',
        ...(usesTagIcons ? {} : {
          selectionIcon: { className: classNames.selectionIcon },
          correctionIcon: {
            className: classNames.correctionIcon,
            correctContent: '✓',
            incorrectContent: '×',
            missedCorrectContent: '✓',
          },
        }),
        move: { target: `${ids.eventPrefix}:answers` },
      },
      emit: {
        change: {
          event: { name: `${ids.eventPrefix}:answer:select`, data: { answerId: answer.id } },
        },
      },
      actions: {
        [`${answerEventPrefix}:selected`]: {
          selectedAnswerIds: [answer.id],
          checked: true,
          visualState: 'selected',
        },
        [`${answerEventPrefix}:idle`]: {
          selectedAnswerIds: [],
          checked: false,
          visualState: 'idle',
        },
        [`${answerEventPrefix}:reset`]: {
          selectedAnswerIds: [],
          correctAnswerIds: [],
          checked: false,
          disabled: false,
          disableAnswers: false,
          showCorrection: false,
          visualState: 'idle',
        },
        [`${answerEventPrefix}:revealed-correct`]: {
          selectedAnswerIds: [answer.id],
          correctAnswerIds,
          checked: true,
          disabled: true,
          disableAnswers: true,
          showCorrection: true,
          visualState: 'revealed-correct',
        },
        [`${answerEventPrefix}:revealed-incorrect`]: {
          selectedAnswerIds: [answer.id],
          correctAnswerIds,
          checked: true,
          disabled: true,
          disableAnswers: true,
          showCorrection: true,
          visualState: 'revealed-incorrect',
        },
        [`${answerEventPrefix}:revealed-missed-correct`]: {
          selectedAnswerIds: [],
          correctAnswerIds,
          checked: false,
          disabled: true,
          disableAnswers: true,
          showCorrection: true,
          visualState: 'revealed-missed-correct',
        },
        [`${answerEventPrefix}:locked`]: {
          selectedAnswerIds: [],
          correctAnswerIds,
          checked: false,
          disabled: true,
          disableAnswers: true,
          showCorrection: true,
          visualState: 'disabled',
        },
      },
    }
    if (!usesTagIcons) return [answerInput]
    const storyId = ids.storyId
    if (storyId === undefined) {
      throw new Error('Les icônes de réponse auteur nécessitent le storyId de leur slot input.')
    }
    return [
      answerInput,
      {
        id: `${answerPersoId}__selection-icon`,
        type: 'tag',
        initial: {
          tag: 'span',
          content: '',
          className: classNames.selectionIcon,
          style: {
            display: 'inline-block',
            minWidth: '1ch',
            marginInlineStart: '0.5em',
            textAlign: 'center',
          },
          move: { target: selectionIconPartId(storyId, answerPersoId) },
        },
        actions: {
          [`${answerEventPrefix}:selected`]: { content: '•' },
          [`${answerEventPrefix}:idle`]: { content: '' },
          [`${answerEventPrefix}:reset`]: { content: '' },
        },
      },
      {
        id: `${answerPersoId}__correction-icon`,
        type: 'tag',
        initial: {
          tag: 'span',
          content: '',
          className: classNames.correctionIcon,
          style: {
            display: 'inline-block',
            minWidth: '1ch',
            marginInlineStart: '0.5em',
            textAlign: 'center',
            fontWeight: 700,
          },
          move: { target: correctionIconPartId(storyId, answerPersoId) },
        },
        actions: {
          [`${answerEventPrefix}:revealed-correct`]: {
            content: '✓',
            className: `${classNames.correctionIcon} is-correct`,
          },
          [`${answerEventPrefix}:revealed-incorrect`]: {
            content: '×',
            className: `${classNames.correctionIcon} is-incorrect`,
          },
          [`${answerEventPrefix}:revealed-missed-correct`]: {
            content: '✓',
            className: `${classNames.correctionIcon} is-missed-correct`,
          },
          [`${answerEventPrefix}:reset`]: {
            content: '',
            className: classNames.correctionIcon,
          },
        },
      },
    ]
  })
}

/** Updates one selection and emits the local input actions for every answer. */
export function selectQuizAnswer(
  eventPrefix: string,
  question: QuizQuestionDefinition,
  state: Readonly<Record<string, unknown>>,
  eventData: Record<string, unknown> | undefined,
) {
  const payload = eventData as { answerId?: unknown } | undefined
  if (state.submitted === true || state.solutionsExposed === true || typeof payload?.answerId !== 'string') {
    return undefined
  }
  if (!question.answers.some((answer) => answer.id === payload.answerId)) return undefined

  const selectedBefore = readSelectedQuizAnswers(state.selectedAnswerIds)
  const selectedAnswerIds = question.type === 'multiple'
    ? selectedBefore.includes(payload.answerId)
      ? selectedBefore.filter((answerId) => answerId !== payload.answerId)
      : [...selectedBefore, payload.answerId]
    : [payload.answerId]
  const selected = new Set(selectedAnswerIds)
  return {
    update: { selectedAnswerIds },
    events: [
      { name: selectedAnswerIds.length > 0 ? `${eventPrefix}:selection:available` : `${eventPrefix}:selection:empty` },
      ...question.answers.map((answer) => ({
        name: `${eventPrefix}:answer:${answer.id}:${selected.has(answer.id) ? 'selected' : 'idle'}`,
      })),
    ],
  }
}

/** Resolves the local quiz answer once and rejects empty or repeated submissions. */
export function resolveQuizAnswer(
  question: QuizQuestionDefinition,
  state: Readonly<Record<string, unknown>>,
): Readonly<{ selectedAnswerIds: readonly string[]; isCorrect: boolean }> | undefined {
  const selectedAnswerIds = readSelectedQuizAnswers(state.selectedAnswerIds)
  if (state.submitted === true || state.solutionsExposed === true || selectedAnswerIds.length === 0) return undefined
  return {
    selectedAnswerIds,
    isCorrect: hasSameQuizAnswerSet([...question.correctAnswerIds], selectedAnswerIds),
  }
}

/** Creates the local correction actions for every answer in one question. */
export function createQuizCorrectionEvents(
  question: QuizQuestionDefinition,
  eventPrefix: string,
  selectedAnswerIds: readonly string[],
): Array<{ name: string }> {
  const selected = new Set(selectedAnswerIds)
  const correct = new Set(question.correctAnswerIds)
  return question.answers.map((answer) => {
    const answerEventPrefix = `${eventPrefix}:answer:${answer.id}`
    if (selected.has(answer.id) && correct.has(answer.id)) {
      return { name: `${answerEventPrefix}:revealed-correct` }
    }
    if (selected.has(answer.id)) return { name: `${answerEventPrefix}:revealed-incorrect` }
    if (correct.has(answer.id)) return { name: `${answerEventPrefix}:revealed-missed-correct` }
    return { name: `${answerEventPrefix}:locked` }
  })
}

/** Accepts only string ids from a scene's materialized state. */
export function readSelectedQuizAnswers(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((answerId): answerId is string => typeof answerId === 'string')
    : []
}

/** Compares answer id sets without depending on their authored order. */
function hasSameQuizAnswerSet(expectedIds: string[], actualIds: string[]): boolean {
  if (expectedIds.length !== actualIds.length) return false
  const expected = new Set(expectedIds)
  return actualIds.every((answerId) => expected.has(answerId))
}
