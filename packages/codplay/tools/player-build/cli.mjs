#!/usr/bin/env node

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** Builds the reusable CodPlay browser library into a directory outside scene packages. */
export async function buildCodPlayLibrary(outputDirectory) {
  const absoluteOutputDirectory = path.resolve(outputDirectory)
  await build({
    configFile: path.join(packageRoot, 'vite.config.ts'),
    root: packageRoot,
    logLevel: 'error',
    build: {
      lib: {
        entry: path.join(packageRoot, 'src/index.ts'),
        formats: ['es'],
        fileName: 'codplay',
      },
      outDir: absoluteOutputDirectory,
      emptyOutDir: false,
      minify: true,
      target: 'es2022',
    },
  })
  return path.join(absoluteOutputDirectory, 'codplay.js')
}

/** Builds the separately distributed player at the package's default dist path. */
async function runPlayerBuildCli() {
  const outputFile = await buildCodPlayLibrary(path.join(packageRoot, 'dist'))
  process.stdout.write(`CodPlay browser player built at ${outputFile}.\n`)
}

const invokedScript = process.argv[1]
if (invokedScript !== undefined && pathToFileURL(path.resolve(invokedScript)).href === import.meta.url) {
  await runPlayerBuildCli()
}
