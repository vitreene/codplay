#!/usr/bin/env node

import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'
import { buildCodPlayLibrary } from '../player-build/cli.mjs'
import { packageResources } from './resource-packager.mjs'
import { compileStyleSheets } from './stylesheet-compiler.mjs'
import { packageStyleSheet } from './stylesheet-packager.mjs'

const capturedStylesheetKey = '__codplaySceneExportStylesheets'

/** Parses the required source scene and output directory options. */
export function parseArguments(args) {
  const options = new Map()
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index]
    if (name !== '--scene' && name !== '--export' && name !== '--engine-config') {
      throw new Error(`Unknown option: ${name}`)
    }
    const value = args[index + 1]
    if (value === undefined || value.startsWith('--')) throw new Error(`${name} requires a path.`)
    options.set(name, value)
    index += 1
  }
  const scene = options.get('--scene')
  const destination = options.get('--export')
  if (scene === undefined || destination === undefined) {
    throw new Error('Usage: codplay export --scene <scene.js|scene.ts> [--engine-config <engine.js|engine.ts>] --export <directory>')
  }
  return { scene, destination, engineConfig: options.get('--engine-config') }
}

/** Builds and atomically publishes one scene package from a JavaScript or TypeScript scene module. */
export async function exportScenePackage({ sceneFile, engineConfigFile, destination, workingDirectory = process.cwd(), signal }) {
  const absoluteSceneFile = path.resolve(workingDirectory, sceneFile)
  const absoluteEngineConfigFile = engineConfigFile === undefined
    ? undefined
    : path.resolve(workingDirectory, engineConfigFile)
  const absoluteDestination = path.resolve(workingDirectory, destination)
  await assertSceneFile(absoluteSceneFile, 'Scene')
  if (absoluteEngineConfigFile !== undefined) await assertSceneFile(absoluteEngineConfigFile, 'Engine configuration')
  await assertDestinationMissing(absoluteDestination)
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
  const parentDirectory = path.dirname(absoluteDestination)
  await mkdir(parentDirectory, { recursive: true })
  const stageDirectory = await mkdtemp(path.join(parentDirectory, `.${path.basename(absoluteDestination)}.codplay-`))
  let playerBuildDirectory
  let player

  try {
    playerBuildDirectory = await mkdtemp(path.join(parentDirectory, '.codplay-player-build-'))
    const exportOperation = (async () => {
      const playerFile = await buildCodPlayLibrary(playerBuildDirectory)
      const codplayModule = await import(pathToFileURL(playerFile).href)
      const sourceBundleDirectory = path.join(stageDirectory, '.scene-source')
      await buildSceneAndCodec(packageRoot, absoluteSceneFile, sourceBundleDirectory)
      globalThis[capturedStylesheetKey] = []
      let sceneModule
      try {
        sceneModule = await import(pathToFileURL(path.join(sourceBundleDirectory, 'scene.mjs')).href)
      } finally {
        var importedStylesheets = globalThis[capturedStylesheetKey]
        delete globalThis[capturedStylesheetKey]
      }
      const codecModule = await import(pathToFileURL(path.join(sourceBundleDirectory, 'codec.mjs')).href)
      await rm(sourceBundleDirectory, { recursive: true, force: true })
      let engineCapabilities
      if (absoluteEngineConfigFile !== undefined) {
        const engineBundleDirectory = path.join(stageDirectory, '.engine-config')
        await buildEngineConfig(packageRoot, absoluteEngineConfigFile, engineBundleDirectory)
        const engineModule = await import(pathToFileURL(path.join(engineBundleDirectory, 'engine.mjs')).href)
        if (!isRecord(engineModule.engineCapabilities)) {
          throw new Error('Engine configuration module must export an engineCapabilities object.')
        }
        engineCapabilities = engineModule.engineCapabilities
        await rm(engineBundleDirectory, { recursive: true, force: true })
      }
      const scene = resolveSceneExport(sceneModule)
      const stylesheetInputs = [...(importedStylesheets ?? [])]
      if (sceneModule.styleSheet !== undefined) {
        stylesheetInputs.push({ sourceFile: absoluteSceneFile, cssText: sceneModule.styleSheet })
      }
      const compiledStyleSheet = stylesheetInputs.length === 0
        ? undefined
        : await compileStyleSheets(stylesheetInputs, absoluteSceneFile)

      const playerOptions = {
        frameScheduler: { request: () => 0, cancel: () => undefined },
        ...(engineCapabilities === undefined ? {} : { engine: engineCapabilities }),
      }
      player = new codplayModule.CodPlay(playerOptions)
      const buildResult = player.build({ scene }, {
        export: true,
        preloadManifest: sceneModule.preloadManifest,
        preloadResourceOccurrences: sceneModule.preloadResourceOccurrences,
      })
      if (!buildResult.ok) throw new Error(formatDiagnostics(buildResult.diagnostics.errors))
      const strapCollectionsExported = Object.hasOwn(sceneModule, 'strapCollections')
      const strapCollections = resolveStrapCollections(sceneModule, strapCollectionsExported)
      const strapIssues = codecModule.validateStrapCollections(
        buildResult.compiledScene,
        strapCollections,
        buildResult.functions,
      )
      if (strapIssues.length > 0) {
        throw new Error(strapIssues.map((issue) => `${issue.code}: ${issue.message}`).join('\n'))
      }

      const packaged = await packageResources({
        sourceFile: absoluteSceneFile,
        compiledScene: buildResult.compiledScene,
        resourceReferences: buildResult.resourceReferences ?? [],
        stageDirectory,
      })
      const packagedStyleSheet = await packageStyleSheet({ compiledStyleSheet, stageDirectory })
      const functionReferences = buildResult.functionReferences ?? []
      const packagedFunctions = functionReferences.length > 0 || strapCollectionsExported
        ? await buildFunctionModule({
          packageRoot,
          sceneFile: absoluteSceneFile,
          functionReferences,
          stageDirectory,
        })
        : undefined
      const codec = new codecModule.CompiledSceneCodec({ diagnosticOutput: () => undefined })
      const sceneJson = codec.encode(packaged.compiledScene)
      await writeFile(path.join(stageDirectory, 'scene/scene.json'), sceneJson)

      await writeFile(path.join(stageDirectory, 'export-manifest.json'), JSON.stringify({
        format: 'codplay.scene-package.v1',
        scene: 'scene/scene.json',
        functions: packagedFunctions === undefined ? [] : {
          file: 'scene/functions.mjs',
          references: functionReferences,
        },
        resources: packaged.resources,
        ...(packagedStyleSheet === undefined ? {} : { styleSheet: packagedStyleSheet }),
      }, null, 2))
      await assertDestinationMissing(absoluteDestination)
      await rename(stageDirectory, absoluteDestination)
      return {
        destination: absoluteDestination,
        resourceCount: packaged.resources.length + (packagedStyleSheet?.resources.length ?? 0)
          + (packagedFunctions?.assetCount ?? 0),
      }
    })()
    return await raceWithAbort(exportOperation, signal)
  } catch (error) {
    await rm(stageDirectory, { recursive: true, force: true })
    throw error
  } finally {
    if (playerBuildDirectory !== undefined) {
      await rm(playerBuildDirectory, { recursive: true, force: true })
    }
    player?.destroy()
  }
}

