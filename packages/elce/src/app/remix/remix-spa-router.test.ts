// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { run } from 'remix/spa'
import { createElceSpaRouter } from './remix-spa-router'

describe('Elcé Remix SPA route', () => {
  let dispose: (() => void) | undefined

  afterEach(() => {
    dispose?.()
    dispose = undefined
    document.body.replaceChildren()
    window.history.replaceState(null, '', '/')
  })

  it('does not mount editor proof views in the popup player, even when its URL carries a proof query', async () => {
    window.history.replaceState(null, '', '/?__remixSectionProof=1&elce-preview-session=preview-1&elce-preview-page=page-a')
    const app = run(createElceSpaRouter(null, null))
    dispose = () => app.dispose()
    await app.ready()

    expect(document.querySelector('#elce-react-temp-host')).not.toBeNull()
    expect(document.querySelector('#elce-remix-section-proof')).toBeNull()
    expect(document.querySelector('#elce-remix-card-proof')).toBeNull()
    expect(document.querySelector('#elce-remix-lifecycle-proof')).toBeNull()
  })
})
