import { afterEach, describe, expect, it } from 'vitest'
import { ElceCardService } from '../../../../../resources/bdcs/card/domain/card-service'
import { ElceQuestionService } from '../../../../../resources/bdcs/question/domain/question-service'
import { SECTION_BDC_TYPE } from '../../../../../resources/bdcs/section/section-config'
import { QuizHuntDocumentService } from '../../../document/quiz-hunt-document-service'
import { learningDocumentService } from '../../../../learning/document/learning-document-service'
import { LearningSqliteProjectPersistence } from '../../../../learning/persistence/server/sqlite/learning-sqlite-project-persistence'
import { QuizHuntProjectDocument } from '../../quiz-hunt-document-codec'
import { QuizHuntSqliteProjectPersistence } from './quiz-hunt-sqlite-project-persistence'
import { openElceProjectDatabase } from '../../../../../server/elce-project-database'
import type { SqliteDatabase } from 'remix/data-table/sqlite'

describe('Quiz Hunt SQLite project persistence', () => {
  let database: SqliteDatabase | undefined

  afterEach(async () => {
    await database?.close()
    database = undefined
  })

  it('saves and reopens shared BDC and media rows beside Learning in the same database', async () => {
    database = await openElceProjectDatabase(':memory:')
    const quizHunt = new QuizHuntSqliteProjectPersistence(database)
    const learning = new LearningSqliteProjectPersistence(database)
    const documents = new QuizHuntDocumentService()
    const questions = new ElceQuestionService()
    const cards = new ElceCardService()
    const initial = documents.createInitialDocument('quiz-hunt-persistence', 'Quiz Hunt persistance')
    const questionPage = initial.pages.find((page) => page.chapterId !== null)!
    const finalBank = initial.chapters.find((chapter) => chapter.type === 'finals')!
    const questionBdcId = questionPage.bdcIds[0]!
    const group = initial.settings.groups[0]!
    const questionBdc = initial.bdcs.find((bdc) => bdc.id === questionBdcId)!
    const question = questions.setPrompt(questionBdc.question!, 'Quel est le satellite naturel de la Terre ?')
    const withQuestion = documents.updateQuestion(initial, questionBdcId, question)
    const withColor = documents.setPageColor(withQuestion, questionPage.id, group.id)
    const withFinalPage = documents.createPage(withColor, finalBank.id, 'Finale Rouge')
    const finalPage = withFinalPage.pages.at(-1)!
    const withFinalColor = documents.setPageColor(withFinalPage, finalPage.id, group.id)
    const withTrigger = documents.updateSettings(withFinalColor, { extraTriggerPageId: questionPage.id })
    const withSection = documents.addSection(withTrigger, questionPage.id, 0)
    const sectionBdcId = withSection.bdcs.find((bdc) => bdc.type === SECTION_BDC_TYPE)!.id
    const section = {
      ...withSection.bdcs.find((bdc) => bdc.id === sectionBdcId)!.section!,
      title: 'Indice conservé',
      markup: '<p>Regarde vers la Terre.</p>',
    }
    const withSectionContent = documents.updateSection(withSection, sectionBdcId, section)
    const successCardId = withSectionContent.settings.successCardBdcId
    const successCard = withSectionContent.bdcs.find((bdc) => bdc.id === successCardId)!.card!
    const withCard = documents.updateCard(
      withSectionContent,
      successCardId,
      cards.setTextField(successCard, 'title', 'Réponse trouvée'),
    )
    const media = { id: 'quiz-media', name: 'lune.png', mimeType: 'image/png', size: 12, caption: 'La Lune' }
    const withQuestionMedia = documents.attachQuestionMedia(withCard, questionBdcId, media)
    const authored = documents.attachCardMedia(withQuestionMedia, successCardId, media)

    const created = await quizHunt.createProject(new QuizHuntProjectDocument(authored))
    expect(created.kind).toBe('created')
    const access = await quizHunt.acquireEditAccess(authored.id, 'quiz-hunt-editor')
    expect(access.kind).toBe('granted')
    if (access.kind !== 'granted') throw new Error('Quiz Hunt edit access was not granted.')

    const savedDocument = documents.renamePage(authored, questionPage.id, 'Épreuve sauvegardée')
    const saved = await quizHunt.saveDocument(authored.id, 0, new QuizHuntProjectDocument(savedDocument), {
      pageId: 'quiz-hunt-editor',
      grantId: access.grantId,
    })
    expect(saved.kind).toBe('saved')

    const learningDocument = learningDocumentService.createInitialDocument()
    const learningCreated = await learning.createProject(learningDocument)
    expect(learningCreated.kind).toBe('created')

    const quizList = await quizHunt.listProjects()
    const learningList = await learning.listProjects()
    const quizReopened = await quizHunt.findProject(authored.id)
    const learningReopened = await learning.findProject(learningDocument.data.id)
    expect(quizList.map((project) => project.id)).toEqual([authored.id])
    expect(learningList.map((project) => project.id)).toEqual([learningDocument.data.id])
    expect(quizReopened).not.toBeNull()
    expect(learningReopened?.document.data.id).toBe(learningDocument.data.id)

    const restored = quizReopened!.document.data
    expect(restored.name).toBe(savedDocument.name)
    expect(restored.pages.find((page) => page.id === questionPage.id)).toMatchObject({
      name: 'Épreuve sauvegardée',
      colorId: group.id,
    })
    expect(restored.scenarioEntries).toEqual(savedDocument.scenarioEntries)
    expect(restored.settings.groups).toEqual(savedDocument.settings.groups)
    expect(restored.settings.extraTriggerPageId).toBe(questionPage.id)
    expect(restored.medias).toEqual([media])
    expect(await quizHunt.findMediaFile(authored.id, media.id)).toMatchObject({
      id: media.id,
      name: media.name,
      mimeType: media.mimeType,
      size: media.size,
      storageKey: null,
      contentSha256: null,
    })
    expect(restored.bdcs.find((bdc) => bdc.id === questionBdcId)?.question).toEqual({ ...question, mediaId: media.id })
    expect(restored.bdcs.find((bdc) => bdc.id === sectionBdcId)?.section).toEqual(section)
    expect(restored.bdcs.find((bdc) => bdc.id === successCardId)?.card).toEqual({ ...cards.setTextField(successCard, 'title', 'Réponse trouvée'), mediaId: media.id })
  })

  it('stores one resumable game state only for Quiz Hunt projects', async () => {
    database = await openElceProjectDatabase(':memory:')
    const quizHunt = new QuizHuntSqliteProjectPersistence(database)
    const learning = new LearningSqliteProjectPersistence(database)
    const authored = new QuizHuntDocumentService().createInitialDocument('quiz-hunt-game-state')
    const learningDocument = learningDocumentService.createInitialDocument()
    expect((await quizHunt.createProject(new QuizHuntProjectDocument(authored))).kind).toBe('created')
    expect((await learning.createProject(learningDocument)).kind).toBe('created')

    const savedRun = {
      seed: 1_234,
      state: {
        screen: 'menu',
        trialStatus: { 'trial-one': 'success' },
        basket: { red: 'trial-one' },
        timerRemainingMs: 42_000,
        timerStartedAtMs: 1_800_000_000_000,
      },
      savedAt: 1_800_000_001_000,
    } as const

    expect(await quizHunt.saveGameState(authored.id, savedRun)).toBe(true)
    expect(await quizHunt.readGameState(authored.id)).toEqual(savedRun)
    expect(await quizHunt.saveGameState(learningDocument.data.id, savedRun)).toBe(false)
    expect(await quizHunt.readGameState(learningDocument.data.id)).toBeNull()
    expect(await quizHunt.clearGameState(authored.id)).toBe(true)
    expect(await quizHunt.readGameState(authored.id)).toBeNull()
  })
})
