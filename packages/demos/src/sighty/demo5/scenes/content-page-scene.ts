import { prepareTween, resolveTween } from 'ace'
import type { SceneDoc } from 'codplay/scene/types'
import type { CoursePage } from '../course-data'
import {
  createPageBottomMarker,
  createPageScrollPort,
  type CoursePerso,
  pageBottomPartId,
  pageScrollPortId,
} from './page-support'

const SECTION_TITLE_LIGHTNESS = 40
const SECTION_TITLE_CHROMA = 0.11
const SECTION_TITLE_HUE_SHIFT = 82
const SECTION_TITLE_THRESHOLDS = [0, 0.2, 0.4, 0.6, 0.8, 1] as const
const SECTION_IMAGE_ROOT_MARGIN = '0px'
const SECTION_IMAGE_HIDDEN_OFFSET = '-112%'
const SECTION_IMAGE_INITIAL_OFFSET = '0%'
const SECTION_IMAGE_FRAME_CLASS = 'demo5-page__image-frame'
const SECTION_IMAGE_ENTER_DURATION = 1000
const SECTION_IMAGE_LEAVE_DURATION = 820
const VIDEO_MAX_HEIGHT = '272px'
const VIDEO_PLAY_ROOT_MARGIN = '-136px 0px -136px 0px'

/** Builds one scrollable lesson page from its content catalogue entry. */
export function createContentPageScene(page: CoursePage): SceneDoc<string> {
  if (page.kind !== 'content' || page.sections === undefined) {
    throw new Error(`La page ${page.id} n’est pas une page de contenu.`)
  }

  const persos: CoursePerso[] = [
    createPageScrollPort(page.id),
    createContentArticle(page),
    ...page.sections.flatMap((section, index) => createSectionPersos(page, section, index)),
    createPageBottomMarker(page.id),
  ]

  return {
    id: `sighty-demo5-${page.id}`,
    stories: {
      main: {
        id: 'main',
        initial: { move: '@root' },
        persos,
        listen: [],
      },
    },
  }
}

/** Creates the article and explicit section mount points for one lesson page. */
function createContentArticle(page: CoursePage): CoursePerso {
  const sectionsMarkup = page.sections!.map((section, index) => {
    const sectionId = `${page.id}-section-${index + 1}`
    const headingPart = sectionPartId(page.id, index, 'heading')
    const paragraphPart = sectionPartId(page.id, index, 'paragraph')
    const imagePart = sectionPartId(page.id, index, 'image')
    const videoPart = sectionPartId(page.id, index, 'video')
    const optionalMedia = [
      section.image === undefined ? '' : `<!-- data-part="${imagePart}" -->`,
      section.video === undefined ? '' : `<!-- data-part="${videoPart}" -->`,
    ].join('')

    return `<section id="${sectionId}" class="demo5-page__section">
      <!-- data-part="${headingPart}" -->
      <!-- data-part="${paragraphPart}" -->
      ${optionalMedia}
    </section>`
  }).join('')

  return {
    id: `${page.id}-article`,
    type: 'layout',
    initial: {
      move: { target: pageScrollPortId(page.id) },
      className: 'demo5-page__article',
      style: {
        display: 'flex',
        minHeight: 'calc(100% + 8rem)',
        flexDirection: 'column',
        gap: '1.25rem',
        padding: 'clamp(1rem, 3vw, 2rem)',
        boxSizing: 'border-box',
      },
      markup: `<article id="${page.id}-article-root" class="demo5-page__article">
        ${sectionsMarkup}
        <div id="${page.id}-bottom-host" class="demo5-page__bottom-host" data-part="${pageBottomPartId(page.id)}"></div>
      </article>`,
    },
  }
}

/** Creates the authored heading, paragraph, and media persos for one section. */
function createSectionPersos(
  page: CoursePage,
  section: NonNullable<CoursePage['sections']>[number],
  index: number,
): CoursePerso[] {
  const sectionNumber = index + 1
  const headingId = `${page.id}-section-${sectionNumber}-heading`
  const headingVisibilityAction = `${headingId}:visibility`
  const headingStartHue = (24 + index * 54) % 360
  const headingStartColor = `oklch(${SECTION_TITLE_LIGHTNESS}% ${SECTION_TITLE_CHROMA} ${headingStartHue}deg)`
  const headingEndColor = `oklch(${SECTION_TITLE_LIGHTNESS}% ${SECTION_TITLE_CHROMA} ${(headingStartHue + SECTION_TITLE_HUE_SHIFT) % 360}deg)`
  const headingTween = prepareTween({
    from: headingStartColor,
    to: headingEndColor,
    duration: 1,
    ease: 'linear',
  })
  const persos: CoursePerso[] = [
    {
      id: headingId,
      type: 'tag',
      initial: {
        tag: 'h2',
        attr: { id: headingId },
        content: section.heading,
        className: 'demo5-page__section-title',
        style: { backgroundColor: headingStartColor },
        move: { target: sectionPartId(page.id, index, 'heading') },
      },
      emit: {
        observe: {
          liveAction: headingVisibilityAction,
          zone: { threshold: SECTION_TITLE_THRESHOLDS },
          enter: [{ name: `${headingId}:enter` }],
          leave: [{ name: `${headingId}:leave` }],
        },
      },
      actions: {
        [headingVisibilityAction]: {
          duration: 1,
          fn: (input: { data: Readonly<Record<string, unknown>> }): Record<string, unknown> => ({
            style: { backgroundColor: resolveTween(headingTween, input.data.ratio as number) },
          }),
        },
        [`${headingId}:enter`]: { style: { boxShadow: '0 0.6rem 1.3rem rgb(15 23 42 / 18%)' } },
        [`${headingId}:leave`]: { style: { boxShadow: 'none' } },
      },
    },
    {
      id: `${page.id}-section-${sectionNumber}-paragraph`,
      type: 'tag',
      initial: {
        tag: 'p',
        content: section.paragraph,
        className: 'demo5-page__paragraph',
        move: { target: sectionPartId(page.id, index, 'paragraph') },
      },
    },
  ]

  if (section.image !== undefined) {
    persos.push(...createObservedSectionImage(page, section, index))
  }

  if (section.video !== undefined) {
    persos.push(...createObservedSectionVideo(page, section, index))
  }

  return persos
}

