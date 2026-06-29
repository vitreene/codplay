import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const AUTHORING_ROOT = resolve(__dirname, '../../authoring')
const AUTHORING_COMPONENTS_ROOT = resolve(__dirname, '../../authoring/components')

/**
 * Resolves one `@codplay/*` import using the same package-family contract as
 * `packages/demos/tsconfig.json`: try `authoring/components/*` first, then
 * fall back to root `authoring/*` packages.
 */
export function resolveCodplayAuthoringImport(id: string): string | null {
  const match = id.match(/^@codplay\/([^/]+)(?:\/(.+))?$/)
  if (!match) {
    return null
  }

  const [, packageName, rawSubpath] = match
  const subpath = rawSubpath ?? 'index.ts'
  const candidates = [
    resolve(AUTHORING_COMPONENTS_ROOT, packageName!, 'src', subpath),
    resolve(AUTHORING_ROOT, packageName!, 'src', subpath),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}
