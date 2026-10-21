import type { ScormVersion } from './scorm-types'

/** Contains the SCORM package options shared by project export adapters. */
export interface ScormExportOptionsInput {
  readonly version?: string
  readonly title?: string
  readonly needSummary?: boolean
  readonly withSummary?: boolean
  readonly monoSco?: boolean
  readonly masteryScore?: number
  readonly client?: string
  readonly language?: string
  readonly packageName?: string
  readonly absolutePath?: string
  readonly zip?: boolean
}

/** Holds normalized export choices while preserving the reference CLI branches. */
export interface ResolvedScormExportOptions {
  readonly version: ScormVersion
  readonly sourceVersion: string
  readonly title?: string
  readonly needSummary: boolean
  readonly withSummary: boolean
  readonly monoSco: boolean
  readonly onePackagePerSco: boolean
  readonly masteryScore: number
  readonly client: string
  readonly language: string
  readonly packageName?: string
  readonly absolutePath: string
  readonly zip: boolean
}

/** Normalizes source CLI values into options for SCORM package generation. */
export function resolveScormExportOptions(
  input: ScormExportOptionsInput,
  defaultTitle?: string,
): ResolvedScormExportOptions {
  const sourceVersion = input.version ?? '2004v4'
  const version = normalizeScormVersion(sourceVersion)
  const needSummary = input.needSummary ?? false
  const withSummary = input.withSummary === true || needSummary
  let monoSco = input.monoSco === true || withSummary && version === '1.2'
  let onePackagePerSco = false
  if (monoSco && !withSummary && !needSummary) {
    monoSco = false
    onePackagePerSco = true
  }

  const title = input.title || defaultTitle
  const client = input.client || 'standard'
  const language = input.language || 'fr'
  const packageName = input.packageName || (title === undefined
    ? undefined
    : `${client}_${slugify(title)}${language ? `_${language}` : ''}_scorm${cleanAndTrim(sourceVersion)}`)

  return {
    version,
    sourceVersion,
    ...(title === undefined ? {} : { title }),
    needSummary,
    withSummary,
    monoSco,
    onePackagePerSco,
    masteryScore: input.masteryScore || 80,
    client,
    language,
    ...(packageName === undefined ? {} : { packageName }),
    absolutePath: input.absolutePath === undefined || input.absolutePath.length === 0
      ? ''
      : ensureTrailingSlash(input.absolutePath),
    zip: input.zip ?? true,
  }
}

/** Maps all version names accepted by the reference CLI to its edition. */
function normalizeScormVersion(value: string): ScormVersion {
  switch (value) {
    case '1.2':
      return '1.2'
    case '2004v3':
    case '2004.3':
    case '2004 3rd Edition':
      return '2004v3'
    case '2004v4':
    case '2004.4':
    case '2004 4th Edition':
      return '2004v4'
    default:
      throw new Error(`Version SCORM non prise en charge : ${value}`)
  }
}

/** Reproduces the reference package slug normalization for a title. */
function slugify(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s/g, '').toLowerCase()
}

/** Reproduces the reference removal of non-alphanumeric version characters. */
function cleanAndTrim(value: string): string {
  return value.replace(/[^a-zA-Z\d\s]/g, '').replace(/\s/g, '')
}

/** Adds the trailing slash required by remote SCO launch paths. */
function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`
}
