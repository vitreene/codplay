import { rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildEngineBundle } from '../../codplay/tools/engine-build/engine-builder.mjs'
import { exportScenePackage } from '../../codplay/tools/scene-export/cli.mjs'
import { buildCodPlayLibrary } from '../../codplay/tools/player-build/cli.mjs'

const demoDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(demoDirectory, '../../..')
const publicDirectory = path.join(repositoryRoot, 'packages/demos/public')
const destination = path.join(repositoryRoot, 'packages/demos/public/exports/scene-export')
const playerDirectory = path.join(publicDirectory, 'codplay-player')
const engineDirectory = path.join(publicDirectory, 'codplay-engine')

/** Exports one simultaneous Rive/Three.js scene and its scene-owned resources. */
async function buildDemoPackage() {
  const playerFile = await buildCodPlayLibrary(playerDirectory)
  const engine = await buildEngineBundle({
    engineConfigFile: path.relative(repositoryRoot, path.join(demoDirectory, 'engine-config.ts')),
    destination: path.relative(repositoryRoot, engineDirectory),
    workingDirectory: repositoryRoot,
  })
  await rm(destination, { recursive: true, force: true })
  const adapterFile = path.join(publicDirectory, '.scene-export-entry.ts')
  await writeFile(adapterFile, [
    "export { scene, styleSheet } from '../scene-export/scene.ts'",
    '',
  ].join('\n'))
  try {
    const result = await exportScenePackage({
      sceneFile: path.relative(repositoryRoot, adapterFile),
      engineConfigFile: path.relative(repositoryRoot, path.join(demoDirectory, 'engine-config.ts')),
      destination,
      workingDirectory: repositoryRoot,
    })
    process.stdout.write(`CodPlay player built at ${playerFile}.\n`)
    process.stdout.write(`Shared site engine built at ${engine.destination} (${engine.files.length} files).\n`)
    process.stdout.write(`V2 Rive + Three.js scene package built at ${result.destination}.\n`)
  } finally {
    await rm(adapterFile, { force: true })
  }
}

await buildDemoPackage()
