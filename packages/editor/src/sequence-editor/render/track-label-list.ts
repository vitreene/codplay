import type { MachineContext } from '../machine'
import type { Item, MarkerTrack } from '../types'
import { childrenOf, getTrackRowHeight } from '../utils'

type FlatEntry = { item: Item; depth: number }

/**
 * Remplace l'ancienne récursion sur `.children` — la profondeur est ici calculée en DESCENDANT
 * (accumulée pendant `walk`), pas en remontant `parentId` depuis chaque item : équivalent au calcul
 * précédent (même valeur produite), juste porté par `childrenOf` (filtre plat) au lieu d'un champ
 * `children` porté par le nœud. C'est le seul endroit où la profondeur NUMÉRIQUE compte (indentation
 * CSS `data-depth`, `sequence-editor.css:125-126`) — audité 2026-07-13.
 */
function flattenWithDepth(
  items: Item[],
  collapsedIds: ReadonlySet<string> = new Set(),
): FlatEntry[] {
  const result: FlatEntry[] = []
  function walk(parentId: string | null, depth: number): void {
    for (const item of childrenOf(items, parentId)) {
      result.push({ item, depth })
      if (!collapsedIds.has(item.id)) walk(item.id, depth + 1)
    }
  }
  walk(null, 0)
  return result
}

export function createTrackLabelList(): HTMLElement {
  const el = document.createElement('div')
  el.classList.add('seq-labels')
  return el
}

export function renderTrackLabelList(
  container: HTMLElement,
  ctx: MachineContext,
  onTrackClick: (trackId: string) => void,
  onToggleVisibility?: (trackId: string) => void,
  onToggleCollapse?: (capsuleId: string) => void,
  collapsedIds?: ReadonlySet<string>,
  onMarkerTrackClick?: (markerTrackId: string) => void,
  onToggleMarkerTrackVisibility?: (markerTrackId: string) => void,
  onAddMarkerTrack?: () => void,
  onRemoveMarkerTrack?: (markerTrackId: string) => void,
): void {
  container.innerHTML = ''

  // Spacer matching cueRow height — sits above the marker track label rows,
  // mirroring cueRow's position in timelineInner (cueRow → markerTrackRows → waveformRow → trackRows).
  // SVG/canvas use box-sizing:content-box → rendered height = attr + 1px border.
  const { layoutProfile, scene } = ctx
  const hasWaveform = Boolean(masterWaveform(ctx))
  const cueSpacer = document.createElement('div')
  cueSpacer.style.cssText = `height:${layoutProfile.rowHeightCues + 1}px;flex-shrink:0`
  container.appendChild(cueSpacer)

  for (const markerTrack of Object.values(scene.markerTracks)) {
    container.appendChild(
      buildMarkerTrackLabelRow(markerTrack, ctx, onMarkerTrackClick, onToggleMarkerTrackVisibility, onRemoveMarkerTrack),
    )
  }

  if (onAddMarkerTrack) {
    const addRow = document.createElement('div')
    addRow.classList.add('seq-label-row', 'seq-label-row--add-marker-track')
    addRow.style.height = `${layoutProfile.rowHeightMarkers + 1}px`
    addRow.textContent = '+ piste marqueur'
    addRow.title = 'Ajouter une piste de marqueurs'
    addRow.addEventListener('click', () => onAddMarkerTrack())
    container.appendChild(addRow)
  }

  if (hasWaveform) {
    const waveformSpacer = document.createElement('div')
    waveformSpacer.style.cssText = `height:${layoutProfile.rowHeightWaveform + 1}px;flex-shrink:0`
    container.appendChild(waveformSpacer)
  }

  const collapsed = collapsedIds ?? new Set<string>()
  for (const { item, depth } of flattenWithDepth(ctx.scene.items, collapsed)) {
    container.appendChild(buildLabelRow(item, depth, ctx, collapsed, onTrackClick, onToggleVisibility, onToggleCollapse))
  }
}

/** Même lookup que `render/waveform-row.ts::masterWaveform` — dupliqué ici plutôt que partagé pour rester un test booléen local, pas une dépendance croisée entre deux modules de rendu indépendants. */
function masterWaveform(ctx: MachineContext): boolean {
  const masterItemId = ctx.scene.masterItemId
  const masterItem = masterItemId ? ctx.scene.items.find((i) => i.id === masterItemId) : undefined
  const content = masterItem?.contentId ? ctx.scene.contents[masterItem.contentId] : undefined
  return Boolean(content?.waveform)
}

