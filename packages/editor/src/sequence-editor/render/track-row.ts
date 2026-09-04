import type { MachineContext, VirtualKeyframe } from '../machine'
import type { Item } from '../types'
import { resolveKeyframeChannel } from '../types'
import { childrenOf, getTrackRowHeight, getParentClipMarkers } from '../utils'
import { createKeyframeHandle } from './keyframe-handle'
import { timeToPixel, pixelToTime } from './geometry'

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

/** Returns all keyframes in temporal order for the decoration event lane. */
function sortTimelineKeyframes(item: Item): Item['keyframes'] {
  return [...item.keyframes].sort((left, right) => left.timeMs - right.timeMs)
}

/** Returns only spatial keyframes; decoration-only points never form a movement segment. */
function sortPoseKeyframes(item: Item): Item['keyframes'] {
  return sortTimelineKeyframes(item).filter((keyframe) => resolveKeyframeChannel(keyframe) === 'pose')
}

/** Reports whether a pose keyframe carries an authored decoration payload of its own. */
function carriesDecoration(scene: MachineContext['scene'], keyframe: Item['keyframes'][number]): boolean {
  const decor = scene.decors[keyframe.decorId]
  if (decor === undefined) return false
  if ((decor.style !== undefined && Object.keys(decor.style).length > 0)
    || decor.classes !== undefined
    || decor.custom !== undefined
    || decor.zoneId !== undefined) return true
  return Object.keys(decor).some((property) => !['id', 'offset', 'path'].includes(property))
}

/** Returns the decoration event chain without duplicating pose-only movement points. */
function sortDecorationKeyframes(ctx: MachineContext, item: Item): Item['keyframes'] {
  return sortTimelineKeyframes(item).filter((keyframe) => (
    resolveKeyframeChannel(keyframe) === 'decor' || carriesDecoration(ctx.scene, keyframe)
  ))
}

