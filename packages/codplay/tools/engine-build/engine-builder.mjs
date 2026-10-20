import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** Builds the site's shared engine integration separately from the player and scene packages. */
export async function buildEngineBundle({ engineConfigFile, destination, workingDirectory = process.cwd() }) {
  const absoluteConfigFile = path.resolve(workingDirectory, engineConfigFile)
  const absoluteDestination = path.resolve(workingDirectory, destination)
  await assertSourceFile(absoluteConfigFile)
  await mkdir(path.dirname(absoluteDestination), { recursive: true })

  const stageDirectory = await mkdtemp(path.join(path.dirname(absoluteDestination), `.${path.basename(absoluteDestination)}.codplay-`))
  let backupDirectory
  try {
    const configDirectory = path.join(stageDirectory, '.config')
    const configFile = await bundleEngineConfig(absoluteConfigFile, configDirectory)
    const configModule = await import(pathToFileURL(configFile).href)
    const engineCapabilities = configModule.engineCapabilities
    const preloadStrategies = configModule.preloadStrategies ?? {}
    const deliveries = readLibraryDeliveries(engineCapabilities)
    await rm(configDirectory, { recursive: true, force: true })

    const bundleDirectory = path.join(stageDirectory, 'bundle')
    await bundleForBrowser(absoluteConfigFile, workingDirectory, bundleDirectory, deliveries)
    await writeFile(path.join(bundleDirectory, 'engine-manifest.json'), JSON.stringify({
      format: 'codplay.site-engine.v1',
      entry: 'engine.js',
      libraries: deliveries.map(({ id, module, delivery }) => ({ id, module, delivery })),
    }, null, 2))

    backupDirectory = await moveExistingDestination(absoluteDestination)
    await rename(bundleDirectory, absoluteDestination)
    await rm(stageDirectory, { recursive: true, force: true })
    if (backupDirectory !== undefined) await rm(backupDirectory, { recursive: true, force: true })
    return {
      destination: absoluteDestination,
      engineCapabilities,
      preloadStrategies,
      libraries: deliveries.map(({ id, module, delivery }) => ({ id, module, delivery })),
      files: await listFiles(absoluteDestination),
    }
  } catch (error) {
    await rm(stageDirectory, { recursive: true, force: true })
    if (backupDirectory !== undefined) {
      const currentDestination = await lstat(absoluteDestination).catch(() => undefined)
      if (currentDestination === undefined) await rename(backupDirectory, absoluteDestination)
    }
    throw error
  }
}

/** Bundles one engine configuration to a temporary ESM module for metadata validation. */
async function bundleEngineConfig(engineConfigFile, outputDirectory) {
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
      outDir: outputDirectory,
      emptyOutDir: true,
      target: 'node24',
    },
  })
  return path.join(outputDirectory, 'engine.mjs')
}

/** Bundles the engine for browsers while keeping the player and selected dependencies external. */
async function bundleForBrowser(engineConfigFile, workingDirectory, outputDirectory, deliveries) {
  const deliveryByModule = new Map(deliveries.map((item) => [item.module, item.delivery]))
  const externalModules = new Set([...deliveryByModule]
    .filter(([, delivery]) => delivery.mode === 'remote' || delivery.mode === 'platform')
    .map(([module]) => module))
  await build({
    configFile: false,
    root: workingDirectory,
    logLevel: 'error',
    build: {
      lib: {
        entry: engineConfigFile,
        formats: ['es'],
        fileName: 'engine',
      },
      outDir: outputDirectory,
      emptyOutDir: true,
      minify: true,
      target: 'es2022',
      rollupOptions: {
        external: (id) => id === 'codplay' || externalModules.has(id),
        treeshake: {
          moduleSideEffects: (id, external) => !(external && externalModules.has(id)),
        },
        output: {
          entryFileNames: 'engine.js',
          chunkFileNames: '[name]-[hash].js',
          paths: (id) => {
            const delivery = deliveryByModule.get(id)
            return delivery?.mode === 'remote' ? delivery.url : id
          },
        },
      },
    },
  })
}

