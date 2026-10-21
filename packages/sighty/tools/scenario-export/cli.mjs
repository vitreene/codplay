import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'
import { build } from 'vite'
import { exportScenePackage } from 'codplay/tools/scene-export/cli.mjs'
import { buildEngineBundle } from 'codplay/tools/engine-build/engine-builder.mjs'
import { buildCodPlayLibrary } from 'codplay/tools/player-build/cli.mjs'
import { buildSightyLibrary } from '../library-build/cli.mjs'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** Parses the scenario source and destination options. */
export function parseArguments(args) {
  const options = new Map()
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index]
    if (name === '--standalone') {
      if (options.has(name)) throw new Error(`${name} may be supplied only once.`)
      options.set(name, true)
      continue
    }
    if (name !== '--scenario' && name !== '--engine-config' && name !== '--engine-name' && name !== '--export') {
      throw new Error(`Unknown option: ${name}`)
    }
    const value = args[index + 1]
    if (value === undefined || value.startsWith('--')) {
      throw new Error(name === '--engine-name' ? `${name} requires a kebab-case name.` : `${name} requires a path.`)
    }
    options.set(name, value)
    index += 1
  }
  const scenario = options.get('--scenario')
  const destination = options.get('--export')
  if (scenario === undefined || destination === undefined) {
    throw new Error('Usage: sighty export --scenario <scenario.js|scenario.ts> [--engine-config <engine.js|engine.ts>] [--standalone [--engine-name <name>]] --export <directory>')
  }
  const standalone = options.has('--standalone')
  const engineConfig = options.get('--engine-config')
  const engineName = options.get('--engine-name') ?? 'engine'
  assertEngineArtifactName(engineName)
  if (options.has('--engine-name') && !standalone) {
    throw new Error('--engine-name requires --standalone.')
  }
  if (standalone && engineConfig === undefined) {
    throw new Error('--standalone requires --engine-config to include the configured engine.')
  }
  return { scenario, destination, engineConfig, engineName, standalone }
}

