// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createActor } from 'xstate'

import { render } from 'remix/ui/test'
import { BDC_ORDER, BDC_TYPE, CARD_IMAGE_FIT, CAROUSEL_IMAGE_POSITION, CAROUSEL_PLAYBACK_MODE, CAROUSEL_TRANSITION, CHAPTER_TYPE, DEFAULT_PRESET_ID, PAGE_LOCATION, PAGE_TYPE, QUESTION_TYPE } from '../../../config/document-config'
import { controllerMachine } from '../../controller/controller-machine'
import { EditorActionsFacade } from '../../facades/editor-actions-facade'
import type { ElceDocumentStore, MediaBlob } from '../../../infrastructure/indexed-db/document-store-types'
import { EditorContextProvider } from '../editor-context'
import { RemixPageEditor } from './page-editor'

describe('Remix production page editor', () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
    document.body.replaceChildren()
  })

  it('renders and edits every ordered BDC in Remix through the existing XState actor', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new EditorActionsFacade(controller)
    const initialDocument = controller.getSnapshot().context.document
    const firstPage = initialDocument.pages[0]
    if (firstPage === undefined) throw new Error('The page editor fixture has no initial page.')
    expect(firstPage.type).toBe(PAGE_TYPE.FLUX)

    actions.createEvaluationChapter(initialDocument)
    const evaluationChapter = controller.getSnapshot().context.document.chapters.find((chapter) => chapter.type === CHAPTER_TYPE.EVALUATION)
    if (evaluationChapter === undefined) throw new Error('The page editor fixture Evaluation chapter was not created.')
    actions.movePage(firstPage.id, { kind: PAGE_LOCATION.CHAPTER, chapterId: evaluationChapter.id })

    actions.createQuestion(initialDocument, firstPage.id, firstPage.bdcIds.length)
    let documentModel = controller.getSnapshot().context.document
    const questionId = documentModel.pages.find((page) => page.id === firstPage.id)?.bdcIds[1]
    if (questionId === undefined) throw new Error('The page editor fixture Question was not created.')

    actions.createEvaluationResult(firstPage.id, documentModel.pages.find((page) => page.id === firstPage.id)!.bdcIds.length)
    documentModel = controller.getSnapshot().context.document
    const resultId = documentModel.pages.find((page) => page.id === firstPage.id)?.bdcIds[2]
    if (resultId === undefined) throw new Error('The page editor fixture Result was not created.')
    actions.createCarousel(firstPage.id, documentModel.pages.find((page) => page.id === firstPage.id)!.bdcIds.length)
    documentModel = controller.getSnapshot().context.document
    const carouselId = documentModel.bdcs.find((bdc) => bdc.type === BDC_TYPE.CAROUSEL && bdc.pageId === firstPage.id)?.id
    if (carouselId === undefined) throw new Error('The page editor fixture Carousel was not created.')
    const firstPageWithBdcs = documentModel.pages.find((page) => page.id === firstPage.id)
    if (firstPageWithBdcs === undefined) throw new Error('The page editor fixture lost its first page.')
    let initialBdcOrder = [...firstPageWithBdcs.bdcIds]

    actions.createPage({ kind: PAGE_LOCATION.SCENARIO }, PAGE_TYPE.DIAPO)
    const secondPage = controller.getSnapshot().context.document.pages.find((page) => page.id !== firstPage.id)
    if (secondPage === undefined) throw new Error('The page editor fixture second page was not created.')
    controller.send({ type: 'page.select', pageId: firstPage.id })

    const subscribeSpy = vi.spyOn(controller, 'subscribe')
    const rendered = render(<EditorContextProvider
      controller={controller}
      actions={actions}
    >
      <RemixPageEditor
        onPreview={() => undefined}
        previewError={null}
      />
    </EditorContextProvider>)
    cleanup = () => {
      rendered.cleanup()
      controller.stop()
    }

    await actOnRemix(rendered, () => Promise.resolve())
    expect(pageBdcOrder(rendered)).toEqual(initialBdcOrder)
    await actOnRemix(rendered, () => rendered.$('#elce-card-create')?.click())
    documentModel = controller.getSnapshot().context.document
    const directCardId = documentModel.pages.find((page) => page.id === firstPage.id)?.bdcIds.at(-1)
    if (directCardId === undefined) throw new Error('The Remix Flux page did not create a standalone Card.')
    const firstPageAfterCard = documentModel.pages.find((page) => page.id === firstPage.id)
    if (firstPageAfterCard === undefined) throw new Error('The Remix Flux page disappeared after Card creation.')
    initialBdcOrder = [...firstPageAfterCard.bdcIds]
    expect(pageBdcOrder(rendered)).toEqual(initialBdcOrder)
    expect(rendered.$(`#elce-section-editor-bdc-section-1`)).not.toBeNull()
    expect(rendered.$(`#elce-question-editor-${questionId}`)).not.toBeNull()
    expect(rendered.$(`#elce-evaluation-result-editor-${resultId}`)).not.toBeNull()
    expect(rendered.$(`#elce-carousel-editor-${carouselId}`)).not.toBeNull()
    expect(rendered.$(`#elce-card-editor-${directCardId}`)).not.toBeNull()
    expect(rendered.$$('.ProseMirror')).toHaveLength(1)
    expect(rendered.$$(`#elce-question-editor-${questionId}`)).toHaveLength(1)
    expect(rendered.$$(`#elce-evaluation-result-editor-${resultId}`)).toHaveLength(1)
    expect(rendered.$$(`#elce-carousel-editor-${carouselId}`)).toHaveLength(1)
    expect(rendered.$$(`#elce-card-editor-${directCardId}`)).toHaveLength(1)

    await actOnRemix(rendered, () => {
      const title = rendered.$(`#elce-question-title-${questionId}`) as HTMLInputElement
      setRemixValue(title, 'Question depuis Remix')
    })
    expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === questionId)?.question?.title)
      .toBe('Question depuis Remix')

    await actOnRemix(rendered, () => {
      const type = rendered.$(`#elce-question-type-${questionId}`) as HTMLSelectElement
      type.value = QUESTION_TYPE.CHOICE
      type.dispatchEvent(new Event('change', { bubbles: true }))
    })
    let question = controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === questionId)?.question
    expect(question?.type).toBe(QUESTION_TYPE.CHOICE)
    const firstAnswer = question?.answers[0]
    if (firstAnswer === undefined) throw new Error('The Remix Question fixture has no default answer.')
    await actOnRemix(rendered, () => {
      const label = rendered.$(`#elce-question-answer-label-${firstAnswer.id}`) as HTMLInputElement
      setRemixValue(label, 'Réponse modifiée')
    })
    question = controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === questionId)?.question
    expect(question?.answers.find((answer) => answer.id === firstAnswer.id)?.label).toBe('Réponse modifiée')
    await actOnRemix(rendered, () => rendered.$(`#elce-question-add-answer-${questionId}`)?.click())
    question = controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === questionId)?.question
    const addedAnswer = question?.answers.at(-1)
    if (addedAnswer === undefined) throw new Error('The Remix Question did not add an answer.')
    await actOnRemix(rendered, () => rendered.$(`#elce-question-answer-correct-${addedAnswer.id}`)?.click())
    question = controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === questionId)?.question
    expect(question?.answers.find((answer) => answer.id === addedAnswer.id)?.correct).toBe(true)
    const answerTransfer = createDataTransfer()
    await actOnRemix(rendered, () => dispatchDrag(rendered.$(`#elce-question-answer-drag-${addedAnswer.id}`)!, 'dragstart', answerTransfer))
    await actOnRemix(rendered, () => dispatchDrag(rendered.$(`#elce-question-answer-row-${firstAnswer.id}`)!, 'dragover', answerTransfer))
    await actOnRemix(rendered, () => dispatchDrag(rendered.$(`#elce-question-answer-row-${firstAnswer.id}`)!, 'drop', answerTransfer))
    question = controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === questionId)?.question
    expect(question?.answers[0]?.id).toBe(addedAnswer.id)

    await actOnRemix(rendered, () => {
      const message = rendered.$(`#elce-evaluation-result-message-${resultId}-success`) as HTMLTextAreaElement
      setRemixValue(message, 'Évaluation réussie')
    })
    expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === resultId)?.evaluationResult?.success.message)
      .toBe('Évaluation réussie')
    await actOnRemix(rendered, () => {
      const action = rendered.$(`#elce-evaluation-result-action-${resultId}-success`) as HTMLSelectElement
      action.value = 'menu'
      action.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === resultId)?.evaluationResult?.success.action)
      .toBe('menu')
    await actOnRemix(rendered, () => {
      const message = rendered.$(`#elce-evaluation-result-message-${resultId}-failure`) as HTMLTextAreaElement
      setRemixValue(message, 'Évaluation à reprendre')
    })
    expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === resultId)?.evaluationResult?.failure.message)
      .toBe('Évaluation à reprendre')
    await actOnRemix(rendered, () => {
      const action = rendered.$(`#elce-evaluation-result-action-${resultId}-failure`) as HTMLSelectElement
      action.value = 'retry'
      action.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === resultId)?.evaluationResult?.failure.action)
      .toBe('retry')

    await actOnRemix(rendered, () => {
      const title = rendered.$(`#elce-card-title-${directCardId}`) as HTMLInputElement
      setRemixValue(title, 'Carte Flux')
    })
    expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === directCardId)?.card?.title).toBe('Carte Flux')
    await actOnRemix(rendered, () => {
      const layout = rendered.$(`#elce-card-card-layout-${directCardId}`) as HTMLSelectElement
      layout.value = DEFAULT_PRESET_ID.TEXT_IMAGE
      layout.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await actOnRemix(rendered, () => {
      const imageFit = rendered.$(`#elce-card-image-fit-${directCardId}`) as HTMLSelectElement
      expect(imageFit.value).toBe(CARD_IMAGE_FIT.COVER)
      const imagePosition = rendered.$(`#elce-card-image-position-${directCardId}`) as HTMLSelectElement
      imagePosition.value = CAROUSEL_IMAGE_POSITION.RIGHT
      imagePosition.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === directCardId)?.card?.title).toBe('Carte Flux')
    expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === directCardId)?.card?.imagePosition)
      .toBe(CAROUSEL_IMAGE_POSITION.RIGHT)

    const initialCarousel = controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === carouselId)
    const initialChildCardId = initialCarousel?.carousel?.cards[0]?.bdcId
    if (initialChildCardId === undefined) throw new Error('The Remix Carousel fixture has no initial Card.')
    await actOnRemix(rendered, () => rendered.$(`#elce-carousel-card-add-${carouselId}`)?.click())
    let currentCarousel = controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === carouselId)?.carousel
    const addedChildCardId = currentCarousel?.cards[1]?.bdcId
    if (addedChildCardId === undefined) throw new Error('The Remix Carousel did not add a child Card.')
    await actOnRemix(rendered, () => {
      const message = rendered.$(`#elce-carousel-message-${addedChildCardId}`) as HTMLTextAreaElement
      setRemixValue(message, 'Carte enfant Remix')
    })
    expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === addedChildCardId)?.card?.message)
      .toBe('Carte enfant Remix')
    await actOnRemix(rendered, () => {
      const playback = rendered.$(`#elce-carousel-playback-${carouselId}`) as HTMLSelectElement
      playback.value = 'automatic'
      playback.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await actOnRemix(rendered, () => {
      const repeat = rendered.$(`#elce-carousel-repeat-${carouselId}`) as HTMLInputElement
      setRemixValue(repeat, '3')
    })
    await actOnRemix(rendered, () => {
      const duration = rendered.$(`#elce-carousel-duration-${carouselId}`) as HTMLInputElement
      duration.value = '7'
      duration.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await actOnRemix(rendered, () => {
      const duration = rendered.$(`#elce-carousel-card-duration-${addedChildCardId}`) as HTMLInputElement
      setRemixValue(duration, '2.5')
    })
    currentCarousel = controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === carouselId)?.carousel
    expect(currentCarousel?.playbackMode).toBe('automatic')
    expect(currentCarousel?.repeatCount).toBe(3)
    expect(currentCarousel?.defaultViewDurationMs).toBe(7000)
    expect(currentCarousel?.cards.find((entry) => entry.bdcId === addedChildCardId)?.durationMs).toBe(2500)
    await actOnRemix(rendered, () => {
      const playback = rendered.$(`#elce-carousel-playback-${carouselId}`) as HTMLSelectElement
      playback.value = CAROUSEL_PLAYBACK_MODE.MANUAL
      playback.dispatchEvent(new Event('change', { bubbles: true }))
    })
    currentCarousel = controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === carouselId)?.carousel
    expect(currentCarousel?.playbackMode).toBe(CAROUSEL_PLAYBACK_MODE.MANUAL)
    await actOnRemix(rendered, () => rendered.$(`#elce-carousel-card-tab-${initialChildCardId}`)?.click())
    expect(rendered.$(`#elce-carousel-card-editor-${initialChildCardId}`)).not.toBeNull()
    const carouselTransfer = createDataTransfer()
    await actOnRemix(rendered, () => dispatchDrag(rendered.$(`#elce-carousel-card-tab-${addedChildCardId}`)!, 'dragstart', carouselTransfer))
    await actOnRemix(rendered, () => dispatchDrag(rendered.$(`#elce-carousel-card-tab-${initialChildCardId}`)!, 'dragover', carouselTransfer))
    await actOnRemix(rendered, () => dispatchDrag(rendered.$(`#elce-carousel-card-tab-${initialChildCardId}`)!, 'drop', carouselTransfer))
    currentCarousel = controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === carouselId)?.carousel
    expect(currentCarousel?.cards.map((entry) => entry.bdcId)).toEqual([addedChildCardId, initialChildCardId])

    const dataTransfer = createDataTransfer()
    await actOnRemix(rendered, () => dispatchDrag(rendered.$(`#elce-page-bdc-drag-${questionId}`)!, 'dragstart', dataTransfer))
    expect(dataTransfer.getData(BDC_ORDER.MIME_TYPE)).toBe(questionId)
    await actOnRemix(rendered, () => dispatchDrag(rendered.$('#elce-page-bdc-drop-0')!, 'dragover', dataTransfer))
    await actOnRemix(rendered, () => dispatchDrag(rendered.$('#elce-page-bdc-drop-0')!, 'drop', dataTransfer))
    const reorderedPage = controller.getSnapshot().context.document.pages.find((page) => page.id === firstPage.id)
    expect(reorderedPage?.bdcIds).toEqual([questionId, ...initialBdcOrder.filter((bdcId) => bdcId !== questionId)])
    expect(pageBdcOrder(rendered)).toEqual(reorderedPage?.bdcIds)

    const sectionHost = rendered.$('#elce-remix-section-editor-host-bdc-section-1') as HTMLElement
    await actOnRemix(rendered, () => actions.selectPage(secondPage.id))
    expect(rendered.$('#elce-remix-section-editor-host-bdc-section-1')).toBeNull()
    expect(sectionHost.isConnected).toBe(false)
    expect(rendered.$(`#elce-question-editor-${questionId}`)).toBeNull()
    const diapoCarousel = controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.type === BDC_TYPE.CAROUSEL && bdc.pageId === secondPage.id)
    if (diapoCarousel === undefined) throw new Error('The Remix Diapo fixture has no default Carousel.')
    await actOnRemix(rendered, () => controller.send({
      type: 'document.apply',
      command: { type: 'bdc.carousel.delete', bdcId: diapoCarousel.id },
    }))
    expect(rendered.$('#elce-card-create')?.hasAttribute('disabled')).toBe(false)
    await actOnRemix(rendered, () => rendered.$('#elce-card-create')?.click())
    const directDiapoCard = controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.type === BDC_TYPE.CARD && bdc.pageId === secondPage.id)
    expect(directDiapoCard?.parentBdcId).toBeNull()
    expect(controller.getSnapshot().context.document.pages.find((page) => page.id === secondPage.id)?.bdcIds).toEqual([directDiapoCard?.id])
    expect(rendered.$(`#elce-card-editor-${directDiapoCard?.id}`)).not.toBeNull()

    await actOnRemix(rendered, () => actions.selectPage(firstPage.id))
    expect(pageBdcOrder(rendered)).toEqual(reorderedPage?.bdcIds)
    expect((rendered.$(`#elce-question-type-${questionId}`) as HTMLSelectElement).value).toBe(QUESTION_TYPE.CHOICE)
    expect((rendered.$(`#elce-evaluation-result-action-${resultId}-success`) as HTMLSelectElement).value).toBe('menu')
    expect((rendered.$(`#elce-evaluation-result-action-${resultId}-failure`) as HTMLSelectElement).value).toBe('retry')
    expect((rendered.$(`#elce-card-card-layout-${directCardId}`) as HTMLSelectElement).value).toBe(DEFAULT_PRESET_ID.TEXT_IMAGE)
    expect((rendered.$(`#elce-card-image-fit-${directCardId}`) as HTMLSelectElement).value).toBe(CARD_IMAGE_FIT.COVER)
    expect((rendered.$(`#elce-card-image-position-${directCardId}`) as HTMLSelectElement).value).toBe(CAROUSEL_IMAGE_POSITION.RIGHT)
    expect((rendered.$(`#elce-carousel-playback-${carouselId}`) as HTMLSelectElement).value).toBe(CAROUSEL_PLAYBACK_MODE.MANUAL)
    expect((rendered.$(`#elce-carousel-transition-${carouselId}`) as HTMLSelectElement).value).toBe(CAROUSEL_TRANSITION.FADE)
    const subscription = subscribeSpy.mock.results[0]?.value
    if (subscription === undefined) throw new Error('The Remix page editor did not subscribe to the actor.')
    const unsubscribeSpy = vi.spyOn(subscription, 'unsubscribe')
    rendered.cleanup()
    cleanup = undefined
    expect(unsubscribeSpy).toHaveBeenCalledOnce()
    controller.stop()
  })

  it('imports Question, standalone Card, and multi-file Carousel media through the shared XState queue', async () => {
    const store = new ImmediateMediaStore()
    const controller = createActor(controllerMachine, { input: { documentStore: store } })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new EditorActionsFacade(controller)
    const initial = controller.getSnapshot().context.document
    const page = initial.pages[0]
    if (page === undefined) throw new Error('The media editor fixture has no page.')

    actions.createQuestion(initial, page.id, page.bdcIds.length)
    actions.createCarousel(page.id, controller.getSnapshot().context.document.pages[0]!.bdcIds.length)
    let documentModel = controller.getSnapshot().context.document
    const questionId = documentModel.pages[0]?.bdcIds.find((bdcId) => documentModel.bdcs.find((bdc) => bdc.id === bdcId)?.type === BDC_TYPE.QUESTION)
    const carousel = documentModel.bdcs.find((bdc) => bdc.type === BDC_TYPE.CAROUSEL)
    const carouselCardId = carousel?.carousel?.cards[0]?.bdcId
    if (questionId === undefined || carousel === undefined || carousel.carousel == null || carouselCardId === undefined) {
      throw new Error('The media editor fixture is missing a Question or Carousel Card.')
    }
    actions.createStandaloneCard(page.id)
    documentModel = controller.getSnapshot().context.document
    const standaloneCardId = documentModel.pages[0]?.bdcIds.at(-1)
    if (standaloneCardId === undefined) throw new Error('The media editor fixture has no standalone Card.')

    const rendered = render(<EditorContextProvider
      controller={controller}
      actions={actions}
    >
      <RemixPageEditor
        onPreview={() => undefined}
        previewError={null}
      />
    </EditorContextProvider>)
    cleanup = () => {
      rendered.cleanup()
      controller.stop()
    }
    await rendered.act(() => Promise.resolve())

    const questionImage = new File(['question image'], 'question.png', { type: 'image/png' })
    await rendered.act(() => dispatchDrag(
      rendered.$(`#elce-question-illustration-${questionId}`)!,
      'drop',
      createDataTransfer([questionImage]),
    ))
    await vi.waitFor(() => expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === questionId)?.question?.mediaId).not.toBeNull())

    const standaloneImage = new File(['standalone image'], 'standalone.png', { type: 'image/png' })
    await rendered.act(() => {
      const layout = rendered.$(`#elce-card-card-layout-${standaloneCardId}`) as HTMLSelectElement
      layout.value = DEFAULT_PRESET_ID.PHOTO
      layout.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await rendered.act(() => dispatchDrag(
      rendered.$(`#elce-card-media-drop-${standaloneCardId}`)!,
      'drop',
      createDataTransfer([standaloneImage]),
    ))
    await vi.waitFor(() => expect(controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === standaloneCardId)?.card?.mediaId).not.toBeNull())

    const carouselImages = [
      new File(['carousel image one'], 'one.png', { type: 'image/png' }),
      new File(['carousel image two'], 'two.png', { type: 'image/png' }),
    ]
    await rendered.act(() => {
      const layout = rendered.$(`#elce-carousel-card-layout-${carouselCardId}`) as HTMLSelectElement
      layout.value = DEFAULT_PRESET_ID.PHOTO
      layout.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await rendered.act(() => dispatchDrag(
      rendered.$(`#elce-carousel-media-drop-${carouselCardId}`)!,
      'drop',
      createDataTransfer(carouselImages),
    ))
    await vi.waitFor(() => {
      const currentDocument = controller.getSnapshot().context.document
      const currentCarousel = currentDocument.bdcs.find((bdc) => bdc.id === carousel.id)?.carousel
      expect(currentCarousel?.cards).toHaveLength(2)
      expect(currentDocument.medias).toHaveLength(4)
    })

    const finalDocument = controller.getSnapshot().context.document
    expect(store.media.size).toBe(4)
    expect(finalDocument.bdcs.find((bdc) => bdc.id === questionId)?.question?.mediaId).toBeTruthy()
    expect(finalDocument.bdcs.find((bdc) => bdc.id === standaloneCardId)?.card?.mediaId).toBeTruthy()
    const finalCarousel = finalDocument.bdcs.find((bdc) => bdc.id === carousel.id)?.carousel
    expect(finalCarousel?.cards.map(({ bdcId }) => finalDocument.bdcs.find((bdc) => bdc.id === bdcId)?.card?.mediaId)).toEqual(
      expect.arrayContaining(finalDocument.medias.slice(2).map(({ id }) => id)),
    )
  })

  it('keeps saved Carousel selections when its editor remounts after page navigation', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new EditorActionsFacade(controller)
    const initialDocument = controller.getSnapshot().context.document
    const firstPage = initialDocument.pages[0]
    if (firstPage === undefined) throw new Error('The Carousel editor fixture has no initial page.')

    actions.createCarousel(firstPage.id, firstPage.bdcIds.length)
    const carouselId = controller.getSnapshot().context.document.bdcs.find(
      (bdc) => bdc.type === BDC_TYPE.CAROUSEL && bdc.pageId === firstPage.id,
    )?.id
    if (carouselId === undefined) throw new Error('The Carousel editor fixture did not create a Carousel.')
    actions.createPage({ kind: PAGE_LOCATION.SCENARIO }, PAGE_TYPE.DIAPO)
    const secondPageId = controller.getSnapshot().context.document.pages.find((page) => page.id !== firstPage.id)?.id
    if (secondPageId === undefined) throw new Error('The Carousel editor fixture has no second page.')
    actions.selectPage(firstPage.id)

    const rendered = render(<EditorContextProvider
      controller={controller}
      actions={actions}
    >
      <RemixPageEditor
        onPreview={() => undefined}
        previewError={null}
      />
    </EditorContextProvider>)
    cleanup = () => {
      rendered.cleanup()
      controller.stop()
    }
    await actOnRemix(rendered, () => Promise.resolve())

    const playback = rendered.$(`#elce-carousel-playback-${carouselId}`) as HTMLSelectElement
    const transition = rendered.$(`#elce-carousel-transition-${carouselId}`) as HTMLSelectElement
    expect(playback.value).toBe(CAROUSEL_PLAYBACK_MODE.MANUAL)
    expect(transition.value).toBe(CAROUSEL_TRANSITION.FADE)

    await actOnRemix(rendered, () => {
      playback.value = CAROUSEL_PLAYBACK_MODE.AUTOMATIC
      playback.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await actOnRemix(rendered, () => {
      const currentTransition = rendered.$(`#elce-carousel-transition-${carouselId}`) as HTMLSelectElement
      currentTransition.value = CAROUSEL_TRANSITION.ZOOM
      currentTransition.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await actOnRemix(rendered, () => {
      const currentPlayback = rendered.$(`#elce-carousel-playback-${carouselId}`) as HTMLSelectElement
      currentPlayback.value = CAROUSEL_PLAYBACK_MODE.MANUAL
      currentPlayback.dispatchEvent(new Event('change', { bubbles: true }))
    })
    await actOnRemix(rendered, () => {
      const currentTransition = rendered.$(`#elce-carousel-transition-${carouselId}`) as HTMLSelectElement
      currentTransition.value = CAROUSEL_TRANSITION.ZOOM
      currentTransition.dispatchEvent(new Event('change', { bubbles: true }))
    })

    let carousel = controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === carouselId)?.carousel
    expect(carousel?.playbackMode).toBe(CAROUSEL_PLAYBACK_MODE.MANUAL)
    expect(carousel?.revelation).toEqual({ intro: CAROUSEL_TRANSITION.ZOOM, outro: CAROUSEL_TRANSITION.ZOOM })
    await actOnRemix(rendered, () => actions.selectPage(secondPageId))
    await actOnRemix(rendered, () => actions.selectPage(firstPage.id))

    carousel = controller.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === carouselId)?.carousel
    expect(carousel?.playbackMode).toBe(CAROUSEL_PLAYBACK_MODE.MANUAL)
    expect(carousel?.revelation).toEqual({ intro: CAROUSEL_TRANSITION.ZOOM, outro: CAROUSEL_TRANSITION.ZOOM })
    expect((rendered.$(`#elce-carousel-playback-${carouselId}`) as HTMLSelectElement).value)
      .toBe(CAROUSEL_PLAYBACK_MODE.MANUAL)
    expect((rendered.$(`#elce-carousel-transition-${carouselId}`) as HTMLSelectElement).value)
      .toBe(CAROUSEL_TRANSITION.ZOOM)
  })
})

