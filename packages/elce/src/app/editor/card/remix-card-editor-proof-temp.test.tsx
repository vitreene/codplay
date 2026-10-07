// @vitest-environment jsdom
import { createActor } from 'xstate'
import { describe, expect, it, vi } from 'vitest'
import { jsx } from 'remix/ui/jsx-runtime'
import { render } from 'remix/ui/test'
import { BDC_TYPE, DEFAULT_PRESET_ID, PAGE_LOCATION, PAGE_TYPE } from '../../../config/document-config'
import { controllerMachine } from '../../controller/controller-machine'
import { EditorActionsFacade } from '../../facades/editor-actions-facade'
import { EditorContextProvider } from '../../remix/editor-context'
import { RemixCardEditorProofTemp } from './remix-card-editor-proof-temp'

describe('Remix Card editor proof', () => {
  it('edits a standalone Diapo Card and a Carousel child through their existing facades', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new EditorActionsFacade(controller)

    actions.createPage({ kind: PAGE_LOCATION.SCENARIO }, PAGE_TYPE.DIAPO)
    const diapo = controller.getSnapshot().context.document.pages.at(-1)!
    let document = controller.getSnapshot().context.document
    const initialCarousel = document.bdcs.find((bdc) => bdc.type === BDC_TYPE.CAROUSEL && bdc.pageId === diapo.id)!
    const initialCarouselActions = actions.createCarouselEditorActions(
      initialCarousel.id,
      initialCarousel.carousel!,
      initialCarousel.carousel!.cards.map((entry) => document.bdcs.find((bdc) => bdc.id === entry.bdcId)!),
      document.data.revelationDefaults,
    )
    initialCarouselActions.deleteCarousel()
    actions.createStandaloneCard(diapo.id)
    document = controller.getSnapshot().context.document
    const directCardId = document.pages.find((page) => page.id === diapo.id)!.bdcIds[0]!

    actions.createPage({ kind: PAGE_LOCATION.SCENARIO }, PAGE_TYPE.FLUX)
    document = controller.getSnapshot().context.document
    const flux = document.pages.at(-1)!
    actions.createCarousel(flux.id, flux.bdcIds.length)
    document = controller.getSnapshot().context.document
    const carousel = document.bdcs.find((bdc) => bdc.type === BDC_TYPE.CAROUSEL && bdc.pageId === flux.id)!
    const carouselCardId = carousel.carousel!.cards[0]!.bdcId

    const subscribeSpy = vi.spyOn(controller, 'subscribe')
    const rendered = render(jsx(EditorContextProvider, {
      controller,
      actions,
      children: jsx(RemixCardEditorProofTemp, {}),
    }))

    expect(rendered.$(`[data-card-placement="diapo-direct"][data-card-id="${directCardId}"]`)).not.toBeNull()
    expect(rendered.$(`[data-card-placement="carousel-child"][data-card-id="${carouselCardId}"]`)).not.toBeNull()
    expect(subscribeSpy).toHaveBeenCalledOnce()

    await rendered.act(() => {
      const title = rendered.$(`#elce-remix-diapo-card-title-${directCardId}`) as HTMLInputElement
      title.value = 'Titre Diapo'
      title.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await rendered.act(() => {
      const message = rendered.$(`#elce-remix-carousel-card-message-${carouselCardId}`) as HTMLTextAreaElement
      message.value = 'Message Carousel'
      message.dispatchEvent(new Event('input', { bubbles: true }))
    })

    document = controller.getSnapshot().context.document
    expect(document.bdcs.find((bdc) => bdc.id === directCardId)?.card?.title).toBe('Titre Diapo')
    expect(document.bdcs.find((bdc) => bdc.id === carouselCardId)?.card?.message).toBe('Message Carousel')
    expect(document.bdcs.find((bdc) => bdc.id === directCardId)?.pageId).toBe(diapo.id)
    expect(document.bdcs.find((bdc) => bdc.id === carouselCardId)?.parentBdcId).toBe(carousel.id)

    await rendered.act(() => {
      const layout = rendered.$(`#elce-remix-diapo-card-card-layout-${directCardId}`) as HTMLSelectElement
      layout.value = DEFAULT_PRESET_ID.TEXT_IMAGE
      layout.dispatchEvent(new Event('change', { bubbles: true }))
    })

    document = controller.getSnapshot().context.document
    expect(document.bdcs.find((bdc) => bdc.id === directCardId)?.presetId).toBe(DEFAULT_PRESET_ID.TEXT_IMAGE)
    expect(document.bdcs.find((bdc) => bdc.id === directCardId)?.card).toMatchObject({ title: 'Titre Diapo' })
    expect(rendered.$(`#elce-remix-diapo-card-media-file-${directCardId}`)?.getAttribute('accept')).toContain('image/*')
    expect(rendered.$(`#elce-remix-diapo-card-media-add-icon-${directCardId}`)).not.toBeNull()
    expect(rendered.$(`#elce-remix-diapo-card-media-add-icon-${directCardId} path`)).not.toBeNull()

    const subscription = subscribeSpy.mock.results[0]?.value
    expect(subscription).toBeDefined()
    if (subscription === undefined) throw new Error('The Remix Card view did not subscribe to the actor.')
    const unsubscribeSpy = vi.spyOn(subscription, 'unsubscribe')
    rendered.cleanup()
    expect(unsubscribeSpy).toHaveBeenCalledOnce()
    controller.stop()
  })
})
