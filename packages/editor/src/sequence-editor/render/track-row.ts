import type { MachineContext, VirtualKeyframe } from '../machine'
import type { Item } from '../types'
import { childrenOf, getTrackRowHeight, getParentClipMarkers } from '../utils'
import { createKeyframeHandle } from './keyframe-handle'

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Ordre visuel de piste : parcours en profondeur (DFS) sur le modèle plat — chaque capsule est
 * immédiatement suivie de ses enfants, exactement le regroupement visuel produit par l'ancienne
 * récursion sur `.children` (audité 2026-07-13 : cet effet ne dépend que de la relation
 * parent↔enfant, jamais de la profondeur elle-même — remplacer par `childrenOf` suffit).
 */
function flattenFiltered(items: Item[], collapsedIds: ReadonlySet<string>): Item[] {
  const result: Item[] = []
  function walk(parentId: string | null): void {
    for (const item of childrenOf(items, parentId)) {
      result.push(item)
      if (!collapsedIds.has(item.id)) walk(item.id)
    }
  }
  walk(null)
  return result
}

function getEffectiveMs(kfId: string, kfTimeMs: number, ctx: MachineContext): number {
  const i = ctx.interaction
  if (i?.kind === 'dragging-keyframe' && i.keyframeId === kfId) return i.currentMs
  return kfTimeMs
}

export function createTrackRowArea(): HTMLElement {
  const el = document.createElement('div')
  el.classList.add('seq-rows')
  return el
}

