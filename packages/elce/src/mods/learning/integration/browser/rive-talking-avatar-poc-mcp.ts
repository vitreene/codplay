import { applyDocumentCommand, createCardBdcCommand, createDefaultPageCommand } from '../../../../domain/commands/document-commands'
import type { CodPlayInstance } from 'codplay'
import { LearningPlayer } from '../../reading/learning-player'
import { learningDocumentService } from '../../document/learning-document-service'
import { INITIAL_PROJECT_TEST_STATE } from '../../reading/learning-test-state-types'
import { DEFAULT_PRESET_ID, PAGE_TYPE } from '../../learning-definition'
import { PAGE_LOCATION } from '../../organization/learning-page-placement'
import { createTemporaryRiveTalkingAvatarPocDemoData } from '../../../../resources/pages/diapo/rive-talking-avatar-poc/rive-talking-avatar-poc-demo-data'

const stage = requiredElement<HTMLElement>('#talking-head-mcp-stage')
const status = requiredElement<HTMLOutputElement>('#talking-head-mcp-status')
const seek = requiredElement<HTMLInputElement>('#talking-head-mcp-seek')
stage.style.width = '100%'
stage.style.height = '100%'

let player: LearningPlayer | undefined
let voice: HTMLAudioElement | undefined
let removePublicEventListener: (() => void) | undefined
const publicEvents: string[] = []

/** Creates a four-card Diapo document whose content and identities belong to this browser fixture. */
function createPocDocument() {
  const initial = learningDocumentService.createInitialDocument()
  const command = createDefaultPageCommand(
    initial,
    { kind: PAGE_LOCATION.SCENARIO },
    'Tête parlante',
    PAGE_TYPE.DIAPO,
  )
  let document = applyDocumentCommand(initial, command)
  document = applyDocumentCommand(document, createCardBdcCommand(
    'mcp-talking-head-card-2', command.bdcId, 1, DEFAULT_PRESET_ID.TEXT_SHORT,
  ))
  document = applyDocumentCommand(document, createCardBdcCommand(
    'mcp-talking-head-card-3', command.bdcId, 2, DEFAULT_PRESET_ID.TEXT_SHORT,
  ))
  document = applyDocumentCommand(document, createCardBdcCommand(
    'mcp-talking-head-card-4', command.bdcId, 3, DEFAULT_PRESET_ID.TEXT_SHORT,
  ))
  const carousel = document.bdcs.find((bdc) => bdc.id === command.bdcId)
  const page = document.pages.find((entry) => entry.id === command.pageId)
  if (carousel?.carousel === null || carousel?.carousel === undefined || page === undefined) {
    throw new Error('Le document MCP de tête parlante n’a pas de Diapo Carousel.')
  }
  const cardIds = carousel.carousel.cards.map((card) => card.bdcId)
  if (cardIds.length !== 4) throw new Error(`Quatre cartes étaient attendues, ${cardIds.length} ont été créées.`)
  return { document, page, cardIds }
}

/** Finds one required fixture element and fails before mounting a partial test page. */
function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (element === null) throw new Error(`L’élément du fixture ${selector} est absent.`)
  return element
}

/** Reads the current audio and visible projection from the actual Learning player DOM. */
function observePlayer() {
  voice ??= stage.querySelector<HTMLAudioElement>('audio[src$="speech.mp3"]') ?? undefined
  const pageInstance = player === undefined ? undefined : getPageInstance()
  const pageProgress = pageInstance?.telco.getProgress()
  const pageState = pageInstance?.telco.getState()
  const cards = [...stage.querySelectorAll<HTMLElement>('.elce-carousel-view')].map((card) => ({
    id: card.id,
    opacity: getComputedStyle(card).opacity,
    transform: getComputedStyle(card).transform,
  }))
  const avatar = stage.querySelector<HTMLElement>('[id^="rive-talking-avatar-"][id$="-stage"]')
  const avatarBounds = avatar?.getBoundingClientRect()
  return {
    pageId: pocPage.id,
    voiceTimeMs: voice === undefined ? null : Math.round(voice.currentTime * 1000),
    voicePaused: voice?.paused ?? null,
    voiceReadyState: voice?.readyState ?? null,
    runtimeTimelineMs: pageProgress?.timelineMs ?? null,
    runtimeStatus: pageState?.status ?? null,
    runtimeSequenceEnded: pageState?.sequenceEnded ?? null,
    publicEvents,
    cardIds,
    cards,
    carouselNavigationCount: stage.querySelectorAll('.elce-carousel__navigation').length,
    avatarBounds: avatarBounds === undefined ? null : {
      x: Math.round(avatarBounds.x),
      y: Math.round(avatarBounds.y),
      width: Math.round(avatarBounds.width),
      height: Math.round(avatarBounds.height),
    },
  }
}

