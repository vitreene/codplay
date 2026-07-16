import { createActor } from 'xstate'
import { decorEditorMachine, resolveAttachedDecor } from './machine'
import type { AttachedItem, DecorEditorMachineContext } from './machine'
import { panelsForTypes } from './palette-panel'
import type { PaletteConfig, PanelId } from './palette-panel'
import { resolveFieldAcrossItems } from './field-state'
import type { FieldState } from './field-state'
import { buildPatchFromPath } from './path-patch'
import { offsetPatchToValuesPx, offsetValuesPxToPatch } from './units'
import type {
  DecorPatch, DecorPreset, ItemType, OffsetEditorBridge, OrientationContext, ResolvedDecor, ZoneCard, ZoneTable,
} from './types'

// ─── Public snapshot type ────────────────────────────────────────────────────

export type DecorEditorSnapshot = {
  context: DecorEditorMachineContext
  value: string
}

export type Unsubscribe = () => void

/** Un écart par item affecté par la mutation courante (item unique = tableau à 1 élément). */
export type DecorChangeEntry = { itemId: string; patch: DecorPatch }

// ─── Options ─────────────────────────────────────────────────────────────────

export interface DecorEditorCatalogs {
  presets: DecorPreset[]
  cards: ZoneCard[]
  palette: PaletteConfig
}

export interface AttachItemInput {
  itemId: string
  itemType: ItemType
  defaults: ResolvedDecor
  chain: DecorPatch[]
  patch: DecorPatch
  zones: ZoneTable
  context: OrientationContext
}

// ─── Controller ──────────────────────────────────────────────────────────────

export class DecorEditorController {
  private actor: ReturnType<typeof createActor<typeof decorEditorMachine>>
  private catalogs: DecorEditorCatalogs
  private decorChangeCallbacks = new Set<(entries: DecorChangeEntry[]) => void>()
  private zonesChangeCallbacks = new Set<(zones: ZoneTable) => void>()
  private interactionEndCallbacks = new Set<() => void>()
  /** Pont vers l'éditeur visuel de position (spec §6) — dedit reste le seul interlocuteur de
   *  l'app, jamais `selection-frame` importé directement. Peut arriver après construction
   *  (`setOffsetBridge`) : le pont dépend de `authorApi`, prêt après le premier rebuild. */
  private offsetBridge: OffsetEditorBridge | undefined
  private unsubscribeOffsetValues: Unsubscribe | null = null
  /** Coupe le rebouclage geste→champs→geste : une valeur reçue DU pont ne doit jamais lui être
   *  repoussée comme si elle venait d'une saisie dedit. */
  private applyingFromBridge = false

  constructor(catalogs: DecorEditorCatalogs, orientationContext: OrientationContext = 'horizontal') {
    this.catalogs = catalogs
    this.actor = createActor(decorEditorMachine, { input: { orientationContext } })
    this.actor.start()
  }

  /** Câblé une fois le pont offset disponible côté hôte (peut arriver après la construction). */
  setOffsetBridge(bridge: OffsetEditorBridge | undefined): void {
    this.offsetBridge = bridge
    this.syncOffsetBridge()
  }

  destroy(): void {
    this.unsubscribeOffsetValues?.()
    this.offsetBridge?.deactivate()
    this.actor.stop()
    this.decorChangeCallbacks.clear()
    this.zonesChangeCallbacks.clear()
    this.interactionEndCallbacks.clear()
  }

  // ── Subscription ────────────────────────────────────────────────────────────

  subscribe(callback: (snapshot: DecorEditorSnapshot) => void): Unsubscribe {
    callback(this.getSnapshot())
    const sub = this.actor.subscribe(s => {
      callback({ context: s.context, value: String(s.value) })
    })
    return () => sub.unsubscribe()
  }

  getSnapshot(): DecorEditorSnapshot {
    const s = this.actor.getSnapshot()
    return { context: s.context, value: String(s.value) }
  }

  private send(event: Parameters<typeof this.actor.send>[0]): void {
    this.actor.send(event)
  }

  private getItems(): AttachedItem[] {
    return this.actor.getSnapshot().context.items
  }

  // ── Item lifecycle ──────────────────────────────────────────────────────────

