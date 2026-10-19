import { afterEach, describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { packageResources, resolveLocalResource } from '../resource-packager.mjs'

const temporaryDirectories = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('scene export resource packaging', () => {
  it('copies one file for repeated references and rewrites only compiler-provided paths', async () => {
    const directory = await createTemporaryDirectory()
    const sourceDirectory = path.join(directory, 'source')
    const stageDirectory = path.join(directory, 'stage')
    await mkdir(sourceDirectory, { recursive: true })
    await mkdir(stageDirectory, { recursive: true })
    const sourceFile = path.join(sourceDirectory, 'scene.ts')
    const assetFile = path.join(sourceDirectory, 'cover image.svg')
    const assetBytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')
    await writeFile(sourceFile, 'export const scene = {}')
    await writeFile(assetFile, assetBytes)
    const compiledScene = createCompiledScene('./cover%20image.svg')
    const before = JSON.stringify(compiledScene)

    const result = await packageResources({
      sourceFile,
      compiledScene,
      resourceReferences: [
        { url: './cover%20image.svg', type: 'image', path: ['scene', 'stories', 'main', 'persos', 0, 'initial', 'src'] },
        { url: './cover%20image.svg', type: 'image', path: ['scene', 'stories', 'main', 'persos', 0, 'actions', 'swap', 'src'] },
      ],
      stageDirectory,
    })

    expect(result.resources).toHaveLength(1)
    const digest = createHash('sha256').update(await realpath(assetFile)).digest('hex').slice(0, 20)
    expect(result.resources[0].file).toBe(`scene/assets/${digest}.svg`)
    expect(result.compiledScene.scene.stories.main.persos[0].initial.src).toBe(result.resources[0].sceneUrl)
    expect(result.compiledScene.scene.stories.main.persos[0].actions.swap.src).toBe(result.resources[0].sceneUrl)
    expect(result.compiledScene.resources.entries[0].url).toBe(result.resources[0].sceneUrl)
    expect(result.compiledScene.requirements.resources).toEqual([result.resources[0].sceneUrl])
    expect(JSON.stringify(compiledScene)).toBe(before)
    expect(await readFile(path.join(stageDirectory, result.resources[0].file))).toEqual(assetBytes)
  })

  it('preserves the full logical compiled state while relocating traced resource occurrences', async () => {
    const directory = await createTemporaryDirectory()
    const sourceDirectory = path.join(directory, 'source')
    const stageDirectory = path.join(directory, 'stage')
    await mkdir(sourceDirectory, { recursive: true })
    await mkdir(stageDirectory, { recursive: true })
    const sourceFile = path.join(sourceDirectory, 'scene.ts')
    const assetFile = path.join(sourceDirectory, 'cover.svg')
    await writeFile(sourceFile, 'export const scene = {}')
    await writeFile(assetFile, '<svg xmlns="http://www.w3.org/2000/svg"/>')
    const compiledScene = createCompiledScene('./cover.svg')
    const story = compiledScene.scene.stories.main
    compiledScene.scene.name = 'general-logical-state'
    compiledScene.scene.state = { currentView: 2, labels: ['intro', 'detail'] }
    compiledScene.scene.init = { ref: 'fn:scene-init' }
    compiledScene.scene.onStart = { ref: 'fn:scene-start' }
    compiledScene.scene.onSequenceEnd = { ref: 'fn:scene-end' }
    compiledScene.scene.straps = ['scene:shared']
    compiledScene.scene.listen = [{
      on: 'scene:source',
      transform: [{ ref: 'fn:scene-transform' }],
      emit: [{ name: 'scene:target', data: { retained: true } }],
      straps: ['scene:shared'],
    }]
    compiledScene.scene.tracks = { main: { active: true, rate: 1 } }
    story.trackId = 'main'
    story.initial = { style: { opacity: 0.75, color: '#223344' } }
    story.state = { selected: 'detail', count: 3 }
    story.straps = ['story:shared']
    story.listen = [{
      on: 'story:source',
      transform: [{ ref: 'fn:story-transform' }],
      straps: ['story:shared'],
    }]
    story.eventimes = [{ name: 'story:open', startAt: 10, data: { retained: true } }]
    story.tracks = { main: { active: true, order: 2 } }
    story.persos[0].actions.swap = { src: './cover.svg', content: 'changed' }
    compiledScene.rootNodeIds = ['picture']
    compiledScene.requirements = {
      components: ['img'],
      services: ['markup'],
      modules: ['timeline'],
      libraries: ['drawing'],
      resources: ['./cover.svg'],
    }
    compiledScene.actionTargetIndex = {
      'image:swap': [{ storyId: 'main', persoId: 'picture' }],
    }
    compiledScene.storyActivationIndex = {
      main: { 'story:open': ['story:open'] },
    }
    const before = JSON.parse(JSON.stringify(compiledScene))

    const result = await packageResources({
      sourceFile,
      compiledScene,
      resourceReferences: [
        { url: './cover.svg', type: 'image', path: ['scene', 'stories', 'main', 'persos', 0, 'initial', 'src'] },
        { url: './cover.svg', type: 'image', path: ['scene', 'stories', 'main', 'persos', 0, 'actions', 'swap', 'src'] },
      ],
      stageDirectory,
    })

    const expected = JSON.parse(JSON.stringify(compiledScene))
    const packagedUrl = result.resources[0].sceneUrl
    expected.scene.stories.main.persos[0].initial.src = packagedUrl
    expected.scene.stories.main.persos[0].actions.swap.src = packagedUrl
    expected.resources.entries[0].url = packagedUrl
    expected.requirements.resources = [packagedUrl]

    expect(result.compiledScene).toEqual(expected)
    expect(compiledScene).toEqual(before)
  })

  it('keeps distinct source files with identical bytes at distinct package paths', async () => {
    const directory = await createTemporaryDirectory()
    const sourceDirectory = path.join(directory, 'source')
    const stageDirectory = path.join(directory, 'stage')
    await mkdir(path.join(sourceDirectory, 'left'), { recursive: true })
    await mkdir(path.join(sourceDirectory, 'right'), { recursive: true })
    await mkdir(stageDirectory, { recursive: true })
    const sourceFile = path.join(sourceDirectory, 'scene.ts')
    const assetBytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')
    await writeFile(sourceFile, 'export const scene = {}')
    await writeFile(path.join(sourceDirectory, 'left/cover.svg'), assetBytes)
    await writeFile(path.join(sourceDirectory, 'right/cover.svg'), assetBytes)
    const urls = ['./left/cover.svg', './right/cover.svg']
    const compiledScene = createCompiledSceneWithUrls(urls)

    const result = await packageResources({
      sourceFile,
      compiledScene,
      resourceReferences: [
        { url: urls[0], type: 'image', path: ['scene', 'stories', 'main', 'persos', 0, 'initial', 'src'] },
        { url: urls[1], type: 'image', path: ['scene', 'stories', 'main', 'persos', 1, 'initial', 'src'] },
      ],
      stageDirectory,
    })

    expect(result.resources).toHaveLength(2)
    expect(result.resources[0].file).not.toBe(result.resources[1].file)
    expect(result.resources.map(({ sceneUrl }) => sceneUrl)).toEqual(
      result.compiledScene.resources.entries.map(({ url }) => url),
    )
    expect(result.compiledScene.requirements.resources).toEqual(result.resources.map(({ sceneUrl }) => sceneUrl))
    expect(await readFile(path.join(stageDirectory, result.resources[0].file))).toEqual(assetBytes)
    expect(await readFile(path.join(stageDirectory, result.resources[1].file))).toEqual(assetBytes)
  })

  it('rewrites compiler-traced inline CSS URLs only on the packaged scene copy', async () => {
    const directory = await createTemporaryDirectory()
    const sourceDirectory = path.join(directory, 'source')
    const stageDirectory = path.join(directory, 'stage')
    await mkdir(sourceDirectory, { recursive: true })
    await mkdir(stageDirectory, { recursive: true })
    const sourceFile = path.join(sourceDirectory, 'scene.ts')
    const assetFile = path.join(sourceDirectory, 'cover image.svg')
    await writeFile(sourceFile, 'export const scene = {}')
    await writeFile(assetFile, '<svg xmlns="http://www.w3.org/2000/svg"/>')
    const compiledScene = createCompiledScene('./cover%20image.svg')
    compiledScene.scene.stories.main.persos[0].initial.style = {
      backgroundImage: 'linear-gradient(black, transparent), url("./cover%20image.svg")',
      color: 'rebeccapurple',
    }
    const stylePath = ['scene', 'stories', 'main', 'persos', 0, 'initial', 'style', 'backgroundImage']

    const result = await packageResources({
      sourceFile,
      compiledScene,
      resourceReferences: [
        { url: './cover%20image.svg', type: 'image', path: ['scene', 'stories', 'main', 'persos', 0, 'initial', 'src'] },
        {
          url: './cover%20image.svg',
          type: 'image',
          path: stylePath,
          cssValue: 'url("./cover%20image.svg")',
        },
      ],
      stageDirectory,
    })

    expect(result.compiledScene.scene.stories.main.persos[0].initial.style.backgroundImage)
      .toBe('linear-gradient(black, transparent), url("assets/' + result.resources[0].file.split('/').at(-1) + '")')
    expect(result.compiledScene.scene.stories.main.persos[0].initial.style.color).toBe('rebeccapurple')
    expect(result.resources[0].occurrences).toEqual([
      ['scene', 'stories', 'main', 'persos', 0, 'initial', 'src'],
      { path: stylePath, cssUrl: `url("${result.resources[0].sceneUrl}")` },
    ])
    expect(compiledScene.scene.stories.main.persos[0].initial.style.backgroundImage)
      .toBe('linear-gradient(black, transparent), url("./cover%20image.svg")')
    expect(compiledScene.scene.stories.main.persos[0].initial.style.color).toBe('rebeccapurple')
  })

  it('rejects URLs and missing source files before publishing a package', async () => {
    const directory = await createTemporaryDirectory()
    const sceneFile = path.join(directory, 'scene.ts')
    await writeFile(sceneFile, 'export const scene = {}')

    await expect(resolveLocalResource(sceneFile, 'https://cdn.example/cover.svg'))
      .rejects.toThrow('Only local media paths are supported')
    await expect(resolveLocalResource(sceneFile, './missing.svg'))
      .rejects.toThrow('Media file referenced by the scene is not a file')
  })

  it('resolves a single-slash web-root asset from the scene source directory', async () => {
    const directory = await createTemporaryDirectory()
    const sourceDirectory = path.join(directory, 'public')
    const assetsDirectory = path.join(sourceDirectory, 'assets')
    await mkdir(assetsDirectory, { recursive: true })
    const sceneFile = path.join(sourceDirectory, 'scene.ts')
    const assetFile = path.join(assetsDirectory, 'cover.svg')
    await writeFile(sceneFile, 'export const scene = {}')
    await writeFile(assetFile, '<svg/>')

    await expect(resolveLocalResource(sceneFile, '/assets/cover.svg')).resolves.toEqual({
      sourcePath: await realpath(assetFile),
      suffix: '',
    })
  })
})

/** Creates and tracks one isolated source/export fixture directory. */
async function createTemporaryDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'codplay-scene-export-'))
  temporaryDirectories.push(directory)
  return directory
}

