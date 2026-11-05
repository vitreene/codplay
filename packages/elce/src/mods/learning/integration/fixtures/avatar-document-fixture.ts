import { applyDocumentCommand, createCardBdcCommand } from '../../../../domain/commands/document-commands'
import { learningDocumentService } from '../../document/learning-document-service'
import type { AvatarTake } from '../../../../resources/bdcs/avatar/domain/avatar-types'
import { createDefaultAvatar } from '../../../../resources/bdcs/avatar/domain/avatar-service'

/** Owns a short, repeated-word take independent of demo assets and timings. */
export function createAvatarTakeFixture(id = 'take-test', offset = 0): AvatarTake {
  return {
    id, audioMediaId: 'voice-test', durationMs: 12_000,
    words: [
      { text: 'Bonjour', startAtMs: 0, endAtMs: 800 },
      { text: 'encore', startAtMs: 2400 + offset, endAtMs: 2900 + offset },
      { text: 'encore', startAtMs: 6800 + offset, endAtMs: 7300 + offset },
    ],
    frames: [{ startAt: 0, values: { v100: 100 } }, { startAt: 2400, values: { v100: 0, v101: 100 } }],
  }
}

/** Creates a real Learning document with a sibling Avatar and three authored views. */
export function createAvatarDocumentFixture() {
  const initial = learningDocumentService.createInitialDocument()
  const withPage = applyDocumentCommand(initial, {
    type: 'page.create', pageId: 'page-avatar', bdcId: 'carousel-test', initialCardBdcId: 'card-one', pageType: 'diapo', placement: { kind: 'scenario' },
  })
  const withSecond = applyDocumentCommand(withPage, createCardBdcCommand('card-two', 'carousel-test', 1, 'text-short-basic'))
  const withThird = applyDocumentCommand(withSecond, createCardBdcCommand('card-three', 'carousel-test', 2, 'text-short-basic'))
  const withAvatar = applyDocumentCommand(withThird, {
    type: 'bdc.create', bdcId: 'avatar-test', bdcType: 'avatar', presetId: 'avatar-matt', placement: { kind: 'page', pageId: 'page-avatar' },
  })
  const withTake = applyDocumentCommand(withAvatar, {
    type: 'bdc.avatar.take.set', bdcId: 'avatar-test', take: createAvatarTakeFixture(),
    media: { id: 'voice-test', name: 'fixture.wav', mimeType: 'audio/wav', size: 44, caption: '' },
  })
  const withSecondWord = applyDocumentCommand(withTake, { type: 'bdc.carousel.word.set', bdcId: 'carousel-test', cardBdcId: 'card-two', avatarBdcId: 'avatar-test', wordIndex: 1, startAtMs: 2400 })
  const withThirdWord = applyDocumentCommand(withSecondWord, { type: 'bdc.carousel.word.set', bdcId: 'carousel-test', cardBdcId: 'card-three', avatarBdcId: 'avatar-test', wordIndex: 2, startAtMs: 6800 })
  return applyDocumentCommand(withThirdWord, { type: 'bdc.avatar.update', bdcId: 'avatar-test', avatar: { ...createDefaultAvatar(), take: createAvatarTakeFixture(), placement: { position: 'bottom-left', widthPercent: 22 } } })
}
