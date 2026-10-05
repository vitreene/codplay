/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createActor } from 'xstate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BDC_TYPE, CAROUSEL_ASPECT_RATIO_OPTIONS, CAROUSEL_CARD_PRESET_OPTIONS, CAROUSEL_PLAYBACK_MODE, CHAPTER_TYPE, DEFAULT_EVALUATION_THRESHOLD, DEFAULT_PRESET_ID, EVALUATION_RESULT_ACTION, EVALUATION_RETRY_SCOPE, MEDIA_FILE_ACCEPT, MEDIA_TYPE, PAGE_TYPE, QUESTION_TYPE } from '../../config/document-config'
import { controllerMachine } from '../controller/controller-machine'
import { AppLayout } from './AppLayout'

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', { value: true, configurable: true })

describe('AppLayout authoring titles and creation actions', () => {
  let root: ReturnType<typeof createRoot> | undefined
  let stopActor: (() => void) | undefined

  afterEach(() => {
    act(() => root?.unmount())
    root = undefined
    stopActor?.()
    stopActor = undefined
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('opens the separate reader by default and keeps the integrated modal available only by opt-in', () => {
    const popup = { focus: vi.fn(), postMessage: vi.fn() } as unknown as Window
    const open = vi.spyOn(window, 'open').mockReturnValue(popup)
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('123e4567-e89b-12d3-a456-426614174000')
    const { host } = mountApp()

    act(() => host.querySelector<HTMLButtonElement>('#elce-preview-open')?.click())

    const openedUrl = new URL(open.mock.calls[0]![0]!)
    expect(openedUrl.searchParams.get('elce-preview-session')).toBe('123e4567-e89b-12d3-a456-426614174000')
    expect(openedUrl.searchParams.get('elce-preview-page')).toBe('page-a')
    expect(host.querySelector('#elce-preview-modal')).toBeNull()
  })

  it('creates pages at the root and in a chapter from contextual icon buttons', async () => {
    const { actor, host } = mountApp()
    const rootPageButton = host.querySelector<HTMLButtonElement>('#elce-create-scenario-page')
    const chapterPageButton = host.querySelector<HTMLButtonElement>('#elce-create-page-chapter-1')
    const chapterButton = host.querySelector<HTMLButtonElement>('#elce-create-chapter')
    const evaluationChapterButton = host.querySelector<HTMLButtonElement>('#elce-create-evaluation-chapter')

    expect(rootPageButton?.getAttribute('aria-label')).toBe('Ajouter une page à la racine du scénario')
    expect(rootPageButton?.querySelector('svg')).not.toBeNull()
    expect(rootPageButton?.textContent?.trim()).toBe('')
    expect(rootPageButton?.parentElement?.id).toBe('elce-outline-actions')
    expect(chapterButton?.parentElement).toBe(rootPageButton?.parentElement)
    expect(evaluationChapterButton?.parentElement).toBe(rootPageButton?.parentElement)
    expect(host.querySelector('#elce-outline-title')?.textContent).toBe('Scénario')
    expect(host.querySelector('#elce-scenario-root-heading')).toBeNull()
    expect(Array.from(rootPageButton?.parentElement?.children ?? []).map((button) => button.id)).toEqual([
      'elce-create-chapter',
      'elce-create-evaluation-chapter',
      'elce-create-scenario-page',
    ])
    expect(chapterPageButton?.getAttribute('aria-label')).toBe('Ajouter une page dans Chapitre 1')
    expect(chapterPageButton?.querySelector('svg')).not.toBeNull()
    expect(chapterPageButton?.textContent?.trim()).toBe('')
    expect(chapterButton?.getAttribute('aria-label')).toBe('Ajouter un chapitre')
    expect(chapterButton?.querySelector('svg')).not.toBeNull()
    expect(chapterButton?.textContent?.trim()).toBe('')
    expect(evaluationChapterButton?.getAttribute('aria-label')).toBe('Ajouter un chapitre d’évaluation')
    expect(evaluationChapterButton?.querySelector('svg')?.classList.contains('lucide-clipboard-check')).toBe(true)
    expect(evaluationChapterButton?.textContent?.trim()).toBe('')

    await act(async () => rootPageButton?.click())
    const rootPage = actor.getSnapshot().context.document.pages[1]
    expect(rootPage).toMatchObject({ name: 'Page B', chapterId: null })
    expect(actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === rootPage?.bdcIds[0])?.type).toBe(BDC_TYPE.SECTION)
    expect(actor.getSnapshot().context.document.data.scenarioEntries).toEqual([
      { kind: 'chapter', chapterId: 'chapter-1' },
      { kind: 'page', pageId: rootPage?.id },
    ])
    expect(actor.getSnapshot().context.document.scenarioPageIds).toEqual(['page-a', rootPage?.id])
    expect(actor.getSnapshot().context.selectedPageId).toBe(rootPage?.id)

    await act(async () => chapterPageButton?.click())
    const chapterPage = actor.getSnapshot().context.document.pages[2]
    expect(chapterPage).toMatchObject({ name: 'Page C', chapterId: 'chapter-1' })
    expect(actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === chapterPage?.bdcIds[0])?.type).toBe(BDC_TYPE.SECTION)
    expect(actor.getSnapshot().context.document.chapters[0]?.pageIds).toEqual(['page-a', chapterPage?.id])
    expect(actor.getSnapshot().context.selectedPageId).toBe(chapterPage?.id)

    await act(async () => chapterButton?.click())
    expect(actor.getSnapshot().context.document.chapters).toHaveLength(2)
    expect(actor.getSnapshot().context.document.chapters[1]).toMatchObject({
      type: CHAPTER_TYPE.STANDARD,
      pageIds: [],
    })
    expect(actor.getSnapshot().context.document.chapters[1]?.evaluationThreshold).toBeUndefined()
    expect(Array.from(host.querySelector('#elce-scenario-entry-list')?.children ?? [])
      .filter((entry) => !entry.classList.contains('elce-drop-separator'))
      .map((entry) => entry.id)).toEqual([
      'elce-chapter-chapter-1',
      `elce-scenario-entry-list-item-${rootPage?.id}`,
      `elce-chapter-${actor.getSnapshot().context.document.chapters[1]?.id}`,
    ])
  })

  it('creates an Evaluation chapter from its icon with the configured threshold', async () => {
    const { actor, host } = mountApp()
    const evaluationChapterButton = host.querySelector<HTMLButtonElement>('#elce-create-evaluation-chapter')

    await act(async () => evaluationChapterButton?.click())

    const evaluationChapter = actor.getSnapshot().context.document.chapters[1]
    expect(evaluationChapter).toMatchObject({
      name: 'Évaluation',
      type: CHAPTER_TYPE.EVALUATION,
      pageIds: [],
      evaluationThreshold: DEFAULT_EVALUATION_THRESHOLD,
      evaluationAttemptLimit: null,
      evaluationRetryScope: EVALUATION_RETRY_SCOPE.ALL_QUESTIONS,
    })
    expect(actor.getSnapshot().context.document.data.scenarioEntries.at(-1)).toEqual({
      kind: 'chapter',
      chapterId: evaluationChapter?.id,
    })
    const chapterTypeMark = host.querySelector(`#elce-chapter-${evaluationChapter?.id} .elce-chapter-type-mark`)
    expect(chapterTypeMark?.textContent).toBe('')
    expect(chapterTypeMark?.querySelector('svg')?.classList.contains('lucide-clipboard-check')).toBe(true)
    expect(host.querySelector(`#elce-chapter-name-${evaluationChapter?.id}`)?.textContent).toBe('Évaluation')
    expect(host.querySelector(`#elce-create-page-${evaluationChapter?.id} svg`)?.getAttribute('width')).toBe('14')
    expect(host.querySelector(`#elce-chapter-delete-${evaluationChapter?.id} svg`)?.getAttribute('width')).toBe('14')

    await act(async () => host.querySelector<HTMLButtonElement>(`#elce-create-page-${evaluationChapter?.id}`)?.click())

    const evaluationPage = actor.getSnapshot().context.document.pages.at(-1)
    const questionBdc = actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === evaluationPage?.bdcIds[0])
    expect(evaluationPage).toMatchObject({ type: PAGE_TYPE.FLUX, chapterId: evaluationChapter?.id, bdcIds: [questionBdc?.id] })
    expect(questionBdc).toMatchObject({
      type: BDC_TYPE.QUESTION,
      presetId: DEFAULT_PRESET_ID.QUESTION,
      section: null,
      question: { type: QUESTION_TYPE.TRUE_FALSE, prompt: '' },
    })
    expect(host.querySelector<HTMLButtonElement>('#elce-question-create')?.disabled).toBe(true)
  })

  it('opens and edits Evaluation chapter settings in the central area', async () => {
    const { actor, host } = mountApp()
    await act(async () => host.querySelector<HTMLButtonElement>('#elce-create-evaluation-chapter')?.click())
    const evaluationChapter = actor.getSnapshot().context.document.chapters[1]!
    const chapterButton = host.querySelector<HTMLButtonElement>(`#elce-chapter-select-${evaluationChapter.id}`)

    expect(host.querySelector('#elce-content-catalog')?.parentElement?.id).toBe('elce-properties')
    expect(host.querySelector('#elce-content-catalog-title')?.textContent).toBe('Contenus disponibles')
    expect(host.querySelector('#elce-properties-title')).toBeNull()

    await act(async () => chapterButton?.click())

    expect(actor.getSnapshot().context.selectedChapterId).toBe(evaluationChapter.id)
    expect(host.querySelector(`#elce-evaluation-threshold-${evaluationChapter.id}`)?.textContent).toBe('80 %')
    expect(host.querySelector<HTMLInputElement>(`#elce-evaluation-attempt-limit-${evaluationChapter.id}`)?.placeholder).toBe('Illimité')
    expect(host.querySelector<HTMLInputElement>(`#elce-evaluation-attempt-limit-${evaluationChapter.id}`)?.value).toBe('')
    expect(host.querySelector<HTMLSelectElement>(`#elce-evaluation-retry-scope-${evaluationChapter.id}`)?.value)
      .toBe(EVALUATION_RETRY_SCOPE.ALL_QUESTIONS)
    expect(host.querySelector(`#elce-page-bdc-list-page-a`)).toBeNull()

    const attemptLimit = host.querySelector<HTMLInputElement>(`#elce-evaluation-attempt-limit-${evaluationChapter.id}`)!
    await act(async () => commitInput(attemptLimit, '3'))
    await act(async () => setControlledValue(
      host.querySelector<HTMLSelectElement>(`#elce-evaluation-retry-scope-${evaluationChapter.id}`)!,
      EVALUATION_RETRY_SCOPE.INCORRECT_QUESTIONS,
    ))

    expect(actor.getSnapshot().context.document.chapters[1]).toMatchObject({
      evaluationAttemptLimit: 3,
      evaluationRetryScope: EVALUATION_RETRY_SCOPE.INCORRECT_QUESTIONS,
    })
  })

  it('adds Text and Quiz BDCs from the top of a Flux page', async () => {
    const { actor, host } = mountApp()
    const textButton = host.querySelector<HTMLButtonElement>('#elce-section-create')
    const quizButton = host.querySelector<HTMLButtonElement>('#elce-question-create')

    expect(textButton?.getAttribute('aria-label')).toBe('Ajouter un bloc texte')
    expect(quizButton?.getAttribute('aria-label')).toBe('Ajouter un bloc quiz')
    expect(quizButton?.querySelector('svg')?.classList.contains('lucide-list-checks')).toBe(true)
    expect(quizButton?.querySelector('svg')?.classList.contains('lucide-circle-help')).toBe(false)

    await act(async () => textButton?.click())
    await act(async () => quizButton?.click())

    const page = actor.getSnapshot().context.document.pages[0]!
    const pageBdcs = page.bdcIds.map((bdcId) => actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === bdcId))
    expect(pageBdcs.map((bdc) => bdc?.type)).toEqual([BDC_TYPE.SECTION, BDC_TYPE.SECTION, BDC_TYPE.QUESTION])
    expect(quizButton?.disabled).toBe(true)
  })

  it('creates, edits and deletes a unique Carousel BDC in the page sequence', async () => {
    const { actor, host } = mountApp()
    const carouselButton = host.querySelector<HTMLButtonElement>('#elce-carousel-create')
    const existingIds = [...actor.getSnapshot().context.document.pages[0]!.bdcIds]

    expect(carouselButton?.getAttribute('aria-label')).toBe('Ajouter un bloc Carousel')
    expect(carouselButton?.querySelector('svg')?.classList.contains('lucide-images')).toBe(true)

    await act(async () => carouselButton?.click())

    const documentModel = actor.getSnapshot().context.document
    const carouselBdcId = documentModel.pages[0]!.bdcIds.at(-1)!
    const carouselBdc = documentModel.bdcs.find((bdc) => bdc.id === carouselBdcId)
    expect(documentModel.pages[0]?.bdcIds).toEqual([...existingIds, carouselBdcId])
    expect(carouselBdc).toMatchObject({ type: BDC_TYPE.CAROUSEL, presetId: DEFAULT_PRESET_ID.CAROUSEL, pageId: 'page-a' })
    expect(carouselBdc?.carousel?.views).toHaveLength(1)
    expect(carouselBdc?.carousel?.playbackMode).toBe(CAROUSEL_PLAYBACK_MODE.MANUAL)
    expect(carouselBdc?.carousel?.repeatCount).toBe(10)
    expect(host.querySelector(`#elce-carousel-editor-${carouselBdcId}`)).not.toBeNull()
    expect(host.querySelector(`#elce-carousel-title-${carouselBdcId}`)?.textContent).toBe('Carousel')
    expect(host.querySelector(`#elce-carousel-delete-${carouselBdcId}`)?.parentElement?.classList.contains('elce-carousel-editor__header')).toBe(true)
    const durationSlider = host.querySelector<HTMLInputElement>(`#elce-carousel-duration-${carouselBdcId}`)
    expect(durationSlider).toMatchObject({ type: 'range', min: '1', max: '10' })
    expect(host.querySelector(`#elce-carousel-repeat-${carouselBdcId}`)).toBeNull()
    const playbackSelect = host.querySelector<HTMLSelectElement>(`#elce-carousel-playback-${carouselBdcId}`)!
    await act(async () => setControlledValue(playbackSelect, CAROUSEL_PLAYBACK_MODE.AUTOMATIC))
    const repeatInput = host.querySelector<HTMLInputElement>(`#elce-carousel-repeat-${carouselBdcId}`)!
    expect(repeatInput).toMatchObject({ type: 'number', min: '0', max: '10', value: '10' })
    await act(async () => setControlledValue(repeatInput, '2'))
    expect(actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === carouselBdcId)?.carousel?.repeatCount).toBe(2)
    await act(async () => setControlledValue(playbackSelect, CAROUSEL_PLAYBACK_MODE.MANUAL))
    expect(host.querySelector(`#elce-carousel-repeat-${carouselBdcId}`)).toBeNull()
    const ratioSelect = host.querySelector<HTMLSelectElement>(`#elce-carousel-ratio-${carouselBdcId}`)
    expect(Array.from(ratioSelect?.options ?? []).map((option) => option.label)).toEqual(CAROUSEL_ASPECT_RATIO_OPTIONS.map((option) => option.label))
    expect(host.textContent).not.toContain('Preset des prochaines vues')

    await act(async () => host.querySelector<HTMLButtonElement>(`#elce-carousel-view-add-${carouselBdcId}`)?.click())
    const editedCarousel = actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === carouselBdcId)?.carousel
    const addedView = editedCarousel?.views[1]
    expect(editedCarousel?.views).toHaveLength(2)

    const viewTransfer = createDataTransfer()
    act(() => dispatchDrag(host.querySelector<HTMLElement>(`#elce-carousel-view-tab-${editedCarousel?.views[0]?.id}`)!, 'dragstart', viewTransfer))
    act(() => dispatchDrag(host.querySelector<HTMLElement>(`#elce-carousel-view-tab-${addedView?.id}`)!, 'dragover', viewTransfer))
    act(() => dispatchDrag(host.querySelector<HTMLElement>(`#elce-carousel-view-tab-${addedView?.id}`)!, 'drop', viewTransfer))
    expect(actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === carouselBdcId)?.carousel?.views.map((view) => view.id))
      .toEqual([addedView?.id, editedCarousel?.views[0]?.id])

    await act(async () => setControlledValue(
      host.querySelector<HTMLInputElement>(`#elce-carousel-title-${addedView?.id}`)!,
      'Titre de la seconde vue',
    ))
    expect(actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === carouselBdcId)?.carousel?.views
      .find((view) => view.id === addedView?.id))
      .toMatchObject({ text: { title: 'Titre de la seconde vue' } })

    await act(async () => setControlledValue(ratioSelect!, '4:3'))
    const ratioCarousel = actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === carouselBdcId)?.carousel
    expect(ratioCarousel?.aspectRatio).toEqual({ width: 4, height: 3 })
    const presetSelect = host.querySelector<HTMLSelectElement>(`#elce-carousel-view-preset-${addedView?.id}`)!
    expect(presetSelect.parentElement?.querySelector('span')?.textContent).toBe('Carte')
    expect(Array.from(presetSelect.options).map((option) => option.label)).toEqual(CAROUSEL_CARD_PRESET_OPTIONS.map((option) => option.label))
    await act(async () => setControlledValue(presetSelect, DEFAULT_PRESET_ID.TEXT_IMAGE))
    expect(actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === carouselBdcId)?.carousel?.views
      .find((view) => view.id === addedView?.id))
      .toMatchObject({ presetId: DEFAULT_PRESET_ID.TEXT_IMAGE, text: { title: 'Titre de la seconde vue' } })
    const imagePosition = host.querySelector<HTMLSelectElement>(`#elce-carousel-image-position-${addedView?.id}`)!
    await act(async () => setControlledValue(imagePosition, 'right'))
    const imageDropZone = host.querySelector<HTMLElement>(`#elce-carousel-media-drop-${addedView?.id}`)
    expect(imageDropZone?.classList.contains('elce-carousel-media-drop--proportional')).toBe(true)
    expect(imageDropZone?.style.aspectRatio).toBe('4 / 3')
    expect(actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === carouselBdcId)?.carousel?.views
      .find((view) => view.id === addedView?.id))
      .toMatchObject({ presetId: DEFAULT_PRESET_ID.TEXT_IMAGE, imagePosition: 'right' })

    await act(async () => host.querySelector<HTMLButtonElement>(`#elce-carousel-delete-${carouselBdcId}`)?.click())
    expect(actor.getSnapshot().context.document.pages[0]?.bdcIds).toEqual(existingIds)
    expect(actor.getSnapshot().context.document.bdcs.some((bdc) => bdc.id === carouselBdcId)).toBe(false)
  })

  it('keeps an image attached while editing Text-short and changing to Text-image', async () => {
    const { actor, host } = mountApp()
    await act(async () => host.querySelector<HTMLButtonElement>('#elce-carousel-create')?.click())

    let documentModel = actor.getSnapshot().context.document
    const carouselBdcId = documentModel.pages[0]!.bdcIds.at(-1)!
    const carousel = documentModel.bdcs.find((bdc) => bdc.id === carouselBdcId)!.carousel!
    const viewId = carousel.views[0]!.id
    const presetSelect = host.querySelector<HTMLSelectElement>(`#elce-carousel-view-preset-${viewId}`)!

    await act(async () => setControlledValue(presetSelect, DEFAULT_PRESET_ID.PHOTO))
    await act(async () => actor.send({
      type: 'document.apply',
      command: {
        type: 'media.add',
        media: { id: 'carousel-media-test', type: MEDIA_TYPE.IMAGE, name: 'photo.png', mimeType: 'image/png', size: 12, caption: '' },
      },
    }))
    await act(async () => actor.send({
      type: 'media.source.register',
      mediaId: 'carousel-media-test',
      source: 'data:image/png;base64,dGVzdA==',
    }))
    await act(async () => host.querySelector<HTMLButtonElement>('#elce-content-catalog-tab-media')?.click())
    const mediaFileInput = host.querySelector<HTMLInputElement>(`#elce-carousel-media-file-${viewId}`)!
    const mediaFileLabel = host.querySelector<HTMLLabelElement>(`#elce-carousel-media-select-${viewId}`)!
    expect(mediaFileInput.type).toBe('file')
    expect(mediaFileInput.accept).toBe(MEDIA_FILE_ACCEPT.IMAGE_AND_VIDEO)
    expect(mediaFileInput.classList.contains('elce-visually-hidden')).toBe(true)
    expect(mediaFileLabel.tagName).toBe('LABEL')
    expect(mediaFileLabel.htmlFor).toBe(mediaFileInput.id)
    expect(host.querySelector<HTMLElement>(`#elce-carousel-media-drop-${viewId}`)?.contains(mediaFileInput)).toBe(true)

    const mediaTransfer = createDataTransfer()
    const catalogMedia = host.querySelector<HTMLElement>('#elce-catalog-media-carousel-media-test button')!
    const photoDropZone = host.querySelector<HTMLElement>(`#elce-carousel-media-drop-${viewId}`)!
    act(() => dispatchDrag(catalogMedia, 'dragstart', mediaTransfer))
    act(() => dispatchDrag(photoDropZone, 'dragover', mediaTransfer))
    act(() => dispatchDrag(photoDropZone, 'drop', mediaTransfer))
    expect(host.querySelector(`#elce-carousel-media-image-${viewId}`)).not.toBeNull()
    expect(mediaFileLabel.contains(host.querySelector(`#elce-carousel-media-image-${viewId}`))).toBe(true)

    await act(async () => setControlledValue(presetSelect, DEFAULT_PRESET_ID.TEXT_SHORT))
    let view = actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === carouselBdcId)?.carousel?.views
      .find((candidate) => candidate.id === viewId)
    expect(view).toMatchObject({ presetId: DEFAULT_PRESET_ID.TEXT_SHORT, mediaId: 'carousel-media-test' })
    expect(host.querySelector(`#elce-carousel-media-image-${viewId}`)).toBeNull()

    await act(async () => setControlledValue(host.querySelector<HTMLInputElement>(`#elce-carousel-title-${viewId}`)!, 'Image conservée'))
    await act(async () => setControlledValue(host.querySelector<HTMLTextAreaElement>(`#elce-carousel-message-${viewId}`)!, 'Texte associé'))
    await act(async () => setControlledValue(presetSelect, DEFAULT_PRESET_ID.TEXT_IMAGE))
    expect(host.querySelector<HTMLInputElement>(`#elce-carousel-media-file-${viewId}`)?.accept).toBe(MEDIA_FILE_ACCEPT.IMAGE)
    view = actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === carouselBdcId)?.carousel?.views
      .find((candidate) => candidate.id === viewId)
    expect(view).toMatchObject({
      presetId: DEFAULT_PRESET_ID.TEXT_IMAGE,
      mediaId: 'carousel-media-test',
      text: { title: 'Image conservée', message: 'Texte associé' },
    })
    expect(host.querySelector(`#elce-carousel-media-image-${viewId}`)).not.toBeNull()

    await act(async () => host.querySelector<HTMLButtonElement>(`#elce-carousel-view-add-${carouselBdcId}`)?.click())
    const textOnlyViewId = actor.getSnapshot().context.selectedCarouselViewId!
    await act(async () => setControlledValue(host.querySelector<HTMLInputElement>(`#elce-carousel-title-${textOnlyViewId}`)!, 'Vue sans image'))
    await act(async () => host.querySelector<HTMLButtonElement>(`#elce-carousel-view-tab-${viewId}`)?.click())
    expect(host.querySelector(`#elce-carousel-media-image-${viewId}`)).not.toBeNull()

    documentModel = actor.getSnapshot().context.document
    const updatedViews = documentModel.bdcs.find((bdc) => bdc.id === carouselBdcId)?.carousel?.views
    view = updatedViews?.find((candidate) => candidate.id === viewId)
    expect(view).toMatchObject({
      presetId: DEFAULT_PRESET_ID.TEXT_IMAGE,
      mediaId: 'carousel-media-test',
      text: { title: 'Image conservée', message: 'Texte associé' },
    })
    expect(updatedViews?.find((candidate) => candidate.id === textOnlyViewId))
      .toMatchObject({ presetId: DEFAULT_PRESET_ID.TEXT_SHORT, text: { title: 'Vue sans image' }, mediaId: null })
  })

  it('adds one dual-outcome Result BDC from an Evaluation page icon', async () => {
    const { actor, host } = mountApp()
    await act(async () => host.querySelector<HTMLButtonElement>('#elce-create-evaluation-chapter')?.click())
    const chapterId = actor.getSnapshot().context.document.chapters[1]!.id
    await act(async () => host.querySelector<HTMLButtonElement>(`#elce-create-page-${chapterId}`)?.click())

    const page = actor.getSnapshot().context.document.pages.at(-1)!
    const createResult = host.querySelector<HTMLButtonElement>('#elce-evaluation-result-create')
    expect(page.type).toBe(PAGE_TYPE.FLUX)
    expect(createResult?.getAttribute('aria-label')).toBe('Ajouter un bloc résultat')
    expect(createResult?.querySelector('svg')?.classList.contains('lucide-badge-check')).toBe(true)
    expect(host.querySelectorAll('#elce-evaluation-result-create')).toHaveLength(1)

    await act(async () => createResult?.click())

    const documentModel = actor.getSnapshot().context.document
    const resultBdcs = documentModel.bdcs.filter((bdc) => bdc.type === BDC_TYPE.EVALUATION_RESULT)
    expect(resultBdcs).toHaveLength(1)
    const resultBdc = resultBdcs[0]!
    expect(page.bdcIds).toHaveLength(1)
    expect(documentModel.pages.find((candidate) => candidate.id === page.id)?.bdcIds).toEqual([
      ...page.bdcIds,
      resultBdc.id,
    ])
    expect(resultBdc).toMatchObject({
      presetId: DEFAULT_PRESET_ID.EVALUATION_RESULT,
      evaluationResult: {
        success: { message: '', action: null },
        failure: { message: '', action: null },
      },
    })
    expect(host.querySelector(`#elce-evaluation-result-editor-${resultBdc.id}`)).not.toBeNull()

    await act(async () => setControlledValue(
      host.querySelector<HTMLTextAreaElement>(`#elce-evaluation-result-message-${resultBdc.id}-success`)!,
      'Bravo !',
    ))
    await act(async () => setControlledValue(
      host.querySelector<HTMLSelectElement>(`#elce-evaluation-result-action-${resultBdc.id}-success`)!,
      EVALUATION_RESULT_ACTION.REPLAY,
    ))

    expect(actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.id === resultBdc.id)?.evaluationResult).toMatchObject({
      success: { message: 'Bravo !', action: EVALUATION_RESULT_ACTION.REPLAY },
      failure: { message: '', action: null },
    })

    await act(async () => host.querySelector<HTMLButtonElement>(`#elce-evaluation-result-delete-${resultBdc.id}`)?.click())

    expect(actor.getSnapshot().context.document.pages.find((candidate) => candidate.id === page.id)?.bdcIds)
      .toEqual(page.bdcIds)
    expect(actor.getSnapshot().context.document.bdcs.some((bdc) => bdc.id === resultBdc.id)).toBe(false)
    expect(host.querySelector(`#elce-evaluation-result-editor-${resultBdc.id}`)).toBeNull()
  })

  it('deletes the default Text BDC through the XState document command', async () => {
    const { actor, host } = mountApp()
    const sectionDelete = host.querySelector<HTMLButtonElement>('#elce-section-delete-bdc-section-1')

    expect(sectionDelete?.getAttribute('aria-label')).toBe('Supprimer le bloc texte')
    await act(async () => sectionDelete?.click())

    const document = actor.getSnapshot().context.document
    expect(document.pages[0]?.bdcIds).toEqual([])
    expect(document.bdcs.some((bdc) => bdc.id === 'bdc-section-1')).toBe(false)
    expect(host.querySelector('#elce-section-editor-bdc-section-1')).toBeNull()
    expect(host.querySelector('#elce-section-create')).not.toBeNull()
  })

  it('drops a standalone page before and after a chapter in the root sequence', async () => {
    const { actor, host } = mountApp()
    const rootPageButton = host.querySelector<HTMLButtonElement>('#elce-create-scenario-page')
    await act(async () => rootPageButton?.click())
    const rootPageId = actor.getSnapshot().context.document.pages[1]?.id
    const dataTransfer = createDataTransfer()
    const chapterHeading = host.querySelector<HTMLElement>('#elce-chapter-heading-chapter-1')!
    const beforeChapter = host.querySelector<HTMLElement>('#elce-scenario-entry-list-drop-0')!
    const rootPageRow = host.querySelector<HTMLElement>(`#elce-scenario-entry-list-row-${rootPageId}`)!

    act(() => dispatchDrag(rootPageRow, 'dragstart', dataTransfer))
    act(() => dispatchDrag(rootPageRow, 'dragover', dataTransfer))
    act(() => dispatchDrag(rootPageRow, 'drop', dataTransfer))
    expect(actor.getSnapshot().context.document.data.scenarioEntries).toEqual([
      { kind: 'chapter', chapterId: 'chapter-1' },
      { kind: 'page', pageId: rootPageId },
    ])
    expect(beforeChapter.classList.contains('elce-drop-separator--active')).toBe(false)
    act(() => dispatchDrag(beforeChapter, 'dragover', dataTransfer))
    expect(beforeChapter.classList.contains('elce-drop-separator--active')).toBe(true)
    expect(rootPageRow.classList.contains('elce-page-row--drop-target')).toBe(false)
    expect(chapterHeading.classList.contains('elce-chapter-row--drop-target')).toBe(false)
    act(() => dispatchDrag(beforeChapter, 'dragleave', dataTransfer))
    expect(beforeChapter.classList.contains('elce-drop-separator--active')).toBe(false)
    act(() => dispatchDrag(beforeChapter, 'dragover', dataTransfer))
    act(() => dispatchDrag(beforeChapter, 'drop', dataTransfer))

    expect(actor.getSnapshot().context.document.data.scenarioEntries).toEqual([
      { kind: 'page', pageId: rootPageId },
      { kind: 'chapter', chapterId: 'chapter-1' },
    ])

    const afterChapter = host.querySelector<HTMLElement>('#elce-scenario-entry-list-drop-2')!
    const updatedRootPageRow = host.querySelector<HTMLElement>(`#elce-scenario-entry-list-row-${rootPageId}`)!
    act(() => dispatchDrag(updatedRootPageRow, 'dragstart', dataTransfer))
    act(() => dispatchDrag(afterChapter, 'dragover', dataTransfer))
    act(() => dispatchDrag(afterChapter, 'drop', dataTransfer))

    expect(actor.getSnapshot().context.document.data.scenarioEntries).toEqual([
      { kind: 'chapter', chapterId: 'chapter-1' },
      { kind: 'page', pageId: rootPageId },
    ])
  })

  it('reorders chapters through the same root drag-and-drop list', async () => {
    const { actor, host } = mountApp()
    await act(async () => host.querySelector<HTMLButtonElement>('#elce-create-scenario-page')?.click())
    await act(async () => host.querySelector<HTMLButtonElement>('#elce-create-chapter')?.click())
    const secondChapterId = actor.getSnapshot().context.document.chapters[1]?.id
    const dataTransfer = createDataTransfer()
    const draggedChapterHeading = host.querySelector<HTMLElement>(`#elce-chapter-heading-${secondChapterId}`)
    const beforeFirstChapter = host.querySelector<HTMLElement>('#elce-scenario-entry-list-drop-0')

    act(() => dispatchDrag(draggedChapterHeading!, 'dragstart', dataTransfer))
    act(() => dispatchDrag(beforeFirstChapter!, 'dragover', dataTransfer))
    act(() => dispatchDrag(beforeFirstChapter!, 'drop', dataTransfer))

    expect(actor.getSnapshot().context.document.data.scenarioEntries).toEqual([
      { kind: 'chapter', chapterId: secondChapterId },
      { kind: 'chapter', chapterId: 'chapter-1' },
      { kind: 'page', pageId: actor.getSnapshot().context.document.pages[1]?.id },
    ])
  })

  it('reorders chapter pages through separators without making page rows drop targets', async () => {
    const { actor, host } = mountApp()
    await act(async () => host.querySelector<HTMLButtonElement>('#elce-create-page-chapter-1')?.click())
    const addedPageId = actor.getSnapshot().context.document.chapters[0]?.pageIds[1]
    const dataTransfer = createDataTransfer()
    const draggedPage = host.querySelector<HTMLElement>(`#elce-pages-chapter-1-row-${addedPageId}`)!
    const beforeFirstPage = host.querySelector<HTMLElement>('#elce-pages-chapter-1-drop-0')!

    act(() => dispatchDrag(draggedPage, 'dragstart', dataTransfer))
    act(() => dispatchDrag(beforeFirstPage, 'dragover', dataTransfer))
    expect(beforeFirstPage.classList.contains('elce-drop-separator--active')).toBe(true)
    expect(draggedPage.classList.contains('elce-page-row--drop-target')).toBe(false)
    act(() => dispatchDrag(beforeFirstPage, 'drop', dataTransfer))

    expect(actor.getSnapshot().context.document.chapters[0]?.pageIds).toEqual([addedPageId, 'page-a'])
  })

  it('edits page and chapter titles in the central work area through XState', async () => {
    const { actor, host } = mountApp()
    const pageTitle = host.querySelector<HTMLInputElement>('#elce-page-title-page-a')
    const chapterTitle = host.querySelector<HTMLInputElement>('#elce-chapter-title-chapter-1')

    expect(host.querySelector('#elce-create-page-name')).toBeNull()
    expect(pageTitle?.value).toBe('Page A')
    expect(chapterTitle?.value).toBe('Chapitre 1')

    await act(async () => commitInput(pageTitle!, 'Présentation'))
    await act(async () => commitInputWithEnter(chapterTitle!, 'Introduction'))

    expect(actor.getSnapshot().context.document.pages[0]?.name).toBe('Présentation')
    expect(actor.getSnapshot().context.document.chapters[0]?.name).toBe('Introduction')
    expect(host.querySelector('#elce-pages-chapter-1-select-page-a')?.textContent).toBe('Présentation')
    expect(host.querySelector('#elce-chapter-name-chapter-1')?.textContent).toBe('Introduction')
  })

  it('authors one multiple-choice Question through the XState document commands', async () => {
    const { actor, host } = mountApp()
    const createButton = host.querySelector<HTMLButtonElement>('#elce-question-create')

    expect(createButton?.disabled).toBe(false)
    await act(async () => createButton?.click())

    let documentModel = actor.getSnapshot().context.document
    let questionBdc = documentModel.bdcs.find((bdc) => bdc.type === 'question')
    expect(questionBdc?.question?.answers.map(({ label, correct }) => ({ label, correct }))).toEqual([
      { label: 'Oui', correct: true },
      { label: 'Non', correct: false },
    ])
    expect(host.querySelector<HTMLButtonElement>('#elce-question-create')?.disabled).toBe(true)

    const typeSelect = host.querySelector<HTMLSelectElement>('select[aria-label="Type de question"]')!
    await act(async () => setControlledValue(typeSelect, 'multiple-choice'))
    documentModel = actor.getSnapshot().context.document
    questionBdc = documentModel.bdcs.find((bdc) => bdc.type === 'question')
    expect(questionBdc?.question?.type).toBe('multiple-choice')
    expect(host.querySelector('#elce-question-multiple-note-' + questionBdc?.id)?.textContent)
      .toContain('Plusieurs réponses possibles')

    const prompt = host.querySelector<HTMLTextAreaElement>('textarea[aria-label="Question"]')!
    await act(async () => setControlledValue(prompt, 'Quels éléments sont corrects ?'))
    questionBdc = actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.type === 'question')
    expect(questionBdc?.question?.prompt).toBe('Quels éléments sont corrects ?')

    const secondCorrect = host.querySelector<HTMLButtonElement>('button[aria-label="Marquer la réponse 2 juste"]')!
    await act(async () => secondCorrect.click())
    const firstCorrect = host.querySelector<HTMLButtonElement>('button[aria-label="Réponse 1 juste"]')!
    await act(async () => firstCorrect.click())

    questionBdc = actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.type === 'question')
    expect(questionBdc?.question?.answers.map(({ correct }) => correct)).toEqual([false, true])

    const answerIds = questionBdc!.question!.answers.map(({ id }) => id)
    const answerTransfer = createDataTransfer()
    const firstAnswerHandle = host.querySelector<HTMLElement>(`#elce-question-answer-drag-${answerIds[0]}`)!
    const secondAnswerRow = host.querySelector<HTMLElement>(`#elce-question-answer-row-${answerIds[1]}`)!
    act(() => dispatchDrag(firstAnswerHandle, 'dragstart', answerTransfer))
    act(() => dispatchDrag(secondAnswerRow, 'dragover', answerTransfer))
    act(() => dispatchDrag(secondAnswerRow, 'drop', answerTransfer))
    questionBdc = actor.getSnapshot().context.document.bdcs.find((bdc) => bdc.type === 'question')
    expect(questionBdc?.question?.answers.map(({ id, correct }) => ({ id, correct }))).toEqual([
      { id: answerIds[1], correct: true },
      { id: answerIds[0], correct: false },
    ])
  })

  /** Mounts the real work area with a running XState controller. */
  function mountApp() {
    const actor = createActor(controllerMachine, { input: {} })
    actor.start()
    stopActor = () => actor.stop()
    const host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)

    act(() => root?.render(<AppLayout controller={actor} />))
    return { actor, host }
  }

  /** Commits an uncontrolled title field with the same blur event used in the interface. */
  function commitInput(input: HTMLInputElement, value: string) {
    input.focus()
    input.value = value
    input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  }

  /** Commits a title by pressing Enter, which blurs the central field. */
  function commitInputWithEnter(input: HTMLInputElement, value: string) {
    input.focus()
    input.value = value
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  }

  /** Updates a controlled authoring field with the browser's native input setter. */
  function setControlledValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value')
    descriptor?.set?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }

  /** Builds the browser drag payload needed by the page-ordering gesture. */
  function createDataTransfer() {
    const values = new Map<string, string>()
    const types: string[] = []
    return {
      effectAllowed: 'none',
      dropEffect: 'none',
      types,
      files: [] as unknown as FileList,
      setData: (type: string, value: string) => {
        values.set(type, value)
        if (!types.includes(type)) types.push(type)
      },
      getData: (type: string) => values.get(type) ?? '',
    }
  }

  /** Dispatches a native-shaped drag event through React's real event handlers. */
  function dispatchDrag(target: HTMLElement, type: string, dataTransfer: ReturnType<typeof createDataTransfer>) {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.defineProperties(event, {
      dataTransfer: { value: dataTransfer },
    })
    target.dispatchEvent(event)
  }
})