/** Bundles a static engine configuration for compilation without adding it to the scene package. */
async function buildEngineConfig(packageRoot, engineConfigFile, outDirectory) {
  await build({
    configFile: path.join(packageRoot, 'vite.config.ts'),
    root: packageRoot,
    logLevel: 'error',
    ssr: { noExternal: true },
    build: {
      ssr: true,
      rollupOptions: {
        input: { engine: engineConfigFile },
        output: { format: 'es', entryFileNames: '[name].mjs' },
      },
      outDir: outDirectory,
      emptyOutDir: true,
      target: 'node24',
    },
  })
}

/** Races one package build against the CLI interrupt without discarding cleanup. */
async function raceWithAbort(operation, signal) {
  if (signal === undefined) return await operation
  if (signal.aborted) throw createAbortError()
  let onAbort
  const aborted = new Promise((_, reject) => {
    onAbort = () => reject(createAbortError())
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    return await Promise.race([operation, aborted])
  } finally {
    signal.removeEventListener('abort', onAbort)
  }
}

/** Creates the internal error used when the caller cancels an export. */
function createAbortError() {
  const error = new Error('Scene export interrupted.')
  error.name = 'AbortError'
  return error
}

/** Bundles one external JavaScript or TypeScript scene module for execution by the Node CLI. */
async function buildSceneAndCodec(packageRoot, sceneFile, outDirectory) {
  const codecEntry = path.join(path.dirname(outDirectory), '.scene-export-codec-entry.mjs')
  await writeFile(codecEntry,
    [
      `export { CompiledSceneCodec } from ${JSON.stringify(path.join(packageRoot, 'src/scene/compiled/index.ts'))};`,
      `export { validateStrapCollections } from ${JSON.stringify(path.join(packageRoot, 'src/runtime/player/pipeline/strap-collections.ts'))};`,
    ].join('\n'))
  try {
    await build({
      configFile: path.join(packageRoot, 'vite.config.ts'),
      root: packageRoot,
      logLevel: 'error',
      ssr: { noExternal: true },
      plugins: [stylesheetCapturePlugin(), sceneAssetUrlPlugin(sceneFile)],
      build: {
        ssr: true,
        rollupOptions: {
          input: { scene: sceneFile, codec: codecEntry },
          output: { format: 'es', entryFileNames: '[name].mjs' },
        },
        outDir: outDirectory,
        emptyOutDir: true,
        target: 'node24',
      },
    })
  } finally {
    await rm(codecEntry, { force: true })
  }
}

/** Rewrites local Vite `?url` imports to source-relative paths for resource compilation. */
function sceneAssetUrlPlugin(sceneFile) {
  const sourceByVirtualId = new Map()
  let importedAssetIndex = 0
  return {
    name: 'codplay-scene-export-local-asset-url',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!hasUrlImportQuery(source)) return null
      const resolved = await this.resolve(source, importer, { skipSelf: true })
      if (resolved === null || resolved.external) return null
      const sourcePath = resolved.id.split('?', 1)[0]
      if (sourcePath === undefined || !path.isAbsolute(sourcePath)) return null
      const virtualId = `\0codplay-scene-export-asset-url-${importedAssetIndex++}`
      sourceByVirtualId.set(virtualId, sourcePath)
      return virtualId
    },
    load(id) {
      const sourcePath = sourceByVirtualId.get(id)
      if (sourcePath === undefined) return null
      const relativePath = path.relative(path.dirname(sceneFile), sourcePath)
        .split(path.sep)
        .map((segment) => encodeURIComponent(segment))
        .join('/')
      const sourceUrl = relativePath.startsWith('.') ? relativePath : `./${relativePath}`
      return `export default ${JSON.stringify(sourceUrl)};`
    },
  }
}

