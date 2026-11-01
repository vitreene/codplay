/**
 * Contexte et événements du contrôleur central — `specs/editor-v2-integration-spec.md`.
 */

import type { CapsuleDef, Content, Decor, EditorScene, ItemType, OffsetData, Orientation, RootPlacementMode, ZoneRect } from '../commands/types'
import type { SequenceEditorCommand } from '../../sequence-editor/commands'

// ─── Sélection ──────────────────────────────────────────────────────────────

/** Sélection indexée par id stable (jamais par référence DOM), survit à un rebuild/seek qui détruit le node. */
export interface Selection {
  itemIds: string[]
  keyframeId?: string
}

export type AuthoringMode = 'zone' | 'block'

export const EMPTY_SELECTION: Selection = { itemIds: [] }

// ─── Panneaux ───────────────────────────────────────────────────────────────

/** Le modèle regroupe décor (dedit), capsule (CapsuleDef), contenu (Content). */
export type EditPanel = 'decor' | 'capsule' | 'content'

// ─── Métadonnées de scène — cycle de vie multi-documents ──────────────

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
  /** Selected zone id for the active zone-editing surface; UI state only, never persisted. */
  selectedZoneId: string | null
  /** Active target for the selection tool; null retains the existing unscoped editor behavior. */
  authoringMode: AuthoringMode | null
  /** Whether the zone overlay is hidden while the selection tool edits blocks. */
  hideZonesInBlockMode: boolean
  openPanels: EditPanel[]
  editGesture: 'zone' | 'offset' | null
  zonesVisible: boolean
  /** Le type en cours de création pendant l'état `creating` — `null` en dehors de ce mode. */
  creatingType: ItemType | null
  /** Placement racine sélectionné pour le tracé courant — `null` en dehors de ce mode. */
  creatingPlacementMode: RootPlacementMode | null
}

// ─── Commandes de la façade — vocabulaire fermé, jamais une mutation arbitraire ─────────

/**
 * Une entrée par commande de `commands/facade.ts` — union discriminée sur `name` pour que la
 * machine ne sache dispatcher QUE vers le vocabulaire de la façade, voie d'écriture unique,
 * jamais vers une fonction de mutation arbitraire fournie par l'appelant.
 *
 * Composée de deux bibliothèques de commandes pures (jamais deux voies d'écriture — la façade
 * centrale reste l'unique possesseur de `scene` qui les invoque, `specs/editor-v2-integration-spec.md) : les commandes de structure du document ci-dessous (`base-commands.ts`),
 * et `SequenceEditorCommand` (`sequence-editor/commands.ts`) — le vocabulaire spécifique à la
 * mécanique timeline (keyframes, marqueurs, visibilité de piste, durée de scène), possédé par le
 * module sequence-editor plutôt que d'engorger ce vocabulaire central déjà documenté comme fermé.
 */
export type Command =
  | { name: 'createItem'; args: { geometry: OffsetData; parentId?: string | null; zoneId?: string } }
  | { name: 'setRootPlacementMode'; args: { mode: RootPlacementMode } }
  | { name: 'createRootZone'; args: { zoneId: string; area: ZoneRect } }
  | { name: 'setRootZonesSurface'; args: { orientation: 'portrait' | 'landscape'; zones: readonly { id: string; name: string; area: ZoneRect }[] } }
  | { name: 'setZonesSurface'; args: { capsuleId: string | null; orientation: Orientation; zones: readonly { id: string; name: string; area: ZoneRect }[] } }
  | { name: 'assignType'; args: { itemId: string; type: ItemType } }
  | { name: 'assignContent'; args: { itemId: string; content: Omit<Content, 'id'> } }
  | { name: 'attachItem'; args: { itemId: string; parentId: string | null; order?: string } }
  | { name: 'setDecor'; args: { decorId: string; patch: Partial<Omit<Decor, 'id'>> } }
  | { name: 'registerDecor'; args: { decorId: string } }
  | { name: 'createKeyframe'; args: { itemId: string; timeMs: number; decorId?: string } }
  | { name: 'createCapsule'; args: { geometry: OffsetData; capsuleDef: CapsuleDef; parentId?: string | null } }
  | { name: 'setCapsuleDef'; args: { itemId: string; patch: Partial<CapsuleDef> } }
  | { name: 'placeInZone'; args: { itemId: string; zoneId: string | null } }
  | { name: 'deleteItem'; args: { itemId: string } }
  | SequenceEditorCommand

// ─── Événements ─────────────────────────────────────────────────────────────

