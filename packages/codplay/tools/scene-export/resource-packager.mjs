import { createHash } from 'node:crypto'
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'

/** Copies compiler-declared local media and rewrites only their traced compiled occurrences. */
export async function packageResources({ sourceFile, compiledScene, resourceReferences, stageDirectory }) {
  const referencesByUrl = groupReferences(resourceReferences)
  const resources = []
  const assetPaths = new Map()
  const packagedUrlBySource = new Map()
  const assetDirectory = path.join(stageDirectory, 'scene', 'assets')
  await mkdir(assetDirectory, { recursive: true })

  for (const entry of compiledScene.resources.entries) {
    const occurrences = referencesByUrl.get(entry.url)
    if (occurrences === undefined || occurrences.length === 0) {
      throw new Error(`Compiler did not provide occurrence paths for resource: ${entry.url}`)
    }
    if (occurrences.some((reference) => reference.type !== entry.type)) {
      throw new Error(`Compiler resource type differs from its occurrence: ${entry.url}`)
    }

    const { sourcePath, suffix } = await resolveLocalResource(sourceFile, entry.url)
    const sourceBytes = await readFile(sourcePath)
    const extension = path.extname(sourcePath).toLowerCase()
    const assetKey = sourcePath
    let assetName = assetPaths.get(assetKey)
    if (assetName === undefined) {
      const sourceDigest = createHash('sha256').update(sourcePath).digest('hex')
      assetName = `${sourceDigest.slice(0, 20)}${extension}`
      await writeFile(path.join(assetDirectory, assetName), sourceBytes, { flag: 'wx' })
      assetPaths.set(assetKey, assetName)
    }

    const sceneUrl = `assets/${assetName}${suffix}`
    packagedUrlBySource.set(entry.url, sceneUrl)
    const resource = {
      sourceUrl: entry.url,
      sceneUrl,
      file: `scene/assets/${assetName}`,
      suffix,
      type: entry.type,
      occurrences: occurrences.map((reference) => reference.cssValue === undefined
        ? reference.path
        : { path: reference.path, cssUrl: `url(${JSON.stringify(sceneUrl)})` }),
    }
    resources.push(resource)
  }

  if (referencesByUrl.size !== compiledScene.resources.entries.length) {
    throw new Error('Compiler occurrence metadata does not match the compiled resource manifest.')
  }

  const packagedScene = JSON.parse(JSON.stringify(compiledScene))
  for (const resource of resources) {
    const sourceReferences = referencesByUrl.get(resource.sourceUrl) ?? []
    for (const reference of sourceReferences) {
      if (reference.cssValue === undefined) {
        writeOccurrence(packagedScene, reference.path, resource.sourceUrl, resource.sceneUrl)
      } else {
        writeCssValueOccurrence(packagedScene, reference.path, reference.cssValue, `url(${JSON.stringify(resource.sceneUrl)})`)
      }
    }
  }
  const packagedResourceEntries = new Map()
  for (const entry of packagedScene.resources.entries) {
    const sceneUrl = packagedUrlBySource.get(entry.url)
    if (sceneUrl === undefined) throw new Error(`Packaged resource is missing: ${entry.url}`)
    const existing = packagedResourceEntries.get(sceneUrl)
    if (existing !== undefined && existing.type !== entry.type) {
      throw new Error(`Packaged resource URL has conflicting media types: ${sceneUrl}`)
    }
    if (existing === undefined) packagedResourceEntries.set(sceneUrl, { ...entry, url: sceneUrl })
  }
  packagedScene.resources.entries = [...packagedResourceEntries.values()]
  packagedScene.requirements.resources = packagedScene.resources.entries.map((entry) => entry.url)

  const manifestResourcesByUrl = new Map()
  for (const { sourceUrl: _sourceUrl, ...resource } of resources) {
    const existing = manifestResourcesByUrl.get(resource.sceneUrl)
    if (existing === undefined) {
      manifestResourcesByUrl.set(resource.sceneUrl, { ...resource, occurrences: [...resource.occurrences] })
      continue
    }
    if (existing.file !== resource.file || existing.type !== resource.type || existing.suffix !== resource.suffix) {
      throw new Error(`Packaged resource URL maps to conflicting sources: ${resource.sceneUrl}`)
    }
    const occurrenceKeys = new Set(existing.occurrences.map((occurrence) => JSON.stringify(occurrence)))
    for (const occurrence of resource.occurrences) {
      const key = JSON.stringify(occurrence)
      if (occurrenceKeys.has(key)) continue
      existing.occurrences.push(occurrence)
      occurrenceKeys.add(key)
    }
  }

  return {
    compiledScene: packagedScene,
    resources: [...manifestResourcesByUrl.values()],
  }
}