/** Builds and atomically publishes one Sighty package with intact CodPlay scene children. */
export async function exportScenarioPackage({
  scenarioFile,
  engineConfigFile,
  engineName = 'engine',
  standalone = false,
  destination,
  workingDirectory = process.cwd(),
  signal,
}) {
  assertEngineArtifactName(engineName)
  if (engineName !== 'engine' && !standalone) {
    throw new Error('A custom engine artifact name requires a standalone distribution.')
  }
  const absoluteScenarioFile = path.resolve(workingDirectory, scenarioFile)
  const absoluteEngineConfigFile = engineConfigFile === undefined
    ? undefined
    : path.resolve(workingDirectory, engineConfigFile)
  const absoluteDestination = path.resolve(workingDirectory, destination)
  await assertSourceFile(absoluteScenarioFile, 'Scenario')
  if (absoluteEngineConfigFile !== undefined) await assertSourceFile(absoluteEngineConfigFile, 'Engine configuration')
  if (standalone && absoluteEngineConfigFile === undefined) {
    throw new Error('Standalone Sighty distribution requires an engine configuration.')
  }
  await assertDestinationMissing(absoluteDestination)

  const parentDirectory = path.dirname(absoluteDestination)
  await mkdir(parentDirectory, { recursive: true })
  const stageDirectory = await mkdtemp(path.join(parentDirectory, `.${path.basename(absoluteDestination)}.sighty-`))
  try {
    const sceneSources = await collectSceneSourceBindings(absoluteScenarioFile)
    const scenarioFunctionsSource = await resolveGroupedFunctionsModule(absoluteScenarioFile, 'scenarioFunctions')
    const rootSceneFunctionsSource = await resolveGroupedFunctionsModule(absoluteScenarioFile, 'sceneFunctions')
    const sceneFunctionsSourceByKey = new Map()
    const functionGroupSources = new Set()
    if (scenarioFunctionsSource !== undefined) functionGroupSources.add(scenarioFunctionsSource)
    if (rootSceneFunctionsSource !== undefined) functionGroupSources.add(rootSceneFunctionsSource)
    for (const [sceneKey, binding] of sceneSources) {
      const sourceFunctions = await resolveGroupedFunctionsModule(binding.sourceFile, 'sceneFunctions')
      const selectedSource = sourceFunctions ?? rootSceneFunctionsSource
      if (selectedSource !== undefined) {
        sceneFunctionsSourceByKey.set(sceneKey, selectedSource)
        functionGroupSources.add(selectedSource)
      }
    }
    const scenarioBuildDirectory = path.join(stageDirectory, '.scenario-build')
    const functionGroupPaths = await buildScenarioModule(
      absoluteScenarioFile,
      scenarioBuildDirectory,
      [...functionGroupSources],
    )
    const scenarioModulePath = path.join(scenarioBuildDirectory, 'scenario.mjs')
    const scenarioBuildFiles = await readdir(scenarioBuildDirectory)
    if (!scenarioBuildFiles.includes('scenario.mjs')) {
      throw new Error(`Scenario bundler output is missing scenario.mjs: ${scenarioBuildFiles.join(', ')}`)
    }
    for (const [sourcePath, bundledPath] of functionGroupPaths) {
      if (!scenarioBuildFiles.includes(path.basename(bundledPath))) {
        throw new Error(`Scenario bundler output is missing grouped functions for ${sourcePath}: ${scenarioBuildFiles.join(', ')}`)
      }
    }
    const scenarioModule = await import(/* @vite-ignore */ pathToFileURL(scenarioModulePath).href)
    const { scenario, exportName } = resolveScenarioExport(scenarioModule)
    const scenarioFunctionsModule = scenarioFunctionsSource === undefined
      ? undefined
      : functionGroupPaths.get(scenarioFunctionsSource)
    const defaultSceneFunctionsModule = rootSceneFunctionsSource === undefined
      ? undefined
      : functionGroupPaths.get(rootSceneFunctionsSource)
    const sceneFunctionsModuleByKey = new Map([...sceneFunctionsSourceByKey].map(([sceneKey, sourcePath]) => [
      sceneKey,
      functionGroupPaths.get(sourcePath),
    ]))
    const codplayBuildDirectory = path.join(stageDirectory, standalone ? 'runtime' : '.codplay-build')
    if (standalone) await mkdir(codplayBuildDirectory, { recursive: true })
    let codplayModule
    /** Builds and imports the shared player once, when the first scene needs compilation. */
    const getCodplayModule = async () => {
      if (codplayModule === undefined) {
        codplayModule = await buildCodPlayModule(codplayBuildDirectory)
      }
      return codplayModule
    }
    const scenePackages = await exportDirectScenes({
      scenario,
      scenarioFile: absoluteScenarioFile,
      scenarioModulePath,
      scenarioExportName: exportName,
      sceneSources,
      sceneFunctionsModuleByKey,
      defaultSceneFunctionsModule,
      engineConfigFile: absoluteEngineConfigFile,
      getCodplayModule,
      stageDirectory,
      workingDirectory,
      signal,
    })
    if (!standalone && codplayModule !== undefined) {
      await rm(codplayBuildDirectory, { recursive: true, force: true })
    }

    await buildCompactScenarioModule({
      scenario,
      scenarioFunctions: scenarioModule.scenarioFunctions,
      scenarioFunctionsModule,
      destination: path.join(stageDirectory, 'scenario.mjs'),
      workingDirectory,
    })
    await rm(scenarioBuildDirectory, { recursive: true, force: true })
    await writeFile(path.join(stageDirectory, 'export-manifest.json'), JSON.stringify({
      format: 'sighty.scenario-package.v2',
      scenario: 'scenario.mjs',
      scenes: scenePackages,
    }, null, 2))
    if (standalone) {
      await buildStandaloneDistribution({
        stageDirectory,
        engineConfigFile: absoluteEngineConfigFile,
        engineName,
        workingDirectory,
        codplayBuilt: codplayModule !== undefined,
      })
    }
    await assertDestinationMissing(absoluteDestination)
    await rename(stageDirectory, absoluteDestination)
    return {
      destination: absoluteDestination,
      sceneCount: Object.keys(scenePackages).length,
    }
  } catch (error) {
    await rm(stageDirectory, { recursive: true, force: true })
    throw error
  }
}

/** Builds and imports the player module used to compile one or more scene packages. */
async function buildCodPlayModule(outputDirectory) {
  const playerFile = await buildCodPlayLibrary(outputDirectory)
  return await import(pathToFileURL(playerFile).href)
}

