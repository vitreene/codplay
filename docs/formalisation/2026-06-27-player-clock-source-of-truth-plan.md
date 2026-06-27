# Plan — une seule horloge de vérité dans le joueur CodPlay

## Statut

**Non implémenté.** Document de cadrage, distinct du correctif déjà posé pour le bug du panier
de `quiz-hunt` (voir `packages/demos/src/scenes/quiz-hunt/BUGS.md`, section "Investigation du
2026-06-27"). Ce correctif-là ne touche qu'un seul point d'entrée (`Player.emit()`, garde
`drainingDueEvents`) ; ce plan vise la cause structurelle plus large, dans `create-player.ts` et
`core/time/ticker.ts`.

## Constat de départ

Le ticker (`core/time/ticker.ts`, `TimeTicker.runTick`) lit l'horloge réelle **une seule fois par
tick** :

```ts
private runTick(onTick: TickHandler): void {
  const nowMs = this.clock.nowMs()
  const prevMs = this.lastTickMs
  const deltaMs = Math.max(0, nowMs - prevMs)
  onTick({ prevMs, nowMs, deltaMs, marginMs: this.marginMs })
  this.lastTickMs = nowMs
}
```

Ce `nowMs` est transmis à `runPlaybackTick(frameNowMs, frameDeltaMs)`. C'est la seule lecture de
l'horloge réelle qui devrait exister pendant la lecture active.

En pratique, `resolveCurrentTimelineMs()` (`create-player.ts:660-672`) **ignore** ce `frameNowMs`
transmis et relit l'horloge réelle elle-même via `this.runtimePlanner.resolveNowMs()`
(`performance.now()`/`Date.now()`). Cette fonction est appelée depuis de nombreux points du
joueur — y compris depuis du code exécuté en cascade, après plusieurs `await`, longtemps après le
tick qui a déclenché ce traitement. Chaque appel peut donc renvoyer une valeur différente de celle
que le ticker avait produite pour ce tick, et différente des autres appels faits dans le même
tick. C'est cette dérive qui a produit le bug du panier de `quiz-hunt` (voir BUGS.md) : un event
système émis en cascade pendant la purge d'un lot d'events dus se voyait comparé à une horloge qui
avait déjà avancé, et donc classé "rétroactif" à tort, ce qui faisait sauter la fin du lot encore
en attente via `syncCursor`.

Principe retenu pour ce plan (formulé par l'auteur) : **en dehors de la lecture faite par le
ticker à chaque tick, aucun autre appel à l'horloge réelle n'est légitime dans le joueur.** Y
compris pour les events "capturés" (interaction utilisateur en direct) : leur capture relève déjà
du principe central de CodPlay et doit passer par l'horloge du ticker, pas par une lecture
indépendante du système.

## Recensement complet des lectures d'horloge réelle (`resolveNowMs`/`performance.now()`/`Date.now()`)

| Emplacement | Rôle actuel | Statut au regard du principe |
|---|---|---|
| `core/time/ticker.ts` (`TimeTicker.runTick`/`loop`) | Échantillonnage unique par tick, anchors de démarrage/reprise | Légitime — c'est la source |
| `create-player.ts:664` (`resolveCurrentTimelineMs`, branche `fallbackTimelineMs`) | Recalcule la position timeline à partir de l'horloge réelle | À corriger — doit utiliser la valeur du tick, pas relire |
| `create-player.ts:681,1616,2121` (`playbackStartMs = resolveNowMs()`) | Ancre de démarrage/reprise de lecture | Légitime en soi, mais doit être posée à partir du `nowMs` du tick courant si on est dans un tick |
| `create-player.ts:1290,1305,1622,1765,1835,1981` (`renderSync.tick/seek`) | Synchronisation du rendu visuel (fluidité CSS/anime.js) | À auditer — probablement substituable par le `frameNowMs` déjà disponible |
| `runtime/capture-session.ts:44` (`Date.now() - startMs`) | Horodatage d'une interaction capturée en direct | À corriger selon le principe énoncé — doit dériver de l'horloge du joueur, pas d'une lecture système indépendante |
| `runtime/trace-store.ts:107` | Horodatage des lignes du panneau de trace | Cosmétique, sans effet sur la logique — hors périmètre |
| `core/time/clock.ts:26` (`TimeClock`, `nowProvider` par défaut) | Fournisseur injectable, utilisé par le ticker | Légitime — c'est l'implémentation de la source elle-même |

## Mécanisme proposé

1. Le joueur garde trace du `nowMs` du tick courant (un champ, ex. `this.activeTickNowMs:
   number | null`), posé en tête de `runPlaybackTick(frameNowMs, ...)` et remis à `null` à la fin
   du tick (y compris si une exception survient — `try/finally`).
2. `resolveCurrentTimelineMs()` n'appelle `resolveNowMs()` que si `this.activeTickNowMs` est
   `null` (c'est-à-dire : aucun tick en cours — cas d'un appel direct hors lecture, par ex. un test
   qui appelle une méthode publique sans ticker actif). Sinon elle utilise
   `this.activeTickNowMs`.
3. Tout code exécuté en cascade pendant le traitement d'un tick (straps imbriqués, `emit()`
   système ou utilisateur, `renderSync.tick`) passe par cette même fonction et reçoit donc
   automatiquement la valeur figée du tick, sans dérive possible — qu'il y ait eu des `await`
   entre-temps ou non.
4. Avec ce mécanisme générique, le garde-fou `drainingDueEvents` posé pour corriger le bug du
   panier (limité à `emit()`) devient un cas particulier déjà couvert — à réévaluer s'il reste
   nécessaire ou s'il peut être retiré une fois ce mécanisme en place.
5. `capture-session.ts` doit être revu pour dériver son horodatage de cette même source plutôt que
   d'un `Date.now()` indépendant — implique de lui donner accès à l'horloge du joueur (ou de lui
   faire recevoir le `nowMs` en paramètre au moment de la capture, plutôt que de le lire lui-même).

## Risques et points à valider avant d'implémenter

- `renderSync.tick`/`renderSync.seek` sont actuellement appelés avec un `frameNowMs` parfois
  optionnel (`frameNowMs ?? this.runtimePlanner.resolveNowMs()`) — il faut vérifier au cas par cas
  si chaque appel a accès à un `nowMs` de tick valide au moment où il est fait, ou s'il peut être
  légitimement hors tick (ex. un `seek()` appelé en pause, sans lecture active).
- Les tests de seek/replay (`horizon-diagnostics.spec.ts`, `reference-scenes.spec.ts`,
  `scene-bootstrap.spec.ts`) dépendent de la distinction "dans un tick / hors tick" pour les
  comportements de `emit()` — le correctif déjà posé en a cassé 9 dans une première tentative trop
  large (condition sur la source de l'event plutôt que sur le contexte d'exécution). Tout
  changement sur `resolveCurrentTimelineMs()` doit être validé contre la suite complète (236
  tests) avant d'être considéré correct.
- `capture-session.ts` sert un usage réel (capture d'interaction utilisateur) — vérifier avec
  l'auteur la sémantique exacte attendue (granularité, précision) avant de changer sa source de
  temps.

## Prochaine étape

Discuter ce plan avec l'auteur avant toute implémentation (changement du cœur du joueur, hors
périmètre d'une démo). Pas de code à écrire à ce stade.
