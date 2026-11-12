import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'
import type { Zippable } from 'fflate'
import type { MediaId } from '../../../../core/document/content-document-types'
import type { QuizHuntDocument } from '../../document/quiz-hunt-document-types'
import { readQuizHuntDocument } from '../quiz-hunt-document-codec'
import { quizHuntScenarioExportMediaIds } from '../quiz-hunt-scenario-export-media'
import { createQuizHuntScenarioModel } from '../../reading/quiz-hunt-scenario-builder'

const ELCE_PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../')
const EXPORT_WORK_DIRECTORY = resolve(ELCE_PACKAGE_ROOT, '.elce-export')
const SIGHTY_EXPORT_CLI = fileURLToPath(import.meta.resolve('@codplay/sighty/tools/scenario-export/cli.mjs'))
const SCENARIO_BUILDER_MODULE = resolve(ELCE_PACKAGE_ROOT, 'src/mods/quiz-hunt/reading/quiz-hunt-scenario-builder.ts')
const DOCUMENT_CODEC_MODULE = resolve(ELCE_PACKAGE_ROOT, 'src/mods/quiz-hunt/persistence/quiz-hunt-document-codec.ts')
const ENGINE_CONFIG_MODULE = resolve(ELCE_PACKAGE_ROOT, 'src/player/elce-player-engine.ts')

