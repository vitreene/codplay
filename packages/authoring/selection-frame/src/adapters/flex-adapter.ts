import type { AuthorApi } from '../author-api'
import type { CsValueAdapter } from '../types'

/**
 * The 11 interaction points of the flex placement interface:
 * 8 on the container sides, 1 center, 2 stretch points on the element.
 */
export type FlexAlignmentPoint =
  | 'TL' | 'TC' | 'TR'
  | 'ML' | 'C'  | 'MR'
  | 'BL' | 'BC' | 'BR'
  | 'stretch-h' | 'stretch-v'

export type FlexAlignment = {
  alignSelf?: 'start' | 'center' | 'end' | 'stretch'
  justifySelf?: 'start' | 'center' | 'end' | 'stretch'
}

/**
 * align-self / justify-self mapping of each interaction point. Valid in both
 * flex and grid containers.
 */
export const FLEX_POINT_ALIGNMENT: Record<FlexAlignmentPoint, FlexAlignment> = {
  TL: { alignSelf: 'start', justifySelf: 'start' },
  TC: { alignSelf: 'start', justifySelf: 'center' },
  TR: { alignSelf: 'start', justifySelf: 'end' },
  ML: { alignSelf: 'center', justifySelf: 'start' },
  C: { alignSelf: 'center', justifySelf: 'center' },
  MR: { alignSelf: 'center', justifySelf: 'end' },
  BL: { alignSelf: 'end', justifySelf: 'start' },
  BC: { alignSelf: 'end', justifySelf: 'center' },
  BR: { alignSelf: 'end', justifySelf: 'end' },
  'stretch-h': { justifySelf: 'stretch' },
  'stretch-v': { alignSelf: 'stretch' }
}

export type FlexAdapterOptions = {
  authorApi: AuthorApi
  itemId: string
  /** Notified after each applied alignment, for editor-side data propagation. */
  onApplied?: (alignment: FlexAlignment) => void
}

/**
 * Container placement adapter. In this context the cs does not emit x/y
 * deltas but clicked alignment targets; applyMove/applyResize are inert.
 */
export type FlexAdapter = CsValueAdapter & {
  applyAlignment: (point: FlexAlignmentPoint) => void
  destroy: () => void
}

export function createFlexAdapter(options: FlexAdapterOptions): FlexAdapter {
  let node: HTMLElement | null = null

  const unsubscribe = options.authorApi.subscribeToNode(options.itemId, (next) => {
    node = next instanceof HTMLElement ? next : null
  })

  return {
    applyMove(): void {
      // Flex placement is target-based: pixel deltas carry no meaning here.
    },

    applyResize(): void {
      // Sizing in flex context is driven by the stretch points, not deltas.
    },

    applyRotate(): void {
      // Rotation carries no meaning for container alignment.
    },

    applyScale(): void {
      // Scale carries no meaning for container alignment.
    },

    applyAlignment(point: FlexAlignmentPoint): void {
      if (node === null) return
      const alignment = FLEX_POINT_ALIGNMENT[point]
      if (alignment.alignSelf !== undefined) {
        node.style.alignSelf = alignment.alignSelf
      }
      if (alignment.justifySelf !== undefined) {
        node.style.justifySelf = alignment.justifySelf
      }
      options.onApplied?.(alignment)
    },

    destroy(): void {
      unsubscribe()
      node = null
    }
  }
}
