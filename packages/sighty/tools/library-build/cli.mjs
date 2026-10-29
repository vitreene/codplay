#!/usr/bin/env node

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'vite'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

/** Builds the reusable Sighty library as an artifact separate from scenario packages. */
export async function buildSightyLibrary(
  outputDirectory = path.join(packageRoot, 'dist'),
  { codplayImport = 'codplay' } = {},
) {
  const absoluteOutputDirectory = path.resolve(outputDirectory)
  await build({
    configFile: false,
    root: packageRoot,
    logLevel: 'error',
    build: {
      lib: {
        entry: path.join(packageRoot, 'src/index.ts'),
        formats: ['es'],
        fileName: 'sighty',
      },
      rollupOptions: {
        external: (id) => id === 'codplay' || id.startsWith('codplay/'),
        output: {
          paths: (id) => id === 'codplay' ? codplayImport : id,
        },
      },
      outDir: absoluteOutputDirectory,
      emptyOutDir: false,
      minify: true,
      target: 'es2022',
    },
  })
  return path.join(absoluteOutputDirectory, 'sighty.js')
}

/** Builds the separately distributed Sighty library at its package dist path. */
async function runSightyBuildCli() {
  const outputFile = await buildSightyLibrary()
  process.stdout.write(`Sighty browser library built at ${outputFile}.\n`)
}

const invokedScript = process.argv[1]
if (invokedScript !== undefined && pathToFileURL(path.resolve(invokedScript)).href === import.meta.url) {
  await runSightyBuildCli()
}
