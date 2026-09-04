import { setup, assign } from 'xstate'
import type { DecorPatch, ItemType, OrientationContext, ResolvedDecor, ZoneTable } from './types'
import type { PanelId } from './palette-panel'
import { mergePatch, resolveDecor } from './merge'
import { stripInherited } from './strip-inherited'

// ─── Machine-specific types ─────────────────────────────────────────────────

export interface AttachedItem {
  itemId: string
  itemType: ItemType
  defaults: ResolvedDecor
  chain: DecorPatch[]
  patch: DecorPatch
  /**
   * `patch` reflète l'état live du node (playhead entre deux kf), pas un décor enregistré —
   * `2026-07-17-resolved-state-at-time-notes.md`. Piloté en donnée jusqu'ici ; la présentation
   * (ex. fond de palette plus clair) reste un choix du rendu, jamais décidé ici.
   */
  isTemporary?: boolean
  /** Property paths changed by the user for the currently displayed target. */
  modifiedProperties: string[]
}

export interface DecorEditorMachineContext {
  items: AttachedItem[]
  zones: ZoneTable
  orientationContext: OrientationContext
  /** Panneau actif — identifiant opaque pour le contrat, résolu contre PaletteConfig côté rendu/contrôleur. */
  activePanelId: PanelId
  visualPosition: boolean
  zoneMode: boolean
}

export type DecorEditorMachineInput = {
  orientationContext?: OrientationContext
  initialPanelId?: PanelId
}

export interface AttachItemEntry {
  itemId: string
  itemType: ItemType
  defaults: ResolvedDecor
  chain: DecorPatch[]
  patch: DecorPatch
  isTemporary?: boolean
  /** Initial property paths changed by the user for the currently displayed target. */
  modifiedProperties?: readonly string[]
}

// ─── Events ──────────────────────────────────────────────────────────────────

export type DecorEditorEvent =
  | { type: 'ITEMS.ATTACH'; items: AttachItemEntry[]; zones: ZoneTable; initialPanelId: PanelId }
  | { type: 'ITEMS.DETACH' }
  | { type: 'CHAIN.SET'; itemId: string; chain: DecorPatch[] }
  | { type: 'CONTEXT.SET'; context: OrientationContext }
  | { type: 'PANEL.SELECT'; panelId: PanelId }
  | { type: 'PATCH.APPLY'; patch: DecorPatch }
  | { type: 'PATCH.STRIP'; path: string }
  | { type: 'MODIFIED.SET'; itemId: string; paths: readonly string[] }
  | { type: 'PRESET.APPLY'; patch: DecorPatch }
  | { type: 'ZONES.SET'; zones: ZoneTable }
  | { type: 'VISUAL_POSITION.TOGGLE'; on: boolean }
  | { type: 'ZONE_MODE.TOGGLE'; on: boolean }

// ─── Machine ─────────────────────────────────────────────────────────────────

function toAttachedItems(entries: AttachItemEntry[]): AttachedItem[] {
  return entries.map(e => ({
    itemId: e.itemId,
    itemType: e.itemType,
    defaults: e.defaults,
    chain: e.chain,
    patch: e.patch,
    isTemporary: e.isTemporary,
    modifiedProperties: [...(e.modifiedProperties ?? [])],
  }))
}

/**
 * `syncSelection` (`decor-editor-bridge.ts`) réattache le MÊME ensemble d'items à chaque
 * `sceneCommitted` — pas seulement quand la sélection change réellement — pour rafraîchir leurs
 * données (`defaults`/`chain`/`patch`) depuis le document à jour. Un re-attach de ce type ne doit
 * jamais réinitialiser la présentation (panneau actif, mode position visuelle, mode zone) : seul un
 * geste de l'utilisateur (choisir un panneau, changer de sélection) a le droit de la changer.
 * Comparaison par ensemble (pas par ordre) — une multi-sélection resynchronisée dans un ordre
 * différent reste « la même sélection ».
 */
