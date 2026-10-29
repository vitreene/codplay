import type { ScormVersion } from '@codplay/sighty-scorm'

/** Builds the stable user-facing filename for a SCORM archive download. */
export function createScormArchiveFilename(
  documentName: string,
  version: ScormVersion,
  monoSco: boolean,
  date: Date = new Date(),
): string {
  const projectName = slugifyProjectName(documentName)
  const scormFormat = 'scorm'
  const monoScoPart = monoSco ? '-monosco' : ''
  const datePart = date.toISOString().slice(0, 10)
  return `${projectName}-${scormFormat}${monoScoPart}-${datePart}(${version}).zip`
}

/** Produces a readable ASCII filename segment from an Elcé project name. */
function slugifyProjectName(value: string): string {
  return value.normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9-]+/gu, '-')
    .replace(/-+/gu, '-')
    .replace(/^-|-$/gu, '')
    || 'elce'
}