/** Creates a compiled-scene fixture with two references to the same local image. */
function createCompiledScene(url) {
  return {
    schemaVersion: 'codplay.v2.scene.v1',
    createdAt: '2026-10-16T00:00:00.000Z',
    scene: {
      id: 'resource-packager-fixture',
      stories: {
        main: {
          id: 'main',
          persos: [{
            id: 'picture',
            type: 'img',
            initial: { src: url },
            actions: { swap: { src: url } },
          }],
          tracks: {},
          listen: [],
        },
      },
      listen: [],
      tracks: {},
    },
    resources: {
      entries: [{ url, type: 'image', policy: { cache: 'default', priority: 'normal' } }],
    },
    rootNodeIds: [],
    requirements: { components: ['img'], services: [], modules: [], libraries: [], resources: [url] },
    actionTargetIndex: {},
    storyActivationIndex: { main: {} },
  }
}

/** Creates one compiled fixture with distinct resources sharing a basename/content. */
function createCompiledSceneWithUrls(urls) {
  const compiledScene = createCompiledScene(urls[0])
  const story = compiledScene.scene.stories.main
  story.persos.push({
    id: 'second-picture',
    type: 'img',
    initial: { src: urls[1] },
    actions: {},
  })
  compiledScene.resources.entries.push({
    url: urls[1],
    type: 'image',
    policy: { cache: 'default', priority: 'normal' },
  })
  compiledScene.requirements.resources.push(urls[1])
  return compiledScene
}
