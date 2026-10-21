import { afterEach, describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { exportScenePackage, parseArguments } from '../cli.mjs'

const temporaryDirectories = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('scene export command', () => {
  it('parses the scene source and destination', () => {
    expect(parseArguments([
      '--scene', './src/scene.ts',
      '--engine-config', './src/engine.ts',
      '--export', './public/scene',
    ])).toEqual({
      scene: './src/scene.ts',
      destination: './public/scene',
      engineConfig: './src/engine.ts',
    })
  })

  it('captures imported CSS and publishes its transitive local resources', async () => {
    const directory = await createTemporaryDirectory()
    const sceneFile = path.join(directory, 'scene.ts')
    const destination = path.join(directory, 'exported-scene')
    await writeFile(sceneFile, [
      "import './scene.css'",
      "import './following.css'",
      "export const scene = { id: 'css-import-scene', stories: { main: { id: 'main', persos: [] } } }",
      "export const styleSheet = '.cp-named { color: red }'",
      '',
    ].join('\n'))
    await writeFile(path.join(directory, 'scene.css'), '@import "./theme.css" layer(theme);\n.cp-imported { background-image: url("./pixel.svg") }\n')
    await writeFile(path.join(directory, 'following.css'), '.cp-following { color: green; }\n')
    await writeFile(path.join(directory, 'theme.css'), '.cp-theme { color: blue }\n')
    await writeFile(path.join(directory, 'pixel.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')

    const result = await exportScenePackage({ sceneFile, destination, workingDirectory: directory })

    const manifest = JSON.parse(await readFile(path.join(destination, 'export-manifest.json'), 'utf8'))
    const cssText = await readFile(path.join(destination, manifest.styleSheet.file), 'utf8')
    expect(manifest).not.toHaveProperty('library')
    await expect(access(path.join(destination, 'codplay.js'))).rejects.toThrow()
    expect(result.resourceCount).toBe(1)
    expect(manifest.styleSheet.classNames).toEqual(['cp-theme', 'cp-imported', 'cp-following', 'cp-named'])
    expect(cssText).toContain('@layer theme')
    expect(cssText).toContain('.cp-imported { background-image: url("assets/')
    expect(cssText).toContain('.cp-named { color: red }')
    expect(cssText.indexOf('.cp-imported')).toBeLessThan(cssText.indexOf('.cp-following'))
    expect(cssText.indexOf('.cp-following')).toBeLessThan(cssText.indexOf('.cp-named'))
    expect(cssText).not.toContain('codplay-resource-')
    expect(await readFile(path.join(destination, manifest.styleSheet.resources[0].file), 'utf8'))
      .toContain('<svg')
  })

  it('packages a local Vite url import used by the compiled scene', async () => {
    const directory = await createTemporaryDirectory()
    const sceneFile = path.join(directory, 'scene.ts')
    const imageFile = path.join(directory, 'component-image.svg')
    const destination = path.join(directory, 'exported-scene')
    const imageSource = '<svg xmlns="http://www.w3.org/2000/svg"><title>fixture</title></svg>'
    await writeFile(imageFile, imageSource)
    await writeFile(sceneFile, [
      "import imageUrl from './component-image.svg?url'",
      'export const scene = {',
      "  id: 'url-import-image-scene',",
      "  stories: { main: { id: 'main', persos: [{ id: 'image', type: 'img', initial: { src: imageUrl }, actions: {} }] } },",
      '}',
      '',
    ].join('\n'))

    await exportScenePackage({ sceneFile, destination, workingDirectory: directory })

    const manifest = JSON.parse(await readFile(path.join(destination, 'export-manifest.json'), 'utf8'))
    const packagedImage = manifest.resources[0]
    const compiledScene = JSON.parse(await readFile(path.join(destination, manifest.scene), 'utf8'))
    expect(manifest.resources).toHaveLength(1)
    expect(packagedImage.type).toBe('image')
    expect(packagedImage.occurrences).toEqual([['scene', 'stories', 'main', 'persos', 0, 'initial', 'src']])
    expect(compiledScene.scene.stories.main.persos[0].initial.src).toBe(packagedImage.sceneUrl)
    expect(await readFile(path.join(destination, packagedImage.file), 'utf8')).toBe(imageSource)
  })

  it('keeps resource paths relative to the scene module behind an export entry', async () => {
    const directory = await createTemporaryDirectory()
    const sourceDirectory = path.join(directory, 'authoring', 'scenes')
    const entryDirectory = path.join(directory, 'generated')
    const sceneFile = path.join(sourceDirectory, 'scene.ts')
    const entryFile = path.join(entryDirectory, 'entry.mjs')
    const assetFile = path.join(sourceDirectory, 'pixel.svg')
    const destination = path.join(directory, 'exported-scene')
    await mkdir(sourceDirectory, { recursive: true })
    await mkdir(entryDirectory, { recursive: true })
    await writeFile(assetFile, '<svg xmlns="http://www.w3.org/2000/svg"/>')
    await writeFile(sceneFile, [
      'export const authoredScene = {',
      "  id: 'scene-with-generated-entry',",
      "  stories: { main: { id: 'main', persos: [{ id: 'image', type: 'img', initial: { src: './pixel.svg' }, actions: {} }] } },",
      '}',
      '',
    ].join('\n'))
    await writeFile(entryFile, [
      `import { authoredScene } from ${JSON.stringify(pathToFileURL(sceneFile).href)}`,
      'export const scene = authoredScene',
      '',
    ].join('\n'))

    await exportScenePackage({
      sceneFile: entryFile,
      sourceFile: sceneFile,
      destination,
      workingDirectory: directory,
    })

    const manifest = JSON.parse(await readFile(path.join(destination, 'export-manifest.json'), 'utf8'))
    const compiledScene = JSON.parse(await readFile(path.join(destination, manifest.scene), 'utf8'))
    expect(manifest.resources).toHaveLength(1)
    expect(compiledScene.scene.stories.main.persos[0].initial.src).toBe(manifest.resources[0].sceneUrl)
    expect(await readFile(path.join(destination, manifest.resources[0].file), 'utf8'))
      .toBe('<svg xmlns="http://www.w3.org/2000/svg"/>')
  })

  it('packages custom binary resources declared by preload and rewrites their exact scene fields', async () => {
    const directory = await createTemporaryDirectory()
    const sceneFile = path.join(directory, 'scene.ts')
    const destination = path.join(directory, 'exported-scene')
    const modelBytes = Buffer.from([0x67, 0x6c, 0x54, 0x46, 1, 2, 3])
    const motionBytes = Buffer.from([0x46, 0x42, 0x58, 0, 4, 5, 6])
    await writeFile(path.join(directory, 'actor.glb'), modelBytes)
    await writeFile(path.join(directory, 'walk.fbx'), motionBytes)
    await writeFile(sceneFile, [
      'export const preloadManifest = { entries: [',
      "  { url: '/actor.glb', type: 'three-glb', policy: { cache: 'default', priority: 'high' } },",
      "  { url: '/walk.fbx', type: 'three-fbx', policy: { cache: 'default', priority: 'normal' } },",
      '] }',
      'export const preloadResourceOccurrences = [',
      "  { entryIndex: 0, storyId: 'main', persoId: 'avatar', path: ['initial', 'src'] },",
      "  { entryIndex: 1, storyId: 'main', persoId: 'avatar', path: ['initial', 'animations', 'walk', 'src'] },",
      ']',
      'export const scene = { id: "custom-binary-resources", stories: { main: { id: "main", persos: [',
      '{ id: "avatar", type: "tag", initial: { tag: "div", src: "/actor.glb", animations: { walk: { src: "/walk.fbx" } } } },',
      '] } } }',
      '',
    ].join('\n'))

    await exportScenePackage({ sceneFile, destination, workingDirectory: directory })

    const manifest = JSON.parse(await readFile(path.join(destination, 'export-manifest.json'), 'utf8'))
    const compiledScene = JSON.parse(await readFile(path.join(destination, manifest.scene), 'utf8'))
    expect(manifest.resources.map(({ type, occurrences }) => ({ type, occurrences }))).toEqual([
      {
        type: 'three-glb',
        occurrences: [['scene', 'stories', 'main', 'persos', 0, 'initial', 'src']],
      },
      {
        type: 'three-fbx',
        occurrences: [['scene', 'stories', 'main', 'persos', 0, 'initial', 'animations', 'walk', 'src']],
      },
    ])
    expect(compiledScene.resources.entries.map(({ url, type }) => ({ url, type }))).toEqual([
      { url: manifest.resources[0].sceneUrl, type: 'three-glb' },
      { url: manifest.resources[1].sceneUrl, type: 'three-fbx' },
    ])
    expect(await readFile(path.join(destination, manifest.resources[0].file))).toEqual(modelBytes)
    expect(await readFile(path.join(destination, manifest.resources[1].file))).toEqual(motionBytes)
  })

  it('returns an unmapped custom preload entry as a compiler error', async () => {
    const directory = await createTemporaryDirectory()
    const sceneFile = path.join(directory, 'scene.ts')
    const destination = path.join(directory, 'exported-scene')
    await writeFile(path.join(directory, 'actor.glb'), Buffer.from('glTF fixture'))
    await writeFile(sceneFile, [
      "export const preloadManifest = { entries: [{ url: '/actor.glb', type: 'three-glb', policy: { cache: 'default' } }] }",
      "export const scene = { id: 'unmapped-custom-preload', stories: { main: { id: 'main', persos: [{ id: 'actor', type: 'tag', initial: { tag: 'div' } }] } } }",
      '',
    ].join('\n'))

    await expect(exportScenePackage({ sceneFile, destination, workingDirectory: directory }))
      .rejects.toThrow('CODPLAY_EXPORT_PRELOAD_RESOURCE_REFERENCE_UNSUPPORTED')
    await expect(access(destination)).rejects.toThrow()
    expect((await readdir(directory)).sort()).toEqual(['actor.glb', 'scene.ts'])
  })

  it('rejects a scene that requires a component outside the core catalog', async () => {
    const directory = await createTemporaryDirectory()
    const sceneFile = path.join(directory, 'scene.ts')
    const destination = path.join(directory, 'exported-scene')
    await writeFile(sceneFile, [
      'export const scene = {',
      "  id: 'external-component-scene',",
      "  stories: { main: { id: 'main', persos: [{ id: 'card', type: 'external-card' }] } },",
      '}',
      '',
    ].join('\n'))

    await expect(exportScenePackage({ sceneFile, destination, workingDirectory: directory }))
      .rejects.toThrow('AUTHOR_COMPONENT_TYPE_UNKNOWN')
    await expect(access(destination)).rejects.toThrow()
    expect((await readdir(directory)).sort()).toEqual(['scene.ts'])
  })

  it('publishes a closed package with stable files, paths and bytes across repeated exports', async () => {
    const directory = await createTemporaryDirectory()
    const sourceDirectory = path.join(directory, 'source-project')
    const firstDestination = path.join(directory, 'site-a', 'show')
    const secondDestination = path.join(directory, 'site-b', 'show')
    await mkdir(sourceDirectory, { recursive: true })
    const sceneFile = path.join(sourceDirectory, 'scene.ts')
    const assetFile = path.join(sourceDirectory, 'clip.mp4')
    const assetBytes = Buffer.from('owned media fixture bytes')
    await writeFile(sceneFile, [
      'export const scene = {',
      "  id: 'repeated-export-fixture',",
      "  stories: { main: { id: 'main', persos: [{ id: 'clip', type: 'media', initial: { tag: 'video', src: './clip.mp4' }, actions: {} }] } },",
      '}',
      '',
    ].join('\n'))
    await writeFile(assetFile, assetBytes)

    await exportScenePackage({ sceneFile, destination: firstDestination, workingDirectory: directory })
    await exportScenePackage({ sceneFile, destination: secondDestination, workingDirectory: directory })

    const firstFiles = await readPackageFiles(firstDestination)
    const secondFiles = await readPackageFiles(secondDestination)
    expect([...firstFiles.keys()].sort()).toEqual([...secondFiles.keys()].sort())
    expect(firstFiles.has('codplay.js')).toBe(false)
    expect([...firstFiles.keys()].some((file) => file.startsWith('.'))).toBe(false)

    const manifest = JSON.parse(firstFiles.get('export-manifest.json').toString('utf8'))
    const secondManifest = JSON.parse(secondFiles.get('export-manifest.json').toString('utf8'))
    expect(manifest).toEqual(secondManifest)
    expect(manifest).not.toHaveProperty('library')
    expect(manifest.resources).toHaveLength(1)
    expect(manifest.resources[0].file).toMatch(/^scene\/assets\/[a-f0-9]{20}\.mp4$/)
    expect(firstFiles.get(manifest.resources[0].file)).toEqual(assetBytes)
    expect(createHash('sha256').update(firstFiles.get(manifest.resources[0].file)).digest('hex'))
      .toBe(createHash('sha256').update(secondFiles.get(secondManifest.resources[0].file)).digest('hex'))

    const firstScene = JSON.parse(firstFiles.get(manifest.scene).toString('utf8'))
    const secondScene = JSON.parse(secondFiles.get(secondManifest.scene).toString('utf8'))
    delete firstScene.createdAt
    delete secondScene.createdAt
    expect(firstScene).toEqual(secondScene)
    expect(firstScene.resources.entries).toEqual([expect.objectContaining({ url: manifest.resources[0].sceneUrl, type: 'video' })])
    expect(firstScene.requirements.resources).toEqual(firstScene.resources.entries.map(({ url }) => url))
    expect(firstScene.scene.stories.main.persos[0].initial.src).toBe(manifest.resources[0].sceneUrl)

    const sourcePathHash = createHash('sha256').update(await realpath(assetFile)).digest('hex').slice(0, 20)
    expect(path.basename(manifest.resources[0].file)).toBe(`${sourcePathHash}.mp4`)
    const expectedFiles = [
      'export-manifest.json',
      manifest.scene,
      ...manifest.resources.map(({ file }) => file),
    ].sort()
    expect([...firstFiles.keys()].sort()).toEqual(expectedFiles)
    for (const [relativePath, bytes] of firstFiles) {
      if (relativePath === manifest.scene) continue
      expect(createHash('sha256').update(bytes).digest('hex'))
        .toBe(createHash('sha256').update(secondFiles.get(relativePath)).digest('hex'))
    }
    expect(await readFile(sceneFile, 'utf8')).toContain("id: 'repeated-export-fixture'")
    expect(await readFile(assetFile)).toEqual(assetBytes)
  })

  it('preserves an existing export destination without creating staging output', async () => {
    const directory = await createTemporaryDirectory()
    const sceneFile = path.join(directory, 'scene.ts')
    const destination = path.join(directory, 'existing-scene')
    const sentinel = path.join(destination, 'owner.txt')
    await mkdir(destination, { recursive: true })
    await writeFile(sceneFile, "export const scene = { id: 'overwrite-refusal', stories: { main: { id: 'main', persos: [] } } }\n")
    await writeFile(sentinel, 'preserve this existing directory')

    await expect(exportScenePackage({ sceneFile, destination, workingDirectory: directory }))
      .rejects.toThrow('Export destination already exists:')

    expect(await readFile(sentinel, 'utf8')).toBe('preserve this existing directory')
    expect((await readdir(directory)).sort()).toEqual(['existing-scene', 'scene.ts'])
  })

  it('leaves no published package when the export process is interrupted and allows a retry', async () => {
    const directory = await createTemporaryDirectory()
    const sceneFile = path.join(directory, 'scene.mjs')
    const markerFile = path.join(directory, 'export-started')
    const destination = path.join(directory, 'published-scene')
    const cliFile = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../cli.mjs')
    await writeFile(sceneFile, [
      "import { writeFileSync } from 'node:fs'",
      'writeFileSync(process.env.CODPLAY_EXPORT_READY, "ready")',
      'await new Promise(() => setInterval(() => undefined, 1000))',
      "export const scene = { id: 'interrupted-export', stories: { main: { id: 'main', persos: [] } } }",
      '',
    ].join('\n'))

    const child = spawn(process.execPath, [cliFile, '--scene', sceneFile, '--export', destination], {
      cwd: directory,
      env: { ...process.env, CODPLAY_EXPORT_READY: markerFile, INIT_CWD: directory },
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk) => { stderr += chunk })
    const childExit = new Promise((resolve) => child.once('exit', (code, signal) => resolve({ code, signal })))
    await waitForFile(markerFile, childExit, stderr)
    child.kill('SIGINT')
    const exit = await childExit

    expect(exit.signal === 'SIGINT' || exit.code === 130).toBe(true)
    await expect(access(destination)).rejects.toThrow()
    expect((await readdir(directory)).sort()).toEqual(['export-started', 'scene.mjs'])
    await writeFile(sceneFile, "export const scene = { id: 'retry-export', stories: { main: { id: 'main', persos: [] } } }\n")
    await exportScenePackage({ sceneFile, destination, workingDirectory: directory })
    expect(JSON.parse(await readFile(path.join(destination, 'export-manifest.json'), 'utf8')).scene)
      .toBe('scene/scene.json')
  })

  it('rejects CSS modules instead of replacing their exports with an empty value', async () => {
    const directory = await createTemporaryDirectory()
    const sceneFile = path.join(directory, 'scene.ts')
    const destination = path.join(directory, 'exported-scene')
    await writeFile(sceneFile, [
      "import classes from './scene.module.css'",
      "export const scene = { id: 'css-module-scene', stories: { main: { id: 'main', persos: [] } } }",
      'export const styleSheet = classes.root',
      '',
    ].join('\n'))
    await writeFile(path.join(directory, 'scene.module.css'), '.root { color: red; }')

    await expect(exportScenePackage({ sceneFile, destination, workingDirectory: directory }))
      .rejects.toThrow('CSS modules are not supported by scene export')
    await expect(access(destination)).rejects.toThrow()
  })

  it('bundles scene functions, static and deferred imports, assets and scoped straps into an owner factory', async () => {
    const directory = await createTemporaryDirectory()
    const sceneFile = path.join(directory, 'scene.ts')
    const destination = path.join(directory, 'exported-scene')
    await writeFile(path.join(directory, 'counter.ts'), [
      'export function createCounter(start: number) {',
      '  let value = start',
      '  return () => ++value',
      '}',
      '',
    ].join('\n'))
    await writeFile(path.join(directory, 'deferred.ts'), "export const value = 'deferred-import-ready'\n")
    await writeFile(path.join(directory, 'pixel.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>')
    await writeFile(sceneFile, [
      "import { createCounter } from './counter.ts'",
      "import pixelUrl from './pixel.svg?url'",
      'const sharedLifecycle = createCounter(10)',
      'export const scene = {',
      "  id: 'function-export-scene',",
      '  init: sharedLifecycle,',
      '  onStart: sharedLifecycle,',
      '  onSequenceEnd: sharedLifecycle,',
      "  straps: ['shared'],",
      '  state: {',
      '    assetUrl: () => pixelUrl,',
      "    deferred: async () => (await import('./deferred.ts')).value,",
      '  },',
      "  stories: { main: { id: 'main', persos: [] } },",
      '}',
      'export const strapCollections = {',
      '  scene: { shared: createCounter(20) },',
      '  stories: { main: {} },',
      '}',
      '',
    ].join('\n'))

    await exportScenePackage({ sceneFile, destination, workingDirectory: directory })

    const manifest = JSON.parse(await readFile(path.join(destination, 'export-manifest.json'), 'utf8'))
    expect(manifest.functions.file).toBe('scene/functions.mjs')
    expect(manifest.functions.references.map(({ path: segments }) => segments)).toEqual([
      ['state', 'assetUrl'],
      ['state', 'deferred'],
      ['init'],
      ['onStart'],
      ['onSequenceEnd'],
    ])
    const moduleUrl = pathToFileURL(path.join(destination, manifest.functions.file)).href
    const functionsModule = await import(moduleUrl)
    const firstContext = functionsModule.createScenePackageContext()
    const secondContext = functionsModule.createScenePackageContext()
    const referenceAt = (segments) => manifest.functions.references.find((reference) =>
      JSON.stringify(reference.path) === JSON.stringify(segments))
    const initRef = referenceAt(['init']).ref
    const startRef = referenceAt(['onStart']).ref
    const endRef = referenceAt(['onSequenceEnd']).ref
    const assetRef = referenceAt(['state', 'assetUrl']).ref
    const deferredRef = referenceAt(['state', 'deferred']).ref

    expect(firstContext.functions[initRef]).toBe(firstContext.functions[startRef])
    expect(firstContext.functions[startRef]).toBe(firstContext.functions[endRef])
    expect(firstContext.functions[startRef]()).toBe(11)
    expect(firstContext.functions[startRef]()).toBe(12)
    expect(secondContext.functions[startRef]()).toBe(11)
    expect(firstContext.strapCollections.scene.shared()).toBe(21)
    expect(secondContext.strapCollections.scene.shared()).toBe(21)
    expect(firstContext.functions[assetRef]()).toMatch(/^data:image\/svg\+xml/)
    await expect(firstContext.functions[deferredRef]()).resolves.toBe('deferred-import-ready')
  })

  it('rejects an external strap declared in a scope that does not provide it', async () => {
    const directory = await createTemporaryDirectory()
    const sceneFile = path.join(directory, 'scene.ts')
    const destination = path.join(directory, 'exported-scene')
    await writeFile(sceneFile, [
      "export const scene = { id: 'missing-external-strap', straps: ['shared'], stories: { main: { id: 'main', persos: [] } } }",
      'export const strapCollections = { scene: {}, stories: { main: { shared: () => [] } } }',
      '',
    ].join('\n'))

    await expect(exportScenePackage({ sceneFile, destination, workingDirectory: directory }))
      .rejects.toThrow('AUTHOR_SCENE_STRAP_MISSING: Scene strap is declared but not available: shared')
    await expect(access(destination)).rejects.toThrow()
  })
})

/** Creates and tracks one isolated scene input directory for a CLI integration test. */
async function createTemporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'codplay-scene-export-cli-'))
  temporaryDirectories.push(directory)
  return directory
}

/** Reads every package file into one sorted path-to-bytes map for integrity checks. */
async function readPackageFiles(root, prefix = '') {
  const files = new Map()
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const relativePath = path.posix.join(prefix, entry.name)
    const absolutePath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      for (const [nestedPath, bytes] of await readPackageFiles(absolutePath, relativePath)) files.set(nestedPath, bytes)
    } else {
      files.set(relativePath, await readFile(absolutePath))
    }
  }
  return files
}

/** Waits for the source module's marker, failing if the CLI exits before cancellation. */
async function waitForFile(file, childExit, stderr) {
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    try {
      await access(file)
      return
    } catch {
      const exit = await Promise.race([childExit, new Promise((resolve) => setTimeout(() => resolve(undefined), 25))])
      if (exit !== undefined) throw new Error(`Export exited before its cancellation point (${exit.signal ?? exit.code}): ${stderr}`)
    }
  }
  throw new Error(`Export did not reach its cancellation point: ${stderr}`)
}
