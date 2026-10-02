import type { PersoDoc, StoryDoc } from 'codplay/scene/types'
import { BDC_TYPE, ELCE_ANCHOR, ELCE_EVENTS, PAGE_TYPE } from '../config/document-config'
import type { Bdc, Page } from '../domain/document-types'
import type { FluxSceneBuild, FluxSceneBuildOptions } from './flux-scene-builder-types'

type FluxBdcMount = Readonly<{
  readonly bdc: Bdc
  readonly partId: string
  readonly markup: string
}>

type FluxAnchorTarget = Readonly<{
  readonly bdcId: string
  readonly partId: string
}>

/** Builds an Elcé Flux scene from the métier page without creating a player circuit. */
export function buildFluxScene(
  page: Page,
  bdcs: readonly Bdc[],
  options: FluxSceneBuildOptions = {},
): FluxSceneBuild {
  switch (page.type) {
    case PAGE_TYPE.FLUX:
      return buildFluxPageScene(page, bdcs, options)
    case PAGE_TYPE.DIAPO:
      throw new Error(`Le builder Flux ne traite pas encore la page Diapo ${page.id}.`)
    default:
      return assertNeverPageType(page.type)
  }
}

function buildFluxPageScene(page: Page, bdcs: readonly Bdc[], options: FluxSceneBuildOptions): FluxSceneBuild {
  const pageBdcs = page.bdcIds.map((bdcId) => bdcs.find((bdc) => bdc.id === bdcId))
  const missingBdc = pageBdcs.find((bdc) => bdc === undefined)
  switch (missingBdc) {
    case undefined:
      break
    default:
      throw new Error(`Un bdc de la page ${page.id} est introuvable.`)
  }
  const pageContents = pageBdcs.filter((bdc): bdc is Bdc => bdc !== undefined)
  const anchorTargets = readAnchorTargets(pageContents)
  const mounts = pageContents.map((bdc) => createBdcMount(page, bdc, anchorTargets))

  const scrollPortId = `${page.id}-scrollport`
  const articleId = `${page.id}-article`
  const bottomMarkerId = `${page.id}-bottom-marker`
  const articleMarkup = `<article id="${articleId}" class="elce-flux-article">${mounts.map((mount) => mount.markup).join('')}<div id="${page.id}-bottom-host" data-part="${page.id}:bottom"></div></article>`
  const pageMediaPersos = mounts.flatMap((mount) => createMediaPersos(page, mount, scrollPortId, options))

  const pageStory: StoryDoc<string> = {
    id: `${page.id}-page`,
    persos: [
      {
        id: scrollPortId,
        type: 'scroll-container',
        initial: {
          tag: 'section',
          attr: { id: scrollPortId, 'aria-label': 'Contenu de la page' },
          className: 'elce-flux-scrollport',
          style: { width: '100%', height: '100%', minHeight: 0, overflowY: 'auto' },
          move: '@root',
        },
      },
      {
        id: articleId,
        type: 'layout',
        initial: {
          move: { target: scrollPortId },
          className: 'elce-flux-article',
          style: { display: 'flex', minHeight: '100%', flexDirection: 'column', gap: '1.25rem', padding: '2rem', boxSizing: 'border-box' },
          markup: articleMarkup,
        },
      },
      {
        id: bottomMarkerId,
        type: 'tag',
        initial: {
          tag: 'span',
          attr: { id: bottomMarkerId, 'aria-hidden': 'true' },
          style: { display: 'block', width: '1px', height: '1px', marginTop: 'auto', opacity: 0 },
          move: { target: `${page.id}:bottom` },
        },
        emit: {
          observe: {
            root: scrollPortId,
            initial: 'enter',
            zone: { threshold: 0 },
            enter: [{ name: ELCE_EVENTS.PAGE_BOTTOM, data: { pageId: page.id }, visibility: 'public' }],
          },
        },
      },
      ...pageMediaPersos,
    ],
  }

  const stories: Readonly<Record<string, StoryDoc<string>>> = {
    [pageStory.id]: pageStory,
    ...Object.fromEntries(mounts.filter((mount) => mount.bdc.type === BDC_TYPE.SECTION).map((mount) => [
      `${page.id}-${mount.bdc.id}`,
      createSectionStory(page, mount.bdc, `${mount.partId}:title`),
    ])),
  }
  return {
    sceneDoc: { id: `elce-flux-${page.id}`, stories },
    scrollPortId,
    bottomMarkerId,
    storyIds: Object.keys(stories),
  }
}

