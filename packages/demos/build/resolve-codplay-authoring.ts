import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const AUTHORING_ROOT = resolve(__dirname, '../../authoring')
const AUTHORING_COMPONENTS_ROOT = resolve(__dirname, '../../authoring/components')
const PACKAGES_ROOT = resolve(__dirname, '../..')

/**
 * Resolves one `@codplay/*` import using the same package-family contract as
 * `packages/demos/tsconfig.json`: try `authoring/components/*` first, then
 * fall back to root `authoring/*` packages, then sibling top-level packages
 * (ex. `@codplay/editor` → `packages/editor`).
 */
export function resolveCodplayAuthoringImport(id: string): string | null {
  const match = id.match(/^@codplay\/([^/]+)(?:\/(.+))?$/)
  if (!match) {
    return null
  }

  const [, packageName, rawSubpath] = match
  // The bare-package default already carries its extension (`index.ts`); an explicit deep
  // subpath (ex. `builder/build-scene`) never does — try it as-is, then with `.ts` appended.
  const subpath = rawSubpath ?? 'index.ts'
  const roots = [AUTHORING_COMPONENTS_ROOT, AUTHORING_ROOT, PACKAGES_ROOT]
  const candidates = roots.flatMap((root) => {
    const base = resolve(root, packageName!, 'src', subpath)
    return [base, `${base}.ts`]
  })

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}
