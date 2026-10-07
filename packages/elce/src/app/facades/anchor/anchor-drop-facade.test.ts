import { describe, expect, it } from 'vitest'
import { ElceAnchorDropFacade } from './anchor-drop-facade'

describe('ElceAnchorDropFacade', () => {
  it('sends the complete Section intention through its dispatcher', () => {
    const dispatched: Array<{ sectionBdcId: string; change: unknown }> = []
    const facade = new ElceAnchorDropFacade({ dispatch: (sectionBdcId, change) => dispatched.push({ sectionBdcId, change }) })
    const change = { kind: 'content' as const, title: '', content: { type: 'doc' as const, content: [{ type: 'paragraph' as const }] }, markup: '<p></p>' }

    facade.submitSectionChange('bdc-section-1', change)

    expect(dispatched).toEqual([{ sectionBdcId: 'bdc-section-1', change }])
  })
})
