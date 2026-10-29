/** @vitest-environment jsdom */

import { afterEach, describe, expect, it } from 'vitest'
import { prepareTween, resolveTween } from 'ace'
import { normalizeReplacePresetCommand, REPLACE_TEXT_SPLITS } from '../../../src/runtime/capabilities/replace-presets'
import { createHtmlReplacePresentationSurface } from '../../../src/runtime/runner-html/replace-presentation-surface'
import { resolveMediaCellSettings } from '../../../src/runtime/runner-html/replace-presentation/profile'
import {
  assignVisualLines,
  createTextUnits,
  segmentTextGraphemes,
  splitTextWords,
  type MeasuredTextFragment,
} from '../../../src/runtime/runner-html/replace-presentation/text'
import type {
  ReplaceMediaPresentationProfile,
  ReplaceMotionProfile,
  SlotReplaceProfile,
} from '../../../src/runtime/components'

/** Creates a slot root with two replaceable foreign-view contents. */
function createReplaceFixture(profile: SlotReplaceProfile): Readonly<{
  parent: HTMLElement
  root: HTMLElement
  session: NonNullable<ReturnType<ReturnType<typeof createHtmlReplacePresentationSurface>['begin']>>
}> {
  const parent = document.createElement('main')
  const root = document.createElement('section')
  root.textContent = 'outgoing view'
  parent.append(root)
  document.body.append(parent)
  const surface = createHtmlReplacePresentationSurface(root)
  const session = surface.begin(profile)
  if (session === undefined) throw new Error('A materialized slot should provide a replace session.')
  root.textContent = 'incoming view'
  session.start()
  return { parent, root, session }
}

/** Returns the two temporary snapshots in outgoing-to-incoming order. */
function getSnapshots(parent: HTMLElement): readonly HTMLElement[] {
  return Array.from(parent.querySelectorAll<HTMLElement>('[data-codplay-replace-view]'))
}

/** Returns the temporary element that clips both views to the slot rectangle. */
function getPresentationLayer(parent: HTMLElement): HTMLElement | null {
  return parent.querySelector<HTMLElement>('[data-codplay-replace-layer]')
}

