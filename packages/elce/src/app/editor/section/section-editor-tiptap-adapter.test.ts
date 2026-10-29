/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CARD_IMAGE_FIT, CAROUSEL_IMAGE_POSITION, DEFAULT_PRESET_ID } from '../../../config/document-config'
import { createInitialDocument } from '../../../domain/document/document-model'
import type { SectionContent } from '../../../domain/document/document-types'
import { SectionTiptapAdapter } from './section-editor-tiptap-adapter'

describe('SectionTiptapAdapter', () => {
  let adapter: SectionTiptapAdapter | undefined

  afterEach(() => {
    adapter?.destroy()
    adapter = undefined
    vi.restoreAllMocks()
  })

  it('submits a cached image ratio update through the existing section change callback', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(900)
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(593)

    const section = createSectionWithAnchor()
    const onChange = vi.fn()
    const host = document.createElement('div')
    document.body.append(host)
    adapter = new SectionTiptapAdapter(host, {
      bdcId: 'bdc-section-1',
      section,
      profileProperties: [],
      anchorOptions: {
        resolveCard: () => ({
          content: {
            mediaId: 'media-image-1',
            overline: '',
            title: '',
            description: '',
            message: '',
            note: '',
            caption: '',
            imagePosition: CAROUSEL_IMAGE_POSITION.LEFT,
            imageFit: CARD_IMAGE_FIT.COVER,
          },
          layoutId: DEFAULT_PRESET_ID.PHOTO,
          media: { source: 'blob:image-1', type: 'image' },
        }),
      },
      onChange,
      onToolbarState: vi.fn(),
    })
    await Promise.resolve()

    const image = host.querySelector<HTMLImageElement>('.elce-anchor-media-preview')
    expect(image?.complete).toBe(true)
    expect(image?.naturalWidth).toBe(900)
    expect(image?.naturalHeight).toBe(593)
    expect(adapter.editor.getJSON()).toMatchObject({
      content: [{ content: [{ attrs: { bdcId: 'bdc-image-1', paddingBottom: '65.88888889%' }, type: 'elceAnchor' }] }],
    })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'content',
      content: expect.objectContaining({
        content: [expect.objectContaining({
          content: [expect.objectContaining({
            type: 'elceAnchor',
            attrs: expect.objectContaining({ bdcId: 'bdc-image-1', paddingBottom: '65.88888889%' }),
          })],
        })],
      }),
      markup: expect.stringContaining('--elce-anchor-padding: 65.88888889%'),
    }), expect.any(Object))
  })
})

/** Creates the smallest valid Section containing a provisional anchor ratio. */
function createSectionWithAnchor(): SectionContent {
  const document = createInitialDocument()
  const sectionBdc = document.bdcs.find((bdc) => bdc.id === 'bdc-section-1')
  if (sectionBdc?.section === null || sectionBdc?.section === undefined) throw new Error('La fixture doit contenir une Section.')
  return {
    ...sectionBdc.section,
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{
        type: 'elceAnchor',
        attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor', paddingBottom: '12rem' },
      }] }],
    },
  }
}