/** Converts one Quiz Hunt document and its referenced media into a standalone Sighty ZIP. */
export async function exportQuizHuntSightyPackage(
  documentData: unknown,
  mediaBytesById: ReadonlyMap<MediaId, Uint8Array>,
): Promise<Uint8Array> {
  const document = readQuizHuntDocument(documentData)
  const scenarioMediaSources = Object.fromEntries(document.medias.map((media, index) => [
    media.id,
    `./media/${mediaFileName(index, media.name)}`,
  ]))
  const requiredMediaIds = quizHuntScenarioExportMediaIds(document, scenarioMediaSources)
  const mediaById = new Map(document.medias.map((media) => [media.id, media]))
  for (const mediaId of mediaBytesById.keys()) {
    if (!mediaById.has(mediaId)) throw new Error(`Le média ${mediaId} ne figure pas dans le document Quiz Hunt.`)
  }

  const mediaSources = new Map<MediaId, Readonly<{ relativePath: string; bytes: Uint8Array }>>()
  for (const mediaId of requiredMediaIds) {
    const media = mediaById.get(mediaId)
    if (media === undefined) throw new Error(`Le média ${mediaId} utilisé par le scénario est absent du document Quiz Hunt.`)
    const bytes = mediaBytesById.get(mediaId)
    if (bytes === undefined) throw new Error(`Le média « ${media.name} » est absent de l’export Quiz Hunt.`)
    if (bytes.byteLength !== media.size) throw new Error(`La taille du média « ${media.name} » ne correspond pas au document.`)
    mediaSources.set(mediaId, { relativePath: scenarioMediaSources[mediaId]!, bytes })
  }

  await mkdir(EXPORT_WORK_DIRECTORY, { recursive: true })
  const temporaryDirectory = await mkdtemp(join(EXPORT_WORK_DIRECTORY, 'quiz-hunt-package-'))
  try {
    await mkdir(join(temporaryDirectory, 'media'))
    for (const { relativePath, bytes } of mediaSources.values()) {
      await writeFile(join(temporaryDirectory, relativePath.slice('./'.length)), bytes)
    }
    await writeScenarioModules(temporaryDirectory, document, scenarioMediaSources)

    const scenarioFile = join(temporaryDirectory, 'scenario.ts')
    const packageDirectory = join(temporaryDirectory, 'scenario-package')
    await runSightyExporter(scenarioFile, packageDirectory, process.env.INIT_CWD ?? process.cwd())
    await normalizeTemporaryScenarioPath(packageDirectory, scenarioFile, process.env.INIT_CWD ?? process.cwd())
    const runtimeMediaSources = Object.fromEntries([...mediaSources].map(([mediaId, source]) => [
      mediaId,
      source.relativePath,
    ]))
    const runtimeData = {
      schemaVersion: 1,
      documentData: { version: 1, document },
      mediaSources: runtimeMediaSources,
    }
    const runtimeFiles = Object.fromEntries([...mediaSources.values()].map((source) => [
      source.relativePath.slice('./'.length),
      source.bytes,
    ]))
    return await zipSightyPackage(packageDirectory, {
      ...runtimeFiles,
      'quiz-hunt-runtime.json': new TextEncoder().encode(JSON.stringify(runtimeData)),
    })
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

/** Writes a singleton model and identity groups for the compact Sighty CLI. */
async function writeScenarioModules(
  temporaryDirectory: string,
  document: QuizHuntDocument,
  mediaSources: Readonly<Record<MediaId, string>>,
): Promise<void> {
  const model = createQuizHuntScenarioModel(document, mediaSources, 'release')
  const scenarioCallbackValues = {
    views: model.scenario.views,
    actions: model.scenario.actions,
    guards: model.scenario.guards,
    sceneResetCallbacks: Object.values(model.scenario.scenes ?? {}).flatMap((source) =>
      typeof source === 'object' && source !== null && 'onReset' in source ? [source.onReset] : [],
    ),
  }
  const scenarioCallbackCount = collectFunctionValues(scenarioCallbackValues).length
  const sceneCallbackCount = collectFunctionValues(model.scenario.scenes).length
  const dataModule = join(temporaryDirectory, 'scenario-data.ts')
  const modelModule = join(temporaryDirectory, 'scenario-model.ts')
  const scenarioFunctionsModule = join(temporaryDirectory, 'scenario-functions.ts')
  const sceneFunctionsModule = join(temporaryDirectory, 'scene-functions.ts')
  const documentData = JSON.stringify({ version: 1, document })
  const mediaSourcesData = JSON.stringify(mediaSources)

  await writeFile(dataModule, [
    `export const documentData = JSON.parse(${JSON.stringify(documentData)});`,
    `export const mediaSources = JSON.parse(${JSON.stringify(mediaSourcesData)});`,
    '',
  ].join('\n'))
  await writeFile(modelModule, [
    `import { readQuizHuntDocument } from ${JSON.stringify(relativeModulePath(temporaryDirectory, DOCUMENT_CODEC_MODULE))};`,
    `import { createQuizHuntScenarioModel } from ${JSON.stringify(relativeModulePath(temporaryDirectory, SCENARIO_BUILDER_MODULE))};`,
    `import { documentData, mediaSources } from './scenario-data.ts';`,
    'const document = readQuizHuntDocument(documentData);',
    "export const model = createQuizHuntScenarioModel(document, mediaSources, 'release');",
    '',
  ].join('\n'))
  await writeFile(scenarioFunctionsModule, createFunctionGroupModule(
    './scenario-model.ts',
    'collectScenarioFunctions({ views: model.scenario.views, actions: model.scenario.actions, guards: model.scenario.guards, sceneResetCallbacks: Object.values(model.scenario.scenes ?? {}).flatMap((source) => typeof source === "object" && source !== null && "onReset" in source ? [source.onReset] : []) })',
    scenarioCallbackCount,
  ))
  await writeFile(sceneFunctionsModule, createFunctionGroupModule(
    './scenario-model.ts',
    'collectSceneFunctions(model.scenario.scenes)',
    sceneCallbackCount,
  ))
  await writeFile(join(temporaryDirectory, 'scenario.ts'), [
    `import { model } from './scenario-model.ts';`,
    `export * as scenarioFunctions from './scenario-functions.ts';`,
    `export * as sceneFunctions from './scene-functions.ts';`,
    'export const scenario = model.scenario;',
    '',
  ].join('\n'))
}

/** Builds a module with stable names for callback references captured by the model. */
function createFunctionGroupModule(modelPath: string, expression: string, callbackCount: number): string {
  return [
    `import { model } from ${JSON.stringify(modelPath)};`,
    `const callbacks = ${expression};`,
    ...Array.from({ length: callbackCount }, (_, index) => `export const callback${index} = callbacks[${index}]!;`),
    'function collectScenarioFunctions(...values: readonly unknown[]): Function[] {',
    '  const callbacks = new Set<Function>();',
    '  const visited = new WeakSet<object>();',
    '  const visit = (value: unknown): void => {',
    '    if (typeof value === "function") { callbacks.add(value); return; }',
    '    if (value === null || typeof value !== "object" || visited.has(value)) return;',
    '    visited.add(value);',
    '    if (Array.isArray(value)) { value.forEach(visit); return; }',
    '    Object.values(value).forEach(visit);',
    '  };',
    '  values.forEach(visit);',
    '  return [...callbacks];',
    '}',
    'function collectSceneFunctions(value: unknown): Function[] {',
    '  return collectScenarioFunctions(value);',
    '}',
    '',
  ].join('\n')
}

/** Collects unique callbacks using the same object traversal as the generated module. */
function collectFunctionValues(value: unknown): Function[] {
  const callbacks = new Set<Function>()
  const visited = new WeakSet<object>()
  const visit = (entry: unknown): void => {
    if (typeof entry === 'function') {
      callbacks.add(entry)
      return
    }
    if (entry === null || typeof entry !== 'object' || visited.has(entry)) return
    visited.add(entry)
    if (Array.isArray(entry)) {
      entry.forEach(visit)
      return
    }
    Object.values(entry).forEach(visit)
  }
  visit(value)
  return [...callbacks]
}

/** Resolves one generated module from its parent without assuming a path depth. */
function relativeModulePath(fromDirectory: string, moduleFile: string): string {
  const modulePath = relative(fromDirectory, moduleFile).split(sep).join('/')
  return modulePath.startsWith('.') ? modulePath : `./${modulePath}`
}

/** Runs Sighty's standalone scenario and scene exporters with Elcé's engine capabilities. */
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
      '--engine-name', 'elce-engine',
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
      rejectProcess(new Error(output.trim() || `L’export Sighty Quiz Hunt s’est arrêté (${signal ?? code}).`))
    })
  })
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
  await writeFile(scenarioModule, bundledScenario.split(sourceLabel).join('quiz-hunt-export-source.ts'))
}

