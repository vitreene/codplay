import type { CodPlayOptions } from 'codplay'
import { applyDocumentCommand, createPageCommand, createQuestionBdcCommand, createStandaloneCardBdcCommand } from '../../../../domain/commands/document-commands'
import { DEFAULT_PRESET_ID } from '../../learning-definition'
import { PAGE_LOCATION } from '../../organization/learning-page-placement'
import { learningDocumentService } from '../../document/learning-document-service'
import { LearningPlayer } from '../../reading/learning-player'
import { INITIAL_PROJECT_TEST_STATE, type ProjectTestState } from '../../reading/learning-test-state-types'
import { ElceQuestionService } from '../../../../resources/bdcs/question/domain/question-service'
import { QUESTION_TYPE } from '../../../../resources/bdcs/question/question-config'
import type { ProfileDefinition } from '../../profile/domain/learning-profile-types'
import type { RichTextDocument } from '../../../../resources/bdcs/section/domain/section-types'

document.title = 'Elcé — validation du player Learning'
document.body.innerHTML = '<main id="l6-fixture-main"><h1 id="l6-fixture-heading">Validation du player Learning</h1><output id="l6-fixture-status" role="status" aria-live="polite">Démarrage…</output><button id="l6-fixture-flush" type="button">Traiter les frames en attente</button><button id="l6-fixture-continue" type="button" disabled>Continuer la lecture</button><button id="l6-fixture-destroy" type="button" disabled>Détruire le player</button><div id="l6-fixture-stage"></div></main>'

const stage = document.querySelector<HTMLElement>('#l6-fixture-stage')
const status = document.querySelector<HTMLOutputElement>('#l6-fixture-status')
const flushButton = document.querySelector<HTMLButtonElement>('#l6-fixture-flush')
const continueButton = document.querySelector<HTMLButtonElement>('#l6-fixture-continue')
const destroyButton = document.querySelector<HTMLButtonElement>('#l6-fixture-destroy')

if (stage === null || status === null || flushButton === null || continueButton === null || destroyButton === null) {
  throw new Error('The Learning player fixture markup is incomplete.')
}

const fixtureStage = stage
const fixtureStatus = status
const fixtureFlushButton = flushButton
const fixtureContinueButton = continueButton
const fixtureDestroyButton = destroyButton
fixtureStage.style.height = 'calc(100vh - 96px)'
fixtureStage.style.width = '100%'
fixtureStage.style.overflow = 'hidden'
const pendingFrames = new Map<number, () => void>()
let nextFrameRequestId = 0

/** Creates a Learning document with a required profile, a long Flux page, a Question, and a next page. */
function createFixtureDocument() {
  const initial = learningDocumentService.createInitialDocument()
  const pageA = initial.pages.find((page) => page.id === 'page-a')
  const sectionBdcId = pageA?.bdcIds[0]
  const sectionBdc = initial.bdcs.find((bdc) => bdc.id === sectionBdcId)
  const chapter = initial.chapters[0]
  if (pageA === undefined || sectionBdc?.section === null || sectionBdc === undefined || chapter === undefined) {
    throw new Error('The default Learning document is missing its first page, Section, or chapter.')
  }

  const longParagraphs = Array.from({ length: 28 }, (_, index) => {
    const text = `Paragraphe ${index + 1} — le lecteur attend la fin du défilement avant de libérer la page suivante.`
    return { text, node: { type: 'paragraph', content: [{ type: 'text', text }] } }
  })
  const content: RichTextDocument = { type: 'doc', content: longParagraphs.map(({ node }) => node) }
  const markup = longParagraphs
    .map(({ text }, index) => `<p id="l6-fixture-paragraph-${index + 1}">${text}</p>`)
    .join('')
  const withContent = applyDocumentCommand(initial, {
    type: 'bdc.section.update',
    bdcId: sectionBdc.id,
    title: 'Texte de validation',
    markup,
    content,
  })
  const withNextPage = applyDocumentCommand(withContent, createPageCommand({
    pageId: 'l6-page-b',
    bdcId: 'l6-section-b',
    placement: { kind: PAGE_LOCATION.CHAPTER, chapterId: chapter.id },
  }))
  const withQuestion = applyDocumentCommand(
    withNextPage,
    createQuestionBdcCommand('l6-question-a', pageA.id, 1),
  )
  const defaultQuestion = withQuestion.bdcs.find((bdc) => bdc.id === 'l6-question-a')?.question
  if (defaultQuestion === null || defaultQuestion === undefined) {
    throw new Error('The Learning Question fixture could not be created.')
  }

  const questionService = new ElceQuestionService()
  const question = questionService.setPrompt(
    questionService.changeType(defaultQuestion, QUESTION_TYPE.TRUE_FALSE),
    'Le parcours de lecture est-il actif ?',
  )
  const withAuthoredQuestion = applyDocumentCommand(withQuestion, {
    type: 'bdc.question.update',
    bdcId: 'l6-question-a',
    question,
  })
  const withMedia = applyDocumentCommand(withAuthoredQuestion, {
    type: 'media.add',
    media: { id: 'l6-media-b', name: 'validation.svg', mimeType: 'image/svg+xml', size: 100, caption: '' },
  })
  const withImageCard = applyDocumentCommand(withMedia, createStandaloneCardBdcCommand(
    'l6-card-b',
    'l6-page-b',
    DEFAULT_PRESET_ID.TEXT_IMAGE,
  ))
  const withImage = applyDocumentCommand(withImageCard, {
    type: 'bdc.card.media.set',
    bdcId: 'l6-card-b',
    mediaId: 'l6-media-b',
  })
  const profile: ProfileDefinition = {
    properties: [{
      id: 'l6-profile-name',
      name: 'name',
      label: 'Nom',
      type: 'text',
      required: true,
      choices: [],
    }],
    fieldPropertyIds: ['l6-profile-name'],
    constraints: [],
    readingConstraints: [],
  }

  return applyDocumentCommand(withImage, { type: 'profile.definition.update', profile })
}

