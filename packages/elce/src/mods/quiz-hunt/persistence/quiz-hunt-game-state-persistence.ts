/** Describes the single resumable game state owned by one Quiz Hunt project. */
export interface QuizHuntSavedGameState {
  readonly seed: number
  readonly state: unknown
  readonly savedAt: number
}

/** Defines the mod-owned read/write boundary for released Quiz Hunt games. */
export interface QuizHuntGameStatePersistence {
  readGameState(projectId: string): Promise<QuizHuntSavedGameState | null>
  saveGameState(projectId: string, value: QuizHuntSavedGameState): Promise<boolean>
  clearGameState(projectId: string): Promise<boolean>
}
