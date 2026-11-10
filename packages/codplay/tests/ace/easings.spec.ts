import { describe, expect, it } from 'vitest'

import { parseEase } from '../../src/ace/easings'

describe('parseEase', () => {
  it('lève sur un nom inconnu, au lieu de retomber sur l’identité', () => {
    expect(() => parseEase('inOutQuadd')).toThrow(/inconnue/)
  })
})
