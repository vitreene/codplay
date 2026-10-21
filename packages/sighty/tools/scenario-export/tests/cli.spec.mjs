import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { spawn } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { exportScenarioPackage, parseArguments } from '../cli.mjs'

const { codplayBuildDirectories } = vi.hoisted(() => ({ codplayBuildDirectories: [] }))

vi.mock('codplay/tools/player-build/cli.mjs', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    buildCodPlayLibrary: async (...args) => {
      codplayBuildDirectories.push(args[0])
      return await original.buildCodPlayLibrary(...args)
    },
  }
})

const cliFile = fileURLToPath(new URL('../cli.mjs', import.meta.url))

const temporaryDirectories = []

beforeEach(() => {
  codplayBuildDirectories.length = 0
})

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('Sighty scenario export', () => {
  it('parses a scenario module and destination', () => {
    expect(parseArguments([
      '--scenario', './src/scenario.ts',
      '--engine-config', './src/engine.ts',
      '--export', './public/scenario',
    ])).toEqual({
      scenario: './src/scenario.ts',
      destination: './public/scenario',
      engineConfig: './src/engine.ts',
      engineName: 'engine',
      standalone: false,
    })
  })

  it('accepts a path-safe application engine name only for standalone distributions', () => {
    expect(parseArguments([
      '--scenario', './src/scenario.ts',
      '--engine-config', './src/engine.ts',
      '--standalone',
      '--engine-name', 'elce-engine',
      '--export', './public/package',
    ]).engineName).toBe('elce-engine')
    expect(() => parseArguments([
      '--scenario', './src/scenario.ts',
      '--engine-name', '../engine',
      '--export', './public/scenario',
    ])).toThrow('Engine artifact name must be a lowercase kebab-case name')
    expect(() => parseArguments([
      '--scenario', './src/scenario.ts',
      '--engine-name', 'elce-engine',
      '--export', './public/scenario',
    ])).toThrow('--engine-name requires --standalone')
  })

  it('requires an engine configuration for a standalone distribution', () => {
    expect(parseArguments([
      '--scenario', './src/scenario.ts',
      '--engine-config', './src/engine.ts',
      '--standalone',
      '--export', './public/package',
    ]).standalone).toBe(true)
    expect(() => parseArguments([
      '--scenario', './src/scenario.ts',
      '--standalone',
      '--export', './public/package',
    ])).toThrow('--standalone requires --engine-config')
  })

  it('builds one self-contained runtime envelope with a loader over the unchanged scene packages', async () => {
    const directory = await createTemporaryDirectory()
    const scenarioFile = path.join(directory, 'scenario.mjs')
    const engineConfigFile = path.join(directory, 'engine.mjs')
    const destination = path.join(directory, 'published', 'course')
    await writeFile(scenarioFile, [
      'export const scenario = {',
      "  id: 'standalone-course',",
      "  views: { start: 'main', views: { main: { view: { scene: 'intro' } } } },",
      "  scenes: {",
      "    intro: { id: 'intro', stories: { main: { id: 'main', persos: [] } } },",
      "    followup: { id: 'followup', stories: { main: { id: 'main', persos: [] } } },",
      '  },',
      '}',
      '',
    ].join('\n'))
    await writeFile(engineConfigFile, [
      "import { CodPlay } from 'codplay'",
      'export const engineCapabilities = { components: {}, modules: {}, ownerName: CodPlay.name }',
      '',
    ].join('\n'))

    const result = await exportScenarioPackage({
      scenarioFile,
      engineConfigFile,
      standalone: true,
      destination,
      workingDirectory: directory,
    })

    expect(result.sceneCount).toBe(2)
    expect(codplayBuildDirectories).toHaveLength(1)
    const distribution = JSON.parse(await readFile(path.join(destination, 'distribution-manifest.json'), 'utf8'))
    expect(distribution).toEqual({
      format: 'sighty.application-package.v1',
      entry: 'loader.mjs',
      scenario: 'export-manifest.json',
      runtime: {
        codplay: 'runtime/codplay.js',
        sighty: 'runtime/sighty.js',
        engine: 'runtime/engine.js',
      },
    })
    const runtimeFiles = await readdir(path.join(destination, 'runtime'))
    expect(runtimeFiles).toEqual(['codplay.js', 'engine-manifest.json', 'engine.js', 'sighty.js'])
    const sightyBundle = await readFile(path.join(destination, 'runtime/sighty.js'), 'utf8')
    const engineBundle = await readFile(path.join(destination, 'runtime/engine.js'), 'utf8')
    expect(sightyBundle).toMatch(/from\s*["']\.\/codplay\.js["']/)
    expect(engineBundle).toMatch(/from\s*["']\.\/codplay\.js["']/)
    expect((await readFile(path.join(destination, 'loader.mjs'), 'utf8'))).toContain('owner.load(packagePath, { root })')

    const scenarioManifest = JSON.parse(await readFile(path.join(destination, 'export-manifest.json'), 'utf8'))
    for (const scenePath of Object.values(scenarioManifest.scenes)) {
      const childPackageRoot = path.join(destination, scenePath)
      await expect(access(path.join(childPackageRoot, 'runtime', 'codplay.js'))).rejects.toThrow()
      await expect(access(path.join(childPackageRoot, 'codplay.js'))).rejects.toThrow()
    }
  }, 180_000)

  it('keeps compiled scenes in intact CodPlay packages and publishes only the compact scenario graph', async () => {
    const directory = await createTemporaryDirectory()
    const sourceDirectory = path.join(directory, 'source')
    const sceneDirectory = path.join(sourceDirectory, 'scenes')
    const destination = path.join(directory, 'published', 'course')
    await mkdir(sceneDirectory, { recursive: true })
    await mkdir(path.join(sceneDirectory, 'assets'), { recursive: true })
    await writeFile(path.join(sceneDirectory, 'assets', 'first.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><title>first</title></svg>')
    await writeFile(path.join(sceneDirectory, 'first.ts'), [
      "const sceneConstructionSentinel = 'scene-source-not-shipped'",
      'export const firstScene = {',
      "  id: 'first-scene',",
      "  stories: { main: { id: 'main', persos: [{ id: 'image', type: 'img', initial: { src: './assets/first.svg' }, actions: {} }] } },",
      '  unused: sceneConstructionSentinel,',
      '}',
      '',
    ].join('\n'))
    await writeFile(path.join(sceneDirectory, 'second.ts'), [
      'export const secondScene = {',
      "  id: 'second-scene',",
      '  stories: { main: { id: \'main\', persos: [] } },',
      '}',
      '',
    ].join('\n'))
    await writeFile(path.join(sourceDirectory, 'helper.ts'), [
      "export const mark = () => 'from-bundled-helper'",
      "export const unused = () => 'unused-scenario-callback-sentinel'",
      '',
    ].join('\n'))
    await writeFile(path.join(sourceDirectory, 'scenario-functions.ts'), [
      "import { mark as markHelper } from './helper'",
      'export async function mark({ context }) { return { ...context, loaded: markHelper() } }',
      "export function reset(keys) { return keys.includes('quiz') ? { name: 'scenario:reset', data: { keys: [...keys] } } : undefined }",
      'export function unused() { return markHelper() }',
      '',
    ].join('\n'))
    const scenarioFile = path.join(sourceDirectory, 'scenario.ts')
    await writeFile(scenarioFile, [
      "import { firstScene as layoutScene } from './scenes/first'",
      "import { secondScene } from './scenes/second'",
      "import { mark, reset } from './scenario-functions'",
      "export * as scenarioFunctions from './scenario-functions'",
      'export const scenario = {',
      "  format: 'sighty',",
      "  version: 1,",
      "  id: 'standalone-course',",
      "  views: { start: 'main', views: { main: { actions: { 'scenario:mark': { action: 'action:course:mark' } }, view: { scene: 'layout' } } } },",
      "  scenes: { layout: { sceneDoc: layoutScene, styleSheet: '.package-layout { color: red; }', onReset: reset }, secondScene },",
      "  actions: { 'action:course:mark': mark },",
      '}',
      '',
    ].join('\n'))

    const result = await exportScenarioPackage({
      scenarioFile,
      destination,
      workingDirectory: directory,
    })
    expect(result.sceneCount).toBe(2)
    expect(codplayBuildDirectories).toHaveLength(1)

    const manifest = JSON.parse(await readFile(path.join(destination, 'export-manifest.json'), 'utf8'))
    expect(manifest).toEqual({
      format: 'sighty.scenario-package.v2',
      scenario: 'scenario.mjs',
      scenes: { layout: 'scenes/scene-0/', secondScene: 'scenes/scene-1/' },
    })
    expect(await readdir(destination)).toEqual(['export-manifest.json', 'scenario.mjs', 'scenes'])
    await expect(access(path.join(destination, 'sighty.js'))).rejects.toThrow()
    await expect(access(path.join(destination, 'codplay.js'))).rejects.toThrow()

    const firstManifest = JSON.parse(await readFile(path.join(destination, manifest.scenes.layout, 'export-manifest.json'), 'utf8'))
    const firstScene = JSON.parse(await readFile(path.join(destination, manifest.scenes.layout, firstManifest.scene), 'utf8'))
    expect(firstManifest.format).toBe('codplay.scene-package.v1')
    expect(firstManifest.resources).toHaveLength(1)
    expect(firstManifest.styleSheet.file).toBe('scene/style.css')
    expect(await readFile(path.join(destination, manifest.scenes.layout, firstManifest.styleSheet.file), 'utf8'))
      .toContain('.package-layout { color: red; }')
    expect(firstScene.scene.stories.main.persos[0].initial.src).toBe(firstManifest.resources[0].sceneUrl)
    expect(await readFile(path.join(destination, manifest.scenes.layout, firstManifest.resources[0].file), 'utf8'))
      .toContain('<title>first</title>')

    const compactScenarioSource = await readFile(path.join(destination, manifest.scenario), 'utf8')
    expect(compactScenarioSource.length).toBeGreaterThan(100)
    expect(compactScenarioSource).not.toContain('scene-source-not-shipped')
    expect(compactScenarioSource).not.toContain('first-scene')
    expect(compactScenarioSource).not.toContain('second-scene')
    expect(compactScenarioSource).not.toContain('package-layout')
    expect(compactScenarioSource).not.toContain('unused-scenario-callback-sentinel')
    expect(compactScenarioSource).toContain('from-bundled-helper')

    await rm(sourceDirectory, { recursive: true, force: true })
    const scenarioFileFromPackage = path.join(destination, manifest.scenario)
    const verifyFile = path.join(directory, 'verify-package.mjs')
    await writeFile(verifyFile, [
      `import * as module from ${JSON.stringify(pathToFileURL(scenarioFileFromPackage).href)}`,
      'process.stdout.write(JSON.stringify({',
      '  id: module.scenario.id,',
      "  action: await module.scenario.actions['action:course:mark']({ context: {} }),",
      "  reset: module.scenario.scenes.layout.onReset(['quiz']),",
      '  sceneKeys: Object.keys(module.scenario.scenes),',
      '}))',
      '',
    ].join('\n'))
    const verification = await runNodeFile(verifyFile)
    expect(verification.exitCode).toBe(0)
    expect(JSON.parse(verification.stdout)).toEqual({
      id: 'standalone-course',
      action: { loaded: 'from-bundled-helper' },
      reset: { name: 'scenario:reset', data: { keys: ['quiz'] } },
      sceneKeys: ['layout', 'secondScene'],
    })
  })

  it('rejects compact scenario callbacks that are not exported from scenarioFunctions', async () => {
    const directory = await createTemporaryDirectory()
    const scenarioFile = path.join(directory, 'scenario.mjs')
    const destination = path.join(directory, 'published-course')
    await writeFile(scenarioFile, [
      'const handler = () => undefined',
      'export const scenario = {',
      "  views: { start: 'main', views: { main: { actions: { run: { action: 'action:course:run' } }, view: { scene: 'layout' } } } },",
      "  scenes: { layout: { id: 'layout', stories: { main: { id: 'main', persos: [] } } } },",
      "  actions: { 'action:course:run': handler },",
      '}',
      '',
    ].join('\n'))

    await expect(exportScenarioPackage({
      scenarioFile,
      destination,
      workingDirectory: directory,
    })).rejects.toThrow('SIGHTY_EXPORT_FUNCTION_REFERENCE_UNSUPPORTED')
    await expect(access(destination)).rejects.toThrow()
  })

  it('rejects a lazy source without invoking its producer or publishing a package', async () => {
    const directory = await createTemporaryDirectory()
    const scenarioFile = path.join(directory, 'scenario.mjs')
    const destination = path.join(directory, 'published-course')
    await writeFile(scenarioFile, [
      'let calls = 0',
      'export const scenario = {',
      "  views: { start: 'main', views: { main: { view: { scene: 'lazy' } } } },",
      '  sceneSources: { lazy: () => { calls += 1; return {} } },',
      '}',
      'export const getCalls = () => calls',
      '',
    ].join('\n'))

    const result = await runScenarioExport(scenarioFile, destination, directory)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Lazy Sighty scene source is not supported by export: sceneSources.lazy.')

    const sourceModule = await import(pathToFileURL(scenarioFile).href)
    expect(sourceModule.getCalls()).toBe(0)
    await expect(access(destination)).rejects.toThrow()
  })
})

/** Creates and retains one temporary directory for a test. */
async function createTemporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sighty-export-'))
  temporaryDirectories.push(directory)
  return directory
}

/** Runs the public Sighty export command with paths rooted in one test fixture. */
async function runScenarioExport(scenarioFile, destination, workingDirectory, extraArguments = []) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      cliFile,
      '--scenario', scenarioFile,
      '--export', destination,
      ...extraArguments,
    ], { cwd: workingDirectory, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })
    child.once('error', reject)
    child.once('close', (exitCode) => resolve({ exitCode, stdout, stderr }))
  })
}

/** Runs one generated Node verifier without importing its file through Vitest's module loader. */
async function runNodeFile(scriptFile) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptFile], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk })
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk })
    child.once('error', reject)
    child.once('close', (exitCode) => resolve({ exitCode, stdout, stderr }))
  })
}
