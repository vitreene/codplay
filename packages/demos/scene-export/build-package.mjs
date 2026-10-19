import { rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { exportScenePackage } from '../../codplay/tools/scene-export/cli.mjs'
import { buildCodPlayLibrary } from '../../codplay/tools/player-build/cli.mjs'

const demoDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(demoDirectory, '../../..')
const publicDirectory = path.join(repositoryRoot, 'packages/demos/public')
const destination = path.join(repositoryRoot, 'packages/demos/public/exports/scene-export')
const playerDirectory = path.join(publicDirectory, 'codplay-player')

/** Exports the existing V2 preload-media scene and its own stylesheet. */
async function buildDemoPackage() {
  const playerFile = await buildCodPlayLibrary(playerDirectory)
  await rm(destination, { recursive: true, force: true })
  const adapterFile = path.join(publicDirectory, `.scene-export-${randomUUID()}.ts`)
  await writeFile(adapterFile, [
    "import { createScene } from '../src/v2/demos/preload-media/main.ts'",
    "import '../src/v2/demos/preload-media/style.css'",
    'export const scene = createScene()',
    '',
  ].join('\n'), { flag: 'wx' })
  try {
    const result = await exportScenePackage({
      sceneFile: path.relative(repositoryRoot, adapterFile),
      destination,
      workingDirectory: repositoryRoot,
    })
    process.stdout.write(`CodPlay player built at ${playerFile}.\n`)
    process.stdout.write(`V2 preload-media scene package built at ${result.destination}.\n`)
  } finally {
    await rm(adapterFile, { force: true })
  }
}

await buildDemoPackage()