function sameItemIdSet(previous: AttachedItem[], next: AttachItemEntry[]): boolean {
  if (previous.length !== next.length) return false
  const nextIds = new Set(next.map(item => item.itemId))
  return previous.every(item => nextIds.has(item.itemId))
}

export const decorEditorMachine = setup({
  types: {
    context: {} as DecorEditorMachineContext,
    events: {} as DecorEditorEvent,
    input: {} as DecorEditorMachineInput,
  },
}).createMachine({
  id: 'decor-editor',
  initial: 'inactive',

  context: ({ input }) => ({
    items: [],
    zones: [],
    orientationContext: input.orientationContext ?? 'horizontal',
    activePanelId: input.initialPanelId ?? '',
    visualPosition: false,
    zoneMode: false,
  }),

  states: {

    // ── inactive ──────────────────────────────────────────────────────────────
    inactive: {
      on: {
        'ITEMS.ATTACH': {
          target: 'active',
          actions: assign(({ event }) => ({
            items: toAttachedItems(event.items),
            zones: event.zones,
            activePanelId: event.initialPanelId,
            visualPosition: false,
            zoneMode: false,
          })),
        },
      },
    },

    // ── active ────────────────────────────────────────────────────────────────
    active: {
      on: {
        'ITEMS.DETACH': {
          target: 'inactive',
          actions: assign(() => ({ items: [], zones: [], visualPosition: false, zoneMode: false })),
        },

        'ITEMS.ATTACH': {
          actions: assign(({ context, event }) => {
            const sameSelection = sameItemIdSet(context.items, event.items)
            return {
              items: toAttachedItems(event.items),
              zones: event.zones,
              activePanelId: sameSelection ? context.activePanelId : event.initialPanelId,
              visualPosition: sameSelection ? context.visualPosition : false,
              zoneMode: sameSelection ? context.zoneMode : false,
            }
          }),
        },

        'CHAIN.SET': {
          actions: assign(({ context, event }) => ({
            items: context.items.map(item =>
              item.itemId === event.itemId ? { ...item, chain: event.chain } : item,
            ),
          })),
        },

        'CONTEXT.SET': {
          actions: assign(({ event }) => ({ orientationContext: event.context })),
        },

        'PANEL.SELECT': {
          actions: assign(({ event }) => ({ activePanelId: event.panelId })),
        },

        'PATCH.APPLY': {
          // Appliqué à CHAQUE item de la sélection, identiquement (spec §7 bis).
          actions: assign(({ context, event }) => ({
            items: context.items.map(item => ({ ...item, patch: mergePatch(item.patch, event.patch) })),
          })),
        },

        'PATCH.STRIP': {
          // No-op en multi-sélection : le contrôleur garde cet événement à 1 seul item
          // (contrôle « hériter » masqué au-delà, spec §7 bis) ; la machine applique
          // simplement à tous les items présents, ce qui est un no-op à un seul item.
          actions: assign(({ context, event }) => ({
            items: context.items.map(item => ({ ...item, patch: stripInherited(item.patch, event.path) })),
          })),
        },

        'MODIFIED.SET': {
          actions: assign(({ context, event }) => ({
            items: context.items.map(item => item.itemId === event.itemId
              ? { ...item, modifiedProperties: [...event.paths] }
              : item),
          })),
        },

        'PRESET.APPLY': {
          actions: assign(({ context, event }) => ({
            items: context.items.map(item => ({ ...item, patch: mergePatch(item.patch, event.patch) })),
          })),
        },

        'ZONES.SET': {
          actions: assign(({ event }) => ({ zones: event.zones })),
        },

        'VISUAL_POSITION.TOGGLE': {
          actions: assign(({ event }) => ({ visualPosition: event.on })),
        },

        'ZONE_MODE.TOGGLE': {
          actions: assign(({ event }) => ({ zoneMode: event.on })),
        },
      },
    },
  },
})

/** Décor résolu d'un item attaché — défauts ⊕ chaîne d'héritage ⊕ écart courant. */
export function resolveAttachedDecor(item: AttachedItem): ResolvedDecor {
  return mergePatch(resolveDecor(item.defaults, item.chain), item.patch)
}
