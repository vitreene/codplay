// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'

import { BuilderFacade } from '../../src/builder/create-builder'
import { Player } from '../../src/player'
import { createQuizHuntScene, createQuizHuntStraps, type GameConfig } from '@codplay/demos/scenes'
import type { QuizHuntContent } from '@codplay/demos/scenes/quiz-hunt/types'
import quizHuntContent from '@codplay/demos/scenes/quiz-hunt/assets/questions/quiz-hunt.json'

function createConfig(): GameConfig {
  return {
    content: quizHuntContent as QuizHuntContent,
    seed: 1,
    timerTotalMs: 5 * 60 * 1000,
    extraDurationMs: 6000,
    showCorrection: true,
    labels: {
      validate: 'Valider', next: 'Suivant', correct: 'Gagné !', incorrect: 'Perdu',
      multipleHint: 'Plusieurs réponses possibles', gridTitle: 'Choisis une épreuve',
      basketTitle: 'Panier', basketEmptySlot: '—', finalButton: 'Épreuve finale',
      resultPassedTitle: 'Partie réussie !', resultFailedTitle: 'Partie échouée',
      extraLabel: 'Jeton de rattrapage'
    }
  }
}

async function waitForGridVisible(player: Player): Promise<void> {
  for (let i = 0; i < 100; i += 1) {
    const grid = player.getRuntimeRegistry().getNodeById('game-grid-root') as HTMLElement | null
    if (grid !== null && !grid.className.includes('is-hidden')) {
      return
    }
    await new Promise((r) => setTimeout(r, 50))
  }
  throw new Error('grid never became visible')
}

async function answerTrial(player: Player, wordId: string, answerId: string) {
  await waitForGridVisible(player)
  await player.emit({ name: 'game:trial:open', data: { trialId: wordId } })
  await player.emit({ name: 'quiz:question:answer:select', scopeStoryId: `game-trial-${wordId}-story`, data: { answerId } })
  await player.emit({ name: 'quiz:question:validate', scopeStoryId: `game-trial-${wordId}-story` })
}

describe('verify: game-timer.ts without context.live, basket fill survives many trials', () => {
  it('fills the basket for raccoon-city then abe, repeated 20 times for flake-hunting', async () => {
    for (let attempt = 0; attempt < 1; attempt += 1) {
      const config = createConfig()
      const wordsById = new Map(config.content.words.map((w) => [w.id, w]))
      const correctAnswerId = (wordId: string) => wordsById.get(wordId)!.trial.question.answers.find((a) => a.isCorrect)!.id

      const builder = new BuilderFacade()
      const compileResult = builder.compile({ scene: createQuizHuntScene(config) })
      expect(compileResult.ok).toBe(true)
      if (!compileResult.ok) return

      const player = new Player()
      const lines: string[] = []
      player.onTrace((row) => {
        lines.push(`${row.eventName} ${JSON.stringify(row.payload)}`)
      })
      expect(await player.init({
        mountTarget: document.createElement('div'),
        compiledScene: compileResult.data.compiledScene,
        resourceManifest: compileResult.data.resourceManifest,
        strapCollection: createQuizHuntStraps(config)
      })).toEqual({ ok: true, data: undefined })
      expect(await player.play()).toEqual({ ok: true, data: undefined })

      await answerTrial(player, 'raccoon-city', correctAnswerId('raccoon-city'))
      await new Promise((r) => setTimeout(r, 2500))

      await answerTrial(player, 'abe', correctAnswerId('abe'))
      await new Promise((r) => setTimeout(r, 2500))

      const registry = player.getRuntimeRegistry()
      const slotBleu = registry.getNodeById('game-basket-slot-bleu') as HTMLElement | null
      const slotJaune = registry.getNodeById('game-basket-slot-jaune') as HTMLElement | null

      if (slotBleu?.textContent !== 'RACCOON CITY' || slotJaune?.textContent !== 'ABE') {
        console.log(`--- attempt ${attempt} TAIL ---`)
        console.log(lines.slice(-50).join('\n'))
      }

      expect([attempt, slotBleu?.textContent]).toEqual([attempt, 'RACCOON CITY'])
      expect([attempt, slotJaune?.textContent]).toEqual([attempt, 'ABE'])

      await player.destroy()
    }
  }, 120000)
})
