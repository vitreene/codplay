/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CARD_IMAGE_FIT, CARD_PRESET_ID } from '../../card/card-config'
import { CAROUSEL_IMAGE_POSITION } from '../../carousel/carousel-config'
import { createAnchorTestPresetBuilder } from '../../../anchoring/authoring/anchor-test-fixtures'
import type { SectionContent } from '../domain/section-types'
import { SectionTiptapAdapter } from './section-editor-tiptap-adapter'
import type { SectionTextFeature } from './section-editor-tiptap-adapter'

describe('SectionTiptapAdapter', () => {
  let adapter: SectionTiptapAdapter | undefined

  afterEach(() => {
    adapter?.destroy()
    adapter = undefined
    vi.restoreAllMocks()
  })

  it('submits a cached image ratio update as a derived anchor change', async () => {
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
      anchorOptions: {
        presetBuilder: createAnchorTestPresetBuilder(),
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
          layoutId: CARD_PRESET_ID.PHOTO,
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
      kind: 'anchor-ratio',
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

  it('attaches an optional text contribution and removes its listener on destruction', () => {
    let handledEvents = 0
    const textFeature: SectionTextFeature = {
      extensions: [],
      attributes: { 'data-test-text-feature': 'active' },
      attach: (editor) => {
        const handleFeatureEvent = (): void => { handledEvents += 1 }
        editor.view.dom.addEventListener('test-text-feature', handleFeatureEvent)
        return () => editor.view.dom.removeEventListener('test-text-feature', handleFeatureEvent)
      },
    }
    const host = document.createElement('div')
    document.body.append(host)
    adapter = new SectionTiptapAdapter(host, {
      bdcId: 'bdc-section-feature-test',
      section: createSectionWithAnchor(),
      textFeature,
      anchorOptions: { presetBuilder: createAnchorTestPresetBuilder() },
      onChange: () => undefined,
      onToolbarState: () => undefined,
    })

    expect(adapter.editor.view.dom.dataset.testTextFeature).toBe('active')
    adapter.editor.view.dom.dispatchEvent(new Event('test-text-feature'))
    expect(handledEvents).toBe(1)

    const editor = adapter.editor
    const editorDom = editor.view.dom
    adapter.destroy()
    adapter = undefined
    editorDom.dispatchEvent(new Event('test-text-feature'))
    expect(handledEvents).toBe(1)
    expect(editor.isDestroyed).toBe(true)
  })
})

/** Creates the smallest valid Section containing a provisional anchor ratio. */
function createSectionWithAnchor(): SectionContent {
  return {
    title: '',
    markup: '<p id="section-test-text"></p>',
    revelation: { intro: null, outro: null },
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{
        type: 'elceAnchor',
        attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor', paddingBottom: '12rem' },
      }] }],
    },
  }
}