export function renderTrackRows(
  container: HTMLElement,
  ctx: MachineContext,
  onAddKeyframe: (trackId: string, rawMs: number) => void,
  onSelectKeyframe: (trackId: string, kfId: string) => void,
  collapsedIds?: ReadonlySet<string>,
  onDragStart?: (trackId: string, kfId: string, e: PointerEvent) => void,
  onMaterializeVirtual?: (vkf: VirtualKeyframe) => void,
): void {
  container.innerHTML = ''

  const { viewport, scene, selection, layoutProfile } = ctx
  const { pixelsPerMs, startMs } = viewport
  const collapsed = collapsedIds ?? new Set<string>()
  const drag = ctx.interaction?.kind === 'dragging-keyframe' ? ctx.interaction : null

  for (const item of flattenFiltered(scene.items, collapsed)) {
    const rowHeight = getTrackRowHeight(item, layoutProfile)
    const rowEl = buildTrackRow(item, rowHeight)

    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.classList.add('seq-row__svg')
    svg.setAttribute('height', String(rowHeight))
    svg.setAttribute('aria-hidden', 'true')

    // Clip band: active zone between intro/outro keyframes (capsule tracks)
    const clipDraw = ctx.interaction?.kind === 'drawing-clip' && ctx.interaction.trackId === item.id
      ? ctx.interaction : null
    if (item.type === 'capsule') {
      let clipMinMs: number | null = null
      let clipMaxMs: number | null = null
      if (clipDraw) {
        clipMinMs = Math.min(clipDraw.startMs, clipDraw.currentMs)
        clipMaxMs = Math.max(clipDraw.startMs, clipDraw.currentMs)
      } else {
        const introKf = item.keyframes.find((k) => k.name === 'intro')
        const outroKf = item.keyframes.find((k) => k.name === 'outro')
        if (introKf && outroKf) {
          clipMinMs = introKf.timeMs
          clipMaxMs = outroKf.timeMs
        }
      }
      if (clipMinMs !== null && clipMaxMs !== null) {
        const bx = (clipMinMs - startMs) * pixelsPerMs
        const bw = (clipMaxMs - clipMinMs) * pixelsPerMs
        const band = document.createElementNS(SVG_NS, 'rect')
        band.setAttribute('x', String(bx))
        band.setAttribute('y', '0')
        band.setAttribute('width', String(Math.max(0, bw)))
        band.setAttribute('height', String(rowHeight))
        band.classList.add(clipDraw ? 'seq-row__clip-preview' : 'seq-row__clip')
        svg.insertBefore(band, svg.firstChild)
      }
    }

    // Segment bars between adjacent keyframes (positions follow active drag)
    for (let i = 0; i < item.keyframes.length; i++) {
      const kf = item.keyframes[i]!
      const next = item.keyframes[i + 1]
      if (!next) break
      const x1 = (getEffectiveMs(kf.id, kf.timeMs, ctx) - startMs) * pixelsPerMs
      const x2 = (getEffectiveMs(next.id, next.timeMs, ctx) - startMs) * pixelsPerMs
      const rect = document.createElementNS(SVG_NS, 'rect')
      rect.setAttribute('x', String(Math.min(x1, x2)))
      rect.setAttribute('y', String(rowHeight / 2 - 2))
      rect.setAttribute('width', String(Math.max(0, Math.abs(x2 - x1))))
      rect.setAttribute('height', '4')
      rect.classList.add('seq-row__segment')
      svg.appendChild(rect)
    }

    // Transition duration bands (named = amber, interpolated = blue)
    for (const kf of item.keyframes) {
      if (!kf.transitionOut) continue
      const kfX = (getEffectiveMs(kf.id, kf.timeMs, ctx) - startMs) * pixelsPerMs
      const bandW = kf.transitionOut.durationMs * pixelsPerMs
      const band = document.createElementNS(SVG_NS, 'rect')
      band.setAttribute('x', String(kfX))
      band.setAttribute('y', String(rowHeight / 2 - 5))
      band.setAttribute('width', String(Math.max(1, bandW)))
      band.setAttribute('height', '10')
      band.classList.add(
        'seq-row__transition',
        kf.transitionOut.kind === 'named' ? 'seq-row__transition--named' : 'seq-row__transition--interp',
      )
      svg.appendChild(band)
    }

    // Parent clip boundary markers + out-of-bounds detection
    const parentMarkers = getParentClipMarkers(item.id, scene.items)

    // Keyframe handles (position follows active drag for the dragged keyframe)
    for (const kf of item.keyframes) {
      const effectiveMs = getEffectiveMs(kf.id, kf.timeMs, ctx)
      const x = (effectiveMs - startMs) * pixelsPerMs
      const handle = createKeyframeHandle(kf, x, rowHeight, layoutProfile)
      const isDragging = drag?.keyframeId === kf.id && drag.trackId === item.id

      if (selection.keyframeId === kf.id && selection.trackId === item.id) {
        handle.classList.add('seq-kf--selected')
      }
      if (isDragging) {
        handle.classList.add('seq-kf--dragging')
      }
      const { introMs, outroMs } = parentMarkers
      if (
        (introMs !== null && effectiveMs < introMs) ||
        (outroMs !== null && effectiveMs > outroMs)
      ) handle.classList.add('seq-kf--out-of-bounds')

      if (onDragStart) {
        handle.addEventListener('pointerdown', e => {
          e.stopPropagation()
          e.preventDefault()
          onDragStart(item.id, kf.id, e)
        })
      } else {
        handle.addEventListener('click', e => {
          e.stopPropagation()
          onSelectKeyframe(item.id, kf.id)
        })
      }

      svg.appendChild(handle)
    }

    // Virtual keyframes (hollow diamonds — distribution-computed, not stored)
    const vkfsForTrack = ctx.virtualKeyframes.filter((v: VirtualKeyframe) => v.trackId === item.id)
    for (const vkf of vkfsForTrack) {
      const x = (vkf.timeMs - startMs) * pixelsPerMs
      const fakeKf = { id: vkf.id, timeMs: vkf.timeMs, name: vkf.name, decorId: '' }
      const handle = createKeyframeHandle(fakeKf, x, rowHeight, layoutProfile)
      handle.classList.add('seq-kf--virtual')
      if (!vkf.visible) handle.classList.add('seq-kf--out-of-bounds')
      if (onMaterializeVirtual) {
        handle.style.cursor = 'pointer'
        handle.addEventListener('dblclick', (e: MouseEvent) => {
          e.stopPropagation()
          onMaterializeVirtual(vkf)
        })
      }
      svg.appendChild(handle)
    }

    // Vertical markers at parent intro/outro positions
    for (const [markerMs, cls] of [
      [parentMarkers.introMs, 'seq-row__clip-marker seq-row__clip-marker--intro'],
      [parentMarkers.outroMs, 'seq-row__clip-marker seq-row__clip-marker--outro'],
    ] as [number | null, string][]) {
      if (markerMs === null) continue
      const mx = (markerMs - startMs) * pixelsPerMs
      const line = document.createElementNS(SVG_NS, 'line')
      line.setAttribute('x1', String(mx))
      line.setAttribute('x2', String(mx))
      line.setAttribute('y1', '0')
      line.setAttribute('y2', String(rowHeight))
      for (const c of cls.split(' ')) line.classList.add(c)
      svg.appendChild(line)
    }

    rowEl.addEventListener('dblclick', e => {
      const rect = rowEl.getBoundingClientRect()
      const rawMs = viewport.startMs + (e.clientX - rect.left) / viewport.pixelsPerMs
      onAddKeyframe(item.id, rawMs)
    })

    rowEl.appendChild(svg)
    container.appendChild(rowEl)
  }
}

function buildTrackRow(item: Item, rowHeight: number): HTMLElement {
  const row = document.createElement('div')
  row.classList.add('seq-row')
  if (!item.visible) row.classList.add('seq-row--hidden')
  row.dataset.trackId = item.id
  row.dataset.kind = item.type === 'capsule' ? 'capsule' : 'element'
  row.style.height = `${rowHeight}px`
  return row
}
