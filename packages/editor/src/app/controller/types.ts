/**
 * Contexte et événements du contrôleur central — `plan/app/2026-07-12-app-controller-definition.md`.
 */

import type { CapsuleDef, Content, Decor, EditorScene, ItemType, PositionData } from '../commands/types'

// ─── Sélection ──────────────────────────────────────────────────────────────

/** §5 — indexée par id stable (jamais par référence DOM), survit à un rebuild/seek qui détruit le node. */
export interface Selection {
  itemIds: string[]
  keyframeId?: string
}

export const EMPTY_SELECTION: Selection = { itemIds: [] }

// ─── Panneaux ───────────────────────────────────────────────────────────────

/** §1 — trilogie d'édition (document-model) : décor (dedit), capsule (CapsuleDef), contenu (Content). */
export type EditPanel = 'decor' | 'capsule' | 'content'

// ─── Métadonnées de scène (§6 — cycle de vie multi-documents) ──────────────

export interface EditorSceneMeta {
  id: string
  title: string
}

// ─── Contexte ───────────────────────────────────────────────────────────────

export interface ControllerContext {
  documents: Record<string, EditorSceneMeta>
  currentSceneId: string | null
  scene: EditorScene | null

  selection: Selection
  openPanels: EditPanel[]
  editGesture: 'zone' | 'position' | null
  zonesVisible: boolean
  /** Le type en cours de création pendant l'état `creating` — `null` en dehors de ce mode. */
  creatingType: ItemType | null
}

// ─── Commandes de la façade (§4.1 — vocabulaire fermé, jamais une mutation arbitraire) ─────────

/**
 * Une entrée par commande de `commands/facade.ts` — union discriminée sur `name` pour que la
 * machine ne sache dispatcher QUE vers le vocabulaire de la façade (§4 « voie d'écriture unique »),
 * jamais vers une fonction de mutation arbitraire fournie par l'appelant.
 */
export type Command =
  | { name: 'createItem'; args: { geometry: PositionData; parentId?: string | null } }
  | { name: 'assignType'; args: { itemId: string; type: ItemType } }
  | { name: 'assignContent'; args: { itemId: string; content: Omit<Content, 'id'> } }
  | { name: 'attachItem'; args: { itemId: string; parentId: string | null; order?: string } }
  | { name: 'setDecor'; args: { decorId: string; patch: Partial<Omit<Decor, 'id'>> } }
  | { name: 'createKeyframe'; args: { itemId: string; timeMs: number; decorId?: string } }
  | { name: 'createCapsule'; args: { geometry: PositionData; capsuleDef: CapsuleDef; parentId?: string | null } }
  | { name: 'setCapsuleDef'; args: { itemId: string; patch: Partial<CapsuleDef> } }
  | { name: 'placeInZone'; args: { itemId: string; zoneId: string | null } }
  | { name: 'deleteItem'; args: { itemId: string } }

// ─── Événements ─────────────────────────────────────────────────────────────

export type ControllerEvent =
  | { type: 'CREATE_MODE_ENTER'; itemType: ItemType }
  | { type: 'CREATE_COMMIT' }
  | { type: 'CREATE_CANCEL' }
  | { type: 'SELECT_ITEM'; itemIds: string[]; keyframeId?: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'TOGGLE_ZONES_VISIBLE' }
  | { type: 'SET_EDIT_GESTURE'; gesture: 'zone' | 'position' | null }
  | { type: 'OPEN_PANEL'; panel: EditPanel }
  | { type: 'CLOSE_PANEL'; panel: EditPanel }
  | { type: 'LOAD_SCENE'; sceneId: string }
  | { type: 'SCENE_LOADED'; scene: EditorScene }
  | { type: 'RUN_COMMAND'; command: Command }
  | { type: 'RUN_TRANSACTION'; commands: Command[] }
