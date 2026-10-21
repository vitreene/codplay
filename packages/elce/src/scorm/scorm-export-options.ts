import { resolveScormExportOptions as resolveSharedScormExportOptions } from '@codplay/sighty-scorm'
import type {
  ResolvedScormExportOptions as SharedResolvedScormExportOptions,
  ScormExportOptionsInput,
} from '@codplay/sighty-scorm'

export type { ScormExportOptionsInput } from '@codplay/sighty-scorm'
export type ResolvedScormExportOptions = Omit<SharedResolvedScormExportOptions, 'language'> & {
  readonly language: 'fr'
}

/** Applies Elcé's current language boundary to shared package options. */
export function resolveScormExportOptions(
  input: ScormExportOptionsInput,
  defaultTitle?: string,
): ResolvedScormExportOptions {
  const resolved = resolveSharedScormExportOptions(input, defaultTitle)
  if (resolved.language !== 'fr') throw new Error('Elcé ne prend en charge que la langue fr pour le moment.')
  return { ...resolved, language: 'fr' }
}
