import type { SlotReplaceShape } from '../../components'
import type { ResolvedMediaCellSettings } from './profile'
import { markHtmlTransientNode } from '../transient-node'
import { nextReplacePresentationId } from './ids'
import { getMaskShapeDefinition } from './masks'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const MASK_STYLE_PROPERTIES = [
  'mask-image', '-webkit-mask-image', 'mask-mode',
  'mask-position', '-webkit-mask-position', 'mask-size', '-webkit-mask-size',
  'mask-repeat', '-webkit-mask-repeat',
] as const

type MediaMaskCellStyle = SVGSVGElement

export type MediaMaskCell = Readonly<{
  readonly container: SVGElement
  element: MediaMaskCellStyle
  index: number
}>

export type MediaMaskGrid = {
  readonly viewKey: HTMLElement
  readonly target: HTMLElement
  readonly host: SVGSVGElement
  readonly mask: SVGMaskElement
  readonly base: SVGRectElement
  readonly background: SVGRectElement
  readonly cells: readonly MediaMaskCell[]
  readonly originalStyles: ReadonlyMap<string, Readonly<{ value: string; priority: string }>>
  readonly columns: number
  readonly rows: number
}

const grids = new WeakMap<HTMLElement, MediaMaskGrid>()

/** Creates a shared inline SVG host for the masks of one replace session. */
export function createMediaMaskHost(parent: HTMLElement): SVGSVGElement {
  const host = document.createElementNS(SVG_NAMESPACE, 'svg')
  host.id = `codplay-replace-mask-host-${nextReplacePresentationId()}`
  markHtmlTransientNode(host)
  host.setAttribute('aria-hidden', 'true')
  host.setAttribute('data-codplay-replace-mask-host', '')
  Object.assign(host.style, {
    position: 'absolute',
    left: '0',
    top: '0',
    width: '0',
    height: '0',
    overflow: 'hidden',
    pointerEvents: 'none',
  })
  parent.append(host)
  return host
}

/** Builds one vector mask grid and applies it to a whole source or target view. */
export function buildMediaMaskGrid(options: Readonly<{
  viewKey: HTMLElement
  target: HTMLElement
  host: SVGSVGElement
  settings: ResolvedMediaCellSettings
  shape: SlotReplaceShape | undefined
}>): MediaMaskGrid | undefined {
  removeMediaMaskGrid(options.viewKey)
  const rect = options.target.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return undefined

  const definitions = options.host.querySelector<SVGDefsElement>('defs')
    ?? appendSvgElement(options.host, 'defs', `codplay-replace-mask-defs-${nextReplacePresentationId()}`)
  const maskId = `codplay-replace-mask-${nextReplacePresentationId()}`
  const mask = appendSvgElement(definitions, 'mask', maskId)
  mask.setAttribute('maskUnits', 'userSpaceOnUse')
  mask.setAttribute('maskContentUnits', 'userSpaceOnUse')
  mask.setAttribute('mask-type', 'luminance')

  const base = appendSvgElement(mask, 'rect', `codplay-replace-mask-base-${nextReplacePresentationId()}`)
  base.setAttribute('x', '0')
  base.setAttribute('y', '0')
  base.setAttribute('fill', 'white')
  base.style.opacity = '0'
  const background = appendSvgElement(mask, 'rect', `codplay-replace-mask-cover-${nextReplacePresentationId()}`)
  background.setAttribute('x', '0')
  background.setAttribute('y', '0')
  background.setAttribute('fill', 'black')
  setMediaMaskRegion(mask, [base, background], rect.width, rect.height)

  const shape = options.shape ?? 'rect'
  const definition = getMaskShapeDefinition(shape)
  const cells: MediaMaskCell[] = []

  for (let row = 0; row < options.settings.rows; row += 1) {
    for (let column = 0; column < options.settings.columns; column += 1) {
      const index = row * options.settings.columns + column
      const container = appendSvgElement(mask, 'g', `codplay-replace-mask-cell-${nextReplacePresentationId()}`)
      container.setAttribute('transform', createMediaCellPosition({
        target: options.target,
        columns: options.settings.columns,
        rows: options.settings.rows,
        column,
        row,
      }))
      const sprite = appendSvgElement(container, 'svg', `codplay-replace-mask-shape-${nextReplacePresentationId()}`)
      sprite.dataset.replaceCellIndex = String(index)
      sprite.setAttribute('viewBox', definition.viewBox)
      sprite.setAttribute('preserveAspectRatio', 'xMidYMid meet')
      sprite.style.overflow = 'visible'
      sprite.style.transformBox = 'view-box'
      sprite.style.transformOrigin = '50% 50%'
      setMediaCellSpriteBox(sprite, options.target, options.settings.columns, options.settings.rows)

      const path = appendSvgElement(sprite, 'path', `codplay-replace-mask-path-${nextReplacePresentationId()}`)
      path.setAttribute('d', definition.path)
      path.setAttribute('fill', 'white')
      cells.push({ container, element: sprite, index })
    }
  }

  const originalStyles = new Map(MASK_STYLE_PROPERTIES.map((property) => [property, {
    value: options.target.style.getPropertyValue(property),
    priority: options.target.style.getPropertyPriority(property),
  }]))
  applyMediaMask(options.target, maskId)
  const grid: MediaMaskGrid = {
    viewKey: options.viewKey,
    target: options.target,
    host: options.host,
    mask,
    base,
    background,
    cells,
    originalStyles,
    columns: options.settings.columns,
    rows: options.settings.rows,
  }
  grids.set(options.viewKey, grid)
  return grid
}

