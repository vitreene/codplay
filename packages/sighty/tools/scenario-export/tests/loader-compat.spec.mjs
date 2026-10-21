import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadSightyScenarioPackage } from '../../../src/scenario-package-loader.ts'

describe('Sighty scenario package loader format compatibility', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('keeps loading v1 packages with their original direct scene sources', async () => {
    const directory = await createPackageDirectory('sighty.scenario-package.v1', [
      'export const scenario = {',
      "  id: 'legacy-package',",
      "  views: { start: 'main', views: { main: { view: { scene: 'layout' } } } },",
      "  scenes: { layout: { sceneDoc: { id: 'layout', stories: {} }, onReset: (keys) => keys.includes('all') ? { name: 'legacy:reset' } : undefined } },",
      '}',
    ].join('\n'))
    try {
      stubManifestFetch('sighty.scenario-package.v1')
      const owner = createFakeOwner()
      const root = {}
      const loaded = await loadSightyScenarioPackage(owner, packageUrl(directory), root)

      expect(loaded.scenario.scenes.layout).toMatchObject({ sceneDoc: { id: 'layout' } })
      expect(loaded.scenario.sceneSources).toBeUndefined()
      expect(loaded.sceneResetHandlers.get('layout')(['all'])).toEqual({ name: 'legacy:reset' })
      expect(loaded.preparedBuilds.has('layout')).toBe(true)
      expect(owner.prepare).toHaveBeenCalledTimes(1)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('loads v2 compact metadata while retaining only compiled child builds', async () => {
    const directory = await createPackageDirectory('sighty.scenario-package.v2', [
      'export const scenario = {',
      "  id: 'compact-package',",
      "  views: { start: 'main', views: { main: { view: { scene: 'layout' } } } },",
      "  scenes: { layout: { onReset: (keys) => keys.includes('all') ? { name: 'compact:reset' } : undefined } },",
      '}',
    ].join('\n'))
    try {
      stubManifestFetch('sighty.scenario-package.v2')
      const owner = createFakeOwner()
      const root = {}
      const loaded = await loadSightyScenarioPackage(owner, packageUrl(directory), root)

      expect(loaded.scenario.scenes).toBeUndefined()
      expect(loaded.sceneResetHandlers.get('layout')(['all'])).toEqual({ name: 'compact:reset' })
      expect(loaded.packagedSceneKeys).toEqual(new Set(['layout']))
      expect(loaded.preparedBuilds.has('layout')).toBe(true)
      expect(owner.prepare).toHaveBeenCalledTimes(1)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})

/** Creates one temporary package folder containing a loadable scenario module. */
async function createPackageDirectory(format, scenarioSource) {
  const directory = await mkdtemp(path.join(tmpdir(), 'sighty-loader-'))
  await mkdir(path.join(directory, 'scenes', 'layout'), { recursive: true })
  await writeFile(path.join(directory, 'scenario.mjs'), scenarioSource)
  await writeFile(path.join(directory, 'export-manifest.json'), JSON.stringify({
    format,
    scenario: 'scenario.mjs',
    scenes: { layout: 'scenes/layout/' },
  }))
  return directory
}

/** Stubs the package manifest request consumed by the loader. */
function stubManifestFetch(format) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    format,
    scenario: 'scenario.mjs',
    scenes: { layout: 'scenes/layout/' },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })))
}

/** Creates the minimal owner response needed to exercise package resolution. */
function createFakeOwner() {
  return {
    prepare: vi.fn(async (_packageUrl, options) => ({
      root: options.root,
      compiledScene: { scene: { id: 'compiled-layout' } },
      functions: {},
      strapCollections: { scene: [], stories: {} },
      resourceUrls: [],
    })),
  }
}

/** Returns the canonical file URL for the package directory. */
function packageUrl(directory) {
  return pathToFileURL(`${directory}${path.sep}`).href
}