/** Reads only the direct BDC rows owned by the selected page. */
function pageBdcOrder(rendered: ReturnType<typeof render>): string[] {
  const rows = rendered.$$('.elce-page-bdc') as NodeListOf<HTMLElement>
  return Array.from(rows).map((row) => row.id.replace('elce-page-bdc-', ''))
}

/** Flushes the Remix view and its native event handlers. */
async function actOnRemix(rendered: ReturnType<typeof render>, run: () => void | Promise<void>): Promise<void> {
  await rendered.act(run)
}

/** Sends the native input events consumed by a Remix editor field. */
function setRemixValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')
  descriptor?.set?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

/** Creates the browser-shaped transfer object consumed by Remix drag handlers. */
function createDataTransfer(files: readonly File[] = []) {
  const values = new Map<string, string>()
  const types = files.length === 0 ? [] : ['Files']
  return {
    effectAllowed: 'none',
    dropEffect: 'none',
    types,
    files: files as unknown as FileList,
    setData: (type: string, value: string) => {
      values.set(type, value)
      if (!types.includes(type)) types.push(type)
    },
    getData: (type: string) => values.get(type) ?? '',
  }
}

/** Dispatches a native drag event with the MIME type expected by the editor. */
function dispatchDrag(target: Element, type: string, dataTransfer: ReturnType<typeof createDataTransfer>): void {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  target.dispatchEvent(event)
}

