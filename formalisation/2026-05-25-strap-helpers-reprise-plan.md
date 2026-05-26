# Strap Helpers Reprise Plan

Date: 2026-05-25

## Contexte

- La correction precedente de S4 etait une mauvaise direction.
- Le vrai sujet est l'alignement des helpers runtime avec la spec strap.
- `player.schedule` ne doit pas etre casse: il reste valide dans son contexte.
- Il faut separer:
  1. un noyau helper interne neutre
  2. un wrapper runtime actif `player.schedule`
  3. un wrapper auteur `context.helpers` pour straps

## Spec fixee

- `state` dans les straps et callbacks helper est `DeepReadonly`
- mutation uniquement via `update`
- helpers supportent `planned|jit`
- `mode` incompatible => warning + fallback
- callbacks acceptent valeur directe, liste, ou factory
- callback recoit `currentTimeMs`, `startedAtMs`, `elapsedMs`, `index`, `state`
- `wait` alias `delay`
- `repeat` utilise `eachMs`
- `stagger` coherent avec les autres helpers
- `loop`:
  - `eachMs` obligatoire
  - condition de sortie obligatoire
  - premiere occurrence a `t0`
  - stop au premier match
  - `until.event` interrompt seulement ce loop
  - `sequence:end` interrompt toujours tous les loops
  - `duration.maxMs` est inclusive
- helpers strap V1: `event` et `update` seulement, pas `effect`
- `seek` ne reexecute jamais les helpers, il rejoue uniquement les sorties materialisees

## Travail a faire

1. Ecrire et adapter les types partages helpers.
2. Introduire le noyau helper interne partage.
3. Garder `player.schedule` comme wrapper runtime actif.
4. Refaire `context.helpers` comme wrapper strap materialisable.
5. Exposer `state` en `DeepReadonly` dans les straps.
6. Corriger S4 pour reposer sur ces helpers.
7. Remettre les tests S4 selon le comportement attendu reel.
8. Ajouter des tests helpers `planned/jit`, fallback, readonly state, loop stop by event, `sequence:end`.

## Fichiers probablement touches

- `src/player/player.ts`
- `src/player/player-schedule.ts`
- `src/player/strap-types.ts`
- un nouveau module helper interne partage
- `src/demos/scenes/s4-quiz-reference-scene.ts`
- tests helpers et tests S4

## Point d'attention

- ne pas faire de simple bricolage scene-specifique
- corriger la librairie d'abord
- S4 n'est qu'un consumer de reference
