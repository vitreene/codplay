import type { PersoDoc } from "codplay-v1/player/types"
import { resolveQuizHuntColorStyle } from "../color-palette"
import type { QuizHuntWord } from "../types"

const POLYGON_SHAPE_BY_COLOR: Record<string, { sides: number; inner?: number; outer: number; rotationDeg?: number }> = {
  rouge: { sides: 5, inner: 18, outer: 42, rotationDeg: -18 },
  bleu: { sides: 12, inner: 34, outer: 42, rotationDeg: -15 },
  vert: { sides: 5, outer: 42, rotationDeg: -18 },
  jaune: { sides: 8, outer: 42, rotationDeg: 22.5 }
}

/** Resolves the display color for one quiz-hunt word. */
export function resolveQuizHuntQuestionColor(word: QuizHuntWord): string {
  return resolveQuizHuntColorStyle(word.color).solid
}

/** Builds one polygon badge carrying the question number. */
export function createQuizHuntQuestionBadge(input: {
  id: string
  parentId: string
  word: QuizHuntWord
  number: number
  content?: string
}): PersoDoc {
  const shape = POLYGON_SHAPE_BY_COLOR[input.word.color] ?? { sides: 6, outer: 40 }

  return {
    id: input.id,
    type: "polygon",
    initial: {
      move: { parentId: input.parentId },
      content: input.content ?? String(input.number),
      ...shape,
      style: {
        width: "5rem",
        minWidth: "5rem",
        height: "5rem",
        minHeight: "5rem",
        color: resolveQuizHuntQuestionColor(input.word),
        "--polygon-label-color": "#ffffff",
        fontSize: "1.55rem",
        fontWeight: "900",
        filter: "drop-shadow(0 0.18rem 0.4rem rgba(15, 23, 42, 0.28))"
      }
    },
    actions: {}
  } as unknown as PersoDoc
}