describe('HTML slot replacement presentation surface', () => {
  let restoreTextGeometry: (() => void) | undefined
  let restoreMediaGeometry: (() => void) | undefined

  afterEach(() => document.body.replaceChildren())

  afterEach(() => {
    restoreTextGeometry?.()
    restoreTextGeometry = undefined
    restoreMediaGeometry?.()
    restoreMediaGeometry = undefined
  })

  it('reveals an incoming custom mask from the slot center', () => {
    const { parent, root, session } = createReplaceFixture({
      transition: 'mask-reveal',
      shape: {
        path: 'M50 0 L100 100 L0 100 Z',
        viewBox: '0 0 100 100',
      },
    })
    const [outgoing, incoming] = getSnapshots(parent)

    session.sample(0.5)

    expect(outgoing?.textContent).toBe('outgoing view')
    expect(incoming?.textContent).toBe('incoming view')
    expect(incoming?.style.getPropertyValue('mask-image')).toContain('data:image/svg+xml')
    expect(incoming?.style.getPropertyValue('mask-size')).toBe('170% auto')
    expect(getPresentationLayer(parent)?.style.overflow).toBe('hidden')
    expect(root.style.visibility).toBe('hidden')

    session.finish()
    expect(getSnapshots(parent)).toHaveLength(0)
    expect(root.style.visibility).toBe('')
  })

  it('moves the old and new slot views vertically for curtain', () => {
    const { parent, session } = createReplaceFixture({ transition: 'curtain' })
    const [outgoing, incoming] = getSnapshots(parent)

    session.sample(0.25)

    expect(getPresentationLayer(parent)?.style.overflow).toBe('hidden')
    expect(outgoing?.style.translate).toBe('0 -12.5%')
    expect(incoming?.style.translate).toBe('0 56.25%')
    expect(outgoing?.style.clipPath).toBe('inset(12.5% 0 0 0)')
    expect(incoming?.style.clipPath).toBe('inset(0 0 56.25% 0)')
  })

  it('reveals wipe from the right edge across the slot', () => {
    const { parent, session } = createReplaceFixture({ transition: 'wipe' })
    const [outgoing, incoming] = getSnapshots(parent)

    session.sample(0.5)

    expect(getPresentationLayer(parent)?.style.overflow).toBe('hidden')
    expect(incoming?.style.clipPath).toBe('inset(0 0 0 50%)')
    expect(outgoing?.style.translate).toBe('-9% 0')
    expect(outgoing?.style.opacity).toBe('0.875')
  })

  it('slides the incoming view over a receding, dimmed view', () => {
    const { parent, session } = createReplaceFixture({ transition: 'slide-over' })
    const [outgoing, incoming] = getSnapshots(parent)

    session.sample(0.5)

    expect(outgoing?.style.scale).toBe('0.95')
    expect(outgoing?.style.filter).toBe('brightness(0.8)')
    expect(incoming?.style.translate).toBe('0 25%')
    expect(incoming?.style.clipPath).toBe('inset(0 0 25% 0)')
  })

  it('uses the incoming view as a sheet for stack and reveals the persistent root', () => {
    const { parent, root, session } = createReplaceFixture({ transition: 'stack' })
    const [outgoing, incoming] = getSnapshots(parent)

    session.sample(0.4)
    expect(root.style.visibility).toBe('hidden')
    expect(outgoing?.style.scale).not.toBe('1')
    expect(incoming?.style.translate).not.toBe('0 100%')

    session.sample(0.8)
    expect(root.style.visibility).toBe('')
    expect(outgoing?.style.opacity).toBe('0')
    expect(Number(incoming?.style.opacity)).toBeCloseTo(2 / 3)
  })

  it('keeps a whole-text snapshot wide enough under fractional parent geometry', () => {
    const parent = document.createElement('div')
    parent.style.width = '213.414px'
    parent.style.height = '226.516px'
    parent.style.boxSizing = 'border-box'
    const root = document.createElement('p')
    root.textContent = 'La lumière du matin'
    parent.append(root)
    document.body.append(parent)

    const parentRect = createRect(25.1875, 218.414, 213.414, 226.516)
    const rootRect = createRect(25.1875, 322.625, 112.3984, 18.0859)
    parent.getBoundingClientRect = () => parentRect
    root.getBoundingClientRect = () => rootRect
    Object.defineProperty(parent, 'offsetWidth', { configurable: true, value: 213 })
    Object.defineProperty(parent, 'offsetHeight', { configurable: true, value: 227 })

    const profile: ReplaceMotionProfile = {
      transition: 'swipe-left',
      duration: 700,
      mode: 'replace',
      intro: { opacity: { from: 0, to: 1 }, x: { from: -40, to: 0 } },
      outro: { opacity: { from: 1, to: 0 }, x: { from: 0, to: -40 } },
    }
    const session = createHtmlReplacePresentationSurface(root).begin(profile)
    const outgoing = getSnapshots(parent)[0]

    expect(session).toBeDefined()
    expect(Number.parseFloat(outgoing?.style.width ?? '0')).toBeCloseTo(rootRect.width + 8, 3)

    session?.cancel()
  })

  it('preserves each whole-text view geometry across the content update', () => {
    const parent = document.createElement('div')
    parent.style.width = '213.414px'
    parent.style.height = '226.516px'
    parent.style.boxSizing = 'border-box'
    const root = document.createElement('p')
    root.textContent = 'La lumière du matin'
    parent.append(root)
    document.body.append(parent)

    const parentRect = createRect(25.1875, 218.414, 213.414, 226.516)
    let rootRect = createRect(25.1875, 322.625, 112.3984, 18.0859)
    parent.getBoundingClientRect = () => parentRect
    root.getBoundingClientRect = () => rootRect
    Object.defineProperty(parent, 'offsetWidth', { configurable: true, value: 213 })
    Object.defineProperty(parent, 'offsetHeight', { configurable: true, value: 227 })

    const profile: ReplaceMotionProfile = {
      transition: 'swipe-left',
      duration: 700,
      mode: 'replace',
      intro: { opacity: { from: 0, to: 1 }, x: { from: -40, to: 0 } },
      outro: { opacity: { from: 1, to: 0 }, x: { from: 0, to: -40 } },
    }
    const session = createHtmlReplacePresentationSurface(root).begin(profile)
    root.textContent = 'Le silence du soir'
    rootRect = createRect(65.1875, 322.625, 95.5625, 18.0859)
    session?.start()
    session?.sample(0.5)

    const [outgoing, incoming] = getSnapshots(parent)
    expect(Number.parseFloat(outgoing?.style.width ?? '0')).toBeCloseTo(120.3984, 3)
    expect(Number.parseFloat(incoming?.style.width ?? '0')).toBeCloseTo(103.5625, 3)
    expect(outgoing?.style.left).toBe('0px')
    expect(incoming?.style.left).toBe('40px')
    expect(outgoing?.textContent).toBe('La lumière du matin')
    expect(incoming?.textContent).toBe('Le silence du soir')

    session?.cancel()
  })

  it.each(['letter', 'word', 'line'] as const)(
    'preserves %s view widths across replace and refreshes geometry on reflow',
    (split) => {
      restoreTextGeometry = mockTextGeometry(16)
      const parent = document.createElement('div')
      parent.style.width = '213.414px'
      parent.style.height = '226.516px'
      parent.style.boxSizing = 'border-box'
      const root = document.createElement('p')
      root.textContent = 'La lumière du matin'
      parent.append(root)
      document.body.append(parent)

      let parentRect = createRect(25.1875, 218.414, 213.414, 226.516)
      let rootRect = createRect(25.1875, 322.625, 112.3984, 18.0859)
      Object.defineProperty(parent, 'getBoundingClientRect', {
        configurable: true,
        value: () => parentRect,
      })
      Object.defineProperty(root, 'getBoundingClientRect', {
        configurable: true,
        value: () => rootRect,
      })
      Object.defineProperty(parent, 'offsetWidth', { configurable: true, value: 213 })
      Object.defineProperty(parent, 'offsetHeight', { configurable: true, value: 227 })

      const session = createHtmlReplacePresentationSurface(root).begin({
        transition: 'swipe-left',
        duration: 700,
        mode: 'replace',
        split,
        intro: { opacity: { from: 0, to: 1 }, x: { from: -40, to: 0 } },
        outro: { opacity: { from: 1, to: 0 }, x: { from: 0, to: -40 } },
      })
      if (session === undefined) throw new Error('A split text root should provide a replace session.')

      root.textContent = 'Le silence du soir'
      rootRect = createRect(65.1875, 322.625, 95.5625, 18.0859)
      session.start()
      session.sample(0.5)

      const [outgoing, incoming] = getSnapshots(parent)
      expect(Number.parseFloat(outgoing?.style.width ?? '0')).toBeCloseTo(120.3984, 3)
      expect(Number.parseFloat(incoming?.style.width ?? '0')).toBeCloseTo(103.5625, 3)
      expect(outgoing?.textContent).toContain('La lumière du matin')
      expect(incoming?.textContent).toContain('Le silence du soir')

      parentRect = createRect(125, 500, 213.414, 226.516)
      rootRect = createRect(175, 580, 95.5625, 18.0859)
      session.reflow?.()

      expect(outgoing?.style.left).toBe('50px')
      expect(outgoing?.style.top).toBe('80px')
      expect(incoming?.style.left).toBe('50px')
      expect(incoming?.style.top).toBe('80px')
      expect(Number.parseFloat(outgoing?.style.width ?? '0')).toBeCloseTo(95.5625, 3)
      expect(Number.parseFloat(incoming?.style.width ?? '0')).toBeCloseTo(95.5625, 3)

      session.cancel()
    },
  )

  it('aligns split text ranges at rest and emits text offsets in rem', () => {
    restoreTextGeometry = mockTextGeometry(20)
    const parent = document.createElement('main')
    const root = document.createElement('p')
    root.textContent = 'source'
    parent.append(root)
    document.body.append(parent)

    const profile: ReplaceMotionProfile = {
      transition: 'slot-up',
      duration: 100,
      mode: 'replace',
      split: 'word',
      intro: { y: { from: 16, to: 0 } },
      outro: { y: { from: 0, to: -16 } },
    }
    const session = createHtmlReplacePresentationSurface(root).begin(profile)
    root.textContent = 'arrive'
    session?.start()

    const [outgoing, incoming] = getSnapshots(parent)
    const incomingSpan = incoming?.querySelector<HTMLElement>('[data-replace-unit-index]')
    session?.sample(0)

    expect(incomingSpan?.style.left).toBe('0.5rem')
    expect(incomingSpan?.style.top).toBe('0rem')
    expect(incomingSpan?.style.translate).toBe('0rem 0.8rem')

    session?.sample(1)
    const sourceRange = getTextRangeRect(root)
    const renderedRange = incomingSpan === null || incomingSpan === undefined
      ? undefined
      : getTextRangeRect(incomingSpan)
    expect(renderedRange?.top).toBe(sourceRange?.top)
    expect(incomingSpan?.style.translate).toBe('none')

    session?.finish()
    expect(getSnapshots(parent)).toHaveLength(0)
    expect(root.style.visibility).toBe('')
    expect(outgoing).toBeDefined()
  })

  it.each(['letter', 'word', 'line'] as const)(
    'maps %s text alignment back through an inherited CSS transform',
    (split) => {
      restoreTextGeometry = mockTextGeometry(20, 1.25)
      const parent = document.createElement('main')
      parent.style.transform = 'matrix(1.25, 0, 0, 1.25, 0, 0)'
      parent.style.transformOrigin = 'top left'
      const root = document.createElement('p')
      root.textContent = 'source'
      parent.append(root)
      document.body.append(parent)

      const session = createHtmlReplacePresentationSurface(root).begin({
        transition: 'slot-up',
        duration: 100,
        mode: 'replace',
        split,
        intro: { y: { from: 16, to: 0 } },
        outro: { y: { from: 0, to: -16 } },
      })
      root.textContent = 'arrive'
      session?.start()
      session?.sample(1)

      const incoming = getSnapshots(parent)[1]
      const span = incoming?.querySelector<HTMLElement>('[data-replace-unit-index]')
      if (span === null || span === undefined) throw new Error('Expected one incoming text fragment.')
      expect(span.style.left).toBe('0.5rem')
      expect(span.style.top).toBe('0rem')
      expect(getTextRangeRect(span)?.top).toBe(getTextRangeRect(root)?.top)

      session?.cancel()
    },
  )

  it('emits whole-text motion offsets in rem', () => {
    const parent = document.createElement('main')
    const root = document.createElement('p')
    root.textContent = 'source'
    parent.append(root)
    document.body.append(parent)
    const session = createHtmlReplacePresentationSurface(root).begin({
      transition: 'swipe-soft-up',
      duration: 100,
      mode: 'replace',
      intro: { y: { from: 14, to: 0 } },
      outro: { y: { from: 0, to: -14 } },
    })

    root.textContent = 'arrive'
    session?.start()
    session?.sample(0)

    const incoming = getSnapshots(parent)[1]
    expect(incoming?.style.translate).toBe('0rem 0.875rem')
    expect(incoming?.style.translate).not.toContain('px')

    session?.cancel()
  })

  it('samples a JSON bounce preset with the ACE-resolved easing', () => {
    const parent = document.createElement('main')
    const root = document.createElement('p')
    root.textContent = 'source'
    parent.append(root)
    document.body.append(parent)
    const command = normalizeReplacePresetCommand('bounce-left', 'replace', REPLACE_TEXT_SPLITS)
    if (command === undefined) throw new Error('The JSON bounce preset should normalize.')

    const session = createHtmlReplacePresentationSurface(root).begin(command.profile)
    root.textContent = 'arrive'
    session?.start()
    session?.sample(0.5)

    const incoming = getSnapshots(parent)[1]
    const { from = 0, to } = command.profile.intro.x ?? { from: 0, to: 0 }
    const expectedTween = prepareTween({
      from: { x: from },
      to: { x: to },
      duration: command.profile.duration,
      ease: command.profile.ease,
    })
    const expected = resolveTween(expectedTween, command.profile.duration / 2) as { x: number }
    const remSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16

    expect(incoming?.style.translate).toBe(`${expected.x / remSize}rem 0rem`)
    expect(expected.x).not.toBe(from + (to - from) / 2)
    session?.cancel()
  })

  it('keeps combining marks and composed emoji intact and retains word punctuation and spaces', () => {
    const graphemes = segmentTextGraphemes('e\u0301👩‍👩‍👧‍👦🇫🇷👍🏽')
    expect(graphemes.map((grapheme) => grapheme.text)).toEqual([
      'e\u0301',
      '👩‍👩‍👧‍👦',
      '🇫🇷',
      '👍🏽',
    ])
    expect(splitTextWords('Bonjour, l’été arc-en-ciel 2026!').map((word) => word.text)).toEqual([
      'Bonjour,',
      ' ',
      'l’été',
      ' ',
      'arc-en-ciel',
      ' ',
      '2026!',
    ])
  })

  it('groups measured fragments into the displayed text lines', () => {
    const graphemes = segmentTextGraphemes('ABCDEF')
    const fragments = graphemes.map((grapheme, index) => createMeasuredFragment(
      grapheme.text,
      index,
      index < 3 ? 0 : 18,
    ))
    const lineIndexes = assignVisualLines(fragments)

    expect(createTextUnits('line', graphemes, splitTextWords('ABCDEF'), fragments, lineIndexes))
      .toEqual(['ABC', 'DEF'])
  })

  it('rebuilds displayed text lines at resize while retaining the sampled progress', () => {
    let wrapAt = 3
    restoreTextGeometry = mockTextGeometry(16, 1, () => wrapAt)
    const parent = document.createElement('main')
    const root = document.createElement('p')
    root.textContent = 'ABCDE'
    parent.append(root)
    document.body.append(parent)
    const profile: ReplaceMotionProfile = {
      transition: 'line-swipe',
      duration: 100,
      ease: 'linear',
      mode: 'replace',
      split: 'line',
      direction: 'left',
      intro: { opacity: { from: 0, to: 1 }, y: { from: 16, to: 0 } },
      outro: { opacity: { from: 1, to: 0 }, y: { from: 0, to: -16 } },
    }
    const session = createHtmlReplacePresentationSurface(root).begin(profile)
    if (session === undefined) throw new Error('A text root should provide a replace session.')

    root.textContent = 'VWXYZ'
    session.start()
    session.sample(0.4)
    const incoming = getSnapshots(parent)[1]
    const getUnitIndexes = (snapshot: HTMLElement | undefined): string[] => Array.from(
      snapshot?.querySelectorAll<HTMLElement>('[data-replace-unit-index]') ?? [],
      (span) => span.dataset.replaceUnitIndex ?? '',
    )
    const initialIndexes = getUnitIndexes(incoming)
    const initialFirstLineOpacity = incoming?.querySelector<HTMLElement>(
      '[data-replace-unit-index="0"]',
    )?.style.opacity
    expect(new Set(initialIndexes)).toEqual(new Set(['0', '1']))

    wrapAt = 2
    session.reflow?.()

    const reflowedIncoming = getSnapshots(parent)[1]
    expect(new Set(getUnitIndexes(reflowedIncoming))).toEqual(new Set(['0', '1', '2']))
    expect(reflowedIncoming?.querySelector<HTMLElement>('[data-replace-unit-index="0"]')?.style.opacity)
      .toBe(initialFirstLineOpacity)

    session.cancel()
  })

  it('interpolates slot-roll chroma and restores the authored glyph color', () => {
    restoreTextGeometry = mockTextGeometry(16)
    const parent = document.createElement('div')
    const root = document.createElement('p')
    root.innerHTML = '<span style="color: rgb(20, 30, 40)">A</span>'
    parent.append(root)
    document.body.append(parent)

    const profile: ReplaceMotionProfile = {
      transition: 'slot-up',
      duration: 100,
      mode: 'replace',
      split: 'letter',
      skipUnchanged: false,
      slot: { axis: 'up', bounce: 0, chroma: true },
      intro: { opacity: { from: 0, to: 1 }, y: { from: 16, to: 0 } },
      outro: { opacity: { from: 1, to: 0 }, y: { from: 0, to: -16 } },
    }
    const session = createHtmlReplacePresentationSurface(root).begin(profile)
    if (session === undefined) throw new Error('A text root should provide a replace session.')

    root.innerHTML = '<span style="color: rgb(20, 30, 40)">B</span>'
    session.start()
    const incoming = getSnapshots(parent)[1]
    const glyph = incoming?.querySelector<HTMLElement>('[data-replace-unit-index="0"]')
    const authoredColor = 'rgb(20, 30, 40)'
    const initialChromaColor = glyph?.style.color
    expect(initialChromaColor).not.toBe(authoredColor)

    session.sample(0.5)
    expect(glyph?.style.color).not.toBe(initialChromaColor)

    session.sample(1)
    expect(glyph?.style.color).toBe(authoredColor)
    session.cancel()
  })

  it.each(['cover', 'contain'] as const)(
    'masks one frozen source above the persistent %s target with SVG cells',
    (objectFit) => {
      const media = mockMediaGeometry(100, 80)
      restoreMediaGeometry = media.restore
      const parent = document.createElement('main')
      const root = document.createElement('section')
      const imageA = document.createElement('img')
      imageA.src = '/image-a.png'
      imageA.style.objectFit = objectFit
      root.append(imageA)
      parent.append(root)
      document.body.append(parent)

      const profile: ReplaceMediaPresentationProfile = {
        transition: 'mask-reveal',
        duration: 100,
        freezeMedia: true,
        split: 'cells',
        cellX: 2,
        cellY: 2,
      }
      const session = createHtmlReplacePresentationSurface(root).begin(profile)
      if (session === undefined) throw new Error('A materialized image should provide a replace session.')

      const imageB = document.createElement('img')
      imageB.src = '/image-b.png'
      imageB.style.objectFit = objectFit
      root.replaceChildren(imageB)
      session.start()

      const [outgoing] = getSnapshots(parent)
      expect(getSnapshots(parent)).toHaveLength(1)
      expect(outgoing?.querySelector('img')?.getAttribute('src')).toBe('/image-a.png')
      expect(outgoing?.querySelector('img')?.style.objectFit).toBe(objectFit)
      expect(root.firstElementChild).toBe(imageB)
      expect(root.style.visibility).toBe('')
      expect(root.style.getPropertyValue('mask-image')).toBe('')
      expect((outgoing?.firstElementChild as HTMLElement | null)?.style.getPropertyValue('mask-image'))
        .toContain('#codplay-replace-mask-')

      const maskHost = parent.querySelector<SVGSVGElement>('[data-codplay-replace-mask-host]')
      const masks = Array.from(maskHost?.querySelectorAll('mask') ?? [])
      expect(masks).toHaveLength(1)
      expect(masks.map((mask) => mask.querySelectorAll('[data-replace-cell-index]').length)).toEqual([4])
      expect(masks.map((mask) => [mask.getAttribute('maskUnits'), mask.getAttribute('maskContentUnits')]))
        .toEqual([['userSpaceOnUse', 'userSpaceOnUse']])
      expect(masks.map((mask) => [mask.getAttribute('width'), mask.getAttribute('height')]))
        .toEqual([['100', '80']])
      expect(masks.map((mask) => {
        return Array.from(mask.querySelectorAll('rect')).map((base) => [
          base.getAttribute('width'),
          base.getAttribute('height'),
        ])
      })).toEqual([[['100', '80'], ['100', '80']]])
      const base = masks[0]?.querySelector<SVGRectElement>('[id*="mask-base"]')
      const cover = masks[0]?.querySelector<SVGRectElement>('[id*="mask-cover"]')
      expect(base?.getAttribute('fill')).toBe('white')
      expect(cover?.getAttribute('fill')).toBe('black')
      expect(masks.flatMap((mask) => Array.from(mask.querySelectorAll('path')))
        .every((path) => path.getAttribute('d')?.includes('A50 50'))).toBe(true)
      expect(parent.querySelectorAll('canvas')).toHaveLength(0)
      const firstCell = maskHost?.querySelector<SVGSVGElement>('[data-replace-cell-index="0"]')
      expect(firstCell?.style.scale).toBe('1')
      expect(base?.style.opacity).toBe('1')
      expect(cover?.style.opacity).toBe('0')
      expect(firstCell?.style.overflow).toBe('visible')
      expect(firstCell?.style.transformBox).toBe('view-box')
      expect(firstCell?.style.transformOrigin).toBe('50% 50%')

      session.sample(0.125)
      expect(base?.style.opacity).toBe('0.5')
      expect(cover?.style.opacity).toBe('0.5')
      session.sample(0.25)
      expect(base?.style.opacity).toBe('0')
      expect(cover?.style.opacity).toBe('1')

      session.sample(0.4)
      const scaleValues = Array.from(maskHost?.querySelectorAll<SVGSVGElement>('[data-replace-cell-index]') ?? [])
        .map((cell) => cell.style.scale)
      expect(scaleValues.some((scale) => scale !== '')).toBe(true)
      expect(base?.style.opacity).toBe('0')
      expect(cover?.style.opacity).toBe('1')
      const initialCellBoxes = Array.from(maskHost?.querySelectorAll<SVGSVGElement>('[data-replace-cell-index]') ?? [])
        .map((cell) => [cell.getAttribute('x'), cell.getAttribute('y'), cell.getAttribute('width'), cell.getAttribute('height')])
      expect(initialCellBoxes[0]).toEqual(['-25', '-20', '50', '40'])
      expect(masks.every((mask) => Array.from(mask.querySelectorAll('[data-replace-cell-index]'))
        .every((cell) => cell.parentNode?.parentNode === mask))).toBe(true)
      expect(firstCell?.parentElement?.getAttribute('transform')).toBe('translate(25 20)')
      expect(firstCell?.parentElement?.style.scale).toBe('')
      expect(firstCell?.style.scale).not.toBe('')
      media.setSize(120, 60)
      session.reflow?.()
      const resizedCellBoxes = Array.from(maskHost?.querySelectorAll<SVGSVGElement>('[data-replace-cell-index]') ?? [])
        .map((cell) => [cell.getAttribute('x'), cell.getAttribute('y'), cell.getAttribute('width'), cell.getAttribute('height')])
      expect(resizedCellBoxes).not.toEqual(initialCellBoxes)
      expect(resizedCellBoxes[0]).toEqual(['-30', '-15', '60', '30'])
      expect(masks.map((mask) => [mask.getAttribute('width'), mask.getAttribute('height')]))
        .toEqual([['120', '60']])

      session.finish()
      expect(root.firstElementChild).toBe(imageB)
      expect(getSnapshots(parent)).toHaveLength(0)
      expect(root.style.visibility).toBe('')
      expect(root.style.getPropertyValue('mask-image')).toBe('')
      expect(parent.querySelector('[data-codplay-replace-mask-host]')).toBeNull()
    },
  )

  it('repeats an author-provided SVG path across the media mask grid', () => {
    const media = mockMediaGeometry(100, 80)
    restoreMediaGeometry = media.restore
    const parent = document.createElement('main')
    const root = document.createElement('section')
    const imageA = document.createElement('img')
    imageA.src = '/image-a.png'
    root.append(imageA)
    parent.append(root)
    document.body.append(parent)

    const authorShape = {
      path: 'M50 0 C84 8 100 42 82 72 C64 102 20 88 8 54 Z',
      viewBox: '0 0 100 100',
    }
    const session = createHtmlReplacePresentationSurface(root).begin({
      transition: 'wipe',
      duration: 100,
      shape: authorShape,
      freezeMedia: true,
      split: 'cells',
      cellX: 2,
      cellY: 1,
    })
    if (session === undefined) throw new Error('A materialized image should provide a replace session.')

    const imageB = document.createElement('img')
    imageB.src = '/image-b.png'
    root.replaceChildren(imageB)
    session.start()

    const masks = Array.from(parent.querySelectorAll<SVGMaskElement>('[data-codplay-replace-mask-host] mask'))
    expect(masks).toHaveLength(1)
    expect(masks.map((mask) => Array.from(mask.querySelectorAll('path')).map((path) => path.getAttribute('d'))))
      .toEqual([[authorShape.path, authorShape.path]])
    const cells = masks.flatMap((mask) => Array.from(mask.querySelectorAll<SVGSVGElement>('[data-replace-cell-index]')))
    expect(cells.every((cell) => cell.parentNode?.parentNode === cell.closest('mask'))).toBe(true)
    expect(cells[0]?.getAttribute('viewBox')).toBe('0 0 100 100')
    expect(cells[0]?.style.transformBox).toBe('view-box')
    expect(cells[0]?.style.transformOrigin).toBe('50% 50%')
    expect(parent.querySelectorAll('canvas')).toHaveLength(0)

    session.finish()
  })

  it('resolves percentage cell size before cell counts and rebuilds the grid on resize', () => {
    const media = mockMediaGeometry(100, 80)
    restoreMediaGeometry = media.restore
    const parent = document.createElement('main')
    const root = document.createElement('section')
    const imageA = document.createElement('img')
    imageA.src = '/image-a.png'
    root.append(imageA)
    parent.append(root)
    document.body.append(parent)

    const surface = createHtmlReplacePresentationSurface(root)
    const session = surface.begin({
      transition: 'mask-reveal',
      duration: 100,
      freezeMedia: true,
      split: 'cells',
      cellSize: 20,
      cellX: 2,
      cellY: 2,
    })
    if (session === undefined) throw new Error('A materialized image should provide a replace session.')

    const imageB = document.createElement('img')
    imageB.src = '/image-b.png'
    root.replaceChildren(imageB)
    session.start()

    const maskHost = parent.querySelector<SVGSVGElement>('[data-codplay-replace-mask-host]')
    const masks = Array.from(maskHost?.querySelectorAll('mask') ?? [])
    expect(masks.map((mask) => mask.querySelectorAll('[data-replace-cell-index]').length)).toEqual([20])

    session.sample(0.4)
    media.setSize(120, 60)
    session.reflow?.()

    const resizedMasks = Array.from(maskHost?.querySelectorAll('mask') ?? [])
    expect(resizedMasks.map((mask) => mask.querySelectorAll('[data-replace-cell-index]').length)).toEqual([15])
    expect(Array.from(maskHost?.querySelectorAll<SVGSVGElement>('[data-replace-cell-index]') ?? [])
      .some((cell) => cell.style.scale !== '')).toBe(true)
    expect(root.firstElementChild).toBe(imageB)

    session.finish()
  })

  it('derives a missing grid axis from the measured media aspect ratio', () => {
    expect(resolveMediaCellSettings({ cellX: 4 }, 100, 80)).toEqual({ columns: 4, rows: 4 })
    expect(resolveMediaCellSettings({ cellY: 2 }, 100, 80)).toEqual({ columns: 3, rows: 2 })
    expect(resolveMediaCellSettings({ cellX: 2, cellY: 1 }, 100, 80)).toEqual({ columns: 2, rows: 1 })
  })
})

