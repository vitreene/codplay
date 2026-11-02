import type { SightySceneSourceValue } from '@codplay/sighty'

/** Caches compiled page resources independently from any reader consultation state. */
export type PageSceneCache = Map<string, Readonly<{
  signature: string
  source: SightySceneSourceValue
  styleSheets: readonly string[]
}>>
