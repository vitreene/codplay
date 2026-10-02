import { describe, expect, it } from 'vitest'
import { CodPlay } from 'codplay'
import {
  SCROLL_CONTAINER_COMPONENT_DEFINITION,
  SCROLL_CONTAINER_MODULE_DEFINITION,
} from '@codplay/component-v2'
import { BDC_LOCATION, BDC_TYPE, ELCE_EVENTS, PAGE_TYPE } from '../config/document-config'
import { applyDocumentCommand } from '../app/commands/document-commands'
import { createInitialDocument } from '../domain/document-model'
import { buildFluxScene } from './flux-scene-builder'

describe('Elcé Flux scene builder', () => {
  it('creates one scrollport, one article and one story per Section', () => {
    const document = createInitialDocument()
    const page = document.pages[0]!
    const build = buildFluxScene(page, document.bdcs)

    expect(build.sceneDoc.stories['page-a-page']?.persos.map((perso) => perso.id)).toEqual([
      'page-a-scrollport',
      'page-a-article',
      'page-a-bottom-marker',
    ])
    expect(build.storyIds).toEqual(['page-a-page', 'page-a-bdc-section-1'])
    expect(build.sceneDoc.stories['page-a-page']?.persos[1]?.initial).toMatchObject({
      markup: expect.stringContaining('id="page-a-article"'),
    })
    expect(build.sceneDoc.stories['page-a-bdc-section-1']?.persos).toHaveLength(0)
    expect(build.sceneDoc.stories['page-a-page']?.persos[2]?.emit?.observe).toMatchObject({
      initial: 'enter',
      enter: [{ name: ELCE_EVENTS.PAGE_BOTTOM }],
    })
  })

  it('places the Section title host before the exported text markup', () => {
    const initial = createInitialDocument()
    const withTitle = applyDocumentCommand(initial, {
      type: 'bdc.section.update',
      bdcId: 'bdc-section-1',
      title: 'Introduction',
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Texte' }] }] },
      markup: '<p id="section-text-1">Texte</p>',
    })
    const build = buildFluxScene(withTitle.pages[0]!, withTitle.bdcs)
    const articleInitial = build.sceneDoc.stories['page-a-page']?.persos[1]?.initial
    const articleMarkup = articleInitial !== undefined && 'markup' in articleInitial ? String(articleInitial.markup) : ''

    const titleHostPosition = articleMarkup.indexOf('data-part="page-a:bdc-section-1:section:title"')
    expect(titleHostPosition).toBeGreaterThanOrEqual(0)
    expect(titleHostPosition).toBeLessThan(articleMarkup.indexOf('<p id="section-text-1">Texte</p>'))
    expect(build.sceneDoc.stories['page-a-bdc-section-1']?.persos[0]?.initial).toMatchObject({
      content: 'Introduction',
      move: { target: 'page-a:bdc-section-1:section:title' },
    })
  })

  it('compiles through the CodPlay scene boundary with the optional scroll capability', () => {
    const document = createInitialDocument()
    const build = buildFluxScene(document.pages[0]!, document.bdcs)
    const codplay = new CodPlay({
      pauseOnDocumentHidden: false,
      engine: {
        idle: false,
        components: { register: [SCROLL_CONTAINER_COMPONENT_DEFINITION] },
        modules: { register: [SCROLL_CONTAINER_MODULE_DEFINITION] },
      },
    })

    const result = codplay.build({ scene: build.sceneDoc })

    expect(result.ok).toBe(true)
    codplay.destroy()
  })

  it('resolves the configured non-Flux page case explicitly', () => {
    const document = createInitialDocument()

    expect(() => buildFluxScene({ ...document.pages[0]!, type: PAGE_TYPE.DIAPO }, document.bdcs))
      .toThrow('page Diapo')
  })

  it('projects a simple image bdc to one img perso and one media host', () => {
    const initial = createInitialDocument()
    const withMedia = applyDocumentCommand(initial, {
      type: 'media.add',
      media: { id: 'media-image-1', type: 'image', name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    const withImage = applyDocumentCommand(withMedia, {
      type: 'bdc.create',
      bdcId: 'bdc-image-1',
      bdcType: BDC_TYPE.IMAGE,
      presetId: 'image-basic',
      mediaId: 'media-image-1',
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    })
    const build = buildFluxScene(withImage.pages[0]!, withImage.bdcs, {
      mediaSources: { 'media-image-1': 'blob:image-1' },
    })

    expect(build.sceneDoc.stories['page-a-page']?.persos[1]?.initial).toMatchObject({
      markup: expect.stringContaining('data-part="page-a:bdc-image-1:media"'),
    })
    expect(build.sceneDoc.stories['page-a-page']?.persos).toHaveLength(4)
    expect(build.sceneDoc.stories['page-a-page']?.persos[3]).toMatchObject({
      type: 'img',
      initial: { src: 'blob:image-1', move: { target: 'page-a:bdc-image-1:media' } },
    })
  })

  it('mounts an image bdc at the exported anchor inside the text flow', () => {
    const initial = createInitialDocument()
    const withMedia = applyDocumentCommand(initial, {
      type: 'media.add',
      media: { id: 'media-image-1', type: 'image', name: 'image.png', mimeType: 'image/png', size: 10, caption: '' },
    })
    const withImage = applyDocumentCommand(withMedia, {
      type: 'bdc.create',
      bdcId: 'bdc-image-1',
      bdcType: BDC_TYPE.IMAGE,
      presetId: 'image-basic',
      mediaId: 'media-image-1',
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    })
    const anchored = applyDocumentCommand(withImage, {
      type: 'bdc.section.update',
      bdcId: 'bdc-section-1',
      title: '',
      content: {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Avant ' },
            { type: 'elceAnchor', attrs: { bdcId: 'bdc-image-1', partId: 'page-a:bdc-image-1:anchor' } },
            { type: 'text', text: ' après' },
          ],
        }],
      },
      markup: '<p id="section-text-1">Avant <span id="page-a:bdc-image-1:anchor" data-elce-anchor="true" data-bdc-id="bdc-image-1" data-part="page-a:bdc-image-1:anchor" style="display:inline-block;position:relative;padding-bottom:12rem;"></span> après</p>',
    })
    const build = buildFluxScene(anchored.pages[0]!, anchored.bdcs, {
      mediaSources: { 'media-image-1': 'blob:image-1' },
    })
    const pageStory = build.sceneDoc.stories['page-a-page']
    const articleInitial = pageStory?.persos[1]?.initial
    const articleMarkup = articleInitial !== undefined && 'markup' in articleInitial ? String(articleInitial.markup) : ''

    expect(articleMarkup).toContain('data-elce-anchor="true"')
    expect(articleMarkup).not.toContain('page-a-bdc-image-1-media-host')
    expect(pageStory?.persos[3]).toMatchObject({
      type: 'img',
      initial: { src: 'blob:image-1', move: { target: 'page-a:bdc-image-1:anchor' } },
    })
  })

  it('projects a simple video bdc to one media perso with native controls', () => {
    const initial = createInitialDocument()
    const withMedia = applyDocumentCommand(initial, {
      type: 'media.add',
      media: { id: 'media-video-1', type: 'video', name: 'video.mp4', mimeType: 'video/mp4', size: 10, caption: '' },
    })
    const withVideo = applyDocumentCommand(withMedia, {
      type: 'bdc.create',
      bdcId: 'bdc-video-1',
      bdcType: BDC_TYPE.VIDEO,
      presetId: 'video-basic',
      mediaId: 'media-video-1',
      placement: { kind: BDC_LOCATION.PAGE, pageId: 'page-a' },
    })
    const build = buildFluxScene(withVideo.pages[0]!, withVideo.bdcs, {
      mediaSources: { 'media-video-1': 'blob:video-1' },
    })
    const videoPerso = build.sceneDoc.stories['page-a-page']?.persos[3]

    expect(videoPerso).toMatchObject({
      type: 'media',
      initial: { tag: 'video', src: 'blob:video-1', controls: true, move: { target: 'page-a:bdc-video-1:media' } },
    })
  })
})
