/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { CARD_IMAGE_FIT, CAROUSEL_IMAGE_POSITION, DEFAULT_PRESET_ID } from '../../../config/document-config'
import { createInitialDocument } from '../../../domain/document/document-model'
import type { SectionContent } from '../../../domain/document/document-types'
import { SectionTiptapAdapter } from './section-editor-tiptap-adapter'
import { INLINE_TEXT_LABEL_SELECTION_EVENT, INLINE_TEXT_LABEL_UPDATE_EVENT } from '../profile/profile-token-events'
import type { InlineTextLabelSelectionEventDetail, InlineTextLabelUpdateDetail } from '../profile/profile-token-events'

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
      pages: [],
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

  it('publishes a selected inline label and persists its edited attributes through the section callback', async () => {
    const section = createSectionWithInlineLabel()
    const onChange = vi.fn()
    const host = document.createElement('div')
    document.body.append(host)
    adapter = new SectionTiptapAdapter(host, {
      bdcId: 'bdc-section-1',
      section,
      profileProperties: [],
      pages: [{ id: 'page-a', name: 'Page A', type: 'flux', chapterId: null, bdcIds: [] }],
      anchorOptions: { resolveCard: () => null },
      onChange,
      onToolbarState: vi.fn(),
    })
    const selectionEvents: InlineTextLabelSelectionEventDetail[] = []
    adapter.editor.view.dom.addEventListener(INLINE_TEXT_LABEL_SELECTION_EVENT, (event) => {
      selectionEvents.push((event as CustomEvent<InlineTextLabelSelectionEventDetail>).detail)
    })
    adapter.editor.commands.setNodeSelection(1)

    expect(selectionEvents.at(-1)).toEqual({
      targetId: 'elce-editor-content-bdc-section-1',
      selection: {
        position: 1,
        label: {
          kind: 'page-link',
          pageId: 'page-a',
          label: null,
          fallbackLabel: 'Page A',
          presentation: 'text',
        },
      },
    })

    const update: InlineTextLabelUpdateDetail = {
      position: 1,
      expected: {
        kind: 'page-link',
        pageId: 'page-a',
        label: null,
        fallbackLabel: 'Page A',
        presentation: 'text',
      },
      label: {
        kind: 'page-link',
        pageId: 'page-a',
        label: 'Lire la page',
        fallbackLabel: 'Page A',
        presentation: 'button',
      },
    }
    adapter.editor.view.dom.dispatchEvent(new CustomEvent(INLINE_TEXT_LABEL_UPDATE_EVENT, {
      bubbles: true,
      detail: update,
    }))

    expect(adapter.editor.getJSON()).toMatchObject({
      content: [{ content: [{
        type: 'pageLinkLabel',
        attrs: { pageId: 'page-a', label: 'Lire la page', presentation: 'button' },
      }] }],
    })
    expect(selectionEvents.at(-1)?.selection).toEqual({ position: 1, label: update.label })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      kind: 'content',
      content: expect.objectContaining({
        content: [expect.objectContaining({ content: [expect.objectContaining({
          type: 'pageLinkLabel',
          attrs: expect.objectContaining({ label: 'Lire la page', presentation: 'button' }),
        })] })],
      }),
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

/** Creates a Section whose first inline atom can be selected for editing. */
function createSectionWithInlineLabel(): SectionContent {
  const document = createInitialDocument()
  const sectionBdc = document.bdcs.find((bdc) => bdc.id === 'bdc-section-1')
  if (sectionBdc?.section === null || sectionBdc?.section === undefined) throw new Error('La fixture doit contenir une Section.')
  return {
    ...sectionBdc.section,
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{
        type: 'pageLinkLabel',
        attrs: { pageId: 'page-a', label: null, fallbackLabel: 'Page A', presentation: 'text' },
      }] }],
    },
  }
}
