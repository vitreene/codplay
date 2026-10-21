import type {
  CodPlay,
  CodPlayPreparedScene,
} from 'codplay'
import type { SightyScenarioDefinition } from './types'
import type { SightyRuntimeBuild } from './runtime/types'

type SightyScenarioPackageManifest = Readonly<{
  format: 'sighty.scenario-package.v1'
  scenario: string
  scenes: Readonly<Record<string, string>>
}>

/** Returns one loaded scenario and the CodPlay builds prepared from its child packages. */
export type LoadedSightyScenario<SceneKey extends string> = Readonly<{
  scenario: SightyScenarioDefinition<SceneKey>
  preparedBuilds: ReadonlyMap<SceneKey, SightyRuntimeBuild>
  root: HTMLElement
  packagedSceneKeys: ReadonlySet<SceneKey>
}>

let packageLoadCounter = 0

/** Loads the Sighty envelope and prepares its intact CodPlay scene packages. */
export async function loadSightyScenarioPackage<SceneKey extends string>(
  owner: CodPlay,
  scenarioPath: string,
  rootInput: HTMLElement | string,
): Promise<LoadedSightyScenario<SceneKey>> {
  const baseUrl = resolvePackageBase(scenarioPath)
  const manifestResponse = await fetch(new URL('export-manifest.json', baseUrl))
  if (!manifestResponse.ok) {
    throw new Error(`Sighty scenario package manifest request failed (${manifestResponse.status}).`)
  }
  const manifest = parsePackageManifest(await manifestResponse.json())
  const loadId = ++packageLoadCounter
  const scenarioUrl = resolvePackageFile(baseUrl, manifest.scenario)
  const scenarioModule = await import(/* @vite-ignore */ withLoadIdentity(scenarioUrl, loadId).href) as Record<string, unknown>
  const scenario = normalizeDirectScenes(resolveScenarioDefinition<SceneKey>(scenarioModule))
  const sceneEntries = Object.entries(scenario.scenes ?? {})
  if (sceneEntries.length === 0) throw new Error('Sighty scenario package must contain at least one direct scene.')
  const manifestSceneKeys = Object.keys(manifest.scenes)
  const sceneKeys = sceneEntries.map(([sceneKey]) => sceneKey)
  if (manifestSceneKeys.length !== sceneKeys.length || sceneKeys.some((sceneKey) => !Object.hasOwn(manifest.scenes, sceneKey))) {
    throw new Error('Sighty scenario package scene references do not match its scenario definition.')
  }

  const preparedBuilds = new Map<SceneKey, SightyRuntimeBuild>()
  const preparedScenes: CodPlayPreparedScene[] = []
  try {
    for (const [sceneKey] of sceneEntries) {
      const childPackagePath = manifest.scenes[sceneKey]
      if (childPackagePath === undefined) {
        throw new Error(`Sighty scene package reference is missing: ${sceneKey}.`)
      }
      const childUrl = resolvePackageFile(baseUrl, childPackagePath)
      const prepared = await owner.prepare(childUrl.href, {
        root: rootInput,
        cssSlot: `sighty-package:${loadId}:${encodeURIComponent(sceneKey)}`,
      })
      preparedScenes.push(prepared)
      preparedBuilds.set(sceneKey as SceneKey, asCompileSuccess(prepared))
    }
  } catch (error) {
    for (const prepared of preparedScenes) {
      if (prepared.cssSlot !== undefined) owner.preload.css.clear(prepared.cssSlot)
    }
    owner.preload.release([...new Set(preparedScenes.flatMap((prepared) => prepared.resourceUrls))])
    throw error
  }

  const firstPreparedScene = preparedScenes[0]
  if (firstPreparedScene === undefined) throw new Error('Sighty scenario package did not prepare any direct scene.')
  return {
    scenario,
    preparedBuilds,
    root: firstPreparedScene.root,
    packagedSceneKeys: new Set(sceneKeys as SceneKey[]),
  }
}

