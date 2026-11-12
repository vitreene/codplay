import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { QuizHuntDocumentService } from '../../document/quiz-hunt-document-service'
import { createQuizHuntGameCatalog } from '../../reading/quiz-hunt-game-catalog'
import { createQuizHuntScenarioModel } from '../../reading/quiz-hunt-scenario-builder'
import { quizHuntScenarioExportMediaIds } from '../quiz-hunt-scenario-export-media'
import { QuizHuntSightyExportApiController } from './quiz-hunt-sighty-export-api-controller'

/** Maps each callback's scenario path so the compact package can be compared by identity. */
function collectCallbacksByPath(value: unknown): ReadonlyMap<string, Function> {
  const callbacks = new Map<string, Function>()
  const visited = new WeakSet<object>()
  const visit = (entry: unknown, path: string): void => {
    if (typeof entry === 'function') {
      callbacks.set(path, entry)
      return
    }
    if (entry === null || typeof entry !== 'object' || visited.has(entry)) return
    visited.add(entry)
    if (Array.isArray(entry)) {
      entry.forEach((item, index) => visit(item, `${path}.${index}`))
      return
    }
    Object.entries(entry).forEach(([key, item]) => visit(item, `${path}.${key}`))
  }
  visit(value, 'scenario')
  return callbacks
}