/** Returns the runtime API owned by the real Learning player. */
function getPlayerRuntimeApi() {
  if (player === undefined) throw new Error('Le player Elcé n’est pas encore initialisé.')
  return (player as unknown as {
    runtime: {
      api: {
        events: { onEvent: (listener: (event: { name: string }) => void) => () => void }
        getInstance: (sceneKey: string) => CodPlayInstance | undefined
      }
    }
  }).runtime.api
}

/** Resolves the page occurrence owned by the real Learning player runtime. */
function getPageInstance(): CodPlayInstance {
  const runtimeApi = getPlayerRuntimeApi()
  const instance = runtimeApi.getInstance(`scene-${pocPage.id}`)
  if (instance === undefined) throw new Error('L’instance Sighty de la page n’est pas montée.')
  return instance
}

/** Starts the master audio through a real browser click or the exposed MCP control. */
async function playVoice() {
  observePlayer()
  if (voice === undefined) throw new Error('La piste vocale n’est pas encore montée dans le player.')
  await getPageInstance().telco.play()
  status.textContent = 'Lecture de la voix.'
  return observePlayer()
}

/** Pauses the master audio without bypassing its CodPlay synchronization. */
async function pauseVoice() {
  if (voice === undefined) throw new Error('La piste vocale n’est pas encore montée dans le player.')
  await getPageInstance().telco.pause()
  status.textContent = 'Voix en pause.'
  return observePlayer()
}

/** Seeks the master audio and reports the actual runtime projection afterward. */
async function seekVoice(timeMs: number) {
  if (voice === undefined) throw new Error('La piste vocale n’est pas encore montée dans le player.')
  const instance = getPageInstance()
  await instance.telco.pause()
  await instance.telco.seek(timeMs)
  seek.value = String(timeMs)
  await new Promise<void>((resolve) => window.setTimeout(resolve, 150))
  status.textContent = `Position de la voix : ${Math.round(voice.currentTime * 1000)} ms.`
  return observePlayer()
}

/** Stops and destroys the real player instance mounted by this fixture. */
function destroyPlayer() {
  player?.destroy()
  player = undefined
  removePublicEventListener?.()
  removePublicEventListener = undefined
  publicEvents.length = 0
  voice?.pause()
  voice = undefined
  stage.replaceChildren()
  status.textContent = 'Player détruit.'
}

requiredElement<HTMLButtonElement>('#talking-head-mcp-play').addEventListener('click', () => {
  void playVoice().catch((error: unknown) => { status.textContent = String(error) })
})
requiredElement<HTMLButtonElement>('#talking-head-mcp-pause').addEventListener('click', () => {
  void pauseVoice().catch((error: unknown) => { status.textContent = String(error) })
})
requiredElement<HTMLButtonElement>('#talking-head-mcp-seek-back').addEventListener('click', () => {
  void seekVoice(1000).catch((error: unknown) => { status.textContent = String(error) })
})
requiredElement<HTMLButtonElement>('#talking-head-mcp-seek-forward').addEventListener('click', () => {
  void seekVoice(7500).catch((error: unknown) => { status.textContent = String(error) })
})
requiredElement<HTMLButtonElement>('#talking-head-mcp-destroy').addEventListener('click', destroyPlayer)
seek.addEventListener('input', () => {
  void seekVoice(Number(seek.value)).catch((error: unknown) => { status.textContent = String(error) })
})

Object.assign(window, {
  riveTalkingAvatarPocMcp: {
    play: playVoice,
    pause: pauseVoice,
    seek: seekVoice,
    observe: observePlayer,
    destroy: destroyPlayer,
  },
})

const { document: pocDocument, page: pocPage, cardIds } = createPocDocument()
const avatarOptions = createTemporaryRiveTalkingAvatarPocDemoData(cardIds)
void (async () => {
  const testState = { ...INITIAL_PROJECT_TEST_STATE, profileEnabled: false, profileSubmitted: true }
  player = new LearningPlayer({
    stage,
    document: pocDocument,
    startPageId: pocPage.id,
    testState,
    temporaryRiveTalkingAvatarByPageId: { [pocPage.id]: avatarOptions },
    onPageChange: (activePageId) => { status.dataset.activePageId = activePageId },
    onTestStateChange: (state) => { status.dataset.finishedPageIds = state.finishedPageIds.join(',') },
    onLog: (message, level) => {
      if (level === 'error') status.textContent = `Erreur player : ${message}`
    },
  })
  removePublicEventListener = getPlayerRuntimeApi().events.onEvent((event) => {
    publicEvents.push(event.name)
    status.dataset.publicEvents = publicEvents.join(',')
  })
  await player.initialize()
  observePlayer()
  seek.max = String(avatarOptions.voice.durationMs)
  status.dataset.ready = 'true'
  status.textContent = 'Player prêt. Lance la voix pour tester la synchronisation.'
})().catch((error: unknown) => {
  status.dataset.initializationError = error instanceof Error ? error.stack ?? error.message : String(error)
  status.textContent = `Erreur de préparation : ${String(error)}`
})
