import { describe, expect, it } from 'vitest'
import { CATALOG_REFERENCE, DEFAULT_PRESET_ID, MEDIA_TYPE } from '../../../config/document-config'
import { cardLayoutAcceptsFile, cardLayoutAcceptsMedia, cardToolbarClassName, parseCardMediaReference } from './card-editor-rules'

describe('Card editor rules', () => {
  it('keeps the layout-specific image and video choices shared by both renderers', () => {
    expect(cardLayoutAcceptsMedia(DEFAULT_PRESET_ID.PHOTO, MEDIA_TYPE.IMAGE)).toBe(true)
    expect(cardLayoutAcceptsMedia(DEFAULT_PRESET_ID.PHOTO, MEDIA_TYPE.VIDEO)).toBe(true)
    expect(cardLayoutAcceptsMedia(DEFAULT_PRESET_ID.IMAGE_CAPTION, MEDIA_TYPE.IMAGE)).toBe(true)
    expect(cardLayoutAcceptsMedia(DEFAULT_PRESET_ID.IMAGE_CAPTION, MEDIA_TYPE.VIDEO)).toBe(false)
    expect(cardLayoutAcceptsMedia(DEFAULT_PRESET_ID.TEXT_IMAGE, MEDIA_TYPE.IMAGE)).toBe(true)
    expect(cardLayoutAcceptsMedia(DEFAULT_PRESET_ID.TEXT_IMAGE, MEDIA_TYPE.VIDEO)).toBe(false)
    expect(cardLayoutAcceptsMedia(DEFAULT_PRESET_ID.TEXT_SHORT, MEDIA_TYPE.IMAGE)).toBe(false)
  })

  it('filters imported files with the same layout rules', () => {
    const image = new File(['image'], 'image.png', { type: 'image/png' })
    const video = new File(['video'], 'video.mp4', { type: 'video/mp4' })
    const text = new File(['text'], 'readme.txt', { type: 'text/plain' })

    expect(cardLayoutAcceptsFile(DEFAULT_PRESET_ID.PHOTO, image)).toBe(true)
    expect(cardLayoutAcceptsFile(DEFAULT_PRESET_ID.PHOTO, video)).toBe(true)
    expect(cardLayoutAcceptsFile(DEFAULT_PRESET_ID.TEXT_IMAGE, video)).toBe(false)
    expect(cardLayoutAcceptsFile(DEFAULT_PRESET_ID.TEXT_SHORT, image)).toBe(false)
    expect(cardLayoutAcceptsFile(DEFAULT_PRESET_ID.PHOTO, text)).toBe(false)
  })

  it('accepts only media catalogue references', () => {
    const mediaReference = { kind: CATALOG_REFERENCE.MEDIA, mediaId: 'media-1' }
    const bdcReference = { kind: CATALOG_REFERENCE.BDC, bdcId: 'bdc-1' }

    expect(parseCardMediaReference(JSON.stringify(mediaReference))).toEqual(mediaReference)
    expect(parseCardMediaReference(JSON.stringify(bdcReference))).toBeNull()
    expect(parseCardMediaReference('{invalid')).toBeNull()
  })

  it('uses the shared toolbar layout for each preset', () => {
    expect(cardToolbarClassName(DEFAULT_PRESET_ID.TEXT_SHORT)).toContain('--text-only')
    expect(cardToolbarClassName(DEFAULT_PRESET_ID.TEXT_IMAGE)).toContain('--image-position')
    expect(cardToolbarClassName(DEFAULT_PRESET_ID.PHOTO)).toContain('--image')
    expect(cardToolbarClassName(DEFAULT_PRESET_ID.IMAGE_CAPTION)).toContain('--image')
  })
})
