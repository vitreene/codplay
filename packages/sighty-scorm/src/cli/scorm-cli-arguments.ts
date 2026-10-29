import type { ScormExportOptionsInput } from '../scorm-export-options'

export type ScormCliArguments = ScormExportOptionsInput

const BOOLEAN_OPTIONS = new Map<string, keyof Pick<ScormExportOptionsInput, 'needSummary' | 'withSummary' | 'monoSco' | 'zip'>>([
  ['--needShellSummary', 'needSummary'],
  ['--withShellSummary', 'withSummary'],
  ['--monoSco', 'monoSco'],
  ['--zip', 'zip'],
])

const VALUE_OPTIONS = new Map<string, keyof Pick<
  ScormExportOptionsInput,
  'version' | 'title' | 'masteryScore' | 'client' | 'language' | 'packageName' | 'absolutePath'
>>([
  ['--version', 'version'],
  ['--title', 'title'],
  ['--masteryScore', 'masteryScore'],
  ['--client', 'client'],
  ['--language', 'language'],
  ['--packageName', 'packageName'],
  ['--absolutePath', 'absolutePath'],
])

/** Parses the reference-compatible options accepted by the shared package command. */
export function parseScormCliArguments(args: readonly string[]): ScormExportOptionsInput {
  const result: {
    version?: string
    title?: string
    needSummary?: boolean
    withSummary?: boolean
    monoSco?: boolean
    masteryScore?: number
    client?: string
    language?: string
    packageName?: string
    absolutePath?: string
    zip?: boolean
  } = {}

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === undefined || !argument.startsWith('--')) throw new Error(`Option SCORM invalide : ${String(argument)}`)
    const separator = argument.indexOf('=')
    const name = separator === -1 ? argument : argument.slice(0, separator)
    const inlineValue = separator === -1 ? undefined : argument.slice(separator + 1)
    const booleanKey = BOOLEAN_OPTIONS.get(name)
    if (booleanKey !== undefined) {
      let rawValue = inlineValue
      const nextArgument = args[index + 1]
      if (rawValue === undefined && nextArgument !== undefined && !nextArgument.startsWith('--')) {
        rawValue = args[++index]
      }
      result[booleanKey] = parseBooleanValue(name, rawValue)
      continue
    }
    const valueKey = VALUE_OPTIONS.get(name)
    if (valueKey === undefined) throw new Error(`Option SCORM inconnue : ${name}`)
    const rawValue = inlineValue ?? args[index + 1]
    if (rawValue === undefined || rawValue.startsWith('--')) throw new Error(`${name} attend une valeur.`)
    if (inlineValue === undefined) index += 1
    if (valueKey === 'masteryScore') {
      const numericValue = Number(rawValue)
      if (!Number.isFinite(numericValue)) throw new Error(`${name} attend un nombre.`)
      result.masteryScore = numericValue
    } else {
      result[valueKey] = rawValue
    }
  }
  return result
}

/** Reads an optional boolean literal while preserving bare-flag behavior. */
function parseBooleanValue(name: string, value: string | undefined): boolean {
  if (value === undefined) return true
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`${name} accepte true ou false.`)
}