function buildMarkerTrackLabelRow(
  markerTrack: MarkerTrack,
  ctx: MachineContext,
  onMarkerTrackClick?: (markerTrackId: string) => void,
  onToggleVisibility?: (markerTrackId: string) => void,
  onRemove?: (markerTrackId: string) => void,
): HTMLElement {
  const row = document.createElement('div')
  row.classList.add('seq-label-row', 'seq-label-row--marker-track')
  row.dataset.markerTrackId = markerTrack.id
  // +1 compensates the SVG marker row's content-box border (see renderMarkerTrackRows)
  row.style.height = `${ctx.layoutProfile.rowHeightMarkers + 1}px`
  if (!markerTrack.visible) row.classList.add('seq-label-row--hidden')

  const name = document.createElement('span')
  name.classList.add('seq-label-row__name')
  name.textContent = markerTrack.label
  row.appendChild(name)

  const visBtn = document.createElement('button')
  visBtn.classList.add('seq-label-row__vis')
  visBtn.textContent = markerTrack.visible ? '●' : '○'
  visBtn.title = markerTrack.visible ? 'Masquer' : 'Afficher'
  visBtn.addEventListener('click', e => {
    e.stopPropagation()
    onToggleVisibility?.(markerTrack.id)
  })
  row.appendChild(visBtn)

  if (onRemove) {
    const rmBtn = document.createElement('button')
    rmBtn.classList.add('seq-label-row__remove')
    rmBtn.textContent = '✕'
    rmBtn.title = 'Retirer cette piste'
    rmBtn.addEventListener('click', e => {
      e.stopPropagation()
      onRemove(markerTrack.id)
    })
    row.appendChild(rmBtn)
  }

  if (onMarkerTrackClick) {
    row.addEventListener('click', () => onMarkerTrackClick(markerTrack.id))
  }
  return row
}

/** Libellé d'affichage — `Item.label` si posé, sinon dérivé (texte tronqué, source, badge de type). Document-model §"Item.label est un libellé d'affichage, pas du contenu". */
function displayLabel(item: Item, ctx: MachineContext): string {
  if (item.label) return item.label
  if (item.type === 'capsule') return item.capsule?.kind ?? 'capsule'
  const content = item.contentId ? ctx.scene.contents[item.contentId] : undefined
  if (content?.text) return content.text.length > 24 ? `${content.text.slice(0, 24)}…` : content.text
  if (content?.source) return content.source.split('/').pop() ?? content.source
  return item.type
}

function buildLabelRow(
  item: Item,
  depth: number,
  ctx: MachineContext,
  collapsedIds: ReadonlySet<string>,
  onTrackClick: (trackId: string) => void,
  onToggleVisibility?: (trackId: string) => void,
  onToggleCollapse?: (capsuleId: string) => void,
): HTMLElement {
  const row = document.createElement('div')
  row.classList.add('seq-label-row')
  row.dataset.trackId = item.id
  row.dataset.kind = item.type === 'capsule' ? 'capsule' : 'element'
  row.dataset.depth = String(depth)
  row.style.height = `${getTrackRowHeight(item, ctx.layoutProfile)}px`

  const isSelected = ctx.selection.trackId === item.id && ctx.selection.keyframeId === null
  if (isSelected) row.classList.add('seq-label-row--selected')
  if (!item.visible) row.classList.add('seq-label-row--hidden')

  // Collapse toggle — capsules with children only
  const hasChildren = item.type === 'capsule' && childrenOf(ctx.scene.items, item.id).length > 0
  if (hasChildren) {
    const isCollapsed = collapsedIds.has(item.id)
    const colBtn = document.createElement('button')
    colBtn.classList.add('seq-label-row__collapse')
    colBtn.textContent = isCollapsed ? '▶' : '▼'
    colBtn.title = isCollapsed ? 'Développer' : 'Réduire'
    colBtn.addEventListener('click', e => {
      e.stopPropagation()
      onToggleCollapse?.(item.id)
    })
    row.appendChild(colBtn)
  }

  const name = document.createElement('span')
  name.classList.add('seq-label-row__name')
  name.textContent = displayLabel(item, ctx)
  row.appendChild(name)

  if (item.type === 'capsule') {
    const tag = document.createElement('span')
    tag.classList.add('seq-label-row__kind')
    tag.textContent = item.capsule?.kind ?? 'capsule'
    row.appendChild(tag)
  }

  // Visibility toggle — right-aligned via margin-left:auto on CSS
  const visBtn = document.createElement('button')
  visBtn.classList.add('seq-label-row__vis')
  visBtn.textContent = item.visible ? '●' : '○'
  visBtn.title = item.visible ? 'Masquer' : 'Afficher'
  visBtn.addEventListener('click', e => {
    e.stopPropagation()
    onToggleVisibility?.(item.id)
  })
  row.appendChild(visBtn)

  row.addEventListener('click', () => onTrackClick(item.id))
  return row
}
