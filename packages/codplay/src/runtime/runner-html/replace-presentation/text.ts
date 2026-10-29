import { createIdentityMatrix, invertMatrix, multiplyMatrix, transformPoint, type Matrix2D } from 'ace'
import { markHtmlTransientNode } from '../transient-node'
import { getMotionContentRoot, removeSnapshot } from './dom'
import { nextReplacePresentationId } from './ids'



export type TextUnit = { text: string; spans: HTMLElement[]; static?: boolean }

export type TextUnitLayer = {
  contentRoot: HTMLElement
  layer: HTMLElement
  units: TextUnit[]
  originalVisibility: string
  originalPosition: string
}


const textUnitLayers = new WeakMap<HTMLElement, TextUnitLayer>()


/** Returns the measured units registered for one temporary text snapshot. */
export function getTextUnits(snapshot: HTMLElement): readonly TextUnit[] | undefined {
  return textUnitLayers.get(snapshot)?.units
}


/** Treats an interrupted visible text composition as one outgoing animation unit. */
export function registerCompositeTextUnitLayer(snapshot: HTMLElement): void {
  textUnitLayers.set(snapshot, {
    contentRoot: snapshot,
    layer: snapshot,
    units: [{ text: '', spans: [snapshot] }],
    originalVisibility: snapshot.style.visibility,
    originalPosition: snapshot.style.position,
  })
}


/** Builds absolutely positioned text fragments for one measured split view. */
export function buildTextUnitLayer(snapshot: HTMLElement, split: 'letter' | 'word' | 'line'): void {
  const previous = textUnitLayers.get(snapshot)
  if (previous !== undefined) {
    previous.contentRoot.style.visibility = previous.originalVisibility
    previous.contentRoot.style.position = previous.originalPosition
    removeSnapshot(previous.layer, previous.contentRoot)
  }
  const contentRoot = getMotionContentRoot(snapshot)
  if (contentRoot === undefined) return

  const originalVisibility = contentRoot.style.visibility
  const originalPosition = contentRoot.style.position
  if (getComputedStyle(contentRoot).position === 'static') contentRoot.style.position = 'relative'
  const rootRect = contentRoot.getBoundingClientRect()
  const entries = collectTextNodeEntries(contentRoot)
  const fullText = entries.map((entry) => entry.value).join('')
  const graphemes = segmentTextGraphemes(fullText)
  const wordSegments = splitTextWords(fullText)
  const measured = measureTextGraphemes(entries, graphemes, contentRoot, rootRect)
  const lineIndexes = assignVisualLines(measured)
  const units = createTextUnits(split, graphemes, wordSegments, measured, lineIndexes)
  const remSizePx = getRootRemSizePx()

  const layer = document.createElement('div')
  layer.id = `codplay-replace-text-units-${nextReplacePresentationId()}`
  layer.setAttribute('data-codplay-replace-text-units', split)
  layer.setAttribute('aria-hidden', 'true')
  markHtmlTransientNode(layer)
  layer.style.position = 'absolute'
  layer.style.left = '0'
  layer.style.top = '0'
  layer.style.width = '100%'
  layer.style.height = '100%'
  layer.style.overflow = 'visible'
  layer.style.pointerEvents = 'none'
  layer.style.visibility = 'visible'

  const unitSpans: HTMLElement[][] = Array.from({ length: units.length }, () => [])
  const measuredSpans: Array<Readonly<{ span: HTMLElement; fragment: MeasuredTextFragment }>> = []
  for (let fragmentIndex = 0; fragmentIndex < measured.length; fragmentIndex += 1) {
    const fragment = measured[fragmentIndex]
    if (fragment === undefined) continue
    const unitIndex = split === 'letter'
      ? fragment.graphemeIndex
      : split === 'word'
        ? fragment.wordIndex
        : lineIndexes[fragmentIndex] ?? 0
    if (unitIndex < 0 || unitIndex >= unitSpans.length) continue
    const span = document.createElement('span')
    span.textContent = fragment.text
    span.dataset.replaceUnitIndex = String(unitIndex)
    applyMeasuredTextStyle(span, fragment, remSizePx)
    layer.append(span)
    measuredSpans.push({ span, fragment })
    unitSpans[unitIndex]?.push(span)
  }

  contentRoot.append(layer)
  alignTextFragmentsToSource(contentRoot, rootRect, measuredSpans, remSizePx)
  contentRoot.style.visibility = 'hidden'
  textUnitLayers.set(snapshot, {
    contentRoot,
    layer,
    originalVisibility,
    originalPosition,
    units: units.map((unit, index) => ({ text: unit, spans: unitSpans[index] ?? [] })),
  })
}