/** Adds each shared runtime artifact once and writes the package loader entry point. */
async function buildStandaloneDistribution({ stageDirectory, engineConfigFile, engineName, workingDirectory, codplayBuilt }) {
  const runtimeDirectory = path.join(stageDirectory, 'runtime')
  await mkdir(runtimeDirectory, { recursive: true })
  if (!codplayBuilt) await buildCodPlayLibrary(runtimeDirectory)
  await buildSightyLibrary(runtimeDirectory, { codplayImport: './codplay.js' })

  const engineBuildDirectory = path.join(stageDirectory, '.engine-build')
  const engineBuild = await buildEngineBundle({
    engineConfigFile,
    destination: engineBuildDirectory,
    workingDirectory,
    codplayImport: './codplay.js',
  })
  const unsupportedLibraries = engineBuild.libraries.filter(({ delivery }) => delivery.mode !== 'package')
  if (unsupportedLibraries.length > 0) {
    const libraryIds = unsupportedLibraries.map(({ id }) => id).join(', ')
    throw new Error(`Standalone Sighty distribution cannot include external engine libraries: ${libraryIds}.`)
  }
  const engineFileName = `${engineName}.js`
  const engineManifestFileName = `${engineName}-manifest.json`
  const engineManifest = JSON.parse(await readFile(path.join(engineBuildDirectory, 'engine-manifest.json'), 'utf8'))
  engineManifest.entry = engineFileName
  await writeFile(path.join(runtimeDirectory, engineFileName), await readFile(path.join(engineBuildDirectory, 'engine.js')))
  await writeFile(path.join(runtimeDirectory, engineManifestFileName), JSON.stringify(engineManifest, null, 2))
  await rm(engineBuildDirectory, { recursive: true, force: true })

  await writeFile(path.join(stageDirectory, 'loader.mjs'), createDistributionLoader(engineFileName))
  await writeFile(path.join(stageDirectory, 'distribution-manifest.json'), JSON.stringify({
    format: 'sighty.application-package.v1',
    entry: 'loader.mjs',
    scenario: 'export-manifest.json',
    runtime: {
      codplay: 'runtime/codplay.js',
      sighty: 'runtime/sighty.js',
      engine: `runtime/${engineFileName}`,
    },
  }, null, 2))
  await writeFile(path.join(stageDirectory, 'README.md'), createDistributionReadme(engineFileName))
}

/** Creates a loader that prepares the package while leaving runtime initialization to its caller. */
function createDistributionLoader(engineFileName) {
  return [
    `import * as engineConfiguration from ${JSON.stringify(`./runtime/${engineFileName}`)}`,
    "import { Sighty } from './runtime/sighty.js'",
    '',
    '/** Loads the package resources and returns Sighty without creating scene occurrences. */',
    'export async function loadSightyPackage({ root, packagePath = new URL(\'./\', import.meta.url).href, codplay, runtime } = {}) {',
    "  if (root === undefined) throw new TypeError('loadSightyPackage() requires a root element or selector.')",
    '  const owner = new Sighty({',
    '    codplay: {',
    '      ...engineConfiguration.codplayOptions,',
    '      ...codplay,',
    '      engine: { ...engineConfiguration.engineCapabilities, ...codplay?.engine },',
    '    },',
    '    runtime: { ...engineConfiguration.runtimeOptions, ...runtime },',
    '  })',
    '  try {',
    '    return await owner.load(packagePath, { root })',
    '  } catch (error) {',
    '    owner.destroy()',
    '    throw error',
    '  }',
    '}',
    '',
  ].join('\n')
}

/** Documents the minimal use of the extracted distribution package. */
function createDistributionReadme(engineFileName) {
  return [
    '# Sighty package',
    '',
    'Extract this archive and serve the directory over HTTP. Import the loader to prepare the scenario and its scene resources:',
    '',
    '```js',
    "import { loadSightyPackage } from './loader.mjs'",
    "const course = await loadSightyPackage({ root: '#player' })",
    'await course.runtime.initialize()',
    '```',
    '',
    '`loadSightyPackage()` returns the scenario and runtime after loading resources. `runtime.initialize()` creates and mounts the initial scene occurrences.',
    '',
    `The application-specific CodPlay configuration is in \`runtime/${engineFileName}\`.`,
    '',
  ].join('\n')
}

/** Bundles the scenario definition and its local code dependencies into one module. */
async function buildScenarioModule(scenarioFile, outDirectory, functionGroupSources = []) {
  const functionGroupEntries = new Map(functionGroupSources.map((sourceFile, index) => [
    sourceFile,
    `authorFunctions${index}`,
  ]))
  const input = { scenario: scenarioFile }
  for (const [sourceFile, entryName] of functionGroupEntries) input[entryName] = sourceFile
  await build({
    configFile: false,
    root: packageRoot,
    logLevel: 'error',
    plugins: [scenarioStylesheetPlugin()],
    ssr: { noExternal: true },
    build: {
      ssr: true,
      rolldownOptions: {
        input,
        output: {
          format: 'es',
          entryFileNames: '[name].mjs',
          chunkFileNames: 'chunks/[name]-[hash].mjs',
        },
      },
      outDir: outDirectory,
      emptyOutDir: true,
      target: 'node24',
    },
  })
  return new Map([...functionGroupEntries].map(([sourceFile, entryName]) => [
    sourceFile,
    path.join(outDirectory, `${entryName}.mjs`),
  ]))
}