/** Provides decoded image dimensions and responsive media boxes for mask tests. */
function mockMediaGeometry(width: number, height: number): Readonly<{
  restore: () => void
  setSize: (width: number, height: number) => void
}> {
  const imagePrototype = HTMLImageElement.prototype
  const elementPrototype = HTMLElement.prototype
  const imageDescriptors = new Map<string, PropertyDescriptor | undefined>([
    ['complete', Object.getOwnPropertyDescriptor(imagePrototype, 'complete')],
    ['naturalWidth', Object.getOwnPropertyDescriptor(imagePrototype, 'naturalWidth')],
    ['naturalHeight', Object.getOwnPropertyDescriptor(imagePrototype, 'naturalHeight')],
  ])
  const getBoundingClientRectDescriptor = Object.getOwnPropertyDescriptor(elementPrototype, 'getBoundingClientRect')
  let boxWidth = width
  let boxHeight = height

  Object.defineProperties(imagePrototype, {
    complete: { configurable: true, get: () => true },
    naturalWidth: {
      configurable: true,
      get: function (this: HTMLImageElement): number {
        return this.getAttribute('src')?.endsWith('image-b.png') ? 640 : 900
      },
    },
    naturalHeight: {
      configurable: true,
      get: function (this: HTMLImageElement): number {
        return this.getAttribute('src')?.endsWith('image-b.png') ? 416 : 593
      },
    },
  })
  Object.defineProperty(elementPrototype, 'getBoundingClientRect', {
    configurable: true,
    value: function (this: HTMLElement): DOMRect {
      if (!this.isConnected) return new DOMRect(0, 0, 0, 0)
      return new DOMRect(0, 0, boxWidth, boxHeight)
    },
  })

  return {
    restore: () => {
      for (const [name, descriptor] of imageDescriptors) {
        if (descriptor === undefined) delete (imagePrototype as unknown as Record<string, unknown>)[name]
        else Object.defineProperty(imagePrototype, name, descriptor)
      }
      if (getBoundingClientRectDescriptor === undefined) {
        delete (elementPrototype as unknown as Record<string, unknown>).getBoundingClientRect
      } else {
        Object.defineProperty(elementPrototype, 'getBoundingClientRect', getBoundingClientRectDescriptor)
      }
    },
    setSize: (nextWidth, nextHeight) => {
      boxWidth = nextWidth
      boxHeight = nextHeight
    },
  }
}

