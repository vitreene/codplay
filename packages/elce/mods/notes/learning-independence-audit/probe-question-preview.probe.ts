import { expect, it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { createInitialDocument } from '../../../src/domain/document/document-model.ts'
import { applyDocumentCommand, createQuestionBdcCommand } from '../../../src/domain/commands/document-commands/index.ts'
import { INITIAL_PROJECT_TEST_STATE } from '../../../src/domain/summary-profile/test-state-types.ts'
import { createPlayerPreviewComposition } from '../../../src/app/player/player-preview.ts'
import type { ProjectTestState } from '../../../src/domain/summary-profile/test-state-types.ts'
import type { ElcePageSceneCache } from '../../../src/player/player-composition-types.ts'

it('observes actual Question controls across reconstructed preview compositions', async () => {
  const documentModel = applyDocumentCommand(createInitialDocument(), createQuestionBdcCommand('audit-question', 'page-a', 1))
  const question = documentModel.bdcs.find((bdc) => bdc.id === 'audit-question')!.question!
  const emptyState = { ...INITIAL_PROJECT_TEST_STATE, profileEnabled: false }
  const answeredState = {
    ...emptyState,
    questionAnswers: {
      'page-a': {
        answerIds: question.answers.map((entry) => entry.id),
        selectedAnswerIds: question.answers.filter((entry) => entry.correct).map((entry) => entry.id),
        expectedAnswerIds: question.answers.filter((entry) => entry.correct).map((entry) => entry.id),
        isCorrect: true,
      },
    },
  }

  /** Mounts the real preview, observes native input controls, then destroys its runtime. */
  async function observe(state: ProjectTestState, cache: ElcePageSceneCache) {
    const stage = document.createElement('div')
    document.body.append(stage)
    const composition = createPlayerPreviewComposition(stage, {
      documentModel, selectedPageId: 'page-a', mediaSources: {}, testState: state, sceneCache: cache,
    })!
    await composition.initialize()
    const inputs = Array.from(stage.querySelectorAll<HTMLInputElement>('.elce-card--question input'))
    expect(inputs).toHaveLength(2)
    const result = { checked: inputs.map((input) => input.checked), disabled: inputs.map((input) => input.disabled) }
    composition.destroy()
    stage.remove()
    return result
  }

  const shared = new Map()
  const first = await observe(emptyState, shared)
  const restoredWithCache = await observe(answeredState, shared)
  const restoredFresh = await observe(answeredState, new Map())
  const answeredCache = new Map()
  const firstAnswered = await observe(answeredState, answeredCache)
  const resetWithCache = await observe(emptyState, answeredCache)
  const resetFresh = await observe(emptyState, new Map())
  const result = { first, restoredWithCache, restoredFresh, firstAnswered, resetWithCache, resetFresh }
  writeFileSync(process.env.ELCE_AUDIT_PREVIEW_OUTPUT ?? '/private/tmp/codplay-mods-runtime-probe.json', JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result))
})
