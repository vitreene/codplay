import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'
import { unzipSync } from 'fflate'
import { parseScormCliArguments } from '@codplay/sighty-scorm/cli'
import { resolveScormExportOptions } from '@codplay/sighty-scorm/options'
import { assembleScormPackage } from '@codplay/sighty-scorm/packaging'
import { createScormManifestIdentities } from './scorm-manifest-identities.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(scriptDirectory, '..')

/** Builds SCORM packages around the existing Sighty archive passed as the first argument. */
async function main(argumentsList) {
  const inputArgument = argumentsList[0]
  if (inputArgument === undefined || inputArgument.startsWith('--')) {
    throw new Error('Usage : npm run package-scorm -- <parcours.sighty.zip> [options SCORM de la CLI source]')
  }
  const inputPath = resolve(inputArgument)
  const sourcePackage = new Uint8Array(await readFile(inputPath))
  const sourceFiles = unzipSync(sourcePackage)
  const scenario = await loadPackagedScenario(sourceFiles['scenario.mjs'])
  const defaultTitle = typeof scenario.id === 'string' ? scenario.id : 'Formation Elcé'
  const runtimeDirectory = await mkdtemp(join(tmpdir(), 'elce-scorm-runtime-'))
  try {
    const cliOptions = parseScormCliArguments(argumentsList.slice(1))
    const options = resolveScormExportOptions(cliOptions, defaultTitle)
    if (options.version === '2004v4' && options.withSummary && !options.monoSco) {
      throw new Error('Le manifeste 2004v4 avec sommaire en SCO séparés échoue encore à la validation XSD source ; le plan demande de réconcilier cette branche avant assemblage.')
    }
    const runtimeModule = await buildRuntimeBundle(runtimeDirectory)
    const packageData = readScenarioData(scenario.data)
    const chapters = Object.values(packageData.chapters)
    const allSco = createScoEntries(chapters, options)
    const packageGroups = options.onePackagePerSco
      ? allSco.filter((sco) => sco.href !== null).map((sco) => [sco])
      : [allSco]
    const manifestIdentity = createScormManifestIdentities(scenario.id, allSco)
    const outputDirectory = join(dirname(inputPath), '-=scorm_packages=-')
    const generatedNames = []

    for (const [index, packageSco] of packageGroups.entries()) {
      const packageName = options.packageName ?? `standard_${slugify(defaultTitle)}_${options.language}_scorm${cleanVersion(options.sourceVersion)}`
      const finalName = `${options.onePackagePerSco ? `${String(index + 1).padStart(2, '0')}_` : ''}${packageName}${options.monoSco ? '_monosco' : ''}`
      assertSafePackageName(finalName)
      const packageFiles = createPackageFiles({
        packageSco,
        allSco,
        packageData,
        title: options.title ?? defaultTitle,
        version: options.version,
        monoSco: options.monoSco,
        language: options.language,
        absolutePath: options.absolutePath,
        runtimeModule,
        chapterScoIdentifiers: Object.fromEntries(packageSco.flatMap((sco) => {
          const identified = manifestIdentity.allSco.find((candidate) => candidate.id === sco.id)
          return identified !== undefined && packageData.chapters[sco.id] !== undefined && identified.href !== null
            ? [[sco.id, identified.identifier]]
            : []
        })),
      })
      const artifact = assembleScormPackage({
        sightyPackage: sourcePackage,
        options,
        title: options.title ?? defaultTitle,
        manifestIdentifier: manifestIdentity.manifestIdentifier,
        organizationIdentifier: manifestIdentity.organizationIdentifier,
        allSco: packageSco.map((sco) => manifestIdentity.allSco.find((identified) => identified.id === sco.id) ?? sco),
        additionalFiles: packageFiles,
      })
      const packageDirectory = join(outputDirectory, finalName)
      await writePackageDirectory(packageDirectory, artifact.files)
      let zipPath
      if (artifact.zip !== undefined) {
        const date = new Date().toISOString().slice(0, 10)
        zipPath = join(outputDirectory, `${finalName}_${date}.zip`)
        await writeNewFile(zipPath, artifact.zip)
      }
      generatedNames.push({ packageDirectory, zipPath })
    }

    return generatedNames
  } finally {
    await rm(runtimeDirectory, { recursive: true, force: true })
  }
}