/** Places a channel in its lane only when the item actually needs two visible channels. */
function channelCenter(rowHeight: number, channel: 'pose' | 'decor', dualChannel: boolean): number {
  if (!dualChannel) return rowHeight / 2
  return channel === 'decor' ? rowHeight / 4 : (rowHeight * 3) / 4
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
  onVirtualDragStart?: (vkf: VirtualKeyframe, e: PointerEvent) => void,
): void {
  container.innerHTML = ''

  const { viewport, scene, selection, layoutProfile } = ctx
  const { pixelsPerMs } = viewport
  const toPx = (timeMs: number) => timeToPixel(timeMs, viewport, layoutProfile)
  const collapsed = collapsedIds ?? new Set<string>()
  const drag = ctx.interaction?.kind === 'dragging-keyframe' ? ctx.interaction : null

  for (const item of flattenFiltered(scene.items, collapsed)) {
    const rowHeight = getTrackRowHeight(item, layoutProfile)
    const rowEl = buildTrackRow(item, rowHeight)
    const poseKeyframes = sortPoseKeyframes(item)
    const decorationKeyframes = sortDecorationKeyframes(ctx, item)
    const hasPoseChannel = poseKeyframes.length > 0
    const hasDecorChannel = item.keyframes.some((keyframe) => resolveKeyframeChannel(keyframe) === 'decor')
    const dualChannel = hasPoseChannel && hasDecorChannel
    if (dualChannel) rowEl.dataset.dualChannel = 'true'

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
        const capsuleKeyframes = poseKeyframes
        const introKf = capsuleKeyframes[0]
        const outroKf = capsuleKeyframes.at(-1)
        if (introKf && outroKf) {
          clipMinMs = introKf.timeMs
          clipMaxMs = outroKf.timeMs
        }
      }
      if (clipMinMs !== null && clipMaxMs !== null) {
        const bx = toPx(clipMinMs)
        const bw = toPx(clipMaxMs) - bx
        const band = document.createElementNS(SVG_NS, 'rect')
        band.setAttribute('x', String(bx))
        band.setAttribute('y', '0')
        band.setAttribute('width', String(Math.max(0, bw)))
        band.setAttribute('height', String(rowHeight))
        band.classList.add(clipDraw ? 'seq-row__clip-preview' : 'seq-row__clip')
        svg.insertBefore(band, svg.firstChild)
      }
    }

    // Segment bars follow their own channel. In particular, a decor point never inserts a pose
    // segment, so A→B remains one spatial segment until a pose KF is actually created.
    const visualSegments = dualChannel
      ? ([['decor', decorationKeyframes], ['pose', poseKeyframes]] as const)
      : hasPoseChannel
        ? ([['pose', poseKeyframes]] as const)
        : ([['decor', decorationKeyframes]] as const)
    for (const [channel, keyframes] of visualSegments) {
      const center = channelCenter(rowHeight, channel, dualChannel)
      for (let i = 0; i < keyframes.length - 1; i += 1) {
        const kf = keyframes[i]!
        const next = keyframes[i + 1]!
        const x1 = toPx(getEffectiveMs(kf.id, kf.timeMs, ctx))
        const x2 = toPx(getEffectiveMs(next.id, next.timeMs, ctx))
        const rect = document.createElementNS(SVG_NS, 'rect')
        rect.setAttribute('x', String(Math.min(x1, x2)))
        rect.setAttribute('y', String(center - 2))
        rect.setAttribute('width', String(Math.max(0, Math.abs(x2 - x1))))
        rect.setAttribute('height', '4')
        rect.classList.add('seq-row__segment', `seq-row__segment--${channel}`)
        svg.appendChild(rect)
      }
    }

    // Transition duration bands (named = amber, interpolated = blue). Un kf FIXE le décor à son
    // instant : `transitionIn` le PRÉCÈDE (bande à gauche, se termine AU kf) ; `transitionOut` le
    // SUIT (bande à droite, débute AU kf) — intro/outro sont les bornes du clip, la transition ne se
    // fait donc que d'un seul côté (règle d'exclusivité, `2026-06-11-sequence-editor-grid-spec.md`).
    for (const kf of item.keyframes) {
      const kfX = toPx(getEffectiveMs(kf.id, kf.timeMs, ctx))
      const center = channelCenter(rowHeight, resolveKeyframeChannel(kf), dualChannel)
      if (kf.transitionIn) {
        const bandW = kf.transitionIn.durationMs * pixelsPerMs
        const band = document.createElementNS(SVG_NS, 'rect')
        band.setAttribute('x', String(kfX - Math.max(1, bandW)))
        band.setAttribute('y', String(center - 5))
        band.setAttribute('width', String(Math.max(1, bandW)))
        band.setAttribute('height', '10')
        band.classList.add(
          'seq-row__transition',
          kf.transitionIn.kind === 'named' ? 'seq-row__transition--named' : 'seq-row__transition--interp',
        )
        svg.appendChild(band)
      }
      if (kf.transitionOut) {
        const bandW = kf.transitionOut.durationMs * pixelsPerMs
        const band = document.createElementNS(SVG_NS, 'rect')
        band.setAttribute('x', String(kfX))
        band.setAttribute('y', String(center - 5))
        band.setAttribute('width', String(Math.max(1, bandW)))
        band.setAttribute('height', '10')
        band.classList.add(
          'seq-row__transition',
          kf.transitionOut.kind === 'named' ? 'seq-row__transition--named' : 'seq-row__transition--interp',
        )
        svg.appendChild(band)
      }
    }

    if (dualChannel) {
      const divider = document.createElementNS(SVG_NS, 'line')
      divider.setAttribute('x1', '0')
      divider.setAttribute('x2', '100%')
      divider.setAttribute('y1', String(rowHeight / 2))
      divider.setAttribute('y2', String(rowHeight / 2))
      divider.classList.add('seq-row__channel-divider')
      svg.appendChild(divider)
    }

    // Parent clip boundary markers + out-of-bounds detection
    const parentMarkers = getParentClipMarkers(item.id, scene.items)

    // Keyframe handles (position follows active drag for the dragged keyframe)
    for (const kf of item.keyframes) {
      const effectiveMs = getEffectiveMs(kf.id, kf.timeMs, ctx)
      const x = toPx(effectiveMs)
      const handle = createKeyframeHandle(
        kf,
        x,
        rowHeight,
        layoutProfile,
        channelCenter(rowHeight, resolveKeyframeChannel(kf), dualChannel),
      )
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
      const x = toPx(vkf.timeMs)
      const fakeKf = { id: vkf.id, timeMs: vkf.timeMs, name: vkf.name, decorId: '', channel: 'pose' as const }
      const handle = createKeyframeHandle(fakeKf, x, rowHeight, layoutProfile, channelCenter(rowHeight, 'pose', dualChannel))
      handle.classList.add('seq-kf--virtual')
      if (!vkf.visible) handle.classList.add('seq-kf--out-of-bounds')
      if (onMaterializeVirtual) {
        handle.style.cursor = 'pointer'
        handle.addEventListener('dblclick', (e: MouseEvent) => {
          e.stopPropagation()
          onMaterializeVirtual(vkf)
        })
      }
      if (onVirtualDragStart) {
        handle.addEventListener('pointerdown', (e: PointerEvent) => {
          e.stopPropagation()
          onVirtualDragStart(vkf, e)
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
      const mx = toPx(markerMs)
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
      const rawMs = pixelToTime(e.clientX - rect.left, viewport, layoutProfile)
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