export type TextNodeEntry = Readonly<{ node: Text; value: string; start: number; end: number }>

export type GraphemeSegment = Readonly<{ text: string; start: number; end: number }>

export type MeasuredTextFragment = Readonly<{
  text: string
  graphemeIndex: number
  wordIndex: number
  lineIndex: number
  left: number
  top: number
  color: string
  font: string
  letterSpacing: string
  wordSpacing: string
  lineHeight: string
  textDecoration: string
  textTransform: string
  textShadow: string
  direction: string
}>


/** Collects visible text nodes and their offsets in one flattened reading string. */
export function collectTextNodeEntries(root: HTMLElement): TextNodeEntry[] {
  const entries: TextNodeEntry[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let cursor = 0
  let current = walker.nextNode()
  while (current !== null) {
    const node = current as Text
    const parent = node.parentElement
    const value = node.data
    if (value.length > 0 && parent !== null && !isNonVisualTextElement(parent)) {
      entries.push({ node, value, start: cursor, end: cursor + value.length })
      cursor += value.length
    }
    current = walker.nextNode()
  }
  return entries
}


/** Excludes source text stored in non-rendering HTML elements. */
export function isNonVisualTextElement(element: HTMLElement): boolean {
  return element.closest('script, style, template') !== null
}


/** Segments a flattened content string into complete Unicode graphemes. */
export function segmentTextGraphemes(value: string): GraphemeSegment[] {
  if (value.length === 0) return []
  if (typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return Array.from(segmenter.segment(value), (segment) => ({
      text: segment.segment,
      start: segment.index,
      end: segment.index + segment.segment.length,
    }))
  }
  return segmentTextGraphemesFallback(value)
}


/** Keeps combining marks, emoji modifiers, joiner sequences, and flag pairs whole. */
export function segmentTextGraphemesFallback(value: string): GraphemeSegment[] {
  const parts: GraphemeSegment[] = []
  let offset = 0
  let regionalIndicators = 0
  let joinNext = false
  for (const character of value) {
    const end = offset + character.length
    const previous = parts[parts.length - 1]
    const isMark = /^\p{M}$/u.test(character)
    const codePoint = character.codePointAt(0) ?? 0
    const isEmojiModifier = codePoint >= 0x1f3fb && codePoint <= 0x1f3ff
    const isVariationSelector = (codePoint >= 0xfe00 && codePoint <= 0xfe0f)
      || (codePoint >= 0xe0100 && codePoint <= 0xe01ef)
    const isRegionalIndicator = codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff
    const isJoiner = codePoint === 0x200d
    const joinsPrevious = previous !== undefined
      && (isMark || isEmojiModifier || isVariationSelector || isJoiner || joinNext
        || (isRegionalIndicator && regionalIndicators % 2 === 1)
        || (previous.text === '\r' && character === '\n'))

    if (joinsPrevious) {
      parts[parts.length - 1] = { text: `${previous.text}${character}`, start: previous.start, end }
    } else {
      parts.push({ text: character, start: offset, end })
    }
    joinNext = isJoiner
    regionalIndicators = isRegionalIndicator ? regionalIndicators + 1 : 0
    offset = end
  }
  return parts
}


/** Splits words and whitespace runs without removing punctuation or spaces. */
export function splitTextWords(value: string): GraphemeSegment[] {
  return Array.from(value.matchAll(/\S+|\s+/gu), (match) => {
    const start = match.index ?? 0
    return { text: match[0], start, end: start + match[0].length }
  })
}


/** Measures each grapheme's rendered fragments before the source text is hidden. */
export function measureTextGraphemes(
  entries: readonly TextNodeEntry[],
  graphemes: readonly GraphemeSegment[],
  root: HTMLElement,
  rootRect: DOMRect,
): Array<MeasuredTextFragment & Readonly<{ graphemeIndex: number }>> {
  const measured: Array<MeasuredTextFragment & Readonly<{ graphemeIndex: number }>> = []
  let wordIndex = 0
  const words = splitTextWords(entries.map((entry) => entry.value).join(''))

  for (let graphemeIndex = 0; graphemeIndex < graphemes.length; graphemeIndex += 1) {
    const grapheme = graphemes[graphemeIndex]
    if (grapheme === undefined) continue
    while (wordIndex < words.length - 1 && grapheme.start >= (words[wordIndex]?.end ?? 0)) wordIndex += 1
    for (const entry of entries) {
      const start = Math.max(grapheme.start, entry.start)
      const end = Math.min(grapheme.end, entry.end)
      if (start >= end) continue
      const localStart = start - entry.start
      const localEnd = end - entry.start
      const range = document.createRange()
      range.setStart(entry.node, localStart)
      range.setEnd(entry.node, localEnd)
      const rects = Array.from(range.getClientRects())
      const parent = entry.node.parentElement
      if (parent === null) continue
      const styles = getComputedStyle(parent)
      for (const rect of rects) {
        measured.push({
          text: entry.value.slice(localStart, localEnd),
          graphemeIndex,
          wordIndex,
          lineIndex: -1,
          left: rect.left - rootRect.left - root.clientLeft + root.scrollLeft,
          top: rect.top - rootRect.top - root.clientTop + root.scrollTop,
          color: styles.color,
          font: styles.font,
          letterSpacing: styles.letterSpacing,
          wordSpacing: styles.wordSpacing,
          lineHeight: styles.lineHeight,
          textDecoration: styles.textDecoration,
          textTransform: styles.textTransform,
          textShadow: styles.textShadow,
          direction: styles.direction,
        })
      }
    }
  }
  return measured
}


/** Assigns one line index to adjacent fragments sharing the same rendered row. */
export function assignVisualLines(
  fragments: Array<MeasuredTextFragment & Readonly<{ graphemeIndex: number }>>,
): number[] {
  const indexes: number[] = []
  let lineIndex = -1
  let previousTop: number | undefined
  for (const fragment of fragments) {
    if (previousTop === undefined || Math.abs(fragment.top - previousTop) > 1) lineIndex += 1
    previousTop = fragment.top
    indexes.push(lineIndex)
  }
  return indexes
}


/** Builds unit labels and maps measured text fragments to their selected split index. */
export function createTextUnits(
  split: 'letter' | 'word' | 'line',
  graphemes: readonly GraphemeSegment[],
  words: readonly GraphemeSegment[],
  fragments: Array<MeasuredTextFragment & Readonly<{ graphemeIndex: number }>>,
  lineIndexes: readonly number[],
): string[] {
  if (split === 'letter') return graphemes.map((grapheme) => grapheme.text)
  if (split === 'word') return words.map((word) => word.text)

  const lines: string[] = []
  for (let index = 0; index < fragments.length; index += 1) {
    const fragment = fragments[index]
    if (fragment === undefined) continue
    const lineIndex = lineIndexes[index] ?? 0
    while (lines.length <= lineIndex) lines.push('')
    lines[lineIndex] = `${lines[lineIndex] ?? ''}${fragment.text}`
  }
  return lines
}


/** Applies measured typography and coordinates to one temporary text fragment. */
export function applyMeasuredTextStyle(
  span: HTMLElement,
  fragment: MeasuredTextFragment,
  remSizePx: number,
): void {
  span.style.position = 'absolute'
  span.style.left = toRem(fragment.left, remSizePx)
  span.style.top = toRem(fragment.top, remSizePx)
  span.style.display = 'inline-block'
  span.style.margin = '0'
  span.style.padding = '0'
  span.style.whiteSpace = 'pre'
  span.style.transformOrigin = 'center center'
  span.style.pointerEvents = 'none'
  span.style.visibility = 'visible'
  span.style.color = fragment.color
  span.style.font = fragment.font
  span.style.letterSpacing = fragment.letterSpacing
  span.style.wordSpacing = fragment.wordSpacing
  span.style.lineHeight = fragment.lineHeight
  span.style.textDecoration = fragment.textDecoration
  span.style.textTransform = fragment.textTransform
  span.style.textShadow = fragment.textShadow
  span.style.direction = fragment.direction
  span.dataset.replaceTargetColor = fragment.color
  span.setAttribute('aria-hidden', 'true')
}


/** Aligns each generated fragment's rendered glyph box with its measured source range. */
export function alignTextFragmentsToSource(
  root: HTMLElement,
  rootRect: DOMRect,
  fragments: readonly Readonly<{ span: HTMLElement; fragment: MeasuredTextFragment }>[],
  remSizePx: number,
): void {
  const originLeft = rootRect.left + root.clientLeft - root.scrollLeft
  const originTop = rootRect.top + root.clientTop - root.scrollTop
  const transform = getCssLinearTransform(root)
  for (const { span, fragment } of fragments) {
    const range = document.createRange()
    range.selectNodeContents(span)
    const renderedRect = Array.from(range.getClientRects())[0]
    if (renderedRect === undefined) continue

    const currentLeft = Number.parseFloat(span.style.left) * remSizePx
    const currentTop = Number.parseFloat(span.style.top) * remSizePx
    const localCorrection = toLocalTextOffset(
      fragment.left + originLeft - renderedRect.left,
      fragment.top + originTop - renderedRect.top,
      transform,
    )
    const left = currentLeft + localCorrection.x
    const top = currentTop + localCorrection.y
    span.style.left = toRem(left, remSizePx)
    span.style.top = toRem(top, remSizePx)
  }
}


/** Composes the affine CSS transform matrices from a text root through its ancestors. */
export function getCssLinearTransform(element: HTMLElement): Matrix2D {
  let result = createIdentityMatrix()
  let current: HTMLElement | null = element
  while (current !== null) {
    const local = parseCssLinearTransform(getComputedStyle(current).transform)
    if (local !== undefined) result = multiplyMatrix(local, result)
    current = current.parentElement
  }
  return result
}


/** Parses the linear part of a computed CSS 2D or planar 3D transform matrix. */
export function parseCssLinearTransform(value: string): Matrix2D | undefined {
  if (value === 'none') return undefined
  const values = value.slice(value.indexOf('(') + 1, value.lastIndexOf(')'))
    .split(',')
    .map(Number)
  if (value.startsWith('matrix(') && values.length === 6) {
    const [a, b, c, d] = values
    if ([a, b, c, d].every(Number.isFinite)) {
      return { ...createIdentityMatrix(), a: a ?? 1, b: b ?? 0, c: c ?? 0, d: d ?? 1 }
    }
  }
  if (value.startsWith('matrix3d(') && values.length === 16) {
    const a = values[0]
    const b = values[1]
    const c = values[4]
    const d = values[5]
    if ([a, b, c, d].every(Number.isFinite)) {
      return { ...createIdentityMatrix(), a: a ?? 1, b: b ?? 0, c: c ?? 0, d: d ?? 1 }
    }
  }
  return undefined
}


/** Converts a viewport correction into the text root's local CSS coordinate plane. */
export function toLocalTextOffset(
  x: number,
  y: number,
  transform: Matrix2D,
): Readonly<{ x: number; y: number }> {
  const inverse = invertMatrix(transform)
  if (inverse === null) return { x, y }
  const [localX, localY] = transformPoint(inverse, [x, y])
  return {
    x: localX,
    y: localY,
  }
}


/** Converts one measured CSS-pixel coordinate to the current document rem scale. */
export function toRem(valuePx: number, remSizePx: number): string {
  return `${valuePx / remSizePx}rem`
}


/** Reads the computed root font size used by rem-valued text positions and motion. */
export function getRootRemSizePx(): number {
  const fontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 16
}
