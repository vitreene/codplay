import { DEFAULT_EVALUATION_THRESHOLD } from '../../config/document-config'
import type { ChapterEvaluationResult } from './chapter-evaluation-types'

/** Calculates an Evaluation chapter's score from its Question page results. */
export class ElceChapterEvaluation {
  /** Counts each Question once; absent and false answers both score zero. */
  public evaluate(
    questionPageIds: readonly string[],
    questionResults: Readonly<Record<string, boolean>>,
    threshold: number = DEFAULT_EVALUATION_THRESHOLD,
  ): ChapterEvaluationResult {
    switch (questionPageIds.length === 0) {
      case true:
        return { questionCount: 0, correctCount: 0, score: null, passed: null }
      case false:
        break
    }

    const correctCount = questionPageIds.filter((pageId) => questionResults[pageId] === true).length
    const score = correctCount / questionPageIds.length
    return {
      questionCount: questionPageIds.length,
      correctCount,
      score,
      passed: score >= threshold,
    }
  }
}