/** Returns the live SVG cells associated with one whole media view. */
export function getMediaMaskCells(viewKey: HTMLElement): readonly MediaMaskCell[] | undefined {
  return grids.get(viewKey)?.cells
}

/** Fades from a fully visible white mask to the black-backed cell mask. */
export function setMediaMaskCoverOpacity(viewKey: HTMLElement, opacity: number): void {
  const grid = grids.get(viewKey)
  if (grid === undefined) return
  const value = Math.min(1, Math.max(0, opacity))
  grid.base.style.opacity = String(1 - value)
  grid.background.style.opacity = String(value)
}

/** Repositions every uncropped shape after its media box changes dimensions. */
export function resizeMediaMaskGrid(viewKey: HTMLElement): void {
  const grid = grids.get(viewKey)
  if (grid === undefined) return
  const target = grid.target
  const rect = target.getBoundingClientRect()
  setMediaMaskRegion(grid.mask, [grid.base, grid.background], rect.width, rect.height)
  for (const cell of grid.cells) {
    const column = cell.index % grid.columns
    const row = Math.floor(cell.index / grid.columns)
    cell.container.setAttribute('transform', createMediaCellPosition({
      target,
      columns: grid.columns,
      rows: grid.rows,
      column,
      row,
    }))
    setMediaCellSpriteBox(
      cell.element,
      target,
      grid.columns,
      grid.rows,
    )
  }
}

/** Restores authored mask styles and removes one grid's generated definition. */
export function removeMediaMaskGrid(viewKey: HTMLElement): void {
  const grid = grids.get(viewKey)
  if (grid === undefined) return
  for (const property of MASK_STYLE_PROPERTIES) {
    const original = grid.originalStyles.get(property)
    if (original === undefined || original.value === '') grid.target.style.removeProperty(property)
    else grid.target.style.setProperty(property, original.value, original.priority)
  }
  grid.mask.remove()
  grids.delete(viewKey)
}

/** Removes the shared mask host after its transition views have been released. */
export function removeMediaMaskHost(host: SVGSVGElement): void {
  host.remove()
}

/** Applies one SVG mask reference and its viewport settings to the whole view. */
function applyMediaMask(target: HTMLElement, maskId: string): void {
  const reference = `url("#${maskId}")`
  target.style.setProperty('mask-image', reference)
  target.style.setProperty('-webkit-mask-image', reference)
  target.style.setProperty('mask-mode', 'luminance')
  target.style.setProperty('mask-position', '0 0')
  target.style.setProperty('-webkit-mask-position', '0 0')
  target.style.setProperty('mask-size', '100% 100%')
  target.style.setProperty('-webkit-mask-size', '100% 100%')
  target.style.setProperty('mask-repeat', 'no-repeat')
  target.style.setProperty('-webkit-mask-repeat', 'no-repeat')
}

/** Creates one identified child element in the SVG namespace. */
function appendSvgElement<K extends keyof SVGElementTagNameMap>(
  parent: SVGElement,
  tagName: K,
  id: string,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NAMESPACE, tagName)
  element.id = id
  parent.append(element)
  return element
}

/** Keeps the SVG mask region aligned with the current media border box. */
function setMediaMaskRegion(
  mask: SVGMaskElement,
  backgrounds: readonly SVGRectElement[],
  width: number,
  height: number,
): void {
  mask.setAttribute('x', '0')
  mask.setAttribute('y', '0')
  mask.setAttribute('width', String(width))
  mask.setAttribute('height', String(height))
  for (const background of backgrounds) {
    background.setAttribute('width', String(width))
    background.setAttribute('height', String(height))
  }
}

/** Positions one animation-independent cell in local media coordinates. */
function createMediaCellPosition(options: Readonly<{
  target: HTMLElement
  columns: number
  rows: number
  column: number
  row: number
}>): string {
  const rect = options.target.getBoundingClientRect()
  const centerX = ((options.column + 0.5) / options.columns) * rect.width
  const centerY = ((options.row + 0.5) / options.rows) * rect.height
  return `translate(${centerX} ${centerY})`
}

/** Gives one nested SVG its grid box so CSS scale uses that sprite's center. */
function setMediaCellSpriteBox(
  sprite: SVGSVGElement,
  target: HTMLElement,
  columns: number,
  rows: number,
): void {
  const rect = target.getBoundingClientRect()
  const cellWidth = rect.width / columns
  const cellHeight = rect.height / rows
  sprite.setAttribute('x', String(-cellWidth / 2))
  sprite.setAttribute('y', String(-cellHeight / 2))
  sprite.setAttribute('width', String(cellWidth))
  sprite.setAttribute('height', String(cellHeight))
}