/** Builds the compact runtime scenario without serializing any authored scene document. */
async function buildCompactScenarioModule({ scenario, scenarioFunctions, scenarioFunctionsModule, destination }) {
  const compactScenario = createCompactScenarioDefinition(scenario)
  const callbacks = collectScenarioCallbacks(compactScenario)
  const exportNameByFunction = new Map()
  if (scenarioFunctions !== undefined) {
    if (!isRecord(scenarioFunctions)) {
      throw new Error('The scenarioFunctions namespace must resolve to an exported module namespace.')
    }
    for (const [exportName, value] of Object.entries(scenarioFunctions)) {
      if (typeof value === 'function' && !exportNameByFunction.has(value)) {
        exportNameByFunction.set(value, exportName)
      }
    }
  }

  const imports = new Map()
  for (const callback of callbacks) {
    const exportName = exportNameByFunction.get(callback)
    if (exportName === undefined || scenarioFunctionsModule === undefined) {
      throw new Error('SIGHTY_EXPORT_FUNCTION_REFERENCE_UNSUPPORTED: every compact scenario callback must be exported by scenarioFunctions.')
    }
    imports.set(exportName, `__sightyFunction${imports.size}`)
  }

  const outputDirectory = path.dirname(destination)
  const entryFile = path.join(outputDirectory, 'scenario-compact-entry.mjs')
  const buildDirectory = path.join(outputDirectory, '.scenario-compact-build')
  const functionAliasByValue = new Map()
  for (const [exportName, alias] of imports) {
    const callback = [...exportNameByFunction].find(([, name]) => name === exportName)?.[0]
    if (callback !== undefined) functionAliasByValue.set(callback, alias)
  }
  const importLines = scenarioFunctionsModule === undefined
    ? []
    : [...imports].map(([exportName, alias]) =>
      `import { ${exportName} as ${alias} } from ${JSON.stringify(relativeModuleSpecifier(entryFile, scenarioFunctionsModule))};`,
    )
  const source = [
    ...importLines,
    `const scenario = ${serializeScenarioValue(compactScenario, functionAliasByValue)};`,
    'export { scenario };',
    '',
  ].join('\n')

  try {
    await writeFile(entryFile, source)
    await build({
      configFile: false,
      root: packageRoot,
      logLevel: 'error',
      ssr: { noExternal: true },
      build: {
        ssr: true,
        minify: true,
        rolldownOptions: {
          input: { scenario: entryFile },
          output: { format: 'es', entryFileNames: '[name].mjs', codeSplitting: false },
        },
        outDir: buildDirectory,
        emptyOutDir: true,
        target: 'es2022',
      },
    })
    const builtScenarioPath = path.join(buildDirectory, 'scenario.mjs')
    await rename(builtScenarioPath, destination)
  } finally {
    await rm(entryFile, { force: true })
    await rm(buildDirectory, { recursive: true, force: true })
  }
}

/** Keeps the scenario graph and execution data while replacing documents with reset metadata. */
function createCompactScenarioDefinition(scenario) {
  const { actionKeys, guardKeys } = collectScenarioReferences(scenario.views)
  const directScenes = new Map(Object.entries(isRecord(scenario.scenes) ? scenario.scenes : {}))
  for (const [sceneKey, sceneSource] of Object.entries(isRecord(scenario.sceneSources) ? scenario.sceneSources : {})) {
    if (!directScenes.has(sceneKey) && typeof sceneSource !== 'function') directScenes.set(sceneKey, sceneSource)
  }
  const scenes = Object.create(null)
  for (const sceneKey of directScenes.keys()) {
    const source = directScenes.get(sceneKey)
    const descriptor = isRecord(source) && Object.hasOwn(source, 'sceneDoc') ? source : undefined
    const onReset = descriptor?.onReset
    if (onReset !== undefined && typeof onReset !== 'function') {
      throw new Error(`SIGHTY_EXPORT_SCENE_RESET_INVALID: scenes.${sceneKey}.onReset must be a function.`)
    }
    scenes[sceneKey] = onReset === undefined ? {} : { onReset }
  }

  const actions = Object.create(null)
  for (const actionKey of actionKeys) {
    const handler = scenario.actions?.[actionKey]
    if (handler !== undefined) actions[actionKey] = handler
  }
  const guards = Object.create(null)
  for (const guardKey of guardKeys) {
    const handler = scenario.guards?.[guardKey]
    if (handler !== undefined) guards[guardKey] = handler
  }

  return {
    ...(scenario.format === undefined ? {} : { format: scenario.format }),
    ...(scenario.version === undefined ? {} : { version: scenario.version }),
    ...(scenario.id === undefined ? {} : { id: scenario.id }),
    views: scenario.views,
    ...(scenario.showMode === undefined ? {} : { showMode: scenario.showMode }),
    scenes,
    ...(scenario.data === undefined ? {} : { data: scenario.data }),
    ...(Object.keys(actions).length === 0 ? {} : { actions }),
    ...(Object.keys(guards).length === 0 ? {} : { guards }),
  }
}