/** Loads the bundled Sighty scenario module from the source archive without extracting its scenes. */
async function loadPackagedScenario(scenarioSource) {
  if (scenarioSource === undefined) throw new Error('Le paquet Sighty ne contient pas scenario.mjs.')
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'elce-sighty-scenario-'))
  const scenarioPath = join(temporaryDirectory, 'scenario.mjs')
  try {
    await writeFile(scenarioPath, scenarioSource)
    const scenarioModule = await import(`${pathToFileURL(scenarioPath).href}?load=${Date.now()}`)
    const scenario = scenarioModule.scenario ?? scenarioModule.default
    if (typeof scenario !== 'object' || scenario === null) throw new Error('Le module scenario.mjs ne déclare pas de scénario Sighty.')
    return scenario
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

/** Builds the small application adapter bundle that runs inside the exported SCO. */
async function buildRuntimeBundle(outputDirectory) {
  await build({
    configFile: resolve(packageRoot, 'vite.scorm.config.ts'),
    build: { outDir: outputDirectory },
  })
  return new Uint8Array(await readFile(join(outputDirectory, 'elce-scorm-runtime.js')))
}

/** Validates the compact runtime fields required to name SCORM learning objects. */
function readScenarioData(value) {
  if (typeof value !== 'object' || value === null
    || !Array.isArray(value.pageIds)
    || typeof value.previewStartPageId !== 'string'
    || typeof value.chapters !== 'object' || value.chapters === null) {
    throw new Error('Le scénario Sighty ne contient pas les données runtime Elcé attendues.')
  }
  const chapters = Object.values(value.chapters)
  if (!chapters.every((chapter) => typeof chapter === 'object'
    && chapter !== null
    && typeof chapter.name === 'string'
    && chapter.name.trim().length > 0)) {
    throw new Error('Le scénario Sighty ne contient pas le nom auteur de chaque chapitre.')
  }
  return value
}

/** Maps the resolved source CLI branches to chapter and summary manifest items. */
function createScoEntries(chapters, options) {
  const chapterSco = chapters
    .filter((chapter) => !(options.withSummary && options.needSummary && !options.monoSco && chapter.type === 'evaluation'))
    .map((chapter) => ({
      id: chapter.id,
      title: chapter.name,
      href: options.monoSco && options.withSummary ? null : `${chapter.id}.html`,
      isVisible: !options.withSummary,
      ...(chapter.type === 'evaluation' ? { masteryScore: options.masteryScore } : {}),
    }))
  if (!options.withSummary) return chapterSco
  return [
    { id: 'summary', title: 'Accueil', href: 'sommaire.html', isVisible: true, masteryScore: options.masteryScore },
    ...chapterSco,
  ]
}

/** Creates the LMS launch page and the Elcé runtime asset for one package group. */
function createPackageFiles(input) {
  const files = {}
  if (input.absolutePath.length === 0) files['runtime/elce-scorm-runtime.js'] = input.runtimeModule
  for (const sco of input.packageSco) {
    if (sco.href === null) continue
    const chapter = input.packageData.chapters[sco.id]
    const initialPageId = chapter?.pageIds[0] ?? input.packageData.previewStartPageId
    files[sco.href] = createLauncherHtml({
      title: `${input.title} - ${sco.title}`,
      version: input.version,
      monoSco: input.monoSco,
      language: input.language,
      absolutePath: input.absolutePath,
      chapterScoIdentifiers: input.chapterScoIdentifiers,
      initialPageId: sco.id === 'summary' ? input.packageData.previewStartPageId : initialPageId,
      chapterId: chapter?.id,
    })
  }
  return files
}

/** Writes a launcher that loads the existing Sighty package and its Elcé adapter. */
function createLauncherHtml(input) {
  const packageBase = input.absolutePath.length === 0 ? './' : input.absolutePath
  const escapedTitle = escapeHtml(input.title)
  const config = escapeScriptJson({
    version: input.version,
    monoSco: input.monoSco,
    initialPageId: input.initialPageId,
    ...(input.chapterId === undefined ? {} : { chapterId: input.chapterId }),
    chapterScoIdentifiers: input.chapterScoIdentifiers,
    packageBase,
  })
  const wrapperPath = escapeHtml(`${packageBase}runtime/pipwerks-scorm-api-wrapper.js`)
  return `<!doctype html>
<html id="scorm-document" lang="${escapeHtml(input.language)}">
<head id="scorm-head">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title id="scorm-title">${escapedTitle}</title>
  <style id="elce-scorm-stage-style">
    html#scorm-document, body#scorm-body {
      width: 100%;
      height: 100%;
      min-height: 0;
      margin: 0;
      overflow: hidden;
    }
    #elce-scorm-player.elce-player-stage {
      display: flex;
      width: 100%;
      height: 100vh;
      min-height: 0;
      overflow: hidden;
      box-sizing: border-box;
    }
  </style>
</head>
<body id="scorm-body">
  <main id="elce-scorm-player" class="elce-player-stage" style="visibility: hidden"></main>
  <div id="elce-scorm-status" role="alert" aria-live="assertive">Chargement du parcours…</div>
  <script id="pipwerks-wrapper" src="${wrapperPath}"></script>
  <script id="elce-scorm-launcher" type="module">
    const config = ${config}
    const packageBase = new URL(config.packageBase, document.baseURI)
    const root = document.querySelector('#elce-scorm-player')
    const status = document.querySelector('#elce-scorm-status')
    try {
      const [loaderModule, runtimeModule, scenarioModule] = await Promise.all([
        import(new URL('loader.mjs', packageBase)),
        import(new URL('runtime/elce-scorm-runtime.js', packageBase)),
        import(new URL('scenario.mjs', packageBase)),
      ])
      const scenario = scenarioModule.scenario ?? scenarioModule.default
      await runtimeModule.startElceScormPackageRuntime({
        root,
        scenario,
        loadSightyPackage: loaderModule.loadSightyPackage,
        version: config.version,
        monoSco: config.monoSco,
        chapterId: config.chapterId,
        initialPageId: config.initialPageId,
      })
      status.textContent = ''
    } catch (error) {
      status.textContent = 'Le parcours SCORM n’a pas pu démarrer : ' + String(error)
      console.error(error)
    }
  </script>
</body>
</html>
`
}

/** Writes the package tree without replacing an existing package. */
async function writePackageDirectory(directory, files) {
  await mkdir(directory, { recursive: true })
  if ((await readdir(directory)).length > 0) throw new Error(`Le dossier SCORM existe déjà et n’est pas vide : ${directory}`)
  for (const [path, contents] of Object.entries(files)) {
    const destination = join(directory, ...path.split('/'))
    await mkdir(dirname(destination), { recursive: true })
    await writeFile(destination, contents)
  }
}

/** Creates one archive without replacing an earlier package with the same name. */
async function writeNewFile(path, contents) {
  try {
    await writeFile(path, contents, { flag: 'wx' })
  } catch (error) {
    if (error?.code === 'EEXIST') throw new Error(`L’archive SCORM existe déjà : ${path}`)
    throw error
  }
}

/** Rejects package names that could escape the selected output directory. */
function assertSafePackageName(value) {
  if (basename(value) !== value || value.includes('..') || value.includes('/') || value.includes('\\')) {
    throw new Error(`Nom de package SCORM invalide : ${value}`)
  }
}

/** Reproduces the reference package-name normalization for a title. */
function slugify(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s/g, '').toLowerCase()
}

/** Removes punctuation from the version token in the generated package name. */
function cleanVersion(value) {
  return value.replace(/[^a-zA-Z\d\s]/g, '').replace(/\s/g, '')
}

/** Escapes text inserted into HTML markup. */
function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

/** Prevents a user-controlled path from ending an inline module script element. */
function escapeScriptJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026')
}

try {
  const generated = await main(process.argv.slice(2))
  for (const result of generated) {
    console.log(`Dossier SCORM : ${result.packageDirectory}`)
    if (result.zipPath !== undefined) console.log(`Archive SCORM : ${result.zipPath}`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
