import { run } from 'remix/spa'

import { createLearningAuthoringComposition } from '../../mods/learning/composition/authoring-composition'
import { createLearningPreviewComposition } from '../../mods/learning/composition/preview-composition'
import { POPUP_PREVIEW_PROJECT_PARAM, POPUP_PREVIEW_SESSION_PARAM } from '../../core/preview/popup-preview-messages'
import { createElceSpaRouter } from './remix-spa-router'

/** Starts the matching Learning composition inside the Remix browser runtime. */
async function startRemixEditor(): Promise<void> {
  const searchParams = new URLSearchParams(window.location.search)
  const isPreview = searchParams.has(POPUP_PREVIEW_SESSION_PARAM) || searchParams.has(POPUP_PREVIEW_PROJECT_PARAM)
  const composition = isPreview ? null : await createLearningAuthoringComposition()
  const previewComposition = isPreview ? createLearningPreviewComposition(searchParams) : null
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

void startRemixEditor().catch((error: unknown) => {
  console.error('Le démarrage Remix de l’éditeur Elcé a échoué.', error)
})
