import { ANCHOR } from '../../config/document-config'
import { anchorNameFor, anchorReservationFor } from '../../anchor/anchor-position'
import type { FluxAnchorMarkupTarget } from './flux-anchor-player-markup-types'

/** Replaces editor-only anchor markup with a structural CodPlay flow slot. */
export function projectFluxPlayerMarkup(markup: string): string {
  const anchorPattern = new RegExp(
    `<span\\b(?=[^>]*\\b${ANCHOR.DATA_ATTRIBUTE}\\s*=\\s*["']true["'])[^>]*>[\\s\\S]*?<\\/span>`,
    'gi',
  )
  return markup.replace(anchorPattern, (anchorMarkup) => createFlowSlotMarkup(anchorMarkup))
}

/** Reads the bdc and CodPlay part identifiers exported by Section anchors. */
export function readFluxAnchorTargets(markup: string): readonly FluxAnchorMarkupTarget[] {
  const anchorPattern = new RegExp(
    `<span\\b(?=[^>]*\\b${ANCHOR.DATA_ATTRIBUTE}\\s*=\\s*["']true["'])[^>]*>`,
    'gi',
  )
  return Array.from(markup.matchAll(anchorPattern)).flatMap((match) => {
    const tag = match[0] ?? ''
    const bdcId = readMarkupAttribute(tag, 'data-bdc-id')
    const partId = readMarkupAttribute(tag, 'data-part')
    return bdcId === null || partId === null ? [] : [{ bdcId, partId, paddingBottom: readPaddingBottom(tag) }]
  })
}

/** Creates the inline flow reservation that receives the bdc in the player. */
function createFlowSlotMarkup(anchorMarkup: string): string {
  const partId = readMarkupAttribute(anchorMarkup, 'data-part') ?? ''
  const paddingBottom = readPaddingBottom(anchorMarkup)
  const slotId = `${partId}-flow-slot`
  return `<span id="${slotId}" class="elce-flow-slot" data-part="${partId}" style="display:inline-block;width:0;height:0;position:static;${ANCHOR.PADDING_VARIABLE}:${paddingBottom};padding-bottom:${anchorReservationFor(paddingBottom)};margin-inline-end:${ANCHOR.FLOW_BREAK_MARGIN};vertical-align:baseline;anchor-name:${anchorNameFor(partId)};"></span>`
}

/** Keeps the editor's configured vertical reservation in the player projection. */
function readPaddingBottom(anchorMarkup: string): string {
  const style = readMarkupAttribute(anchorMarkup, 'style')
  const variableMatch = style?.match(new RegExp(`${escapeRegExp(ANCHOR.PADDING_VARIABLE)}\\s*:\\s*([^;]+)`, 'i'))
  if (variableMatch?.[1] !== undefined) return variableMatch[1].trim()
  const paddingMatch = style?.match(/(?:^|;)\s*padding-bottom\s*:\s*([^;]+)/i)
  return paddingMatch?.[1]?.trim() ?? ANCHOR.DEFAULT_PADDING_BOTTOM
}

/** Escapes a CSS property name before using it in an authored style matcher. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Reads one quoted attribute from an authored markup tag. */
function readMarkupAttribute(tag: string, name: string): string | null {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))
  return match?.[2] ?? null
}
