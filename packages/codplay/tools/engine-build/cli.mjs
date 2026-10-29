#!/usr/bin/env node

import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildEngineBundle } from './engine-builder.mjs'

/** Parses the source engine configuration and output directory arguments. */
export function parseArguments(args) {
  const options = new Map()
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index]
    if (name !== '--engine-config' && name !== '--output') throw new Error(`Unknown option: ${name}`)
    const value = args[index + 1]
    if (value === undefined || value.startsWith('--')) throw new Error(`${name} requires a path.`)
    if (options.has(name)) throw new Error(`${name} may be supplied only once.`)
    options.set(name, value)
    index += 1
  }
  const engineConfig = options.get('--engine-config')
  const output = options.get('--output')
  if (engineConfig === undefined || output === undefined) {
    throw new Error('Usage: codplay build:engine --engine-config <engine.js|engine.ts> --output <directory>')
  }
  return { engineConfig, output }
}

/** Runs the engine bundle command from the current project directory. */
async function runCli() {
  try {
    const options = parseArguments(process.argv.slice(2))
    const workingDirectory = process.env.INIT_CWD ?? process.cwd()
    const result = await buildEngineBundle({
      engineConfigFile: options.engineConfig,
      destination: options.output,
      workingDirectory,
    })
    process.stdout.write(`CodPlay site engine built at ${result.destination} (${result.files.length} files).\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}

const invokedScript = process.argv[1]
if (invokedScript !== undefined && pathToFileURL(path.resolve(invokedScript)).href === import.meta.url) {
  await runCli()
}
