import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'
import type { Zippable } from 'fflate'
import { ElceDocument } from '../domain/document/document-model'
import type { ElceDocumentData, MediaId, MediaMetadata } from '../domain/document/document-types'
import { scenarioExportMediaIds } from './scenario-export-media'

const ELCE_PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const EXPORT_WORK_DIRECTORY = resolve(ELCE_PACKAGE_ROOT, '.elce-export')
const SIGHTY_EXPORT_CLI = fileURLToPath(import.meta.resolve('@codplay/sighty/tools/scenario-export/cli.mjs'))
const PLAYER_SCENARIO_MODULE = resolve(ELCE_PACKAGE_ROOT, 'src/player/elce-player-composition.ts')
const DOCUMENT_MODULE = resolve(ELCE_PACKAGE_ROOT, 'src/domain/document/document-model.ts')
const ENGINE_CONFIG_MODULE = resolve(ELCE_PACKAGE_ROOT, 'src/player/elce-player-engine.ts')

/** Converts one current Elcé document and its media bytes into a Sighty package ZIP. */
export async function exportElceSightyPackage(
  documentData: ElceDocumentData,
  mediaBytesById: ReadonlyMap<MediaId, Uint8Array>,
): Promise<Uint8Array> {
  const workingDirectory = process.env.INIT_CWD ?? process.cwd()
  const document = ElceDocument.fromJSON(documentData)
  const mediaPathsById = new Map<MediaId, Readonly<{ media: MediaMetadata; relativePath: string }>>()
  for (const [index, media] of document.medias.entries()) {
    mediaPathsById.set(media.id, { media, relativePath: `./media/${mediaFileName(index, media)}` })
  }
  for (const mediaId of mediaBytesById.keys()) {
    if (!mediaPathsById.has(mediaId)) throw new Error(`Le média ${mediaId} ne figure pas dans le document Elcé.`)
  }

  const scenarioMediaSources = Object.fromEntries([...mediaPathsById].map(([mediaId, source]) => [mediaId, source.relativePath]))
  const requiredMediaIds = scenarioExportMediaIds(document, scenarioMediaSources)
  const mediaSources = new Map<MediaId, Readonly<{ media: MediaMetadata; bytes: Uint8Array; relativePath: string }>>()
  for (const mediaId of requiredMediaIds) {
    const source = mediaPathsById.get(mediaId)
    if (source === undefined) throw new Error(`Le média ${mediaId} utilisé par le scénario est absent du document Elcé.`)
    const { media, relativePath } = source
    const bytes = mediaBytesById.get(media.id)
    if (bytes === undefined) throw new Error(`Le média « ${media.name} » est absent de l’export.`)
    if (bytes.byteLength !== media.size) throw new Error(`La taille du média « ${media.name} » ne correspond pas au document.`)
    mediaSources.set(media.id, { media, bytes, relativePath })
  }

  await mkdir(EXPORT_WORK_DIRECTORY, { recursive: true })
  const temporaryDirectory = await mkdtemp(join(EXPORT_WORK_DIRECTORY, 'package-'))
  try {
    const mediaDirectory = join(temporaryDirectory, 'media')
    await mkdir(mediaDirectory)
    for (const { bytes, relativePath } of mediaSources.values()) {
      await writeFile(join(temporaryDirectory, relativePath.slice('./'.length)), bytes)
    }

    const scenarioFile = join(temporaryDirectory, 'scenario.ts')
    const packagedMediaSources = Object.fromEntries([...mediaSources].map(([mediaId, source]) => [mediaId, source.relativePath]))
    await writeFile(scenarioFile, createScenarioModule(temporaryDirectory, document.toJSON(), packagedMediaSources))

    const packageDirectory = join(temporaryDirectory, 'scenario-package')
    await runSightyExporter(scenarioFile, packageDirectory, workingDirectory)
    await normalizeTemporaryScenarioPath(packageDirectory, scenarioFile, workingDirectory)
    return await zipSightyPackage(packageDirectory)
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

/** Removes the unique temporary source directory from the bundled scenario's source labels. */
async function normalizeTemporaryScenarioPath(
  packageDirectory: string,
  scenarioFile: string,
  workingDirectory: string,
): Promise<void> {
  const scenarioModule = join(packageDirectory, 'scenario.mjs')
  const sourceLabel = relative(workingDirectory, scenarioFile).split(sep).join('/')
  const bundledScenario = await readFile(scenarioModule, 'utf8')
  await writeFile(scenarioModule, bundledScenario.split(sourceLabel).join('elce-export-source.ts'))
}

/** Creates the temporary module consumed by the existing Sighty CLI. */
function createScenarioModule(
  temporaryDirectory: string,
  documentData: ElceDocumentData,
  mediaSources: Readonly<Record<string, string>>,
): string {
  return [
    `import { ElceDocument } from ${JSON.stringify(relativeModulePath(temporaryDirectory, DOCUMENT_MODULE))};`,
    `import { createElcePlayerScenario } from ${JSON.stringify(relativeModulePath(temporaryDirectory, PLAYER_SCENARIO_MODULE))};`,
    `const documentData = JSON.parse(${JSON.stringify(JSON.stringify(documentData))});`,
    `const mediaSources = JSON.parse(${JSON.stringify(JSON.stringify(mediaSources))});`,
    'export const scenario = createElcePlayerScenario({ document: ElceDocument.fromJSON(documentData), mediaSources });',
    '',
  ].join('\n')
}

/** Resolves one source module from the temporary scenario entry without assuming its location. */
function relativeModulePath(fromDirectory: string, moduleFile: string): string {
  const modulePath = relative(fromDirectory, moduleFile).split(sep).join('/')
  return modulePath.startsWith('.') ? modulePath : `./${modulePath}`
}

/** Runs Sighty's exported CLI entry with Elcé's engine capabilities. */
function runSightyExporter(
  scenarioFile: string,
  packageDirectory: string,
  workingDirectory: string,
): Promise<void> {
  return new Promise((resolveProcess, rejectProcess) => {
    const child = spawn(process.execPath, [
      SIGHTY_EXPORT_CLI,
      '--scenario', scenarioFile,
      '--engine-config', ENGINE_CONFIG_MODULE,
      '--standalone',
      '--export', packageDirectory,
    ], { cwd: workingDirectory, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    const collectOutput = (chunk: string | Buffer): void => {
      output = `${output}${chunk.toString()}`.slice(-16_000)
    }
    child.stdout.setEncoding('utf8').on('data', collectOutput)
    child.stderr.setEncoding('utf8').on('data', collectOutput)
    child.once('error', rejectProcess)
    child.once('close', (code, signal) => {
      if (code === 0) {
        resolveProcess()
        return
      }
      rejectProcess(new Error(output.trim() || `L’export Sighty s’est arrêté (${signal ?? code}).`))
    })
  })
}

/** Creates a ZIP whose paths match the Sighty package directory exactly. */
async function zipSightyPackage(packageDirectory: string): Promise<Uint8Array> {
  const entries: Zippable = Object.create(null) as Zippable
  await addDirectoryEntries(packageDirectory, packageDirectory, entries)
  if (Object.keys(entries).length === 0) throw new Error('L’export Sighty n’a produit aucun fichier.')
  return zipSync(entries, { level: 6 })
}

/** Adds files below one package root to the ZIP without adding a wrapper directory. */
async function addDirectoryEntries(rootDirectory: string, currentDirectory: string, entries: Zippable): Promise<void> {
  const children = await readdir(currentDirectory, { withFileTypes: true })
  for (const child of children) {
    const childPath = join(currentDirectory, child.name)
    if (child.isDirectory()) {
      await addDirectoryEntries(rootDirectory, childPath, entries)
      continue
    }
    if (!child.isFile()) throw new Error(`Entrée Sighty non prise en charge : ${childPath}`)
    const entryPath = relative(rootDirectory, childPath).split(sep).join('/')
    const data = new Uint8Array(await readFile(childPath))
    entries[entryPath] = entryPath.includes('/scene/assets/') ? [data, { level: 0 }] : data
  }
}

/** Makes a stable, path-safe source filename while preserving its media extension. */
function mediaFileName(index: number, media: MediaMetadata): string {
  const extension = extname(media.name).toLowerCase().replace(/[^a-z0-9.]/g, '')
  const safeExtension = /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : ''
  return `media-${index}${safeExtension}`
}
