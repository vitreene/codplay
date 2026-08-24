import type { DiagnosticReport } from '../../../diagnostics'
import { DiagnosticCollector } from '../../../diagnostics'
import type { SolvedScene } from '../pipeline'

/** Converts pure move-policy issues into the public diagnostic report. */
export function collectSolvedMoveDiagnostics(
  solved: SolvedScene,
  diagnostics: DiagnosticCollector,
): void {
  for (const issue of solved.moveIssues) {
    diagnostics.warning(issue.code, issue.message, {
      refs: { sceneId: solved.scene.scene.id },
    })
  }
}

/** Builds one detached diagnostic report for a reconstructed scene. */
export function createSolvedMoveDiagnostics(solved: SolvedScene): DiagnosticReport {
  const diagnostics = new DiagnosticCollector({ output: () => undefined })
  collectSolvedMoveDiagnostics(solved, diagnostics)
  return diagnostics.report()
}

/** Creates an empty diagnostic report for a player before its first seek. */
export function createEmptyDiagnosticReport(): DiagnosticReport {
  return { all: [], warnings: [], errors: [] }
}