/** Stores imported files in memory so production editor events use the real XState media path. */
class ImmediateMediaStore implements ElceDocumentStore {
  public readonly media = new Map<string, Blob>()

  /** Leaves document loading to the controller's initial document fixture. */
  public async loadDocument(): Promise<null> { return null }

  /** Keeps this test focused on editor commands rather than document persistence. */
  public async saveDocument(): Promise<void> { }

  /** Keeps this test focused on editor commands rather than document persistence. */
  public async saveDocumentAndDeleteMedia(): Promise<void> { }

  /** Has no previously persisted documents to delete in this in-memory fixture. */
  public async deleteDocument(): Promise<void> { }

  /** Has no previously persisted media to delete in this in-memory fixture. */
  public async deleteMedia(): Promise<void> { }

  /** Starts each import with no server upload checkpoint. */
  public async loadSyncState(documentId: string) {
    return { documentId, remoteRevision: null, uploadedMediaIds: [], status: 'pending' as const }
  }

  /** Leaves this test's local synchronization state unchanged. */
  public async saveSyncState(): Promise<void> { }

  /** Persists the bytes immediately for the controller's media deduplication path. */
  public async saveMedia(media: MediaBlob): Promise<void> {
    this.media.set(media.id, media.blob)
  }

  /** Reads a media blob previously saved by this fixture. */
  public async loadMedia(mediaId: string): Promise<Blob | null> {
    return this.media.get(mediaId) ?? null
  }
}
