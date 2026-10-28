import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { LEARNING_PLAYER_STYLE_SHEET } from './learning-player-style'

describe('Learning player styles', () => {
  it('reassembles the previous layout and resource cascade unchanged', () => {
    const hash = createHash('sha256').update(LEARNING_PLAYER_STYLE_SHEET).digest('hex')

    expect(LEARNING_PLAYER_STYLE_SHEET).toHaveLength(25_107)
    expect(hash).toBe('ac0cbb454aea7da9a40989b8f0d34da66611d724ec11582073b96e4ec0623882')
  })
})