/** Supplies deterministic source and generated text boxes in a custom rem scale. */
function mockTextGeometry(
  remSizePx: number,
  inheritedScale = 1,
  getWrapAt: () => number = () => Number.MAX_SAFE_INTEGER,
): () => void {
  const originalRootFontSize = document.documentElement.style.fontSize
  document.documentElement.style.fontSize = `${remSizePx}px`
  const elementPrototype = HTMLElement.prototype
  const elementDescriptor = Object.getOwnPropertyDescriptor(elementPrototype, 'getBoundingClientRect')
  Object.defineProperty(elementPrototype, 'getBoundingClientRect', {
    configurable: true,
    value(this: HTMLElement) {
      return this.tagName === 'P'
        ? createRect(40 * inheritedScale, 100 * inheritedScale, 120 * inheritedScale, 20 * inheritedScale)
        : createRect(0, 0, 320, 200)
    },
  })

  const rangePrototype = Range.prototype
  const rangeDescriptor = Object.getOwnPropertyDescriptor(rangePrototype, 'getClientRects')
  Object.defineProperty(rangePrototype, 'getClientRects', {
    configurable: true,
    value(this: Range) {
      const container = this.commonAncestorContainer
      const element = container instanceof HTMLElement ? container : container.parentElement
      if (element instanceof HTMLElement && element.tagName === 'SPAN') {
        const root = element.parentElement?.parentElement
        const rootRect = root?.getBoundingClientRect() ?? createRect(40, 100, 120, 20)
        const left = Number.parseFloat(element.style.left) * remSizePx
        const top = Number.parseFloat(element.style.top) * remSizePx
        const translation = element.style.translate.split(/\s+/)
        const translateX = Number.parseFloat(translation[0] ?? '0') * remSizePx || 0
        const translateY = Number.parseFloat(translation[1] ?? '0') * remSizePx || 0
        return [createRect(
          rootRect.left + (left + translateX) * inheritedScale,
          rootRect.top + (top + 2 + translateY) * inheritedScale,
          8 * inheritedScale,
          14 * inheritedScale,
        )]
      }
      const root = element?.closest('p')
      const rootRect = root?.getBoundingClientRect() ?? createRect(40, 100, 120, 20)
      const wrapAt = Math.max(1, Math.floor(getWrapAt()))
      const sourceOffset = this.startOffset
      return [createRect(
        rootRect.left + (10 + (sourceOffset % wrapAt) * 8) * inheritedScale,
        rootRect.top + (2 + Math.floor(sourceOffset / wrapAt) * 18) * inheritedScale,
        8 * inheritedScale,
        14 * inheritedScale,
      )]
    },
  })

  return () => {
    document.documentElement.style.fontSize = originalRootFontSize
    if (elementDescriptor === undefined) delete (elementPrototype as unknown as Record<string, unknown>).getBoundingClientRect
    else Object.defineProperty(elementPrototype, 'getBoundingClientRect', elementDescriptor)
    if (rangeDescriptor === undefined) delete (rangePrototype as unknown as Record<string, unknown>).getClientRects
    else Object.defineProperty(rangePrototype, 'getClientRects', rangeDescriptor)
  }
}

/** Creates one measured fragment for deterministic visual-line grouping. */
function createMeasuredFragment(
  text: string,
  graphemeIndex: number,
  top: number,
): MeasuredTextFragment & Readonly<{ graphemeIndex: number }> {
  return {
    text,
    graphemeIndex,
    wordIndex: 0,
    lineIndex: -1,
    left: 0,
    top,
    color: 'rgb(0, 0, 0)',
    font: '16px sans-serif',
    letterSpacing: 'normal',
    wordSpacing: 'normal',
    lineHeight: 'normal',
    textDecoration: 'none',
    textTransform: 'none',
    textShadow: 'none',
    direction: 'ltr',
  }
}

/** Reads the first rendered box of all text inside an element. */
function getTextRangeRect(element: HTMLElement): DOMRect | undefined {
  const range = document.createRange()
  range.selectNodeContents(element)
  return Array.from(range.getClientRects())[0]
}

/** Creates a DOMRect-shaped fixture with fractional CSS pixel dimensions. */
function createRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    left: x,
    top: y,
    width,
    height,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  }
}
