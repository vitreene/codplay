// @vitest-environment jsdom
import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'

import { render } from 'remix/ui/test'
import { CHAPTER_TYPE, EVALUATION_RETRY_SCOPE } from '../../../config/document-config'
import type { Chapter } from '../../../domain/document/document-types'
import { controllerMachine } from '../../controller/controller-machine'
import { EditorActionsFacade } from '../../facades/editor-actions-facade'
import { renderChapterSettings } from './chapter-settings'

describe('Remix chapter settings', () => {
  it('renders and persists the existing Evaluation chapter settings through XState', async () => {
    const controller = createActor(controllerMachine, { input: {} })
    controller.start()
    controller.send({ type: 'editor.access.activate' })
    const actions = new EditorActionsFacade(controller)
    actions.createEvaluationChapter(controller.getSnapshot().context.document)
    const initialChapter = controller.getSnapshot().context.document.chapters.at(-1)
    if (initialChapter === undefined) throw new Error('The Evaluation chapter was not created.')
    let chapter: Chapter = initialChapter

    const mountSettings = () => render(<main
      id="elce-remix-chapter-settings-test-root"
    >
      {renderChapterSettings({ chapter, actions, onPreview: () => { }, previewError: null })}
    </main>)
    let rendered = mountSettings()

    expect(chapter.type).toBe(CHAPTER_TYPE.EVALUATION)
    expect(rendered.$(`#elce-remix-evaluation-threshold-${chapter.id}`)?.textContent).toBe('80 %')
    expect((rendered.$(`#elce-remix-evaluation-attempt-limit-${chapter.id}`) as HTMLInputElement).value).toBe('')
    expect((rendered.$(`#elce-remix-evaluation-retry-scope-${chapter.id}`) as HTMLSelectElement).value).toBe(EVALUATION_RETRY_SCOPE.ALL_QUESTIONS)

    await rendered.act(() => {
      const name = rendered.$(`#elce-remix-chapter-name-${chapter.id}`) as HTMLInputElement
      name.focus()
      name.value = 'Évaluation finale'
      name.blur()
    })
    rendered.cleanup()
    chapter = findChapter(controller, chapter.id)
    rendered = mountSettings()
    await rendered.act(() => {
      const limit = rendered.$(`#elce-remix-evaluation-attempt-limit-${chapter.id}`) as HTMLInputElement
      limit.focus()
      limit.value = '4'
      limit.blur()
    })
    rendered.cleanup()
    chapter = findChapter(controller, chapter.id)
    rendered = mountSettings()
    await rendered.act(() => {
      const retryScope = rendered.$(`#elce-remix-evaluation-retry-scope-${chapter.id}`) as HTMLSelectElement
      retryScope.value = EVALUATION_RETRY_SCOPE.INCORRECT_QUESTIONS
      retryScope.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const updatedChapter = controller.getSnapshot().context.document.chapters.find((entry) => entry.id === chapter.id)
    expect(updatedChapter).toMatchObject({
      name: 'Évaluation finale',
      evaluationAttemptLimit: 4,
      evaluationRetryScope: EVALUATION_RETRY_SCOPE.INCORRECT_QUESTIONS,
    })

    rendered.cleanup()
    chapter = findChapter(controller, chapter.id)
    rendered = mountSettings()
    expect((rendered.$(`#elce-remix-evaluation-retry-scope-${chapter.id}`) as HTMLSelectElement).value)
      .toBe(EVALUATION_RETRY_SCOPE.INCORRECT_QUESTIONS)

    rendered.cleanup()
    controller.stop()
  })
})

/** Reads the latest chapter snapshot after an XState command. */
function findChapter(controller: ReturnType<typeof createActor<typeof controllerMachine>>, chapterId: string): Chapter {
  const chapter = controller.getSnapshot().context.document.chapters.find((entry) => entry.id === chapterId)
  if (chapter === undefined) throw new Error(`Chapter introuvable : ${chapterId}`)
  return chapter
}