/** Collects the registered action and guard keys referenced by one view graph. */
function collectScenarioReferences(viewGraph) {
  const actionKeys = new Set()
  const guardKeys = new Set()
  const visit = (value) => {
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry)
      return
    }
    if (!isRecord(value)) return
    for (const [key, child] of Object.entries(value)) {
      if (key === 'action' && typeof child === 'string' && child.startsWith('action:')) actionKeys.add(child)
      if ((key === 'accessBy' || key === 'exitBy') && typeof child === 'string' && child.startsWith('guard:')) guardKeys.add(child)
      visit(child)
    }
  }
  visit(viewGraph)
  return { actionKeys, guardKeys }
}

/** Collects every callback retained in the compact scenario payload. */
function collectScenarioCallbacks(value) {
  const callbacks = new Set()
  const visited = new Set()
  const visit = (entry) => {
    if (typeof entry === 'function') {
      callbacks.add(entry)
      return
    }
    if (entry === null || typeof entry !== 'object' || visited.has(entry)) return
    visited.add(entry)
    if (Array.isArray(entry)) {
      for (const item of entry) visit(item)
      return
    }
    for (const item of Object.values(entry)) visit(item)
  }
  visit(value)
  return callbacks
}

/** Emits JSON-compatible scenario data and static references to grouped callbacks. */
function serializeScenarioValue(value, functionAliasByValue, pathSegments = [], seen = new Set()) {
  if (typeof value === 'function') {
    const alias = functionAliasByValue.get(value)
    if (alias === undefined) {
      throw new Error(`SIGHTY_EXPORT_FUNCTION_REFERENCE_UNSUPPORTED: callback at ${pathSegments.join('.')} is absent from scenarioFunctions.`)
    }
    return alias
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error(`SIGHTY_EXPORT_SCENARIO_VALUE_UNSUPPORTED: non-finite number at ${pathSegments.join('.')}.`)
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) throw new Error(`SIGHTY_EXPORT_SCENARIO_CYCLE: cyclic value at ${pathSegments.join('.')}.`)
    seen.add(value)
    const result = `[${value.map((item, index) => serializeScenarioValue(item, functionAliasByValue, [...pathSegments, String(index)], seen)).join(',')}]`
    seen.delete(value)
    return result
  }
  if (isRecord(value)) {
    if (seen.has(value)) throw new Error(`SIGHTY_EXPORT_SCENARIO_CYCLE: cyclic value at ${pathSegments.join('.')}.`)
    seen.add(value)
    const properties = []
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue
      properties.push(`${JSON.stringify(key)}:${serializeScenarioValue(item, functionAliasByValue, [...pathSegments, key], seen)}`)
    }
    seen.delete(value)
    return `{${properties.join(',')}}`
  }
  throw new Error(`SIGHTY_EXPORT_SCENARIO_VALUE_UNSUPPORTED: unsupported value at ${pathSegments.join('.')}.`)
}

/** Resolves one namespace export to its local grouped author-function module. */
async function resolveGroupedFunctionsModule(sourceFile, namespaceName) {
  const sourceText = await readFile(sourceFile, 'utf8')
  const source = ts.createSourceFile(sourceFile, sourceText, ts.ScriptTarget.Latest, true)
  let moduleSpecifier
  let hasNamespaceExport = false
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement) || statement.exportClause === undefined) continue
    if (ts.isNamespaceExport(statement.exportClause) && statement.exportClause.name.text === namespaceName) {
      moduleSpecifier = statement.moduleSpecifier
      break
    }
    if (ts.isNamedExports(statement.exportClause)) {
      hasNamespaceExport ||= statement.exportClause.elements.some((element) =>
        (element.propertyName?.text ?? element.name.text) === namespaceName,
      )
    }
  }
  if (moduleSpecifier === undefined) {
    if (hasNamespaceExport) {
      throw new Error(`Compact Sighty export requires \`export * as ${namespaceName} from "./${namespaceName}.js"\` to expose the grouped author-function module.`)
    }
    return undefined
  }
  if (!ts.isStringLiteral(moduleSpecifier)) {
    throw new Error(`The ${namespaceName} namespace must re-export one local author-function module.`)
  }
  const resolvedModule = ts.resolveModuleName(moduleSpecifier.text, sourceFile, {
    allowJs: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  }, ts.sys).resolvedModule
  if (resolvedModule === undefined) {
    throw new Error(`Unable to resolve the ${namespaceName} module "${moduleSpecifier.text}" from ${sourceFile}.`)
  }
  return path.resolve(resolvedModule.resolvedFileName)
}