export type ControllerEvent =
  | { type: 'CREATE_MODE_ENTER'; itemType: ItemType; placementMode: RootPlacementMode }
  | { type: 'CREATE_COMMIT' }
  | { type: 'CREATE_CANCEL' }
  | { type: 'SELECT_ITEM'; itemIds: string[]; keyframeId?: string }
  | { type: 'SELECT_ZONE'; zoneId: string | null }
  | { type: 'SET_AUTHORING_MODE'; mode: AuthoringMode }
  | { type: 'SET_HIDE_ZONES_IN_BLOCK_MODE'; hidden: boolean }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'TOGGLE_ZONES_VISIBLE' }
  | { type: 'SET_EDIT_GESTURE'; gesture: 'zone' | 'offset' | null }
  | { type: 'OPEN_PANEL'; panel: EditPanel }
  | { type: 'CLOSE_PANEL'; panel: EditPanel }
  | { type: 'LOAD_SCENE'; sceneId: string }
  | { type: 'SCENE_LOADED'; scene: EditorScene }
  /** Restores a history endpoint through the document owner's existing commit path. */
  | { type: 'RESTORE_DOCUMENT'; scene: EditorScene; selection: Selection }
  /** Flushes application modules' current phases before Undo or Redo is applied. */
  | { type: 'HISTORY_BOUNDARY' }
  | { type: 'RUN_COMMAND'; command: Command }
  | { type: 'RUN_TRANSACTION'; commands: Command[] }
  /** Relais pur, `playheadMs` reste possédé par `sequence-editor` (seul écrivain, jamais stocké ici). */
  | { type: 'SEEK'; timelineMs: number }
  /**
   * Fin explicite d'un scrub auteur (`pointerup`). Le seek continu reste un simple relais ; cette
   * frontière permet au contrôleur de dériver la sélection du keyframe sans la faire varier pendant
   * le geste.
   */
  | { type: 'SEEK_RELEASED'; timelineMs: number }
  /**
   * Envoyé par `scenePlayer` une fois que `telco.seek()` (asynchrone) a réellement fini d'appliquer
   * la position au DOM — jamais au moment de la demande (`SEEK`/`'seek'`, synchrone, émis AVANT que
   * le seek asynchrone n'ait eu lieu). `decor-editor-bridge.ts` en a besoin pour re-résoudre la
   * palette après coup : lue au moment de `'seek'`, elle capturait systématiquement l'état
   * D'AVANT le seek (bug constaté en direct — la couleur d'un décor temporaire restait figée sur
   * le keyframe précédent alors que la position progressait normalement). Le CS lit sa pose depuis
   * la `PresentationFrame` runtime à ce même rendez-vous ; il ne relit pas le path côté éditeur et
   * ne déclenche pas un second appel `telco.seek()`.
   */
  | { type: 'SEEK_APPLIED' }
  /**
   * Envoyé par tout point d'entrée `telco` (`onPlayClick` aujourd'hui — même besoin pour un futur
   * stop/rewind/setRate direct, `2026-07-17` remarque utilisateur : « patron commun, pas besoin de
   * dupliquer le flush ») juste AVANT l'appel `telco.*`, jamais après. Une édition dedit tout juste
   * faite peut encore être dans `pendingCommands` (commit de fin de phase) : sans ce signal, le
   * document et l'instance conservés pour cette action ne verraient pas la mutation, contrairement
   * à un `SEEK` qui flush déjà via l'event `'seek'` (changement de sélection/lecture de tête). Si la
   * scène change réellement, `sceneCommitted` déclenche ensuite le rebuild unique nécessaire ; un
   * simple Play n'en déclenche aucun.
   */
  | { type: 'TELCO_ACTION_REQUEST' }
  /**
   * Émis juste avant tout `telco.pause()` — geste explicite (clic Play/Pause) ou pause automatique
   * en fin de scène (`sequence-editor/mount.ts::syncFromTelco`). Fait sortir l'état `playing`
   * (voir la spécification d'intégration Editor V2) — entrée ET sortie au niveau du GESTE
   * éditeur, jamais du statut brut du transport. `SEEK` (déjà un event racine) sert de second signal de sortie,
   * géré directement dans l'état `playing` — couvre Stop (`onStopClick` → seek 0) et le scrub
   * pendant la lecture.
   */
  | { type: 'TELCO_PAUSE_REQUEST'; timelineMs?: number }
  /**
   * Abandon de phase (Échap) — envoyé par le pont `decorEditor` quand une édition en attente
   * (`pendingCommands`) est jetée sans commit (voir la spécification d'intégration Editor V2).
   * Ne mute jamais `context.scene` (rien n'a été committé) — sert uniquement à
   * déclencher `sceneReverted`, qui force le pont `scenePlayer` à rejouer le document inchangé et
   * ainsi effacer toute preview live désormais périmée.
   */
  | { type: 'PHASE_ABORT' }

// ─── Événements émis — les ponts utilisent machine.on aux frontières utiles, pas subscribe sur chaque snapshot. ───

export type ControllerEmitted =
  | { type: 'sceneCommitted'; scene: EditorScene; selection: Selection }
  | { type: 'sceneLoaded'; scene: EditorScene }
  | {
      type: 'documentCommitted'
      beforeScene: EditorScene
      afterScene: EditorScene
      beforeSelection: Selection
      afterSelection: Selection
    }
  | { type: 'historyBoundary' }
  | { type: 'seek'; timelineMs: number }
  /** Réponse à `SEEK_APPLIED` — `decor-editor-bridge.ts` s'y abonne pour re-résoudre la palette une fois le seek réellement appliqué au DOM (jamais au moment de la demande, cf. `SEEK_APPLIED`). */
  | { type: 'seekApplied' }
  /** Émis en réponse à `TELCO_ACTION_REQUEST` — `decor-editor-bridge.ts` s'y abonne comme sur `'seek'` (même `flushNow`). */
  | { type: 'flushPending' }
  /** Réponse à `PHASE_ABORT` — `scene` est le document INCHANGÉ (rien n'a été committé). */
  | { type: 'sceneReverted'; scene: EditorScene }
  /**
   * Émis à l'entrée ET à la sortie de l'état `playing` (`specs/editor-v2-integration-spec.md`) — `decorEditor` suspend/réactive sa preview live ; `scenePlayer` ne
   * remplace l'instance que lorsqu'un `sceneCommitted` l'exige et la conserve pour un simple
   * Play/Seek.
   */
  | { type: 'playbackActiveChanged'; active: boolean }
  | { type: 'creationModeChanged'; mode: { itemType: ItemType; placementMode: RootPlacementMode } | null }
