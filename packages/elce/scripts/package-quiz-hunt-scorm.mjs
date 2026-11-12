import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import { unzipSync } from 'fflate'
import { parseScormCliArguments } from '@codplay/sighty-scorm/cli'
import { resolveScormExportOptions } from '@codplay/sighty-scorm/options'
import { assembleScormPackage } from '@codplay/sighty-scorm/packaging'
import { createScormManifestIdentities } from './scorm-manifest-identities.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const packageRoot = resolve(scriptDirectory, '..')
const runtimeEntry = resolve(packageRoot, 'src/mods/quiz-hunt/scorm/quiz-hunt-scorm-package-runtime.ts')

/** Builds one monoSCO archive around the standalone Quiz Hunt Sighty package. */
async function main(argumentsList) {
  const inputPath = argumentsList[0]
  const outputPath = argumentsList[1]
  if (inputPath === undefined || outputPath === undefined || inputPath.startsWith('--')) {
    throw new Error('Usage : node scripts/package-quiz-hunt-scorm.mjs <parcours.sighty.zip> <sortie.zip> [options SCORM]')
  }
  const sourcePackage = new Uint8Array(await readFile(resolve(inputPath)))
  const sourceFiles = unzipSync(sourcePackage)
  const runtimeData = readQuizHuntRuntimeData(sourceFiles['quiz-hunt-runtime.json'])
  const document = runtimeData.documentData.document
  const cliOptions = parseScormCliArguments(argumentsList.slice(2))
  const resolvedOptions = resolveScormExportOptions(cliOptions, document.name)
  const options = { ...resolvedOptions, monoSco: true, onePackagePerSco: false, withSummary: false, zip: true }
  const runtimeDirectory = await mkdtemp(join(tmpdir(), 'quiz-hunt-scorm-runtime-'))
  try {
    const runtimeModule = await buildRuntimeBundle(runtimeDirectory)
    const allSco = [{ id: 'quiz-hunt-game', title: document.name, href: 'quiz-hunt.html', isVisible: true }]
    const manifestIdentity = createScormManifestIdentities(`${document.id}-quiz-hunt-scenario`, allSco)
    const artifact = assembleScormPackage({
      sightyPackage: sourcePackage,
      options,
      title: document.name,
      manifestIdentifier: manifestIdentity.manifestIdentifier,
      organizationIdentifier: manifestIdentity.organizationIdentifier,
      allSco: manifestIdentity.allSco,
      additionalFiles: {
        'quiz-hunt.html': createQuizHuntLauncherHtml(document.name, options.version),
        'runtime/elce-scorm-runtime.js': runtimeModule,
      },
    })
    if (artifact.zip === undefined) throw new Error('L’assembleur SCORM Quiz Hunt n’a produit aucune archive.')
    await writeFile(resolve(outputPath), artifact.zip)
  } finally {
    await rm(runtimeDirectory, { recursive: true, force: true })
  }
}

/** Validates the Quiz Hunt package metadata required by its browser runtime. */
function readQuizHuntRuntimeData(value) {
  if (value === undefined) throw new Error('Le paquet Sighty ne contient pas quiz-hunt-runtime.json.')
  const candidate = JSON.parse(new TextDecoder().decode(value))
  const document = candidate?.documentData?.document
  if (candidate?.schemaVersion !== 1 || typeof document?.id !== 'string'
    || typeof document?.name !== 'string' || typeof candidate.mediaSources !== 'object'
    || candidate.mediaSources === null || Array.isArray(candidate.mediaSources)
    || !Object.values(candidate.mediaSources).every((source) => typeof source === 'string')) {
    throw new Error('Les données runtime du paquet Quiz Hunt ne sont pas reconnues.')
  }
  return candidate
}

/** Builds the browser runtime bundle that starts the real Quiz Hunt player. */
async function buildRuntimeBundle(outputDirectory) {
  await build({
    configFile: resolve(packageRoot, 'vite.scorm.config.ts'),
    build: {
      outDir: outputDirectory,
      lib: {
        entry: runtimeEntry,
        formats: ['es'],
        fileName: () => 'elce-scorm-runtime.js',
      },
    },
  })
  return new Uint8Array(await readFile(join(outputDirectory, 'elce-scorm-runtime.js')))
}

/** Creates the sole SCO launcher for one complete Quiz Hunt game. */
function createQuizHuntLauncherHtml(title, version) {
  const config = escapeScriptJson({ version, packageBase: './' })
  return `<!doctype html>
<html id="scorm-document" lang="fr">
<head id="scorm-head">
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title id="scorm-title">${escapeHtml(title)}</title>
  <style id="quiz-hunt-scorm-stage-style">
    html#scorm-document, body#scorm-body { width: 100%; height: 100%; min-height: 0; margin: 0; overflow: hidden; }
    #elce-scorm-player.elce-player-stage { display: flex; width: 100%; height: 100vh; min-height: 0; overflow: hidden; box-sizing: border-box; }
  </style>
</head>
<body id="scorm-body">
  <main id="elce-scorm-player" class="elce-player-stage" style="visibility: hidden"></main>
  <div id="elce-scorm-status" role="alert" aria-live="assertive">Chargement de la partie Quiz Hunt…</div>
  <script id="pipwerks-wrapper" src="./runtime/pipwerks-scorm-api-wrapper.js"></script>
  <script id="quiz-hunt-scorm-launcher" type="module">
    const config = ${config}
    const packageBase = new URL(config.packageBase, document.baseURI)
    const root = document.querySelector('#elce-scorm-player')
    const status = document.querySelector('#elce-scorm-status')
    try {
      const [runtimeModule, runtimeResponse] = await Promise.all([
        import(new URL('runtime/elce-scorm-runtime.js', packageBase)),
        fetch(new URL('quiz-hunt-runtime.json', packageBase)),
      ])
      if (!runtimeResponse.ok) throw new Error('Les données Quiz Hunt ne sont pas disponibles.')
      await runtimeModule.startQuizHuntScormPackageRuntime({
        root,
        runtimeData: await runtimeResponse.json(),
        version: config.version,
      })
      status.textContent = ''
    } catch (error) {
      status.textContent = 'La partie Quiz Hunt SCORM n’a pas pu démarrer : ' + String(error)
      console.error(error)
    }
  </script>
</body>
</html>
`
}

/** Escapes title text for its HTML element. */
function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;')
}

/** Escapes one JSON value before embedding it in the launcher's module source. */
function escapeScriptJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026')
}

main(process.argv.slice(2)).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
