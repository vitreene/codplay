import { assign, createActor, createMachine } from 'xstate'
import type { DecorPatch } from './types'
import { mergePatch } from './merge'

/**
 * Canal unique geste → Decor (`2026-07-25-decor-unified-channel-plan.md` §2/§3) — remplace les
 * callbacks bruts (`onValues`/`onCommit`/`notifyNow`) par des états explicites, pour que Decor
 * consulte un ÉTAT plutôt que de s'abonner à des notifications propres à chaque module producteur
 * (CS/offset, zones, multi-sélection — tous construits sur `TrackedSession`/
 * `createGestureLifecycleMachine`, réutilisés tels quels : cette machine ne gère PAS le cycle de vie
 * du geste lui-même, seulement ce qu'il produit).
 *
 * `idle` (aucune valeur live, Decor lit sa cascade normale) ──VALUES_CHANGED──▶ `live` (`context.patch`
 * porte le dernier `DecorPatch` fusionné, substitué à la cascade pour l'item concerné) ──COMMIT──▶
 * `committing` (le consommateur lit `context.patch` une dernière fois, effectue l'écriture réelle —
 * fork-si-partagé + `setDecor` — puis notifie `WRITTEN`) ──▶ `idle`. `ABORT` depuis `live` revient
 * directement à `idle` sans écriture.
 */

type DecorLiveSessionContext = { patch: DecorPatch }

type DecorLiveSessionEvent =
  | { type: 'VALUES_CHANGED'; patch: DecorPatch }
  | { type: 'COMMIT' }
  | { type: 'ABORT' }
  | { type: 'WRITTEN' }

export type DecorLiveSessionStatus = 'idle' | 'live' | 'committing'

export type DecorLiveSessionSnapshot = {
  status: DecorLiveSessionStatus
  /** Vide hors `live`/`committing` — jamais de valeur résiduelle d'une session précédente. */
  patch: DecorPatch
}

export type DecorLiveSession = {
  /** Producteur (CS/offset, zone, multi-sélection) — un delta de geste. Fusionné sur le patch déjà
   *  accumulé depuis le début de CETTE session (`mergePatch`, jamais un remplacement total). */
  reportValues(patch: DecorPatch): void
  /** Producteur — geste terminé, validé. Passe en `committing` ; le patch reste lisible jusqu'à `notifyWritten()`. */
  commit(): void
  /** Producteur — geste terminé, annulé. Retour direct à `idle`, rien à écrire. */
  abort(): void
  /** Consommateur (Decor) — écriture réelle effectuée pour le patch de `committing`. Referme la session. */
  notifyWritten(): void
  getSnapshot(): DecorLiveSessionSnapshot
  /** Fires immédiatement avec l'état courant, puis à chaque transition — même contrat que `TrackedSession.subscribe`. */
  subscribe(cb: (snapshot: DecorLiveSessionSnapshot) => void): () => void
  destroy(): void
}

const decorLiveSessionMachine = createMachine({
  types: {} as { context: DecorLiveSessionContext; events: DecorLiveSessionEvent },
  id: 'decor-live-session',
  context: { patch: {} },
  initial: 'idle',
  states: {
    idle: {
      on: {
        VALUES_CHANGED: { target: 'live', actions: assign({ patch: ({ event }) => event.patch }) }
      }
    },
    live: {
      on: {
        VALUES_CHANGED: {
          actions: assign({ patch: ({ context, event }) => mergePatch(context.patch, event.patch) })
        },
        COMMIT: { target: 'committing' },
        ABORT: { target: 'idle', actions: assign({ patch: () => ({}) }) }
      }
    },
    committing: {
      on: {
        WRITTEN: { target: 'idle', actions: assign({ patch: () => ({}) }) }
      }
    }
  }
})

export function createDecorLiveSession(): DecorLiveSession {
  const actor = createActor(decorLiveSessionMachine)
  const listeners = new Set<(snapshot: DecorLiveSessionSnapshot) => void>()

  const toSnapshot = (): DecorLiveSessionSnapshot => {
    const snapshot = actor.getSnapshot()
    return { status: snapshot.value as DecorLiveSessionStatus, patch: snapshot.context.patch }
  }

  actor.subscribe(() => {
    const snapshot = toSnapshot()
    for (const cb of listeners) cb(snapshot)
  })

  actor.start()

  return {
    reportValues(patch) {
      actor.send({ type: 'VALUES_CHANGED', patch })
    },
    commit() {
      actor.send({ type: 'COMMIT' })
    },
    abort() {
      actor.send({ type: 'ABORT' })
    },
    notifyWritten() {
      actor.send({ type: 'WRITTEN' })
    },
    getSnapshot: toSnapshot,
    subscribe(cb) {
      listeners.add(cb)
      cb(toSnapshot())
      return () => {
        listeners.delete(cb)
      }
    },
    destroy() {
      actor.stop()
      listeners.clear()
    }
  }
}
