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
        } as unknown as PersoDoc["initial"],
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
          content: "",
          style: { display: "inline-block", minWidth: "1ch", marginInlineStart: "8px", textAlign: "center" },
          move: { parentId: `${answerRootId}__selection-icon-slot` }
        } as unknown as PersoDoc["initial"],
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
          content: "",
          style: { display: "inline-block", minWidth: "1ch", marginInlineStart: "8px", textAlign: "center", fontWeight: 700 },
          move: { parentId: `${answerRootId}__correction-icon-slot` }
        } as unknown as PersoDoc["initial"],
        actions: {
          [`quiz:question:answer:${answer.id}:revealed-correct`]: { content: "+", style: { color: "#16a34a" } },
          [`quiz:question:answer:${answer.id}:revealed-incorrect`]: { content: "-", style: { color: "#dc2626" } },
          [`quiz:question:answer:${answer.id}:revealed-missed-correct`]: { content: "+", style: { color: "#16a34a" } },
          ...(retryEventName === undefined ? {} : { [retryEventName]: { content: "" } })
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
        content: question.labels.validate,
        style: {
          marginTop: "12px",
          alignSelf: "flex-start",
          backgroundColor: accent,
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          padding: "8px 16px",
          cursor: "pointer",
          fontWeight: 600
        },
        attr: { type: "button", disabled: true },
        move: { parentId: `${prefix}:controls` }
      } as unknown as PersoDoc["initial"],
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
        content: "",
        style: { fontWeight: 600 },
        attr: { hidden: true },
        move: { parentId: `${prefix}:result` }
      } as unknown as PersoDoc["initial"],
      actions: {
        "quiz:question:resolved:correct": {
          content: question.labels.correct,
          attr: { hidden: false },
          style: { color: "#16a34a" }
        },
        "quiz:question:resolved:incorrect": {
          content: question.labels.incorrect,
          attr: { hidden: false },
          style: { color: "#dc2626" }
        },
        ...(retryEventName === undefined ? {} : { [retryEventName]: { content: "", attr: { hidden: true } } })
      }
    }
  ]
}