/** Checks whether an import query explicitly requests an asset URL. */
function hasUrlImportQuery(source) {
  const query = source.split('?', 2)[1]
  return query !== undefined && new URLSearchParams(query).has('url')
}

/** Bundles author code into a factory so each owner/package gets fresh closures. */
async function buildFunctionModule({ packageRoot, sceneFile, functionReferences, stageDirectory }) {
  const bundleDirectory = path.join(stageDirectory, '.scene-functions')
  const sourceDirectory = path.join(stageDirectory, '.scene-function-source')
  const entryFile = path.join(sourceDirectory, 'functions-entry.mjs')
  const contextName = '__codplayScenePackageSource'
  await mkdir(sourceDirectory, { recursive: true })
  await writeFile(entryFile, [
    'import * as sourceModule from ' + JSON.stringify(pathToFileURL(sceneFile).href) + ';',
    'export const scene = sourceModule.scene;',
    'export const strapCollections = sourceModule.strapCollections;',
    '',
  ].join('\n'))
  try {
    await build({
      configFile: path.join(packageRoot, 'vite.config.ts'),
      root: packageRoot,
      logLevel: 'error',
      plugins: [stylesheetRuntimePlugin()],
      build: {
        lib: {
          entry: entryFile,
          formats: ['iife'],
          name: contextName,
          fileName: 'functions-bundle',
        },
        outDir: bundleDirectory,
        emptyOutDir: true,
        minify: true,
        target: 'es2022',
        assetsInlineLimit: Number.MAX_SAFE_INTEGER,
        assetsDir: 'functions-assets',
      },
    })
  } finally {
    await rm(sourceDirectory, { recursive: true, force: true })
  }

  const emittedFiles = await readdir(bundleDirectory)
  const bundleFile = emittedFiles.find((file) => file.endsWith('.js'))
  if (bundleFile === undefined) throw new Error('Function code bundler did not emit its JavaScript module.')
  const bundle = await readFile(path.join(bundleDirectory, bundleFile), 'utf8')
  const referencesJson = JSON.stringify(functionReferences)
  const moduleSource = [
    `export const functionReferences = Object.freeze(${referencesJson}.map((entry) => Object.freeze({ ref: entry.ref, path: Object.freeze([...entry.path]) })));`,
    'export function createScenePackageContext() {',
    bundle,
    `  const sourceModule = ${contextName};`,
    '  const scene = sourceModule.scene ?? sourceModule.default;',
    "  if (scene === null || typeof scene !== 'object') throw new Error('Scene package function module did not provide its SceneDoc.');",
    '  const functions = Object.create(null);',
    '  for (const { ref, path } of functionReferences) {',
    '    let value = scene;',
    '    for (const segment of path) {',
    '      if (typeof segment === \'number\') {',
    '        if (!Array.isArray(value) || segment < 0 || segment >= value.length) { value = undefined; break; }',
    '        value = value[segment];',
    '      } else {',
    "        if ((typeof value !== 'object' && typeof value !== 'function') || value === null || !Object.hasOwn(value, segment)) { value = undefined; break; }",
    '        value = value[segment];',
    '      }',
    '    }',
    "    if (typeof value !== 'function') throw new Error(`Scene package function reference is not a function: ${ref}.`);",
    '    functions[ref] = value;',
    '  }',
    '  const strapCollections = sourceModule.strapCollections ?? { scene: {}, stories: {} };',
    '  return Object.freeze({ functions: Object.freeze(functions), strapCollections });',
    '}',
    '',
  ].join('\n')
  if (emittedFiles.some((file) => file !== bundleFile)) {
    throw new Error(`Function module emitted external files that cannot be inlined: ${emittedFiles.filter((file) => file !== bundleFile).join(', ')}`)
  }

  const sceneDirectory = path.join(stageDirectory, 'scene')
  await mkdir(sceneDirectory, { recursive: true })
  await writeFile(path.join(sceneDirectory, 'functions.mjs'), moduleSource)
  await rm(bundleDirectory, { recursive: true, force: true })
  return { file: 'scene/functions.mjs', references: functionReferences }
}