  /** Item unique = tableau à un élément — pas d'API séparée pour la sélection simple. */
  attachItems(inputs: AttachItemInput[]): void {
    const initialPanelId = panelsForTypes(inputs.map(i => i.itemType), this.catalogs.palette)[0] ?? ''
    this.send({
      type: 'ITEMS.ATTACH',
      items: inputs.map(input => ({
        itemId: input.itemId,
        itemType: input.itemType,
        defaults: input.defaults,
        chain: input.chain,
        patch: input.patch,
      })),
      zones: inputs[0]?.zones ?? [],
      initialPanelId,
    })
    if (inputs[0]) this.send({ type: 'CONTEXT.SET', context: inputs[0].context })
    this.syncOffsetBridge()
  }

  detach(): void {
    this.send({ type: 'ITEMS.DETACH' })
    this.syncOffsetBridge()
  }

  /**
   * Rebranche le pont offset sur l'item unique actuellement attaché (spec §7 bis : position hors
   * périmètre de l'édition groupée — inerte en multi-sélection ou sans item). `'transform'` est le
   * mode sélectionné par défaut (spec §6) ; aucun autre mode n'a encore d'éditeur visuel intégré à
   * l'app (position/grille et attache-flex — pas encore câblés, `2026-07-16-position-bridge-
   * reconciliation-plan.md` risque §5), donc jamais activé automatiquement ici.
   */
  private syncOffsetBridge(): void {
    this.unsubscribeOffsetValues?.()
    this.unsubscribeOffsetValues = null
    if (this.offsetBridge === undefined) return
    const items = this.getItems()
    if (items.length !== 1) {
      this.offsetBridge.deactivate()
      return
    }
    this.offsetBridge.activate('transform')
    this.unsubscribeOffsetValues = this.offsetBridge.onValues(values => {
      const widthPx = this.offsetBridge!.containerRefWidthPx()
      if (widthPx <= 0) return
      this.applyingFromBridge = true
      try {
        this.applyPatch({ offset: offsetValuesPxToPatch(values, widthPx) })
      } finally {
        this.applyingFromBridge = false
      }
    })
  }

  /** No-op tant qu'aucun item n'est attaché (le contexte initial se règle au constructeur). */
  setContext(ctx: OrientationContext): void {
    this.send({ type: 'CONTEXT.SET', context: ctx })
  }

  /** Révision de la chaîne d'héritage d'un item (déplacement de kf) : repli complet, sans état résiduel. */
  setChain(itemId: string, chain: DecorPatch[]): void {
    this.send({ type: 'CHAIN.SET', itemId, chain })
  }

  // ── Panel / modes ────────────────────────────────────────────────────────────

  selectPanel(panelId: PanelId): void {
    this.send({ type: 'PANEL.SELECT', panelId })
  }

  /** Intersection des panneaux pertinents pour tous les items attachés (spec §7 bis). */
  getPanelsForCurrentItems(): PanelId[] {
    const items = this.getItems()
    if (items.length === 0) return []
    return panelsForTypes(items.map(i => i.itemType), this.catalogs.palette)
  }

  getPaletteConfig(): PaletteConfig {
    return this.catalogs.palette
  }

  getPresets(): DecorPreset[] {
    return this.catalogs.presets
  }

  setVisualPosition(on: boolean): void {
    this.send({ type: 'VISUAL_POSITION.TOGGLE', on })
  }

  setZoneMode(on: boolean): void {
    this.send({ type: 'ZONE_MODE.TOGGLE', on })
  }

  // ── Decor editing ───────────────────────────────────────────────────────────

  /** Appliqué à chaque item attaché, identiquement (spec §7 bis). */
  applyPatch(patch: DecorPatch): void {
    this.send({ type: 'PATCH.APPLY', patch })
    this.emitDecorChange()
    // champs → geste (spec §6) : une saisie touchant `offset` est repoussée sur l'élément via le
    // pont — sauf si CETTE valeur vient déjà du pont (`syncOffsetBridge`), sinon boucle infinie
    // geste→champs→geste.
    if (patch.offset !== undefined && !this.applyingFromBridge && this.offsetBridge !== undefined) {
      const widthPx = this.offsetBridge.containerRefWidthPx()
      if (widthPx > 0) this.offsetBridge.apply(offsetPatchToValuesPx(patch.offset, widthPx))
    }
  }

  /**
   * Construit un écart à partir d'un chemin générique ("groupe.propriete", ou racine) et
   * l'applique — même règle que `applyPatch` (spec §7 bis). Le rendu appelle cette méthode
   * sans connaître la structure du décor, symétrique de `resolveField`/`hasOwnPatch` en
   * lecture : aucune limitation du rendu à `style.*`.
   */
  applyPathPatch(path: string, value: unknown): void {
    this.applyPatch(buildPatchFromPath(path, value))
  }