/** Creates a section image whose image perso owns explicit enter/leave tweens. */
function createObservedSectionImage(
  page: CoursePage,
  section: NonNullable<CoursePage['sections']>[number],
  index: number,
): CoursePerso[] {
  const image = section.image!
  const imageId = `${page.id}-section-${index + 1}-image`
  const imageFrameId = `${imageId}-frame`
  const enterEvent = `${imageId}:enter`
  const leaveEvent = `${imageId}:leave`
  return [
    {
      id: imageFrameId,
      type: 'tag',
      initial: {
        tag: 'figure',
        attr: { id: imageFrameId },
        className: SECTION_IMAGE_FRAME_CLASS,
        move: { target: sectionPartId(page.id, index, 'image') },
      },
      emit: {
        observe: {
          zone: { rootMargin: SECTION_IMAGE_ROOT_MARGIN, threshold: 0 },
          enter: [{ name: enterEvent }],
          leave: [{ name: leaveEvent }],
        },
      },
    },
    {
      id: imageId,
      type: 'img',
      initial: {
        src: image.src,
        alt: image.alt,
        className: 'demo5-page__image',
        // The first IntersectionObserver callback synchronizes phase without
        // emitting enter, so an image already in the viewport must start visible.
        style: { translateX: SECTION_IMAGE_INITIAL_OFFSET },
        img: {
          style: {
            display: 'block',
            width: '100%',
            height: '100%',
            maxHeight: '24rem',
            objectFit: 'cover',
            borderRadius: '0.7rem',
          },
        },
        move: { target: imageFrameId },
      },
      actions: {
        [enterEvent]: {
          style: {
            translateX: {
              from: SECTION_IMAGE_HIDDEN_OFFSET,
              to: '0%',
              duration: SECTION_IMAGE_ENTER_DURATION,
              ease: 'outCubic',
            },
          },
        },
        [leaveEvent]: {
          style: {
            translateX: {
              from: '0%',
              to: SECTION_IMAGE_HIDDEN_OFFSET,
              duration: SECTION_IMAGE_LEAVE_DURATION,
              ease: 'inCubic',
            },
          },
        },
      },
    },
  ]
}

/** Creates a video media perso and its full-visibility and half-hidden observers. */
function createObservedSectionVideo(
  page: CoursePage,
  section: NonNullable<CoursePage['sections']>[number],
  index: number,
): CoursePerso[] {
  const video = section.video!
  const videoId = `${page.id}-section-${index + 1}-video`
  const playEvent = `${videoId}:fully-visible`
  const pauseEvent = `${videoId}:half-hidden`
  const centerMarkerStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '1px',
    height: '1px',
    opacity: 0,
    pointerEvents: 'none',
  }

  return [
    {
      id: videoId,
      type: 'media',
      initial: {
        tag: 'video',
        src: video.src,
        controls: true,
        master: false,
        className: 'demo5-page__video',
        style: { position: 'relative', width: '100%', maxWidth: '36rem' },
        video: {
          className: 'demo5-page__video-native',
          attr: { preload: 'metadata', 'aria-label': video.title },
          style: { display: 'block', width: '100%', maxHeight: VIDEO_MAX_HEIGHT, objectFit: 'cover', borderRadius: '0.7rem' },
        },
        move: { target: sectionPartId(page.id, index, 'video') },
      },
      actions: {
        [playEvent]: { broadcast: { type: 'START' } },
        [pauseEvent]: { broadcast: { type: 'PAUSE' } },
      },
    },
    {
      id: `${videoId}-full-visibility-marker`,
      type: 'tag',
      initial: {
        tag: 'span',
        attr: { 'aria-hidden': 'true' },
        className: 'demo5-page__video-visibility-marker',
        style: centerMarkerStyle,
        move: { target: videoId },
      },
      emit: {
        observe: {
          zone: { rootMargin: VIDEO_PLAY_ROOT_MARGIN, threshold: 0 },
          enter: [{ name: playEvent }],
        },
      },
    },
    {
      id: `${videoId}-half-hidden-marker`,
      type: 'tag',
      initial: {
        tag: 'span',
        attr: { 'aria-hidden': 'true' },
        className: 'demo5-page__video-visibility-marker',
        style: centerMarkerStyle,
        move: { target: videoId },
      },
      emit: {
        observe: {
          zone: { threshold: 0 },
          leave: [{ name: pauseEvent }],
        },
      },
    },
  ]
}

/** Creates a stable CodPlay part name for one section child. */
function sectionPartId(pageId: string, index: number, part: string): string {
  return `${pageId}:section:${index + 1}:${part}`
}
