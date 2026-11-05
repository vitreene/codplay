import { strFromU8, unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { QuizHuntDocumentService } from '../document/quiz-hunt-document-service'
import { createQuizHuntGameCatalog } from '../reading/quiz-hunt-game-catalog'
import { writeQuizHuntDocument } from '../persistence/quiz-hunt-document-codec'
import { exportQuizHuntSightyPackage } from '../persistence/server/quiz-hunt-sighty-exporter'
import { runQuizHuntScormPackage } from '../persistence/server/quiz-hunt-scorm-package-runner'

describe('Quiz Hunt SCORM package', () => {
  it('packages the authored game and media into one monoSCO archive', async () => {
    const documents = new QuizHuntDocumentService()
    const initial = documents.createInitialDocument('quiz-hunt-scorm', 'Quiz Hunt SCORM')
    const questionChapter = initial.chapters.find((chapter) => chapter.type === 'questions')!
    const finalChapter = initial.chapters.find((chapter) => chapter.type === 'finals')!
    const trialPage = initial.pages.find((page) => page.chapterId === questionChapter.id)!
    const createdFinal = documents.createPage(initial, finalChapter.id, 'Finale rouge')
    const finalPage = createdFinal.pages.find((page) => page.chapterId === finalChapter.id)!
    const group = initial.settings.groups[0]!
    const authored = documents.updateSettings(
      documents.setPageColor(
        documents.setPageColor(createdFinal, trialPage.id, group.id),
        finalPage.id,
        group.id,
      ),
      { seed: 7, random: false },
    )
    const trial = createQuizHuntGameCatalog(authored, 'release').trials[0]
    if (trial === undefined) throw new Error('The SCORM fixture must draw a trial question.')
    const mediaBytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><title>Quiz Hunt</title></svg>')
    const media = {
      id: 'quiz-hunt-scorm-media',
      name: 'indice.svg',
      mimeType: 'image/svg+xml',
      size: mediaBytes.byteLength,
      caption: 'Indice illustré',
    }
    const document = documents.attachQuestionMedia(authored, trial.questionBdc.id, media)
    const sightyPackage = await exportQuizHuntSightyPackage(
      writeQuizHuntDocument(document),
      new Map([[media.id, mediaBytes]]),
    )

    const archive = unzipSync(await runQuizHuntScormPackage(sightyPackage, '2004v4'))
    const manifest = strFromU8(archive['imsmanifest.xml'] ?? new Uint8Array())
    const launcher = strFromU8(archive['quiz-hunt.html'] ?? new Uint8Array())
    const runtimeData = JSON.parse(strFromU8(archive['quiz-hunt-runtime.json'] ?? new Uint8Array())) as Readonly<{
      documentData: Readonly<{ document: Readonly<{ id: string }> }>
      mediaSources: Readonly<Record<string, string>>
    }>

    expect([...manifest.matchAll(/<item\b/gu)]).toHaveLength(1)
    expect([...manifest.matchAll(/<resource\b/gu)]).toHaveLength(1)
    expect(manifest).toContain('Quiz Hunt SCORM')
    expect(launcher).toContain('startQuizHuntScormPackageRuntime')
    expect(archive['runtime/elce-scorm-runtime.js']).toBeDefined()
    expect(archive['media/media-0.svg']).toEqual(mediaBytes)
    expect(runtimeData.documentData.document.id).toBe(document.id)
    expect(runtimeData.mediaSources[media.id]).toBe('./media/media-0.svg')
  }, 60_000)
})