function createBdcMount(page: Page, bdc: Bdc, anchorTargets: readonly FluxAnchorTarget[]): FluxBdcMount {
  switch (bdc.type) {
    case BDC_TYPE.SECTION: {
      const partId = `${page.id}:${bdc.id}:section`
      const sectionId = `${page.id}-${bdc.id}`
      const titlePartId = `${partId}:title`
      return {
        bdc,
        partId,
        markup: `<section id="${sectionId}" data-part="${partId}"><div id="${sectionId}-title-host" data-part="${titlePartId}"></div>${bdc.section?.markup ?? ''}</section>`,
      }
    }
    case BDC_TYPE.IMAGE:
    case BDC_TYPE.VIDEO: {
      const anchorTarget = anchorTargets.find((candidate) => candidate.bdcId === bdc.id)
      switch (anchorTarget) {
        case undefined:
          break
        default:
          return { bdc, partId: anchorTarget.partId, markup: '' }
      }
      const partId = `${page.id}:${bdc.id}:media`
      const hostId = `${page.id}-${bdc.id}-media-host`
      return {
        bdc,
        partId,
        markup: `<div id="${hostId}" class="elce-flux-media-host" data-part="${partId}"></div>`,
      }
    }
    case BDC_TYPE.QUESTION:
    case BDC_TYPE.DIAPO:
      throw new Error(`Le bdc ${bdc.type} n’est pas encore pris en charge dans le Flux.`)
    default:
      return assertNeverBdcType(bdc.type)
  }
}

/** Reads the CodPlay targets exported by anchors inside the page's Sections. */
function readAnchorTargets(bdcs: readonly Bdc[]): readonly FluxAnchorTarget[] {
  return bdcs.flatMap((bdc) => {
    switch (bdc.type) {
      case BDC_TYPE.SECTION:
        return readAnchorTargetsFromMarkup(bdc.section?.markup ?? '')
      case BDC_TYPE.IMAGE:
      case BDC_TYPE.VIDEO:
      case BDC_TYPE.QUESTION:
      case BDC_TYPE.DIAPO:
        return []
      default:
        return assertNeverBdcType(bdc.type)
    }
  })
}

/** Extracts the stable bdc and CodPlay part identifiers from exported anchor spans. */
function readAnchorTargetsFromMarkup(markup: string): readonly FluxAnchorTarget[] {
  const anchorPattern = new RegExp(`<span\\b(?=[^>]*\\b${ELCE_ANCHOR.DATA_ATTRIBUTE}\\s*=\\s*["']true["'])[^>]*>`, 'gi')
  return Array.from(markup.matchAll(anchorPattern)).flatMap((match) => {
    const tag = match[0] ?? ''
    const bdcId = readMarkupAttribute(tag, 'data-bdc-id')
    const partId = readMarkupAttribute(tag, 'data-part')
    switch (bdcId) {
      case null:
        return []
      default:
        switch (partId) {
          case null:
            return []
          default:
            return [{ bdcId, partId }]
        }
    }
  })
}

/** Reads one quoted attribute from an exported markup tag. */
function readMarkupAttribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))
  return match?.[2] ?? null
}

