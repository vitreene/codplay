import type { CompiledScene } from '../builder/types'
import type { PlayerStateSnapshot } from '../player/types'
import type { StrapCollection, StrapMeta } from '../player/strap-types'
import type { DeepReadonly, StoryEvent } from '../player/helper-types'

export type DataScene = {
  /** Artefact compilé produit par le builder (peut être importé depuis JSON). */
  compiled: CompiledScene
  /** Straps et fonctions de transformation — le seul JS nécessaire en diffusion. */
  straps?: StrapCollection
  /** Préfixe appliqué à toutes les URLs du ResourceManifest. */
  resourceBaseUrl?: string
}

export type PlayerHookResult =
  | undefined
  | { status: 'success' }
  | { status: 'error'; code?: string }

export type PlayerHookInput = {
  event: StoryEvent
  state: DeepReadonly<Record<string, unknown>>
  meta: StrapMeta
}

/** Handler d'effet de bord externe. Pas d'accès aux helpers, retour restreint. */
export type PlayerHookFn = (input: PlayerHookInput) => Promise<PlayerHookResult> | PlayerHookResult

export type BroadcastPlayerApi = {
  /** Lance la lecture. Au premier appel, initialise et monte la scène. */
  play(): Promise<void>
  /** Met en pause. */
  pause(): Promise<void>
  /** Déplace la tête de lecture à `ms`. */
  seek(ms: number): Promise<void>
  /** Émet un événement dans la pipeline de la scène. */
  emit(event: StoryEvent): Promise<void>
  /** Snapshot de l'état courant du player. */
  getState(): PlayerStateSnapshot
  /** Abonne un listener aux changements d'état. Retourne la fonction de désabonnement. */
  onChange(listener: (state: PlayerStateSnapshot) => void): () => void
  /**
   * Enregistre un hook externe sur un événement scène.
   * Doit être appelé avant le premier play().
   * Retourne la fonction de désabonnement.
   */
  on(eventName: string, fn: PlayerHookFn): () => void
  /** Détruit le runtime. */
  destroy(): Promise<void>
}
