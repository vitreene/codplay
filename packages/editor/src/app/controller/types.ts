/**
 * Contexte et événements du contrôleur central — `plan/app/2026-07-12-app-controller-definition.md`.
 */

import type { CapsuleDef, Content, Decor, EditorScene, ItemType, OffsetData } from '../commands/types'
import type { SequenceEditorCommand } from '../../sequence-editor/commands'
import type { AuthorApi } from '@codplay/selection-frame'
import type { OffsetEditorBridge } from '../../decor-editor/types'

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
  editGesture: 'zone' | 'offset' | null
  zonesVisible: boolean
  /** Le type en cours de création pendant l'état `creating` — `null` en dehors de ce mode. */
  creatingType: ItemType | null

  /**
   * Posé une fois par le pont `scenePlayer` après son premier rebuild réussi (§7 étape 4) — le pont
   * `decorEditor` en a besoin pour `subscribeToNode` (preview live) ; jamais recréé par la suite,
   * `studio.player` reste la même instance à travers tous les rebuilds.
   */
  authorApi: AuthorApi | null
  /** Largeur réelle (px) du substrat de scène rendu — conversion cqw↔px côté dedit (spec text-auto-size). */
  referenceWidthPx: number
  /**
   * Posé une fois par le pont `scenePlayer`, en même temps qu'`authorApi` (§7 étape 4) — le pont
   * `decorEditor` est le SEUL consommateur (`2026-07-16-position-bridge-reconciliation-plan.md`
   * §Étape A) : dedit reste le seul interlocuteur de l'app pour le décor, l'offset ne doit jamais
   * apparaître comme un pont indépendant que l'app câblerait elle-même.
   */
  offsetBridge: OffsetEditorBridge | null
}

// ─── Commandes de la façade (§4.1 — vocabulaire fermé, jamais une mutation arbitraire) ─────────

/**
 * Une entrée par commande de `commands/facade.ts` — union discriminée sur `name` pour que la
 * machine ne sache dispatcher QUE vers le vocabulaire de la façade (§4 « voie d'écriture unique »),
 * jamais vers une fonction de mutation arbitraire fournie par l'appelant.
 *
 * Composée de deux bibliothèques de commandes pures (jamais deux voies d'écriture — la façade
 * centrale reste l'unique possesseur de `scene` qui les invoque, `2026-07-13-controller-islands-
 * bridge-plan.md` §3bis) : les commandes de structure du document ci-dessous (`base-commands.ts`),
 * et `SequenceEditorCommand` (`sequence-editor/commands.ts`) — le vocabulaire spécifique à la
 * mécanique timeline (keyframes, marqueurs, visibilité de piste, durée de scène), possédé par le
 * module sequence-editor plutôt que d'engorger ce vocabulaire central déjà documenté comme fermé.
 */
export type Command =
  | { name: 'createItem'; args: { geometry: OffsetData; parentId?: string | null } }
  | { name: 'assignType'; args: { itemId: string; type: ItemType } }
  | { name: 'assignContent'; args: { itemId: string; content: Omit<Content, 'id'> } }
  | { name: 'attachItem'; args: { itemId: string; parentId: string | null; order?: string } }
  | { name: 'setDecor'; args: { decorId: string; patch: Partial<Omit<Decor, 'id'>> } }
  | { name: 'createKeyframe'; args: { itemId: string; timeMs: number; decorId?: string } }
  | { name: 'createCapsule'; args: { geometry: OffsetData; capsuleDef: CapsuleDef; parentId?: string | null } }
  | { name: 'setCapsuleDef'; args: { itemId: string; patch: Partial<CapsuleDef> } }
  | { name: 'placeInZone'; args: { itemId: string; zoneId: string | null } }
  | { name: 'deleteItem'; args: { itemId: string } }
  | SequenceEditorCommand

// ─── Événements ─────────────────────────────────────────────────────────────

export type ControllerEvent =
  | { type: 'CREATE_MODE_ENTER'; itemType: ItemType }
  | { type: 'CREATE_COMMIT' }
  | { type: 'CREATE_CANCEL' }
  | { type: 'SELECT_ITEM'; itemIds: string[]; keyframeId?: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'TOGGLE_ZONES_VISIBLE' }
  | { type: 'SET_EDIT_GESTURE'; gesture: 'zone' | 'offset' | null }
  | { type: 'OPEN_PANEL'; panel: EditPanel }
  | { type: 'CLOSE_PANEL'; panel: EditPanel }
  | { type: 'LOAD_SCENE'; sceneId: string }
  | { type: 'SCENE_LOADED'; scene: EditorScene }
  | { type: 'RUN_COMMAND'; command: Command }
  | { type: 'RUN_TRANSACTION'; commands: Command[] }
  /** §7 étape 5 — relais pur, `playheadMs` reste possédé par `sequence-editor` (seul écrivain, jamais stocké ici). */
  | { type: 'SEEK'; timelineMs: number }
  /** §7 étape 4 — envoyé une fois par le pont `scenePlayer` (voir `ControllerContext.authorApi`). */
  | { type: 'PLAYER_READY'; authorApi: AuthorApi; referenceWidthPx: number; offsetBridge: OffsetEditorBridge }

// ─── Événements émis (§"modules de câblage impératifs", `2026-07-13-controller-islands-bridge-
// plan.md` §3) — un pont s'y abonne via `machine.on(...)`, jamais via `subscribe()` sur chaque
// snapshot : seuls ces moments comptent pour resynchroniser un îlot. ─────────────────────────

export type ControllerEmitted =
  | { type: 'sceneCommitted'; scene: EditorScene; selection: Selection }
  | { type: 'sceneLoaded'; scene: EditorScene }
  | { type: 'seek'; timelineMs: number }
  | { type: 'authorApiReady'; authorApi: AuthorApi; referenceWidthPx: number; offsetBridge: OffsetEditorBridge }
