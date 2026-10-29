import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { buildScormManifest } from './scorm-manifest.ts'
import type { ScormManifestSco } from './scorm-manifest.ts'
import type { ResolvedScormExportOptions } from '../scorm-export-options.ts'

/** Supplies the shared inputs needed to wrap an existing Sighty package as SCORM. */
export interface ScormPackageAssemblyInput {
  readonly sightyPackage: Uint8Array
  readonly options: ResolvedScormExportOptions
  readonly title: string
  readonly allSco: readonly ScormManifestSco[]
  readonly additionalFiles: Readonly<Record<string, string | Uint8Array>>
  readonly manifestIdentifier?: string
  readonly organizationIdentifier?: string
}

/** Contains one manifest-rooted SCORM package and its optional ZIP archive. */
export interface ScormPackageArtifact {
  readonly files: Readonly<Record<string, Uint8Array>>
  readonly zip?: Uint8Array
}

const RESOURCE_ROOT = fileURLToPath(new URL('../resources/', import.meta.url))
const SCHEMA_DIRECTORY_BY_VERSION = {
  '1.2': 'scorm12edition',
  '2004v3': 'scorm20043rdedition',
  '2004v4': 'scorm20044thedition',
} as const

/** Adds the SCORM manifest, edition schemas, launcher files, and optional ZIP around a Sighty archive. */
export function assembleScormPackage(input: ScormPackageAssemblyInput): ScormPackageArtifact {
  const files: Record<string, Uint8Array> = {}
  if (input.options.absolutePath.length === 0) {
    for (const [path, contents] of Object.entries(unzipSync(input.sightyPackage))) {
      if (path.endsWith('/')) continue
      addFile(files, path, contents)
    }
    requireSightyPackageFiles(files)
    addFile(
      files,
      'runtime/pipwerks-scorm-api-wrapper.js',
      readFileSync(fileURLToPath(new URL('../runtime/pipwerks-scorm-api-wrapper.js', import.meta.url))),
    )
  }

  const schemaDirectory = join(RESOURCE_ROOT, 'schemas', SCHEMA_DIRECTORY_BY_VERSION[input.options.version])
  for (const [path, contents] of Object.entries(readDirectory(schemaDirectory))) {
    addFile(files, path, contents)
  }

  const manifest = buildScormManifest({
    version: input.options.version,
    title: input.title,
    withSummary: input.options.withSummary,
    monoSco: input.options.monoSco,
    allSco: input.allSco,
    ...(input.manifestIdentifier === undefined ? {} : { manifestIdentifier: input.manifestIdentifier }),
    ...(input.organizationIdentifier === undefined ? {} : { organizationIdentifier: input.organizationIdentifier }),
  })
  addFile(files, 'imsmanifest.xml', strToU8(manifest))
  for (const [path, contents] of Object.entries(input.additionalFiles)) {
    addFile(files, path, typeof contents === 'string' ? strToU8(contents) : contents)
  }

  validateManifestReferences(manifest, files)
  const archive = input.options.zip ? zipSync(files, { level: 6 }) : undefined
  return { files, ...(archive === undefined ? {} : { zip: archive }) }
}

/** Reads every schema file while preserving its relative path beneath the package root. */
function readDirectory(directory: string, root = directory): Record<string, Uint8Array> {
  const files: Record<string, Uint8Array> = {}
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      Object.assign(files, readDirectory(entryPath, root))
      continue
    }
    if (!entry.isFile()) throw new Error(`Fichier de schéma SCORM non pris en charge : ${entryPath}`)
    files[relative(root, entryPath).split(sep).join('/')] = readFileSync(entryPath)
  }
  return files
}

/** Rejects a source archive that does not match the existing Sighty package contract. */
function requireSightyPackageFiles(files: Readonly<Record<string, Uint8Array>>): void {
  for (const path of ['export-manifest.json', 'scenario.mjs', 'loader.mjs']) {
    if (files[path] === undefined) throw new Error(`Le paquet Sighty ne contient pas ${path}.`)
  }
}

/** Adds one safe relative package file without overwriting an existing input. */
function addFile(files: Record<string, Uint8Array>, path: string, contents: Uint8Array): void {
  if (!isSafePackagePath(path)) throw new Error(`Chemin de package SCORM invalide : ${path}`)
  if (files[path] !== undefined) throw new Error(`Le package SCORM contient deux fichiers ${path}.`)
  files[path] = contents
}

/** Checks that one output path remains inside the ZIP root. */
function isSafePackagePath(path: string): boolean {
  return path.length > 0
    && !path.startsWith('/')
    && !path.includes('\\')
    && !path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
    && !/^[a-z][a-z\d+.-]*:/i.test(path)
}

/** Confirms every manifest item resolves to a declared resource and an included launch file. */
function validateManifestReferences(manifest: string, files: Readonly<Record<string, Uint8Array>>): void {
  const resourceIds = new Set([...manifest.matchAll(/<resource\b[^>]*\bidentifier="([^"]+)"/gu)].map((match) => match[1]))
  const itemResourceIds = [...manifest.matchAll(/<item\b[^>]*\bidentifierref="([^"]+)"/gu)].map((match) => match[1])
  for (const resourceId of itemResourceIds) {
    if (!resourceIds.has(resourceId)) throw new Error(`La référence SCORM ${resourceId} ne désigne aucune ressource.`)
  }
  const hrefs = [...manifest.matchAll(/<resource\b[^>]*\bhref="([^"]+)"/gu)].map((match) => match[1])
  for (const href of hrefs) {
    if (href === undefined || files[href] === undefined) throw new Error(`Le lanceur SCORM ${String(href)} est absent du package.`)
  }
}