/** Creates a relative ESM path from a generated entry to one author module. */
function relativeModuleSpecifier(fromFile, toFile) {
  const relativePath = path.relative(path.dirname(fromFile), toFile).split(path.sep).join('/')
  return relativePath.startsWith('./') || relativePath.startsWith('../')
    ? relativePath
    : `./${relativePath}`
}

/** Ignores scene CSS while bundling scenario code; each scene exports its own CSS through CodPlay. */
function scenarioStylesheetPlugin() {
  const cssIds = new Set()
  let cssIndex = 0
  return {
    name: 'sighty-scenario-css-placeholder',
    enforce: 'pre',
    resolveId(source) {
      if (!/\.css(?:\?.*)?$/i.test(source)) return null
      const id = `\0sighty-scenario-css-${cssIndex++}`
      cssIds.add(id)
      return id
    },
    load(id) {
      if (!cssIds.has(id)) return null
      return 'export default "";'
    },
  }
}

/** Exports each direct scene as an unchanged CodPlay package in a child directory. */
async function exportDirectScenes({
  scenario,
  scenarioFile,
  scenarioModulePath,
  scenarioExportName,
  sceneSources,
  sceneFunctionsModuleByKey,
  defaultSceneFunctionsModule,
  engineConfigFile,
  getCodplayModule,
  stageDirectory,
  workingDirectory,
  signal,
}) {
  const authoredScenes = isRecord(scenario.scenes) ? scenario.scenes : {}
  const declaredSources = isRecord(scenario.sceneSources) ? scenario.sceneSources : {}
  const directScenes = new Map(Object.entries(authoredScenes))
  for (const [sceneKey, sceneSource] of Object.entries(declaredSources)) {
    if (directScenes.has(sceneKey)) continue
    if (typeof sceneSource === 'function') {
      throw new Error(`Lazy Sighty scene source is not supported by export: sceneSources.${sceneKey}.`)
    }
    directScenes.set(sceneKey, sceneSource)
  }

  const packages = Object.create(null)
  let index = 0
  for (const [sceneKey, sceneSource] of directScenes) {
    if (typeof sceneSource === 'function') {
      throw new Error(`Lazy Sighty scene source is not supported by export: scenes.${sceneKey}.`)
    }
    const sourceBinding = sceneSources.get(sceneKey)
    const sourceFile = sourceBinding?.sourceFile ?? scenarioFile
    const groupedSceneFunctions = sceneFunctionsModuleByKey.get(sceneKey) ?? defaultSceneFunctionsModule
    const sceneIndex = index++
    const codplayModule = await getCodplayModule()
    const sceneEntryFile = path.join(stageDirectory, `.scene-entry-${sceneIndex}.mjs`)
    await writeFile(sceneEntryFile, createSceneEntryModule({
      sceneEntryFile,
      sourceBinding,
      sourceFile,
      scenarioFile,
      scenarioModulePath,
      scenarioExportName,
      sceneKey,
      sceneFunctionsModule: groupedSceneFunctions,
    }))
    const relativePackagePath = `scenes/scene-${sceneIndex}`
    await exportScenePackage({
      sceneFile: sceneEntryFile,
      sourceFile,
      engineConfigFile,
      codplayModule,
      destination: path.join(stageDirectory, relativePackagePath),
      workingDirectory,
      signal,
    })
    await rm(sceneEntryFile, { force: true })
    packages[sceneKey] = `${relativePackagePath}/`
  }
  return packages
}

