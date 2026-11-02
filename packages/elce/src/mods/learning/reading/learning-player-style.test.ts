import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { LEARNING_PLAYER_STYLE_SHEET } from './learning-player-style'

describe('Learning player styles', () => {
  it('retains reader style contracts across extracted module owners', () => {
    const hash = createHash('sha256').update(LEARNING_PLAYER_STYLE_SHEET).digest('hex')

    expect(LEARNING_PLAYER_STYLE_SHEET).toHaveLength(35_264)
    expect(hash).toBe('2fb5032e33cdaaded517e4aa5d49a360091d213228abb72db9cf40ae33799a2d')
    expect(LEARNING_PLAYER_STYLE_SHEET).toMatch(/\.elce-summary__chapter-row\s*\{[^}]*grid-template-columns: minmax\(10rem, 0\.8fr\) minmax\(0, 1\.2fr\);/s)
    expect(LEARNING_PLAYER_STYLE_SHEET).toMatch(/\.elce-summary__entry-link:hover\s*\{[^}]*text-decoration: none;/s)
    expect(LEARNING_PLAYER_STYLE_SHEET).toMatch(/\.elce-inline-link--button\s*\{[^}]*margin-inline: 0\.5em;/s)
    expect(LEARNING_PLAYER_STYLE_SHEET).toMatch(/\.elce-statistical-graph__inline-label-overlay\s*\{[^}]*pointer-events: none;/s)
    expect(LEARNING_PLAYER_STYLE_SHEET).toMatch(/\.elce-question-answer-option\s*\{[^}]*display: flex;[^}]*align-items: center;/s)
    expect(LEARNING_PLAYER_STYLE_SHEET).toMatch(/\.elce-question-answer-option \.input__control\s*\{[^}]*width: auto;[^}]*flex: 0 0 auto;/s)
  })
})