/** Resolves and validates the versioned outer package manifest. */
function parsePackageManifest(value: unknown): SightyScenarioPackageManifest {
  if (!isRecord(value)
    || value.format !== 'sighty.scenario-package.v1'
    || typeof value.scenario !== 'string'
    || !isRecord(value.scenes)
    || Object.values(value.scenes).some((scenePath) => typeof scenePath !== 'string')) {
    throw new Error('Sighty scenario package manifest is invalid.')
  }
  return value as SightyScenarioPackageManifest
}

/** Selects a Sighty scenario definition from named or default module exports. */
function resolveScenarioDefinition<SceneKey extends string>(
  module: Record<string, unknown>,
): SightyScenarioDefinition<SceneKey> {
  if (isScenarioDefinition(module.scenario)) return module.scenario as SightyScenarioDefinition<SceneKey>
  if (isScenarioDefinition(module.default)) return module.default as SightyScenarioDefinition<SceneKey>
  const candidates = Object.values(module).filter(isScenarioDefinition)
  if (candidates.length === 1) return candidates[0] as SightyScenarioDefinition<SceneKey>
  throw new Error(candidates.length === 0
    ? 'Scenario module does not export a Sighty scenario definition.'
    : 'Scenario module exports more than one Sighty scenario definition.')
}

/** Promotes direct scene-source values to the stable scene catalog and rejects lazy producers. */
function normalizeDirectScenes<SceneKey extends string>(
  scenario: SightyScenarioDefinition<SceneKey>,
): SightyScenarioDefinition<SceneKey> {
  const scenes = { ...(scenario.scenes ?? {}) } as NonNullable<SightyScenarioDefinition<SceneKey>['scenes']>
  for (const [sceneKey, source] of Object.entries(scenario.sceneSources ?? {})) {
    if (typeof source === 'function') {
      throw new Error(`Lazy Sighty scene source is not supported by package loading: sceneSources.${sceneKey}.`)
    }
    if (scenes[sceneKey as SceneKey] === undefined) {
      scenes[sceneKey as SceneKey] = source as (typeof scenes)[SceneKey]
    }
  }
  return { ...scenario, scenes, sceneSources: undefined }
}

/** Converts a prepared package into the build record consumed by Sighty's existing runtime. */
function asCompileSuccess(prepared: CodPlayPreparedScene): SightyRuntimeBuild {
  return {
    ok: true,
    compiledScene: prepared.compiledScene,
    functions: prepared.functions,
    strapCollections: prepared.strapCollections,
    diagnostics: { all: [], warnings: [], errors: [] },
  }
}

/** Resolves a directory path relative to the host page and normalizes its trailing slash. */
function resolvePackageBase(packagePath: string): URL {
  const fallbackBase = globalThis.document?.baseURI ?? globalThis.location?.href ?? import.meta.url
  const baseUrl = new URL(packagePath, fallbackBase)
  if (!baseUrl.pathname.endsWith('/')) baseUrl.pathname += '/'
  return baseUrl
}

/** Resolves a safe relative file path inside one scenario package. */
function resolvePackageFile(baseUrl: URL, relativePath: string): URL {
  if (relativePath.length === 0
    || relativePath.startsWith('/')
    || relativePath.includes('\\')
    || relativePath.split('/').includes('..')
    || /^[a-z][a-z\d+.-]*:/i.test(relativePath)) {
    throw new Error(`Sighty scenario package contains an invalid relative path: ${relativePath}`)
  }
  const resolvedUrl = new URL(relativePath, baseUrl)
  if (resolvedUrl.origin !== baseUrl.origin || !resolvedUrl.pathname.startsWith(baseUrl.pathname)) {
    throw new Error(`Sighty scenario package path escapes its package root: ${relativePath}`)
  }
  return resolvedUrl
}

/** Adds a distinct module URL so each package load gets its own scenario closures. */
function withLoadIdentity(moduleUrl: URL, loadId: number): URL {
  const resolvedUrl = new URL(moduleUrl)
  resolvedUrl.searchParams.set('sighty-load', String(loadId))
  return resolvedUrl
}

/** Checks for the public scenario shape required by the Sighty runtime. */
function isScenarioDefinition(value: unknown): value is SightyScenarioDefinition<string> {
  return isRecord(value) && value.views !== undefined
}

/** Checks whether one manifest or scenario value is a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
