import { createRouter } from 'remix/router'
import { render } from 'remix/spa'
import type { RemixNode } from 'remix/ui'
import { POPUP_PREVIEW_PROJECT_PARAM, POPUP_PREVIEW_SESSION_PARAM } from '../../core/preview/popup-preview-messages'

export interface ElceSpaRoots {
  readonly authoringRoot: RemixNode | null
  readonly previewRoot: RemixNode | null
}

/** Builds the browser route table and selects the root for this request. */
export function createElceSpaRouter(roots: ElceSpaRoots) {
  const rootForUrl = (url: URL): RemixNode | null => url.searchParams.has(POPUP_PREVIEW_SESSION_PARAM)
    || url.searchParams.has(POPUP_PREVIEW_PROJECT_PARAM)
    ? roots.previewRoot
    : roots.authoringRoot
  const router = createRouter({
    middleware: [render()],
    defaultHandler({ render: renderRoute, url }) {
      const root = rootForUrl(url)
      return renderRoute(root ?? <p id="elce-remix-unavailable">Cette page Elcé est indisponible.</p>, { status: 404 })
    },
  })

  router.get('/', ({ render: renderRoute, url }) => {
    const root = rootForUrl(url)
    if (root === null) return renderRoute(<p id="elce-remix-unavailable">Cette page Elcé est indisponible.</p>, { status: 404 })
    return renderRoute(root)
  })

  return router
}
