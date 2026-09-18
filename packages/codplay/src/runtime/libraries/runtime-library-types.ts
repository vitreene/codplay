/**
 * Loads one engine-scoped third-party library before a scene is initialized.
 *
 * The library package keeps the loaded value in its own factory closure. The
 * core only owns the ordering and lifecycle barrier; it never imports or
 * interprets the foreign library.
 */
export type RuntimeLibraryDefinition = Readonly<{
  id: string
  load: () => Promise<void> | void
  release?: () => void
  origin?: 'core' | 'foreign'
}>