/** Creates a tiny module that exposes only one authored SceneDoc to CodPlay's exporter. */
function createSceneEntryModule({
  sceneEntryFile,
  sourceBinding,
  sourceFile,
  scenarioFile,
  scenarioModulePath,
  scenarioExportName,
  sceneKey,
  sceneFunctionsModule,
}) {
  const sceneFunctionsExport = sceneFunctionsModule === undefined
    ? undefined
    : `export * as sceneFunctions from ${JSON.stringify(relativeModuleSpecifier(sceneEntryFile, sceneFunctionsModule))};`
  if (sourceBinding !== undefined) {
    const lines = [
      `import * as scenarioModule from ${JSON.stringify(pathToFileURL(scenarioModulePath).href)};`,
      `import * as sceneModule from ${JSON.stringify(pathToFileURL(sourceFile).href)};`,
      `const scenario = scenarioModule[${JSON.stringify(scenarioExportName)}];`,
      `const scenarioScene = scenario.scenes?.[${JSON.stringify(sceneKey)}] ?? scenario.sceneSources?.[${JSON.stringify(sceneKey)}];`,
      `const sourceScene = sceneModule[${JSON.stringify(sourceBinding.exportName)}];`,
      'export const scene = sourceScene?.sceneDoc ?? sourceScene;',
      'export const styleSheet = scenarioScene?.styleSheet ?? sourceScene?.styleSheet ?? sceneModule.styleSheet;',
      'export const preloadManifest = sceneModule.preloadManifest;',
      'export const preloadResourceOccurrences = sceneModule.preloadResourceOccurrences;',
    ]
    if (moduleExportsName(sourceFile, 'strapCollections')) {
      lines.push('export const strapCollections = sceneModule.strapCollections;')
    }
    if (sceneFunctionsExport !== undefined) lines.push(sceneFunctionsExport)
    return `${lines.join('\n')}\n`
  }
  const scenarioReference = `scenarioModule[${JSON.stringify(scenarioExportName)}]`
  const directSource = `(${scenarioReference}.scenes?.[${JSON.stringify(sceneKey)}] ?? ${scenarioReference}.sceneSources?.[${JSON.stringify(sceneKey)}])`
  const lines = [
    `import * as scenarioModule from ${JSON.stringify(pathToFileURL(scenarioModulePath).href)};`,
    `const sceneSource = ${directSource};`,
    'export const scene = sceneSource?.sceneDoc ?? sceneSource;',
    'export const styleSheet = sceneSource?.styleSheet;',
    'export const preloadManifest = scenarioModule.preloadManifest;',
    'export const preloadResourceOccurrences = scenarioModule.preloadResourceOccurrences;',
  ]
  if (moduleExportsName(scenarioFile, 'strapCollections')) {
    lines.push('export const strapCollections = scenarioModule.strapCollections;')
  }
  if (sceneFunctionsExport !== undefined) lines.push(sceneFunctionsExport)
  return `${lines.join('\n')}\n`
}

/** Checks whether a source module explicitly exports one named value. */
function moduleExportsName(sourcePath, exportName) {
  const sourceText = ts.sys.readFile(sourcePath)
  if (sourceText === undefined) return false
  const source = ts.createSourceFile(sourcePath, sourceText, ts.ScriptTarget.Latest, true)
  return source.statements.some((statement) => {
    if (ts.isVariableStatement(statement)
      && statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      return statement.declarationList.declarations.some((declaration) =>
        ts.isIdentifier(declaration.name) && declaration.name.text === exportName,
      )
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause !== undefined && ts.isNamedExports(statement.exportClause)) {
      return statement.exportClause.elements.some((element) =>
        (element.propertyName?.text ?? element.name.text) === exportName,
      )
    }
    return false
  })
}

/** Finds direct scene values that are imported from separate scene modules. */
async function collectSceneSourceBindings(scenarioFile) {
  const sourceText = await readFile(scenarioFile, 'utf8')
  const source = ts.createSourceFile(scenarioFile, sourceText, ts.ScriptTarget.Latest, true)
  const compilerOptions = {
    allowJs: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  }
  const importBindings = new Map()
  const localInitializers = new Map()
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const resolvedModule = ts.resolveModuleName(
        statement.moduleSpecifier.text,
        scenarioFile,
        compilerOptions,
        ts.sys,
      ).resolvedModule
      if (resolvedModule === undefined) continue
      const sourcePath = path.resolve(resolvedModule.resolvedFileName)
      const importClause = statement.importClause
      if (importClause?.name !== undefined) {
        importBindings.set(importClause.name.text, { sourceFile: sourcePath, exportName: 'default' })
      }
      if (importClause?.namedBindings !== undefined && ts.isNamedImports(importClause.namedBindings)) {
        for (const element of importClause.namedBindings.elements) {
          importBindings.set(element.name.text, {
            sourceFile: sourcePath,
            exportName: element.propertyName?.text ?? element.name.text,
          })
        }
      }
      if (importClause?.namedBindings !== undefined && ts.isNamespaceImport(importClause.namedBindings)) {
        importBindings.set(importClause.namedBindings.name.text, { sourceFile: sourcePath, exportName: '*' })
      }
      continue
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer !== undefined) {
          localInitializers.set(declaration.name.text, declaration.initializer)
        }
      }
    }
  }

  const bindings = new Map()
  for (const statement of source.statements) {
    visitSceneCatalogs(statement, (sceneKey, expression) => {
      const binding = resolveSceneBinding(expression, importBindings, localInitializers)
      if (binding !== undefined) bindings.set(sceneKey, binding)
    })
  }
  return bindings
}

