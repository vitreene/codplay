import { run } from 'remix/spa'

import {
  POPUP_PREVIEW_MOD_PARAM,
  POPUP_PREVIEW_PROJECT_PARAM,
  POPUP_PREVIEW_SESSION_PARAM,
} from '../../core/preview/popup-preview-messages'
import { createElceSpaRouter } from './remix-spa-router'
import { consumeChooserMod, resolveElceAuthoringLocation } from './elce-authoring-routes.ts'

/** Starts the selected mod composition inside the Remix browser runtime. */
async function startRemixEditor(): Promise<void> {
  const url = new URL(window.location.href)
  const searchParams = url.searchParams
  const isQuizHunt = searchParams.get(POPUP_PREVIEW_MOD_PARAM) === 'quiz-hunt'
  const isPreview = searchParams.has(POPUP_PREVIEW_SESSION_PARAM) || searchParams.has(POPUP_PREVIEW_PROJECT_PARAM)
  const location = resolveElceAuthoringLocation(url.pathname)
  const authoringMod = location.kind === 'document'
    ? location.mod
    : location.kind === 'chooser'
      ? consumeChooserMod(window.sessionStorage)
      : 'learning'
  const composition = isPreview ? null : await createAuthoringComposition(
    authoringMod,
    location.kind === 'document' ? location.documentId : undefined,
  )
  const previewComposition = isPreview
    ? isQuizHunt ? await createQuizHuntPreview(searchParams) : await createLearningPreview(searchParams)
    : null
  const runtime = run(createElceSpaRouter({
    authoringRoot: composition?.authoringRoot ?? null,
    previewRoot: previewComposition?.root ?? null,
  }), {
    fallback: <p
      id="elce-remix-loading"
      role="status"
    >
      Chargement de l’éditeur…
    </p>,
  })
  await runtime.ready()

  /** Reopens the document named by browser history through the active mod session. */
  const handlePopState = (): void => {
    const nextLocation = resolveElceAuthoringLocation(window.location.pathname)
    if (nextLocation.kind !== 'document') return
    if (nextLocation.mod !== authoringMod) {
      window.location.reload()
      return
    }
    void composition?.openDocument(nextLocation.documentId)
  }
  window.addEventListener('popstate', handlePopState)

  const dispose = (): void => {
    window.removeEventListener('popstate', handlePopState)
    void Promise.all([
      composition?.dispose() ?? Promise.resolve(),
      previewComposition?.dispose() ?? Promise.resolve(),
    ]).finally(() => runtime.dispose())
  }
  window.addEventListener('pagehide', dispose, { once: true })
}

/** Loads the selected authoring mod only when its route is active. */
async function createAuthoringComposition(mod: 'learning' | 'quiz-hunt', requestedProjectId?: string) {
  if (mod === 'quiz-hunt') {
    const { createQuizHuntAuthoringComposition } = await import('../../mods/quiz-hunt/composition/quiz-hunt-authoring-composition')
    return createQuizHuntAuthoringComposition(requestedProjectId)
  }
  const { createLearningAuthoringComposition } = await import('../../mods/learning/composition/authoring-composition')
  return createLearningAuthoringComposition(requestedProjectId)
}

/** Keeps Learning's preview modules out of Quiz Hunt's authoring bundle. */
async function createLearningPreview(searchParams: URLSearchParams) {
  const { createLearningPreviewComposition } = await import('../../mods/learning/composition/preview-composition')
  return createLearningPreviewComposition(searchParams)
}

/** Loads Quiz Hunt's player only in its own preview window. */
async function createQuizHuntPreview(searchParams: URLSearchParams) {
  const { createQuizHuntPreviewComposition } = await import('../../mods/quiz-hunt/composition/quiz-hunt-preview-composition')
  return createQuizHuntPreviewComposition(searchParams)
}

void startRemixEditor().catch((error: unknown) => {
  console.error('Le démarrage Remix de l’éditeur Elcé a échoué.', error)
})