/** Supplies deterministic host frames for the actual CodPlay runtime in background Safari MCP. */
function createMcpFrameScheduler(): NonNullable<CodPlayOptions['frameScheduler']> {
  return {
    request: (callback) => {
      nextFrameRequestId += 1
      pendingFrames.set(nextFrameRequestId, callback)
      fixtureStatus.dataset.pendingFrameCount = String(pendingFrames.size)
      return nextFrameRequestId
    },
    cancel: (requestId) => {
      pendingFrames.delete(requestId)
      fixtureStatus.dataset.pendingFrameCount = String(pendingFrames.size)
    },
  }
}

const fixtureDocument = createFixtureDocument()
const frameScheduler = createMcpFrameScheduler()
let testState: ProjectTestState = INITIAL_PROJECT_TEST_STATE
let player: LearningPlayer | undefined

/** Flushes runtime frames after yielding so native scroll observations can reach CodPlay. */
async function flushScheduledFrames(remainingBatches = 64): Promise<void> {
  await new Promise<void>((resolve) => window.setTimeout(resolve, 100))
  const callbacks = [...pendingFrames.values()]
  pendingFrames.clear()
  callbacks.forEach((callback) => callback())
  fixtureStatus.dataset.pendingFrameCount = String(pendingFrames.size)
  fixtureStatus.dataset.flushedFrameCount = String(
    Number(fixtureStatus.dataset.flushedFrameCount ?? '0') + callbacks.length,
  )
  if (remainingBatches <= 1 || callbacks.length === 0) return
  await Promise.resolve()
  await flushScheduledFrames(remainingBatches - 1)
}

/** Mounts a fresh real LearningPlayer with the current in-memory consultation state. */
function createPlayer(startPageId?: string): void {
  player = new LearningPlayer({
    stage: fixtureStage,
    document: fixtureDocument,
    ...(startPageId === undefined ? {} : { startPageId }),
    testState,
    mediaSources: {
      'l6-media-b': `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#168f56" /></svg>')}`,
    },
    frameScheduler,
    onTestStateChange: (nextState) => {
      testState = nextState
      fixtureStatus.dataset.profileSubmitted = String(nextState.profileSubmitted)
      fixtureStatus.dataset.finishedPageIds = nextState.finishedPageIds.join(',')
      fixtureStatus.dataset.questionAnswerCount = String(Object.keys(nextState.questionAnswers).length)
      if (nextState.profileSubmitted) fixtureContinueButton.disabled = false
    },
    onLog: (message, level) => {
      if (level === 'error') fixtureStatus.textContent = `Erreur du player : ${message}`
    },
  })
  fixtureDestroyButton.disabled = false
  void player.initialize().then(() => {
    fixtureStatus.textContent = startPageId === undefined
      ? 'Profil prêt dans la session mémoire.'
      : `Lecture prête sur ${startPageId}.`
  }).catch((error: unknown) => {
    fixtureStatus.textContent = `Erreur du player : ${String(error)}`
  })
}

fixtureContinueButton.addEventListener('click', () => {
  if (!testState.profileSubmitted) return
  player?.destroy()
  createPlayer('page-a')
})

fixtureFlushButton.addEventListener('click', () => {
  void flushScheduledFrames()
})

fixtureDestroyButton.addEventListener('click', () => {
  player?.destroy()
  player = undefined
  fixtureDestroyButton.disabled = true
  fixtureStatus.textContent = 'Player détruit.'
})

window.addEventListener('pagehide', () => player?.destroy(), { once: true })
createPlayer()
