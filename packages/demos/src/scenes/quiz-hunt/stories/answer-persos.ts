import type { PersoDoc } from "codplay/player/types"
import type { ResolvedQuizQuestion } from "../../quiz-question-scene"

/**
 * Builds the 3 persos (input + selection icon + correction icon) for one quiz answer,
 * mounted into `${prefix}:answers`. Mirrors quiz-series-scene's answer pattern.
 */
export function createQuizAnswerPersos(
  prefix: string,
  question: ResolvedQuizQuestion,
  groupName: string,
  retryEventName?: string
): PersoDoc[] {
  const inputType = question.type === "multiple" ? "checkbox" : "radio"

  return question.answers.flatMap((answer): PersoDoc[] => {
    const answerRootId = `${prefix}__answer-${answer.id}`

    return [
      {
        id: answerRootId,
        type: "input",
        initial: {
          inputType,
          name: groupName,
          value: answer.id,
          label: answer.label,
          hint: "",
          checked: false,
          disabled: false,
          visualState: "idle",
          move: { parentId: `${prefix}:answers` }
        },
        actions: retryEventName === undefined ? {} : { [retryEventName]: { checked: false, disabled: false, visualState: "idle" } },
        emit: {
          change: {
            data: { answerId: answer.id },
            event: { name: "quiz:question:answer:select" }
          }
        }
      },
      {
        id: `${answerRootId}__selection-icon`,
        type: "tag",
        initial: {
          tag: "span",
          className: "quiz-hunt-answer-icon quiz-hunt-answer-icon-selection",
          content: "",
          move: { parentId: `${answerRootId}__selection-icon-slot` }
        },
        actions: {
          [`quiz:question:answer:${answer.id}:selected`]: { content: "•" },
          [`quiz:question:answer:${answer.id}:idle`]: { content: "" },
          ...(retryEventName === undefined ? {} : { [retryEventName]: { content: "" } })
        }
      },
      {
        id: `${answerRootId}__correction-icon`,
        type: "tag",
        initial: {
          tag: "span",
          className: "quiz-hunt-answer-icon quiz-hunt-answer-icon-correction",
          content: "",
          move: { parentId: `${answerRootId}__correction-icon-slot` }
        },
        actions: {
          [`quiz:question:answer:${answer.id}:revealed-correct`]: { content: "+", className: "quiz-hunt-answer-icon quiz-hunt-answer-icon-correction is-correct" },
          [`quiz:question:answer:${answer.id}:revealed-incorrect`]: { content: "-", className: "quiz-hunt-answer-icon quiz-hunt-answer-icon-correction is-incorrect" },
          [`quiz:question:answer:${answer.id}:revealed-missed-correct`]: { content: "+", className: "quiz-hunt-answer-icon quiz-hunt-answer-icon-correction is-missed-correct" },
          ...(retryEventName === undefined ? {} : { [retryEventName]: { content: "", className: "quiz-hunt-answer-icon quiz-hunt-answer-icon-correction" } })
        }
      }
    ]
  })
}

/** Builds the validate button + result text persos shared by trial and final question panels. */
export function createQuizControlPersos(
  prefix: string,
  question: ResolvedQuizQuestion,
  accent: string,
  retryEventName?: string
): PersoDoc[] {
  return [
    {
      id: `${prefix}-validate`,
      type: "tag",
      initial: {
        tag: "button",
        className: "quiz-hunt-validate-button",
        content: question.labels.validate,
        style: { "--quiz-hunt-accent": accent },
        attr: { type: "button", disabled: true },
        move: { parentId: `${prefix}:controls` }
      },
      emit: { click: { event: { name: "quiz:question:validate" } } },
      actions: {
        "quiz:question:selection:available": { attr: { disabled: false } },
        "quiz:question:selection:empty": { attr: { disabled: true } },
        "quiz:question:resolved": { attr: { disabled: true } },
        ...(retryEventName === undefined ? {} : { [retryEventName]: { attr: { disabled: true } } })
      }
    },
    {
      id: `${prefix}-result`,
      type: "tag",
      initial: {
        tag: "span",
        className: "quiz-hunt-question-result",
        content: "",
        attr: { hidden: true },
        move: { parentId: `${prefix}:result` }
      },
      actions: {
        "quiz:question:resolved:correct": {
          content: question.labels.correct,
          attr: { hidden: false },
          className: "quiz-hunt-question-result is-correct"
        },
        "quiz:question:resolved:incorrect": {
          content: question.labels.incorrect,
          attr: { hidden: false },
          className: "quiz-hunt-question-result is-incorrect"
        },
        ...(retryEventName === undefined ? {} : { [retryEventName]: { content: "", className: "quiz-hunt-question-result", attr: { hidden: true } } })
      }
    }
  ]
}
