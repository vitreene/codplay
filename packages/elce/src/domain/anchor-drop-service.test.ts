/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import { BDC_TYPE } from '../config/document-config'
import { ElceAnchorDropFacade } from './anchor-drop-facade'
import { ElceAnchorDropService } from './anchor-drop-service'

describe('ElceAnchorDropService', () => {
  it('builds the stable media target and command for an image drop', () => {
    const service = new ElceAnchorDropService()
    const file = new File(['image'], 'photo.png', { type: 'image/png' })
    const target = service.createFileDropTarget(file, 'page-a')
    if (target === null) throw new Error('La cible image doit être acceptée.')

    const command = service.createDocumentCommand('bdc-section-1', {
      kind: 'file-drop',
      file,
      target,
      title: '',
      content: { type: 'doc', content: [{ type: 'paragraph' }] },
      markup: '<p></p>',
    })

    expect(target.media.type).toBe('image')
    expect(target.paddingBottom).toBe('75%')
    expect(command).toMatchObject({
      type: 'bdc.anchor.create',
      sectionBdcId: 'bdc-section-1',
      pageId: 'page-a',
      bdcType: BDC_TYPE.IMAGE,
      media: { name: 'photo.png', mimeType: 'image/png' },
    })
  })

  it('rejects file types outside the media whitelist', () => {
    const service = new ElceAnchorDropService()
    expect(service.createFileDropTarget(new File(['text'], 'notes.txt', { type: 'text/plain' }), 'page-a')).toBeNull()
  })

  it('sends the complete Section intention through its dispatcher', () => {
    const dispatched: Array<{ sectionBdcId: string; change: unknown }> = []
    const facade = new ElceAnchorDropFacade({ dispatch: (sectionBdcId, change) => dispatched.push({ sectionBdcId, change }) })
    const change = { kind: 'content' as const, title: '', content: { type: 'doc' as const, content: [{ type: 'paragraph' as const }] }, markup: '<p></p>' }

    facade.submitSectionChange('bdc-section-1', change)

    expect(dispatched).toEqual([{ sectionBdcId: 'bdc-section-1', change }])
  })
})