/** Validates metadata attached to the existing engine library entries. */
function readLibraryDeliveries(engineCapabilities) {
  if (!isRecord(engineCapabilities)) throw new Error('Engine configuration must export an engineCapabilities object.')
  const group = engineCapabilities.libraries
  const definitions = [
    ...(Array.isArray(group?.register) ? group.register : []),
    ...(Array.isArray(group?.override) ? group.override : []),
  ]
  const modules = new Map()
  const deliveries = []
  for (const definition of definitions) {
    if (!isRecord(definition)
      || typeof definition.id !== 'string'
      || definition.id.length === 0
      || typeof definition.module !== 'string'
      || definition.module.trim().length === 0
      || !isRecord(definition.delivery)) {
      throw new Error('Every engine library entry must declare id, module and delivery metadata.')
    }
    const { delivery } = definition
    if (delivery.mode === 'package') {
      if ('url' in delivery) throw new Error(`Package delivery for library "${definition.id}" must not declare a URL.`)
    } else if (delivery.mode === 'platform') {
      if ('url' in delivery) throw new Error(`Platform delivery for library "${definition.id}" must not declare a URL.`)
    } else if (delivery.mode === 'remote') {
      if (typeof delivery.url !== 'string') throw new Error(`Remote delivery for library "${definition.id}" requires a URL.`)
      let remoteUrl
      try {
        remoteUrl = new URL(delivery.url)
      } catch {
        throw new Error(`Remote delivery for library "${definition.id}" requires an absolute HTTP(S) URL.`)
      }
      if (remoteUrl.protocol !== 'https:' && remoteUrl.protocol !== 'http:') {
        throw new Error(`Remote delivery for library "${definition.id}" requires an absolute HTTP(S) URL.`)
      }
    } else {
      throw new Error(`Library "${definition.id}" has an unsupported delivery mode.`)
    }

    const previous = modules.get(definition.module)
    if (previous !== undefined
      && (previous.mode !== delivery.mode || previous.url !== delivery.url)) {
      throw new Error(`Module "${definition.module}" has conflicting delivery metadata in the shared engine.`)
    }
    modules.set(definition.module, delivery)
    deliveries.push({ id: definition.id, module: definition.module, delivery })
  }
  return deliveries
}

/** Moves an existing output aside so a failed replacement can restore it. */
async function moveExistingDestination(destination) {
  const existing = await lstat(destination).catch((error) => {
    if (error?.code === 'ENOENT') return undefined
    throw error
  })
  if (existing === undefined) return undefined
  const backupDirectory = await mkdtemp(path.join(path.dirname(destination), `.${path.basename(destination)}.backup-`))
  await rm(backupDirectory, { recursive: true, force: true })
  await rename(destination, backupDirectory)
  return backupDirectory
}

/** Confirms that the engine configuration is a supported source file. */
async function assertSourceFile(filePath) {
  const metadata = await lstat(filePath).catch((error) => {
    if (error?.code === 'ENOENT') return undefined
    throw error
  })
  if (metadata === undefined || !metadata.isFile()) throw new Error(`Engine configuration is not a file: ${filePath}`)
  if (!['.js', '.mjs', '.ts', '.mts'].includes(path.extname(filePath).toLowerCase())) {
    throw new Error('Engine configuration must use .js, .mjs, .ts or .mts.')
  }
}

/** Returns a stable relative file list for the published engine bundle. */
async function listFiles(directory, prefix = '') {
  const result = []
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = path.posix.join(prefix, entry.name)
    if (entry.isDirectory()) result.push(...await listFiles(path.join(directory, entry.name), relativePath))
    else result.push(relativePath)
  }
  return result
}

/** Checks whether a config value is a plain object. */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