/** Creates a ZIP from the exported package without adding a wrapper directory. */
async function zipSightyPackage(
  packageDirectory: string,
  additionalFiles: Readonly<Record<string, Uint8Array>> = {},
): Promise<Uint8Array> {
  const entries: Zippable = Object.create(null) as Zippable
  await addDirectoryEntries(packageDirectory, packageDirectory, entries)
  for (const [path, bytes] of Object.entries(additionalFiles)) {
    if (entries[path] !== undefined) throw new Error(`Le fichier complémentaire Sighty existe déjà : ${path}`)
    entries[path] = bytes
  }
  if (Object.keys(entries).length === 0) throw new Error('L’export Sighty Quiz Hunt n’a produit aucun fichier.')
  return zipSync(entries, { level: 6 })
}

/** Adds files below one package root while leaving scene assets uncompressed. */
async function addDirectoryEntries(rootDirectory: string, currentDirectory: string, entries: Zippable): Promise<void> {
  const children = await readdir(currentDirectory, { withFileTypes: true })
  for (const child of children) {
    const childPath = join(currentDirectory, child.name)
    if (child.isDirectory()) {
      await addDirectoryEntries(rootDirectory, childPath, entries)
      continue
    }
    if (!child.isFile()) throw new Error(`Entrée Sighty Quiz Hunt non prise en charge : ${childPath}`)
    const entryPath = relative(rootDirectory, childPath).split(sep).join('/')
    const data = new Uint8Array(await readFile(childPath))
    entries[entryPath] = entryPath.includes('/scene/assets/') ? [data, { level: 0 }] : data
  }
}

/** Makes a stable, path-safe media filename while preserving a valid extension. */
function mediaFileName(index: number, name: string): string {
  const extension = extname(name).toLowerCase().replace(/[^a-z0-9.]/g, '')
  const safeExtension = /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : ''
  return `media-${index}${safeExtension}`
}
