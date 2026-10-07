import { createActor } from 'xstate'
import { describe, expect, it } from 'vitest'
import { BDC_LOCATION, BDC_TYPE, CATALOG_REFERENCE, CATALOG_TAB, DEFAULT_PRESET_ID } from '../../config/document-config'
import { controllerMachine } from '../controller/controller-machine'
import { editorViewModelEqual, selectEditorViewModel } from './editor-view-model'

describe('editor view model selector', () => {
  it('derives ordered page BDCs and catalogue entries without mutating the document', () => {
    const actor = createActor(controllerMachine, { input: {} })
    actor.start()
    const initialSnapshot = actor.getSnapshot()
    const initialDocument = initialSnapshot.context.document
    const initialView = selectEditorViewModel(initialSnapshot)

    expect(initialView.selectedPage?.id).toBe('page-a')
    expect(initialView.selectedPageBdcs.map((bdc) => bdc.id)).toEqual(['bdc-section-1'])
    expect(initialView.catalogContents).toEqual({ bdcs: [], media: [] })
    expect(actor.getSnapshot().context.document).toBe(initialDocument)

    actor.send({
      type: 'document.apply',
      command: {
        type: 'media.add',
        media: { id: 'media-photo', name: 'photo.jpg', mimeType: 'image/jpeg', size: 12, caption: '' },
      },
    })
    actor.send({
      type: 'document.apply',
      command: {
        type: 'bdc.create',
        bdcId: 'bdc-photo',
        bdcType: BDC_TYPE.CARD,
        presetId: DEFAULT_PRESET_ID.PHOTO,
        placement: { kind: BDC_LOCATION.CATALOG },
      },
    })
    actor.send({
      type: 'document.apply',
      command: { type: 'bdc.card.media.set', bdcId: 'bdc-photo', mediaId: 'media-photo' },
    })
    actor.send({ type: 'catalog.tab.select', tabId: CATALOG_TAB.MEDIA })

    const updatedSnapshot = actor.getSnapshot()
    const view = selectEditorViewModel(updatedSnapshot)
    expect(view.catalogContents.bdcs).toEqual([{
      key: `${CATALOG_REFERENCE.BDC}:bdc-photo`,
      name: 'photo.jpg',
      mediaType: 'image',
      reference: { kind: CATALOG_REFERENCE.BDC, bdcId: 'bdc-photo' },
    }])
    expect(view.catalogContents.media.map((entry) => entry.reference)).toEqual([
      { kind: CATALOG_REFERENCE.MEDIA, mediaId: 'media-photo' },
    ])
    expect(view.mediaById['media-photo']).toMatchObject({ name: 'photo.jpg', type: 'image', source: null })
    expect(view.catalogTab).toBe(CATALOG_TAB.MEDIA)
    expect(editorViewModelEqual(view, selectEditorViewModel(updatedSnapshot))).toBe(true)

    actor.stop()
  })
})
