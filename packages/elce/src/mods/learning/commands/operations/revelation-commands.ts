import { CAROUSEL_TRANSITION_OPTIONS } from '../../../../resources/revelation/revelation-config'
import type { RevelationTransitionRef } from '../../../../resources/revelation/revelation-types'
import { LearningDocument } from '../../document/learning-document'
import { fail } from './command-helpers'

/** Updates the project fallback transitions used by Cards without a parent override. */
export function updateDocumentRevelation(
  document: LearningDocument,
  revelationDefaults: LearningDocument['data']['revelationDefaults'],
): LearningDocument {
  assertTransitionReference(revelationDefaults.intro)
  assertTransitionReference(revelationDefaults.outro)
  return new LearningDocument({ ...document.data, revelationDefaults })
}

/** Confirms a configured Capsule Automation transition reference. */
function assertTransitionReference(reference: RevelationTransitionRef): void {
  switch (CAROUSEL_TRANSITION_OPTIONS.some((option) => option.value === reference)) {
    case true:
      return
    case false:
      fail(`Référence de transition inconnue : ${reference}`)
  }
}

/** Accepts an inherited transition or validates an explicit override. */
export function assertTransitionOverride(reference: RevelationTransitionRef | null): void {
  switch (reference) {
    case null:
      return
    default:
      assertTransitionReference(reference)
  }
}
