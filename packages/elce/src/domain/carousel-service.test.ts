import { describe, expect, it } from 'vitest'
import { CAROUSEL_CONFIG, DEFAULT_PRESET_ID } from '../config/document-config'
import { ElceCarouselService } from './carousel-service'

describe('ElceCarouselService', () => {
  it('preserves shared text and hidden image references while changing card presets', () => {
    const service = new ElceCarouselService()
    let carousel = service.createDefault()
    const viewId = carousel.views[0]!.id

    carousel = service.setShortText(carousel, viewId, 'title', 'Présentation')
    carousel = service.setShortText(carousel, viewId, 'message', 'Texte conservé')
    carousel = service.setViewDuration(carousel, viewId, 7000)
    carousel = service.changeViewPreset(carousel, viewId, DEFAULT_PRESET_ID.TEXT_IMAGE)

    expect(carousel.views[0]).toMatchObject({
      id: viewId,
      presetId: DEFAULT_PRESET_ID.TEXT_IMAGE,
      durationMs: 7000,
      text: { title: 'Présentation', message: 'Texte conservé' },
      mediaId: null,
      imagePosition: CAROUSEL_CONFIG.defaultImagePosition,
    })

    carousel = service.setMedia(carousel, viewId, 'media-photo')
    carousel = service.changeViewPreset(carousel, viewId, DEFAULT_PRESET_ID.PHOTO)

    expect(carousel.views[0]).toMatchObject({
      presetId: DEFAULT_PRESET_ID.PHOTO,
      durationMs: 7000,
      mediaId: 'media-photo',
    })

    carousel = service.changeViewPreset(carousel, viewId, DEFAULT_PRESET_ID.TEXT_SHORT)
    expect(carousel.views[0]).toMatchObject({ presetId: DEFAULT_PRESET_ID.TEXT_SHORT, mediaId: 'media-photo' })

    carousel = service.setShortText(carousel, viewId, 'title', 'Titre après passage par Texte court')
    carousel = service.setShortText(carousel, viewId, 'message', 'Message après passage par Texte court')
    carousel = service.changeViewPreset(carousel, viewId, DEFAULT_PRESET_ID.TEXT_IMAGE)

    expect(carousel.views[0]).toMatchObject({
      presetId: DEFAULT_PRESET_ID.TEXT_IMAGE,
      durationMs: 7000,
      mediaId: 'media-photo',
      text: { title: 'Titre après passage par Texte court', message: 'Message après passage par Texte court' },
      imagePosition: CAROUSEL_CONFIG.defaultImagePosition,
    })

    carousel = service.changeViewPreset(carousel, viewId, DEFAULT_PRESET_ID.IMAGE_CAPTION)
    expect(carousel.views[0]).toMatchObject({
      presetId: DEFAULT_PRESET_ID.IMAGE_CAPTION,
      durationMs: 7000,
      mediaId: 'media-photo',
      text: { caption: '' },
    })

    carousel = service.changeViewPreset(carousel, viewId, DEFAULT_PRESET_ID.TEXT_IMAGE)
    expect(carousel.views[0]).toMatchObject({
      presetId: DEFAULT_PRESET_ID.TEXT_IMAGE,
      durationMs: 7000,
      mediaId: 'media-photo',
    })
  })

  it('keeps all content when the selected preset is already active', () => {
    const service = new ElceCarouselService()
    let carousel = service.createDefault()
    const viewId = carousel.views[0]!.id

    carousel = service.setShortText(carousel, viewId, 'title', 'Titre existant')
    const originalView = carousel.views[0]
    carousel = service.changeViewPreset(carousel, viewId, DEFAULT_PRESET_ID.TEXT_SHORT)

    expect(carousel.views[0]).toBe(originalView)
  })
})