describe('Quiz Hunt Sighty export', () => {
  it('exports a compact Sighty package with its referenced media and identity-bound callbacks', async () => {
    const documents = new QuizHuntDocumentService()
    const initial = documents.createInitialDocument('quiz-hunt-export', 'Quiz Hunt export')
    const questionChapter = initial.chapters.find((chapter) => chapter.type === 'questions')!
    const finalChapter = initial.chapters.find((chapter) => chapter.type === 'finals')!
    const trialPage = initial.pages.find((page) => page.chapterId === questionChapter.id)!
    const createdFinal = documents.createPage(initial, finalChapter.id, 'Finale rouge')
    const finalPage = createdFinal.pages.find((page) => page.chapterId === finalChapter.id)!
    const group = initial.settings.groups[0]!
    const colored = documents.setPageColor(
      documents.setPageColor(createdFinal, trialPage.id, group.id),
      finalPage.id,
      group.id,
    )
    const authored = documents.updateSettings(colored, { seed: 7, random: false })
    const trial = createQuizHuntGameCatalog(authored, 'release').trials[0]
    if (trial === undefined) throw new Error('The export fixture must draw a trial question.')

    const mediaBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><title>Quiz Hunt</title></svg>')
    const media = {
      id: 'quiz-hunt-export-media',
      name: 'indice.svg',
      mimeType: 'image/svg+xml',
      size: mediaBytes.byteLength,
      caption: 'Indice illustré',
    }
    const document = documents.attachQuestionMedia(authored, trial.questionBdc.id, media)
    expect(document.bdcs.find((bdc) => bdc.id === trial.questionBdc.id)?.question?.mediaId).toBe(media.id)
    expect([...quizHuntScenarioExportMediaIds(document, { [media.id]: './media/media-0.svg' })]).toContain(media.id)
    const form = new FormData()
    form.set('document', JSON.stringify({ version: 1, document }))
    form.append(`media:${media.id}`, new Blob([new TextDecoder().decode(mediaBytes)], { type: media.mimeType }), media.name)

    const sightyResponse = await new QuizHuntSightyExportApiController().export(new Request(
      'http://elce.test/api/quiz-hunt/exports/sighty',
      { method: 'POST', body: form },
    ))
    expect(sightyResponse.status, await sightyResponse.clone().text()).toBe(200)
    expect(sightyResponse.headers.get('Content-Type')).toBe('application/zip')
    expect(sightyResponse.headers.get('Content-Disposition')).toBe('attachment; filename="Quiz-Hunt-export.sighty.zip"')

    const sightyBytes = new Uint8Array(await sightyResponse.arrayBuffer())
    const sightyFiles = unzipSync(sightyBytes)
    const readSightyText = (path: string): string => {
      const entry = sightyFiles[path]
      if (entry === undefined) throw new Error(`Missing Sighty ZIP entry: ${path}`)
      return strFromU8(entry)
    }
    const scenarioManifest = JSON.parse(readSightyText('export-manifest.json')) as {
      format: string
      scenario: string
      scenes: Readonly<Record<string, string>>
    }
    const distributionManifest = JSON.parse(readSightyText('distribution-manifest.json')) as {
      entry: string
      runtime: Readonly<Record<string, string>>
    }

    expect(scenarioManifest.format).toBe('sighty.scenario-package.v2')
    expect(scenarioManifest.scenario).toBe('scenario.mjs')
    expect(distributionManifest).toMatchObject({
      entry: 'loader.mjs',
      runtime: {
        codplay: 'runtime/codplay.js',
        sighty: 'runtime/sighty.js',
        engine: 'runtime/elce-engine.js',
      },
    })
    expect(Object.keys(scenarioManifest.scenes)).toContain(`scene-page-${trial.page.id}`)
    expect(readSightyText('scenario.mjs')).not.toContain('ElceDocument')
    expect(readSightyText('scenario.mjs')).not.toContain('createQuizHuntScenarioModel')
    expect(readSightyText('loader.mjs')).toContain('loadSightyPackage')
    const quizHuntRuntime = JSON.parse(readSightyText('quiz-hunt-runtime.json')) as {
      schemaVersion: number
      documentData: Readonly<{ version: number; document: Readonly<{ id: string }> }>
      mediaSources: Readonly<Record<string, string>>
    }
    expect(quizHuntRuntime).toMatchObject({
      schemaVersion: 1,
      documentData: { version: 1, document: { id: document.id } },
      mediaSources: { [media.id]: './media/media-0.svg' },
    })
    expect(sightyFiles['media/media-0.svg']).toEqual(mediaBytes)
    const mediaPath = Object.keys(sightyFiles).find((path) => path.startsWith('scenes/') && path.endsWith('.svg'))
    expect(mediaPath).toBeDefined()
    expect(sightyFiles[mediaPath!]).toEqual(mediaBytes)
    expect(Object.keys(sightyFiles).some((path) => path.endsWith('/scene/functions.mjs'))).toBe(true)

    const extractionDirectory = await mkdtemp(join(tmpdir(), 'quiz-hunt-sighty-package-'))
    try {
      await Promise.all(Object.entries(sightyFiles).map(async ([path, bytes]) => {
        const destination = join(extractionDirectory, path)
        await mkdir(dirname(destination), { recursive: true })
        await writeFile(destination, bytes)
      }))
      const scenarioPackage = await import(pathToFileURL(join(extractionDirectory, 'scenario.mjs')).href) as {
        scenario: Readonly<{
          views?: unknown
          scenes?: Readonly<Record<string, unknown>>
          actions?: Readonly<Record<string, unknown>>
          guards?: Readonly<Record<string, unknown>>
        }>
      }
      const sourceScenario = createQuizHuntScenarioModel(document, { [media.id]: './media/media-0.svg' }, 'release').scenario
      const sourceSceneResetCallbacks = Object.values(sourceScenario.scenes ?? {}).flatMap((source) =>
        typeof source === 'object' && source !== null && 'onReset' in source ? [source.onReset] : [],
      )
      const packagedSceneResetCallbacks = Object.values(scenarioPackage.scenario.scenes ?? {}).flatMap((source) =>
        typeof source === 'object' && source !== null && 'onReset' in source ? [source.onReset] : [],
      )
      const sourceCallbacks = collectCallbacksByPath({
        views: sourceScenario.views,
        actions: sourceScenario.actions,
        guards: sourceScenario.guards,
        sceneResetCallbacks: sourceSceneResetCallbacks,
      })
      const packagedCallbacks = collectCallbacksByPath({
        views: scenarioPackage.scenario.views,
        actions: scenarioPackage.scenario.actions,
        guards: scenarioPackage.scenario.guards,
        sceneResetCallbacks: packagedSceneResetCallbacks,
      })
      expect(sourceCallbacks.size).toBeGreaterThan(0)
      expect([...packagedCallbacks.keys()].toSorted()).toEqual([...sourceCallbacks.keys()].toSorted())
      for (const [path, sourceCallback] of sourceCallbacks) {
        const sourceIdentityPaths = [...sourceCallbacks]
          .filter(([, candidate]) => candidate === sourceCallback)
          .map(([candidatePath]) => candidatePath)
          .toSorted()
        const packagedCallback = packagedCallbacks.get(path)
        expect(packagedCallback).toBeTypeOf('function')
        const packagedIdentityPaths = [...packagedCallbacks]
          .filter(([, candidate]) => candidate === packagedCallback)
          .map(([candidatePath]) => candidatePath)
          .toSorted()
        expect(packagedIdentityPaths).toEqual(sourceIdentityPaths)
      }
    } finally {
      await rm(extractionDirectory, { recursive: true, force: true })
    }
  }, 60_000)
})
