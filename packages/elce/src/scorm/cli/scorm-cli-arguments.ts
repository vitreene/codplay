import { parseScormCliArguments as parseSharedScormCliArguments } from '@codplay/sighty-scorm'
import type { ScormExportOptionsInput } from '../scorm-export-options'

/** Parses shared SCORM command options for Elcé's export adapter. */
export function parseScormCliArguments(args: readonly string[]): ScormExportOptionsInput {
  return parseSharedScormCliArguments(args)
}
