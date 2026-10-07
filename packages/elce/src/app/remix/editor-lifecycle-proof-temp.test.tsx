// @vitest-environment jsdom
import { createActor } from 'xstate'
import { describe, expect, it, vi } from 'vitest'
import { jsx } from 'remix/ui/jsx-runtime'
import { render } from 'remix/ui/test'
import { PAGE_LOCATION } from '../../config/document-config'
import { controllerMachine } from '../controller/controller-machine'
import { EditorActionsFacade } from '../facades/editor-actions-facade'
import { EditorContextProvider } from './editor-context'
import { RemixEditorLifecycleProofTemp } from './editor-lifecycle-proof-temp'

describe('Remix editor lifecycle proof', () => {
  it('renders the live actor selection and unsubscribes when removed', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new EditorActionsFacade(controller)
    actions.createPage({ kind: PAGE_LOCATION.SCENARIO })
    const pageA = controller.getSnapshot().context.document.pages[0]!
    const pageB = controller.getSnapshot().context.document.pages[1]!
    const subscribeSpy = vi.spyOn(controller, 'subscribe')

    const rendered = render(jsx(EditorContextProvider, {
      controller,
      actions,
      children: jsx(RemixEditorLifecycleProofTemp, {}),
    }))

    expect(rendered.$('#elce-remix-lifecycle-proof-current-page')?.textContent).toBe('Page sélectionnée : Page B')
    expect(rendered.$(`#elce-remix-lifecycle-proof-select-${pageB.id}`)?.getAttribute('aria-pressed')).toBe('true')
    expect(subscribeSpy).toHaveBeenCalledTimes(1)

    await rendered.act(() => rendered.$(`#elce-remix-lifecycle-proof-select-${pageA.id}`)?.click())

    expect(controller.getSnapshot().context.selectedPageId).toBe(pageA.id)
    expect(rendered.$('#elce-remix-lifecycle-proof-current-page')?.textContent).toBe('Page sélectionnée : Page A')
    expect(rendered.$(`#elce-remix-lifecycle-proof-select-${pageA.id}`)?.getAttribute('aria-pressed')).toBe('true')

    const subscription = subscribeSpy.mock.results[0]?.value
    expect(subscription).toBeDefined()
    if (subscription === undefined) throw new Error('The Remix view did not subscribe to the actor.')
    const unsubscribeSpy = vi.spyOn(subscription, 'unsubscribe')

    rendered.cleanup()
    expect(unsubscribeSpy).toHaveBeenCalledOnce()

    actions.selectPage(pageB.id)
    expect(controller.getSnapshot().context.selectedPageId).toBe(pageB.id)
    controller.stop()
  })
})