/** Captures CSS module imports for the scene export compiler instead of dropping them in SSR. */
function stylesheetCapturePlugin() {
  const sourceByVirtualId = new Map()
  let importedStyleIndex = 0
  return {
    name: 'codplay-scene-export-stylesheet-capture',
    enforce: 'pre',
    async resolveId(source, importer) {
      const [sourcePath, query = ''] = source.split('?', 2)
      if (!/\.css$/i.test(sourcePath ?? '')) {
        if (/\.(?:scss|sass|less|styl)$/i.test(sourcePath ?? '')) {
          throw new Error(`Stylesheet preprocessors are not supported by scene export: ${source}`)
        }
        return null
      }
      if (query !== '' && query !== 'inline') {
        throw new Error(`Unsupported stylesheet import query in scene export: ${source}`)
      }
      const resolved = await this.resolve(source, importer, { skipSelf: true })
      if (resolved === null) return null
      const resolvedPath = resolved.id.split('?', 1)[0] ?? resolved.id
      if (/\.module\.css$/i.test(resolvedPath)) {
        throw new Error(`CSS modules are not supported by scene export: ${source}`)
      }
      const virtualId = `\0codplay-scene-css-${importedStyleIndex++}`
      sourceByVirtualId.set(virtualId, {
        sourceFile: resolvedPath,
        inline: query === 'inline',
      })
      return {
        id: virtualId,
        moduleSideEffects: true,
      }
    },
    async load(id) {
      const source = sourceByVirtualId.get(id)
      if (source === undefined) return null
      const { sourceFile, inline } = source
      const cssText = await readFile(sourceFile, 'utf8')
      if (inline) return `export default ${JSON.stringify(cssText)};`
      return [
        `const key = ${JSON.stringify(capturedStylesheetKey)};`,
        'const stylesheets = globalThis[key] ?? (globalThis[key] = []);',
        `stylesheets.push({ sourceFile: ${JSON.stringify(sourceFile)}, cssText: ${JSON.stringify(cssText)} });`,
        'export default undefined;',
      ].join('\n')
    },
  }
}

/** Keeps inline CSS strings and removes side-effect stylesheet imports from the function bundle. */
function stylesheetRuntimePlugin() {
  const sourceByVirtualId = new Map()
  let importedStyleIndex = 0
  return {
    name: 'codplay-scene-export-stylesheet-runtime',
    enforce: 'pre',
    async resolveId(source, importer) {
      const [sourcePath, query = ''] = source.split('?', 2)
      if (!/\.css$/i.test(sourcePath ?? '')) {
        if (/\.(?:scss|sass|less|styl)$/i.test(sourcePath ?? '')) {
          throw new Error(`Stylesheet preprocessors are not supported by scene export: ${source}`)
        }
        return null
      }
      if (query !== '' && query !== 'inline') {
        throw new Error(`Unsupported stylesheet import query in scene export: ${source}`)
      }
      const resolved = await this.resolve(source, importer, { skipSelf: true })
      if (resolved === null) return null
      const resolvedPath = resolved.id.split('?', 1)[0] ?? resolved.id
      if (/\.module\.css$/i.test(resolvedPath)) {
        throw new Error(`CSS modules are not supported by scene export: ${source}`)
      }
      const virtualId = `\0codplay-scene-runtime-css-${importedStyleIndex++}`
      sourceByVirtualId.set(virtualId, { sourceFile: resolvedPath, inline: query === 'inline' })
      return { id: virtualId, moduleSideEffects: false }
    },
    async load(id) {
      const source = sourceByVirtualId.get(id)
      if (source === undefined) return null
      if (source.inline) return `export default ${JSON.stringify(await readFile(source.sourceFile, 'utf8'))};`
      return 'export default undefined;'
    },
  }
}