function createMediaPersos(
  page: Page,
  mount: FluxBdcMount,
  scrollPortId: string,
  options: FluxSceneBuildOptions,
): readonly PersoDoc<string>[] {
  switch (mount.bdc.type) {
    case BDC_TYPE.SECTION:
      return []
    case BDC_TYPE.IMAGE:
      return [createImagePerso(page, mount.bdc, mount.partId, scrollPortId, resolveMediaSource(mount.bdc, options))]
    case BDC_TYPE.VIDEO:
      return [createVideoPerso(page, mount.bdc, mount.partId, scrollPortId, resolveMediaSource(mount.bdc, options))]
    case BDC_TYPE.QUESTION:
    case BDC_TYPE.DIAPO:
      throw new Error(`Le bdc ${mount.bdc.type} n’est pas encore pris en charge dans le Flux.`)
    default:
      return assertNeverBdcType(mount.bdc.type)
  }
}

function createSectionStory(page: Page, bdc: Bdc, articlePartId: string): StoryDoc<string> {
  const headingId = `${page.id}-${bdc.id}-title`
  return {
    id: `${page.id}-${bdc.id}`,
    persos: bdc.section?.title
      ? [{
          id: headingId,
          type: 'tag',
          initial: {
            tag: 'h2',
            content: bdc.section.title,
            move: { target: articlePartId },
          },
        }]
      : [],
  }
}

function createImagePerso(
  page: Page,
  bdc: Bdc,
  articlePartId: string,
  scrollPortId: string,
  source: string,
): PersoDoc<string> {
  const imageId = `${page.id}-${bdc.id}-image`
  const enterEvent = `${imageId}:enter`
  const leaveEvent = `${imageId}:leave`
  return {
    id: imageId,
    type: 'img',
    initial: {
      src: source,
      className: 'elce-flux-image',
      style: { translateX: '0%' },
      img: {
        style: { display: 'block', width: '100%', aspectRatio: '4 / 3', objectFit: 'cover' },
      },
      move: { target: articlePartId },
    },
    emit: {
      observe: {
        root: scrollPortId,
        zone: { threshold: 0 },
        enter: [{ name: enterEvent }],
        leave: [{ name: leaveEvent }],
      },
    },
    actions: {
      [enterEvent]: { style: { translateX: { from: '-112%', to: '0%', duration: 1000, ease: 'outCubic' } } },
      [leaveEvent]: { style: { translateX: { from: '0%', to: '-112%', duration: 820, ease: 'inCubic' } } },
    },
  }
}

function createVideoPerso(
  page: Page,
  bdc: Bdc,
  articlePartId: string,
  scrollPortId: string,
  source: string,
): PersoDoc<string> {
  const videoId = `${page.id}-${bdc.id}-video`
  const playEvent = `${videoId}:fully-visible`
  const pauseEvent = `${videoId}:half-hidden`
  return {
    id: videoId,
    type: 'media',
    initial: {
      tag: 'video',
      src: source,
      controls: true,
      master: false,
      className: 'elce-flux-video',
      style: { position: 'relative', width: '100%', marginInline: 'auto', maxWidth: '48rem' },
      video: {
        style: { display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover' },
      },
      move: { target: articlePartId },
    },
    emit: {
      observe: {
        root: scrollPortId,
        zone: { threshold: 0.75 },
        enter: [{ name: playEvent }],
        leave: [{ name: pauseEvent }],
      },
    },
    actions: {
      [playEvent]: { broadcast: { type: 'START' } },
      [pauseEvent]: { broadcast: { type: 'PAUSE' } },
    },
  }
}

function resolveMediaSource(bdc: Bdc, options: FluxSceneBuildOptions): string {
  switch (bdc.mediaId) {
    case null:
      throw new Error(`Le bdc média ${bdc.id} ne référence aucun média.`)
    default:
      break
  }
  const source = options.mediaSources?.[bdc.mediaId]
  switch (source) {
    case undefined:
      throw new Error(`La source du média ${bdc.mediaId} est absente pour le bdc ${bdc.id}.`)
    default:
      return source
  }
}

function assertNeverPageType(value: never): never {
  throw new Error(`Type de page non traité : ${String(value)}`)
}

function assertNeverBdcType(value: never): never {
  throw new Error(`Type de bdc non traité : ${String(value)}`)
}