/** Visits scene and direct source catalog literals in scenario source code. */
function visitSceneCatalogs(node, visitEntry) {
  if (ts.isPropertyAssignment(node)
    && ts.isIdentifier(node.name)
    && (node.name.text === 'scenes' || node.name.text === 'sceneSources')
    && ts.isObjectLiteralExpression(node.initializer)) {
    for (const property of node.initializer.properties) {
      if (ts.isPropertyAssignment(property)) {
        const sceneKey = propertyName(property.name)
        if (sceneKey !== undefined) visitEntry(sceneKey, property.initializer)
      } else if (ts.isShorthandPropertyAssignment(property)) {
        visitEntry(property.name.text, property.name)
      }
    }
  }
  ts.forEachChild(node, (child) => visitSceneCatalogs(child, visitEntry))
}

/** Resolves an authored scene expression to its static imported module when possible. */
function resolveSceneBinding(expression, importBindings, localInitializers, seen = new Set()) {
  if (ts.isIdentifier(expression)) {
    if (seen.has(expression.text)) return undefined
    seen.add(expression.text)
    const imported = importBindings.get(expression.text)
    if (imported !== undefined && imported.exportName !== '*') {
    return imported
    }
    const initializer = localInitializers.get(expression.text)
    return initializer === undefined
      ? undefined
      : resolveSceneBinding(initializer, importBindings, localInitializers, seen)
  }
  if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
    const imported = importBindings.get(expression.expression.text)
    if (imported?.exportName === '*') {
      return { sourceFile: imported.sourceFile, exportName: expression.name.text, descriptorPath: [] }
    }
  }
  if (ts.isObjectLiteralExpression(expression)) {
    const sceneDoc = expression.properties.find((property) =>
      ts.isPropertyAssignment(property) && propertyName(property.name) === 'sceneDoc',
    )
    if (sceneDoc !== undefined && ts.isPropertyAssignment(sceneDoc)) {
      const binding = resolveSceneBinding(sceneDoc.initializer, importBindings, localInitializers, seen)
      if (binding !== undefined) return binding
    }
  }
  return undefined
}

/** Returns one static object-literal property name. */
function propertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text
  return undefined
}

/** Selects a Sighty definition from named or default module exports. */
function resolveScenarioExport(module) {
  const named = module.scenario
  if (isScenarioDefinition(named)) return { scenario: named, exportName: 'scenario' }
  if (isScenarioDefinition(module.default)) return { scenario: module.default, exportName: 'default' }
  const candidates = Object.entries(module).filter(([, value]) => isScenarioDefinition(value))
  if (candidates.length === 1) {
    const [exportName, scenario] = candidates[0]
    return { scenario, exportName }
  }
  throw new Error(candidates.length === 0
    ? 'Scenario module must export a Sighty scenario definition.'
    : 'Scenario module exports more than one Sighty scenario; export the selected one as `scenario` or default.')
}

/** Checks the minimum scenario surface needed by the package producer. */
function isScenarioDefinition(value) {
  return isRecord(value) && value.views !== undefined
}

/** Restricts the application engine artifact name to one path-safe kebab-case stem. */
function assertEngineArtifactName(value) {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value)) {
    throw new Error('Engine artifact name must be a lowercase kebab-case name without an extension.')
  }
}

/** Confirms one input module exists and uses a supported JavaScript or TypeScript extension. */
async function assertSourceFile(sourceFile, label) {
  const metadata = await lstat(sourceFile).catch((error) => {
    if (error?.code === 'ENOENT') return undefined
    throw error
  })
  if (metadata === undefined || !metadata.isFile()) throw new Error(`${label} module is not a file: ${sourceFile}`)
  const extension = path.extname(sourceFile).toLowerCase()
  if (!['.js', '.mjs', '.ts', '.mts'].includes(extension)) {
    throw new Error(`${label} module must use .js, .mjs, .ts or .mts.`)
  }
}

/** Refuses to replace an existing package directory. */
async function assertDestinationMissing(destination) {
  const existing = await lstat(destination).catch((error) => {
    if (error?.code === 'ENOENT') return undefined
    throw error
  })
  if (existing !== undefined) throw new Error(`Export destination already exists: ${destination}`)
}

/** Checks whether a scenario or scene source is a plain object. */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Runs the CLI entry point and reports failures with a non-zero process status. */
async function main() {
  try {
    const arguments_ = parseArguments(process.argv.slice(2))
    const result = await exportScenarioPackage({
      scenarioFile: arguments_.scenario,
      engineConfigFile: arguments_.engineConfig,
      engineName: arguments_.engineName,
      standalone: arguments_.standalone,
      destination: arguments_.destination,
      workingDirectory: process.env.INIT_CWD ?? process.cwd(),
    })
    process.stdout.write(`Sighty scenario exported to ${result.destination} (${result.sceneCount} scenes).\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  }
}

const invokedScript = process.argv[1]
if (invokedScript !== undefined && pathToFileURL(path.resolve(invokedScript)).href === import.meta.url) {
  await main()
}
