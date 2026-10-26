import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it, vi } from 'vitest'
import { BDC_TYPE, ELCE_SCENARIO, ELCE_SCENARIO_HANDLERS, PAGE_LOCATION } from '../config/document-config'
import {
  applyDocumentCommand,
  createCarouselBdcCommand,
  createPageCommand,
  createQuestionBdcCommand,
} from '../domain/commands/document-commands'
import { createInitialDocument } from '../domain/document/document-model'
import { createElcePlayerScenario } from '../player/elce-player-composition'
import { exportElceSightyPackage } from './elce-scenario-exporter'

describe('Elcé Sighty package export', () => {
  it('exports the preview scenario as an autonomous ZIP with intact scene packages and media', async () => {
    const imageBytes = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><title>Elce export fixture</title></svg>',
    )
    let document = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: {
        id: 'media-export-fixture',
        name: 'visuel-export.svg',
        mimeType: 'image/svg+xml',
        size: imageBytes.byteLength,
        caption: '',
      },
    })
    document = applyDocumentCommand(document, {
      type: 'media.add',
      media: { id: 'media-unused-catalog', name: 'ancien.svg', mimeType: 'image/svg+xml', size: 1, caption: '' },
    })
    document = applyDocumentCommand(document, {
      type: 'bdc.create',
      bdcId: 'bdc-export-card',
      bdcType: BDC_TYPE.CARD,
      presetId: 'photo-basic',
      placement: { kind: 'page', pageId: 'page-a' },
    })
    document = applyDocumentCommand(document, {
      type: 'bdc.card.media.set',
      bdcId: 'bdc-export-card',
      mediaId: 'media-export-fixture',
    })
    document = applyDocumentCommand(document, createCarouselBdcCommand('bdc-export-carousel', 'page-a', 2))
    document = applyDocumentCommand(document, createQuestionBdcCommand('bdc-export-question', 'page-a', 3))
    document = applyDocumentCommand(document, {
      type: 'chapter.create',
      chapterId: 'chapter-export-next',
      name: 'Chapitre suivant',
    })
    document = applyDocumentCommand(document, createPageCommand({
      pageId: 'page-export-next',
      bdcId: 'bdc-export-next',
      name: 'Page suivante',
      placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: 'chapter-export-next' },
    }))
    document = applyDocumentCommand(document, {
      type: 'profile.definition.update',
      profile: {
        ...document.data.profile,
        properties: [{ id: 'profile-export-audience', name: 'audience', label: 'Public', type: 'text', required: true, choices: [] }],
        fieldPropertyIds: ['profile-export-audience'],
      },
    })

    const externalWorkingDirectory = await mkdtemp(join(tmpdir(), 'elce-external-export-'))
    let zipBytes: Uint8Array
    try {
      vi.stubEnv('INIT_CWD', externalWorkingDirectory)
      zipBytes = await exportElceSightyPackage(document.toJSON(), new Map([
        ['media-export-fixture', imageBytes],
      ]))
    } finally {
      vi.unstubAllEnvs()
      await rm(externalWorkingDirectory, { recursive: true, force: true })
    }
    const files = unzipSync(zipBytes)
    const readText = (path: string): string => {
      const value = files[path]
      if (value === undefined) throw new Error(`Missing ZIP entry: ${path}`)
      return strFromU8(value)
    }
    const scenarioManifest = JSON.parse(readText('export-manifest.json')) as {
      format: string
      scenario: string
      scenes: Record<string, string>
    }
    const distributionManifest = JSON.parse(readText('distribution-manifest.json')) as {
      format: string
      entry: string
      runtime: Record<string, string>
    }
    const expectedScenario = createElcePlayerScenario({
      document,
      mediaSources: { 'media-export-fixture': './media/media-0.svg' },
    })

    expect(scenarioManifest.format).toBe('sighty.scenario-package.v2')
    expect(scenarioManifest.scenario).toBe('scenario.mjs')
    expect(Object.keys(scenarioManifest.scenes)).toEqual(Object.keys(expectedScenario.scenes ?? {}))
    expect(distributionManifest).toEqual({
      format: 'sighty.application-package.v1',
      entry: 'loader.mjs',
      scenario: 'export-manifest.json',
      runtime: {
        codplay: 'runtime/codplay.js',
        sighty: 'runtime/sighty.js',
        engine: 'runtime/elce-engine.js',
      },
    })
    expect(files['runtime/codplay.js']).toBeDefined()
    expect(files['runtime/sighty.js']).toBeDefined()
    expect(files['runtime/elce-engine.js']).toBeDefined()
    expect(files['runtime/elce-engine-manifest.json']).toBeDefined()
    expect(readText('runtime/elce-engine.js')).not.toContain('aliceblue')
    expect(files['runtime/engine.js']).toBeUndefined()
    expect(JSON.parse(readText('runtime/elce-engine-manifest.json'))).toMatchObject({
      format: 'codplay.site-engine.v1',
      entry: 'elce-engine.js',
    })
    expect(strFromU8(files['runtime/sighty.js']!)).toMatch(/from\s*["']\.\/codplay\.js["']/)
    expect(strFromU8(files['runtime/elce-engine.js']!)).toMatch(/from\s*["']\.\/codplay\.js["']/)
    expect(readText('loader.mjs')).toMatch(/from\s*["']\.\/runtime\/elce-engine\.js["']/)
    expect(readText('loader.mjs')).toContain('owner.load(packagePath, { root })')
    expect(readText('README.md')).toContain("loadSightyPackage({ root: '#player' })")
    const scenarioModuleText = readText('scenario.mjs')
    expect(scenarioModuleText).not.toContain('.elce-export')
    expect(scenarioModuleText).not.toContain('ElceDocument')
    expect(scenarioModuleText).not.toContain('createElcePlayerScenario')
    expect(scenarioModuleText).not.toContain('documentData')
    const packagedScenario = await import(`data:text/javascript;base64,${Buffer.from(scenarioModuleText).toString('base64')}`) as {
      scenario?: {
        scenes?: Record<string, unknown>
        data?: { chapters?: Record<string, Readonly<{ name?: string }>> }
        actions?: Record<string, unknown>
        views?: unknown
      }
    }
    expect(Object.keys(packagedScenario.scenario?.scenes ?? {})).toEqual(Object.keys(scenarioManifest.scenes))
    expect(packagedScenario.scenario?.data?.chapters?.['chapter-1']?.name).toBe('Chapitre 1')
    expect(packagedScenario.scenario?.actions?.[ELCE_SCENARIO_HANDLERS.NAVIGATE_SCORM_CHAPTER]).toBeTypeOf('function')
    expect(JSON.stringify(packagedScenario.scenario?.views) ?? '')
      .not.toContain(ELCE_SCENARIO_HANDLERS.NAVIGATE_SCORM_CHAPTER)

    const pagePackageRoot = scenarioManifest.scenes['scene-page-a']
    expect(pagePackageRoot).toBeDefined()
    const pagePackageManifest = JSON.parse(readText(`${pagePackageRoot}export-manifest.json`)) as {
      format: string
      scene: string
      resources: readonly { file: string }[]
      styleSheet?: { file: string }
    }
    expect(pagePackageManifest.format).toBe('codplay.scene-package.v1')
    expect(pagePackageManifest.scene).toBe('scene/scene.json')
    expect(files[`${pagePackageRoot}${pagePackageManifest.scene}`]).toBeDefined()
    const compiledPageScene = JSON.parse(readText(`${pagePackageRoot}${pagePackageManifest.scene}`)) as {
      scene?: { stories?: Record<string, unknown> }
    }
    expect(compiledPageScene.scene?.stories).toBeDefined()
    expect(pagePackageManifest.styleSheet).toBeDefined()
    expect(strFromU8(files[`${pagePackageRoot}${pagePackageManifest.styleSheet!.file}`]!)).toContain('ac-grid-carousel')
    expect(pagePackageManifest.resources.some((resource) => resource.file.endsWith('.svg'))).toBe(true)
    expect(Object.keys(files).some((path) => path.includes('.elce-export'))).toBe(false)
    expect(Object.keys(files).some((path) => path.endsWith('visuel-export.svg'))).toBe(false)
    expect(Object.keys(files).filter((path) => path === 'runtime/codplay.js')).toHaveLength(1)
    expect(Object.keys(files).some((path) => /scenes\/scene-[^/]+\/(codplay|sighty|elce-engine)\.js$/.test(path))).toBe(false)
    const sceneFunctionPaths = Object.keys(files).filter((path) => path.endsWith('/scene/functions.mjs'))
    const sceneFunctionBytes = sceneFunctionPaths.reduce((total, path) => total + files[path]!.byteLength, 0)
    expect(sceneFunctionPaths.length).toBeGreaterThan(0)
    expect(sceneFunctionBytes).toBeLessThan(200_000)
    for (const path of sceneFunctionPaths) {
      const functionsModule = strFromU8(files[path]!)
      expect(functionsModule).not.toMatch(/AutoCapsule|ElceCarouselSceneBuilder|createElcePlayerScenario|ElceDocument/)
    }

    const layoutPackageRoot = scenarioManifest.scenes[ELCE_SCENARIO.LAYOUT_SCENE]
    expect(layoutPackageRoot).toBeDefined()
    const layoutPackageManifest = JSON.parse(readText(`${layoutPackageRoot}export-manifest.json`)) as {
      scene: string
      styleSheet?: { file: string }
    }
    expect(layoutPackageManifest.scene).toBe('scene/scene.json')
    expect(JSON.parse(readText(`${layoutPackageRoot}${layoutPackageManifest.scene}`))).toHaveProperty('scene.stories')
    expect(layoutPackageManifest.styleSheet).toBeDefined()
    expect(files[`${layoutPackageRoot}${layoutPackageManifest.styleSheet!.file}`]).toBeDefined()
    expect(strFromU8(files[`${layoutPackageRoot}${layoutPackageManifest.styleSheet!.file}`]!))
      .toMatch(/\.elce-carousel-media > img,\s*\.elce-carousel-media > video\s*\{[^}]*width: 100%;[^}]*height: 100%;[^}]*object-fit: cover;/)
    const layoutStyleSheet = readText(`${layoutPackageRoot}${layoutPackageManifest.styleSheet!.file}`)
    expect(layoutStyleSheet).toContain('--elce-appearance-background: #fffdf8;')
    expect(layoutStyleSheet).toContain('.headings-crimson-text')
    expect(layoutStyleSheet).toContain('.body-dm-sans')
    expect(layoutStyleSheet).toContain('.density-normal')
    expect(layoutStyleSheet).not.toContain('.bg-ocean-background')
    expect(layoutStyleSheet).not.toContain('.headings-inter')
    expect(layoutStyleSheet).toContain('var(--elce-appearance-background)')
    expect(Object.keys(files).some((path) => path.includes('/appearance/css/'))).toBe(false)

    const mediaResource = pagePackageManifest.resources.find((resource) => resource.file.endsWith('.svg'))
    expect(mediaResource).toBeDefined()
    expect(strFromU8(files[`${pagePackageRoot}${mediaResource!.file}`]!)).toBe(strFromU8(imageBytes))
  }, 180_000)

  it('requires bytes for a media source referenced by the Sighty scenes', async () => {
    const bytes = new TextEncoder().encode('<svg/>')
    let document = applyDocumentCommand(createInitialDocument(), {
      type: 'media.add',
      media: { id: 'media-required', name: 'required.svg', mimeType: 'image/svg+xml', size: bytes.byteLength, caption: '' },
    })
    document = applyDocumentCommand(document, {
      type: 'bdc.create',
      bdcId: 'bdc-required-image',
      bdcType: BDC_TYPE.CARD,
      presetId: 'photo-basic',
      placement: { kind: 'page', pageId: 'page-a' },
    })
    document = applyDocumentCommand(document, {
      type: 'bdc.card.media.set',
      bdcId: 'bdc-required-image',
      mediaId: 'media-required',
    })

    await expect(exportElceSightyPackage(document.toJSON(), new Map()))
      .rejects.toThrow('Le média « required.svg » est absent de l’export.')
  })
})
