/** @vitest-environment jsdom */

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createActor } from 'xstate'
import { afterEach, describe, expect, it } from 'vitest'
import { BDC_TYPE, CHAPTER_TYPE, DEFAULT_EVALUATION_THRESHOLD, DEFAULT_PRESET_ID, EVALUATION_RETRY_SCOPE, PAGE_TYPE, QUESTION_TYPE } from '../../config/document-config'
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
