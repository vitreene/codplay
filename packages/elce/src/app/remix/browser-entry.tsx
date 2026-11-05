import { run } from 'remix/spa'

import { POPUP_PREVIEW_PROJECT_PARAM, POPUP_PREVIEW_SESSION_PARAM } from '../../core/preview/popup-preview-messages'
import { createElceSpaRouter } from './remix-spa-router'

/** Starts the selected mod composition inside the Remix browser runtime. */
async function startRemixEditor(): Promise<void> {
  const searchParams = new URLSearchParams(window.location.search)
  const isQuizHunt = searchParams.get('mod') === 'quiz-hunt'
  const isPreview = searchParams.has(POPUP_PREVIEW_SESSION_PARAM) || searchParams.has(POPUP_PREVIEW_PROJECT_PARAM)
  const composition = isPreview ? null : await createAuthoringComposition(isQuizHunt)
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

  const dispose = (): void => {
    void Promise.all([
      composition?.dispose() ?? Promise.resolve(),
      previewComposition?.dispose() ?? Promise.resolve(),
    ]).finally(() => runtime.dispose())
  }
  window.addEventListener('pagehide', dispose, { once: true })
}

/** Loads the selected authoring mod only when its route is active. */
async function createAuthoringComposition(isQuizHunt: boolean) {
  if (isQuizHunt) {
    const { createQuizHuntAuthoringComposition } = await import('../../mods/quiz-hunt/composition/quiz-hunt-authoring-composition')
    return createQuizHuntAuthoringComposition()
  }
  const { createLearningAuthoringComposition } = await import('../../mods/learning/composition/authoring-composition')
  return createLearningAuthoringComposition()
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