  /** Contrôle « hériter » — masqué en multi-sélection : no-op tant que plusieurs items sont attachés. */
  stripInherited(path: string): void {
    if (this.getItems().length > 1) return
    this.send({ type: 'PATCH.STRIP', path })
    this.emitDecorChange()
  }

  applyPreset(name: string): void {
    const preset = this.catalogs.presets.find(p => p.name === name)
    if (!preset) return
    this.send({ type: 'PRESET.APPLY', patch: preset.patch })
    this.emitDecorChange()
  }

  applyCard(name: string): void {
    const card = this.catalogs.cards.find(c => c.name === name)
    if (!card) return
    this.send({ type: 'ZONES.SET', zones: card.zones })
    this.emitZonesChange()
  }

  setZones(zones: ZoneTable): void {
    this.send({ type: 'ZONES.SET', zones })
    this.emitZonesChange()
  }

  // ── Field resolution (multi-sélection) ──────────────────────────────────────

  /** État d'un champ à travers tous les items attachés — valeur commune, ou mixte (spec §7 bis). */
  resolveField<T>(path: string): FieldState<T> {
    const decors = this.getItems().map(resolveAttachedDecor)
    return resolveFieldAcrossItems<T>(decors, path)
  }

  /**
   * Vrai si l'item unique attaché porte un écart explicite sur cette propriété
   * (distinct de la valeur résolue — sert au marqueur « hériter », §3.1). Toujours
   * faux en multi-sélection (le contrôle n'existe pas dans ce cas, §7 bis).
   */
  hasOwnPatch(path: string): boolean {
    const items = this.getItems()
    if (items.length !== 1) return false
    const segments = path.split('.')
    let current: unknown = items[0]!.patch
    for (const segment of segments) {
      if (current === null || typeof current !== 'object' || !(segment in current)) return false
      current = (current as Record<string, unknown>)[segment]
    }
    return true
  }

  // ── Read access ──────────────────────────────────────────────────────────────

  /** Écart de chaque item attaché (item unique = tableau à 1 élément). */
  getPatches(): DecorChangeEntry[] {
    return this.getItems().map(item => ({ itemId: item.itemId, patch: item.patch }))
  }

  getResolvedDecors(): ResolvedDecor[] {
    return this.getItems().map(resolveAttachedDecor)
  }

  getZones(): ZoneTable {
    return this.actor.getSnapshot().context.zones
  }

  // ── Change notifications ─────────────────────────────────────────────────────

  onDecorChange(cb: (entries: DecorChangeEntry[]) => void): Unsubscribe {
    this.decorChangeCallbacks.add(cb)
    return () => this.decorChangeCallbacks.delete(cb)
  }

  onZonesChange(cb: (zones: ZoneTable) => void): Unsubscribe {
    this.zonesChangeCallbacks.add(cb)
    return () => this.zonesChangeCallbacks.delete(cb)
  }

  /**
   * Signal de bord "l'utilisateur vient de terminer une interaction sur un champ" — le rendu
   * l'appelle sur l'événement natif `'change'` des contrôles continus (couleur, curseur : `'input'`
   * n'a pas de fin détectable), ou juste après le patch d'un contrôle déjà discret (nombre,
   * sélection, texte — sa propre fin de geste). Généralise le flush de fin de phase (chantier 3,
   * `2026-07-16-position-bridge-reconciliation-plan.md` §Étape D) au-delà du seul CS : dedit ne
   * décide pas lui-même de la cadence de commit (§4.3 du spec — jamais de debounce ici), il ne fait
   * que relayer ce signal à l'hôte, qui en reste seul juge.
   */
  onInteractionEnd(cb: () => void): Unsubscribe {
    this.interactionEndCallbacks.add(cb)
    return () => this.interactionEndCallbacks.delete(cb)
  }

  notifyInteractionEnd(): void {
    for (const cb of this.interactionEndCallbacks) cb()
  }

  private emitDecorChange(): void {
    const entries = this.getPatches()
    if (entries.length === 0) return
    for (const cb of this.decorChangeCallbacks) cb(entries)
  }

  private emitZonesChange(): void {
    const zones = this.getZones()
    for (const cb of this.zonesChangeCallbacks) cb(zones)
  }
}
