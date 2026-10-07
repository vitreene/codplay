export interface ChapterEvaluationResult {
  readonly questionCount: number
  readonly correctCount: number
  readonly score: number | null
  readonly passed: boolean | null
}
