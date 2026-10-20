import { afterEach, describe, expect, it } from 'vitest'
import { access, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { parseArguments } from '../cli.mjs'
import { buildEngineBundle } from '../engine-builder.mjs'

const temporaryDirectories = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('CodPlay site engine build', () => {
  it('parses a config source and output directory', () => {
    expect(parseArguments(['--engine-config', './src/engine.ts', '--output', './public/engine']))
      .toEqual({ engineConfig: './src/engine.ts', output: './public/engine' })
  })

  it('bundles, externalizes and platform-resolves modules according to existing library metadata', async () => {
    const directory = await createTemporaryDirectory()
    const configFile = path.join(directory, 'engine.ts')
    const destination = path.join(directory, 'output', 'site-engine')
    await writeFile(path.join(directory, 'package-library.mjs'), 'export const marker = "PACKAGE_LIBRARY_INCLUDED"\n')
    await createLocalModule(directory, 'remote-library')
    await createLocalModule(directory, 'platform-library')
    await writeFile(configFile, [
      'export const engineCapabilities = { libraries: { register: [',
      "{ id: 'packaged', module: './package-library.mjs', delivery: { mode: 'package' }, load: () => import('./package-library.mjs') },",
      "{ id: 'remote', module: 'remote-library', delivery: { mode: 'remote', url: 'https://cdn.example/remote-library.mjs' }, load: () => import('remote-library') },",
      "{ id: 'platform', module: 'platform-library', delivery: { mode: 'platform' }, load: () => import('platform-library') },",
      '] } }',
      'export const preloadStrategies = {}',
      '',
    ].join('\n'))

    const result = await buildEngineBundle({
      engineConfigFile: configFile,
      destination,
      workingDirectory: directory,
    })

    const outputFiles = await readBundleTextFiles(destination)
    const bundleText = outputFiles.map(([, content]) => content).join('\n')
    expect(result.files, JSON.stringify(result.files)).toContain('engine.js')
    expect(result.libraries).toEqual([
      { id: 'packaged', module: './package-library.mjs', delivery: { mode: 'package' } },
      { id: 'remote', module: 'remote-library', delivery: { mode: 'remote', url: 'https://cdn.example/remote-library.mjs' } },
      { id: 'platform', module: 'platform-library', delivery: { mode: 'platform' } },
    ])
    expect(bundleText).toContain('PACKAGE_LIBRARY_INCLUDED')
    expect(bundleText).toContain('import("https://cdn.example/remote-library.mjs")')
    expect(bundleText).toContain('import("platform-library")')
    expect(bundleText).not.toContain('import("remote-library")')
    expect(bundleText).not.toMatch(/^import\s+["']https:\/\/cdn\.example\/remote-library\.mjs["']/m)
    expect(bundleText).not.toMatch(/^import\s+["']platform-library["']/m)
    expect(JSON.parse(await readFile(path.join(destination, 'engine-manifest.json'), 'utf8')).libraries)
      .toEqual(result.libraries)

    await writeFile(path.join(destination, 'old-output.txt'), 'replace after a successful build')
    await buildEngineBundle({ engineConfigFile: configFile, destination, workingDirectory: directory })
    await expect(access(path.join(destination, 'old-output.txt'))).rejects.toThrow()
  })

  it('rejects incomplete remote metadata before publishing output', async () => {
    const directory = await createTemporaryDirectory()
    const configFile = path.join(directory, 'engine.ts')
    const destination = path.join(directory, 'output', 'site-engine')
    await writeFile(configFile, [
      'export const engineCapabilities = { libraries: { register: [] } }',
      'export const preloadStrategies = {}',
      '',
    ].join('\n'))
    await buildEngineBundle({ engineConfigFile: configFile, destination, workingDirectory: directory })
    const publishedEngine = await readFile(path.join(destination, 'engine.js'), 'utf8')

    await createLocalModule(directory, 'remote-library')
    await writeFile(configFile, [
      "export const engineCapabilities = { libraries: { register: [{ id: 'remote', module: 'remote-library', delivery: { mode: 'remote' }, load: () => import('remote-library') }] } }",
      'export const preloadStrategies = {}',
      '',
    ].join('\n'))

    await expect(buildEngineBundle({ engineConfigFile: configFile, destination, workingDirectory: directory }))
      .rejects.toThrow('requires a URL')
    expect(await readFile(path.join(destination, 'engine.js'), 'utf8')).toBe(publishedEngine)
    expect(await readdir(destination)).toContain('engine-manifest.json')
  })
})

/** Creates one temporary directory owned and removed by this test file. */
async function createTemporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'codplay-engine-build-'))
  temporaryDirectories.push(directory)
  return directory
}

/** Creates a local package so Vite can inspect the config before delivery rewriting. */
async function createLocalModule(directory, name) {
  const packageDirectory = path.join(directory, 'node_modules', name)
  await mkdir(packageDirectory, { recursive: true })
  await writeFile(path.join(packageDirectory, 'package.json'), JSON.stringify({ name, type: 'module', exports: './index.js' }))
  await writeFile(path.join(packageDirectory, 'index.js'), 'export const marker = "LOCAL_EXTERNAL_FIXTURE"\n')
}

/** Reads the generated ESM bundle files as a single searchable result. */
async function readBundleTextFiles(directory, prefix = '') {
  const result = []
  for (const name of await readdir(directory)) {
    const filePath = path.join(directory, name)
    const relativePath = path.posix.join(prefix, name)
    const metadata = await stat(filePath)
    if (metadata.isDirectory()) result.push(...await readBundleTextFiles(filePath, relativePath))
    else if (name.endsWith('.js')) result.push([relativePath, await readFile(filePath, 'utf8')])
  }
  return result
}
