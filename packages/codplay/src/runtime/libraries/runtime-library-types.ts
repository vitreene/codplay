/**
 * Loads one engine-scoped third-party library before a scene is initialized.
 *
 * The returned value is opaque to CodPlay. The engine retains it for
 * injection into component classes that declare this library dependency.
 */
export type RuntimeLibraryDefinition = Readonly<{
  id: string
  load: () => Promise<unknown> | unknown
  release?: (runtime: unknown) => void
  origin?: 'core' | 'foreign'
}>