/** Verifies the entry's external strap exports and returns their scoped collections. */
function resolveStrapCollections(module, exported) {
  const empty = { scene: {}, stories: {} }
  if (!exported) return empty
  const collections = module.strapCollections
  if (!isRecord(collections) || !isRecord(collections.scene) || !isRecord(collections.stories)) {
    throw new Error('Scene module strapCollections must have the shape { scene, stories }.')
  }
  for (const [name, strap] of Object.entries(collections.scene)) {
    if (typeof strap !== 'function') throw new Error(`Scene strapCollections.scene.${name} must be a function.`)
  }
  for (const [storyId, storyCollection] of Object.entries(collections.stories)) {
    if (!isRecord(storyCollection)) throw new Error(`Scene strapCollections.stories.${storyId} must be a strap collection.`)
    for (const [name, strap] of Object.entries(storyCollection)) {
      if (typeof strap !== 'function') throw new Error(`Scene strapCollections.stories.${storyId}.${name} must be a function.`)
    }
  }
  return collections
}

/** Selects the exported SceneDoc while keeping the stylesheet as a separate named export. */
function resolveSceneExport(module) {
  const scene = module.scene ?? module.default
  if (!isRecord(scene) || typeof scene.id !== 'string' || !isRecord(scene.stories)) {
    throw new Error('Scene module must export a SceneDoc as `scene` or as its default export.')
  }
  return scene
}

/** Confirms the scene input exists and is a regular source file. */
async function assertSceneFile(sceneFile, label) {
  const metadata = await lstat(sceneFile).catch((error) => {
    if (error?.code === 'ENOENT') return undefined
    throw error
  })
  if (metadata === undefined || !metadata.isFile()) throw new Error(`${label} module is not a file: ${sceneFile}`)
  const extension = path.extname(sceneFile).toLowerCase()
  if (extension !== '.js' && extension !== '.mjs' && extension !== '.ts' && extension !== '.mts') {
    throw new Error(`${label} module must use .js, .mjs, .ts or .mts.`)
  }
}

/** Refuses an existing export destination so one command never overwrites a package. */
async function assertDestinationMissing(destination) {
  const existing = await lstat(destination).catch((error) => {
    if (error?.code === 'ENOENT') return undefined
    throw error
  })
  if (existing !== undefined) throw new Error(`Export destination already exists: ${destination}`)
}

/** Formats compiler diagnostics without hiding their scene and occurrence context. */
function formatDiagnostics(diagnostics) {
  return diagnostics.map((diagnostic) => {
    const context = diagnostic.details?.context
    const location = context === undefined ? '' : ` ${JSON.stringify(context)}`
    return `${diagnostic.code}: ${diagnostic.message}${location}`
  }).join('\n')
}

/** Checks whether an authored scene value is a non-array object. */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Runs the CLI entry point and reports failures with a non-zero process status. */
async function main() {
  const controller = new AbortController()
  const onInterrupt = () => controller.abort()
  process.once('SIGINT', onInterrupt)
  let interrupted = false
  try {
    const arguments_ = parseArguments(process.argv.slice(2))
    const workingDirectory = process.env.INIT_CWD ?? process.cwd()
    const result = await exportScenePackage({
      sceneFile: arguments_.scene,
      engineConfigFile: arguments_.engineConfig,
      destination: arguments_.destination,
      workingDirectory,
      signal: controller.signal,
    })
    process.stdout.write(`CodPlay scene exported to ${result.destination} (${result.resourceCount} resources).\n`)
  } catch (error) {
    if (controller.signal.aborted) {
      interrupted = true
    } else {
      const message = error instanceof Error ? error.message : String(error)
      const debugDetails = process.env.CODPLAY_EXPORT_DEBUG === '1' && error instanceof Error
        ? `\n${error.stack}`
        : ''
      process.stderr.write(`${message}${debugDetails}\n`)
      process.exitCode = 1
    }
  } finally {
    process.removeListener('SIGINT', onInterrupt)
  }
  if (interrupted) process.exit(130)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
