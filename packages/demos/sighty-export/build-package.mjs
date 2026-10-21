import { readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { exportScenarioPackage } from '../../sighty/tools/scenario-export/cli.mjs'

const demoDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(demoDirectory, '../../..')
const publicDirectory = path.join(repositoryRoot, 'packages/demos/public')
const packageDestination = path.join(publicDirectory, 'exports/sighty-demo5')
const legacySightyPlayerDirectory = path.join(publicDirectory, 'sighty-player')
const legacyEngineDirectory = path.join(publicDirectory, 'sighty-engine')
const scenarioAdapterFile = path.join(publicDirectory, '.sighty-demo5-export-entry.ts')
const scenarioSourceFile = path.join(repositoryRoot, 'packages/demos/src/sighty/demo5/scenario.ts')
const engineConfigFile = path.join(repositoryRoot, 'packages/demos/src/sighty/demo5/engine-config.ts')

/** Produces the standalone Sighty package used by the Demo 5 browser fixture. */
async function buildSightyDemo5Package() {
  await rm(packageDestination, { recursive: true, force: true })
  await rm(legacySightyPlayerDirectory, { recursive: true, force: true })
  await rm(legacyEngineDirectory, { recursive: true, force: true })

  const styleSheet = await readFile(path.join(path.dirname(scenarioSourceFile), 'style.css'), 'utf8')
  await writeFile(scenarioAdapterFile, createScenarioAdapter(styleSheet))
  try {
    const scenarioPackage = await exportScenarioPackage({
      scenarioFile: path.relative(repositoryRoot, scenarioAdapterFile),
      engineConfigFile: path.relative(repositoryRoot, engineConfigFile),
      standalone: true,
      destination: path.relative(repositoryRoot, packageDestination),
      workingDirectory: repositoryRoot,
    })
    process.stdout.write(`Sighty Demo 5 package built at ${scenarioPackage.destination} (${scenarioPackage.sceneCount} scenes).\n`)
  } finally {
    await rm(scenarioAdapterFile, { force: true })
  }
}

/** Wraps the existing Demo 5 scenario and carries its authored CSS in each CodPlay scene package. */
function createScenarioAdapter(styleSheet) {
  return [
    "import { createCourseScenario } from '../src/sighty/demo5/scenario.ts'",
    "export * as scenarioFunctions from '../src/sighty/demo5/scenario-functions.ts'",
    "export * as sceneFunctions from '../src/sighty/demo5/scene-functions.ts'",
    `const styleSheet = ${JSON.stringify(styleSheet)}`,
    'const authoredScenario = createCourseScenario()',
    'const scenes = Object.fromEntries(Object.entries(authoredScenario.scenes ?? {}).map(([sceneKey, source]) => [',
    '  sceneKey,',
    "  source !== null && typeof source === 'object' && 'sceneDoc' in source",
    '    ? { ...source, styleSheet }',
    '    : { sceneDoc: source, styleSheet },',
    ']))',
    'export const scenario = { ...authoredScenario, scenes }',
    '',
  ].join('\n')
}

await buildSightyDemo5Package()
