import { CAROUSEL_TRANSITION_OPTIONS } from '../../../config/document-config'
import type { RevelationTransitionRef } from '../../../config/document-config-types'
import { ElceDocument } from '../../../domain/document/document-model'
import { fail } from './command-helpers'

/** Updates the project fallback transitions used by Cards without a parent override. */
export function updateDocumentRevelation(
  document: ElceDocument,
  revelationDefaults: ElceDocument['data']['revelationDefaults'],
): ElceDocument {
  assertTransitionReference(revelationDefaults.intro)
  assertTransitionReference(revelationDefaults.outro)
  return new ElceDocument({ ...document.data, revelationDefaults })
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