/** Resolves one local media URL relative to the scene file and preserves query/fragment suffixes. */
export async function resolveLocalResource(sourceFile, sourceUrl) {
  const suffixIndex = [sourceUrl.indexOf('?'), sourceUrl.indexOf('#')]
    .filter((index) => index >= 0)
    .reduce((left, right) => Math.min(left, right), Number.POSITIVE_INFINITY)
  const encodedPath = Number.isFinite(suffixIndex) ? sourceUrl.slice(0, suffixIndex) : sourceUrl
  const suffix = Number.isFinite(suffixIndex) ? sourceUrl.slice(suffixIndex) : ''
  const sceneRootRelativePath = encodedPath.startsWith('/') && !encodedPath.startsWith('//')
  if (encodedPath.length === 0
    || encodedPath.startsWith('//')
    || /^[a-z][a-z\d+.-]*:/i.test(encodedPath)
    || (path.win32.isAbsolute(encodedPath) && !sceneRootRelativePath)) {
    throw new Error(`Only local media paths are supported in this export step: ${sourceUrl}`)
  }

  let decodedPath
  try {
    decodedPath = decodeURIComponent(encodedPath)
  } catch {
    throw new Error(`Media path contains invalid URL encoding: ${sourceUrl}`)
  }
  const sourceDirectory = path.dirname(path.resolve(sourceFile))
  const relativePath = decodedPath.startsWith('/') ? decodedPath.slice(1) : decodedPath
  const sourcePath = path.resolve(sourceDirectory, relativePath)
  const info = await stat(sourcePath).catch(() => undefined)
  if (info === undefined || !info.isFile()) {
    throw new Error(`Media file referenced by the scene is not a file: ${sourceUrl}`)
  }
  return { sourcePath: await realpath(sourcePath), suffix }
}

/** Groups compiler references by their source URL while preserving occurrence order. */
function groupReferences(references) {
  const grouped = new Map()
  for (const reference of references ?? []) {
    if (typeof reference.url !== 'string'
      || !Array.isArray(reference.path)
      || reference.path.length === 0) {
      throw new Error('Compiler returned an invalid media occurrence reference.')
    }
    const entries = grouped.get(reference.url) ?? []
    entries.push(reference)
    grouped.set(reference.url, entries)
  }
  return grouped
}

/** Rewrites one exact compiler-provided path, refusing to alter a changed or ambiguous value. */
function writeOccurrence(root, segments, expectedValue, replacement) {
  let parent = root
  for (const segment of segments.slice(0, -1)) {
    if (typeof segment === 'number') {
      if (!Array.isArray(parent) || segment < 0 || segment >= parent.length) {
        throw new Error(`Compiler media occurrence path is invalid: ${segments.join('.')}`)
      }
      parent = parent[segment]
      continue
    }
    if (!isRecord(parent) || !(segment in parent)) {
      throw new Error(`Compiler media occurrence path is invalid: ${segments.join('.')}`)
    }
    parent = parent[segment]
  }

  const finalSegment = segments.at(-1)
  if (typeof finalSegment === 'number') {
    if (!Array.isArray(parent) || parent[finalSegment] !== expectedValue) {
      throw new Error(`Compiler media occurrence does not match its source URL: ${segments.join('.')}`)
    }
    parent[finalSegment] = replacement
    return
  }
  if (!isRecord(parent) || parent[finalSegment] !== expectedValue) {
    throw new Error(`Compiler media occurrence does not match its source URL: ${segments.join('.')}`)
  }
  parent[finalSegment] = replacement
}

/** Replaces only one compiler-reported inline CSS url(...) token in a compiled style value. */
function writeCssValueOccurrence(root, segments, expectedToken, replacementToken) {
  const value = readOccurrence(root, segments)
  if (typeof value !== 'string' || !value.includes(expectedToken)) {
    throw new Error(`Compiler CSS occurrence does not match its source token: ${segments.join('.')}`)
  }
  writeValueAtPath(root, segments, value.replaceAll(expectedToken, replacementToken))
}

/** Reads one value at a compiler-provided payload path without searching the scene. */
function readOccurrence(root, segments) {
  let value = root
  for (const segment of segments) {
    if (typeof segment === 'number') {
      if (!Array.isArray(value) || segment < 0 || segment >= value.length) return undefined
      value = value[segment]
      continue
    }
    if (!isRecord(value) || !(segment in value)) return undefined
    value = value[segment]
  }
  return value
}

/** Writes one complete value at a compiler-provided payload path. */
function writeValueAtPath(root, segments, replacement) {
  const parent = readOccurrence(root, segments.slice(0, -1))
  const finalSegment = segments.at(-1)
  if (typeof finalSegment === 'number') {
    if (!Array.isArray(parent) || finalSegment >= parent.length) throw new Error(`Compiler CSS occurrence path is invalid: ${segments.join('.')}`)
    parent[finalSegment] = replacement
    return
  }
  if (typeof finalSegment !== 'string' || !isRecord(parent) || !(finalSegment in parent)) {
    throw new Error(`Compiler CSS occurrence path is invalid: ${segments.join('.')}`)
  }
  parent[finalSegment] = replacement
}

/** Checks whether one value is a plain record before following a compiler path. */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
