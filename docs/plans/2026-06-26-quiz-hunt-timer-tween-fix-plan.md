# Plan — corriger le bug n°1 (double boucle timer) via `TweenAction`

## Statut

**Implémenté (2026-06-26).** `StrapMeta.ms` ajouté (`strap-types.ts`), transmis depuis
`scope.ms` dans `executeStrap` (`player.ts`) ; `game-timer.ts` réécrit selon ce plan. `BUGS.md`
n°1 marqué corrigé.

**Régression corrigée dans la foulée (même jour)** : la conception initiale ci-dessous ne
calculait le temps écoulé que dans la branche `pause`/`stop`. Or la 1ère épreuve s'ouvre par
`start` (pas `pause`) et se referme par `resume` (jamais `pause`) — rien ne recalculait
`timerRemainingMs` entre les deux, donc `resume` repartait avec la durée totale intacte (timer
visuellement "réinitialisé" après la 1ère réponse). Fix : le calcul de l'écoulé s'applique à
**chaque** event reçu (voir le code final de `game-timer.ts` — une seule passe de calcul de
l'écoulé en tête de fonction, avant de brancher sur le nom de l'event), pas seulement
`pause`/`stop`. Vérifié : suite complète 236/236, gates 21/21, tests ciblés couvrant le bug
original (double minuteur) et cette régression (`start` → `resume` direct sans `pause`).

## Contexte

- Bug constaté : `packages/demos/src/scenes/quiz-hunt/BUGS.md` n°1 — l'event
  `game:timer:resume` relance systématiquement une nouvelle boucle de minuterie
  (`context.live.loop`, dans `game-timer.ts:53-57`) sans annuler celle démarrée par
  `game:timer:start`. Deux boucles tournent alors en même temps entre la fermeture de la 1ère
  épreuve et la 2ème ouverture, et le décompte affiché part dans tous les sens.
- Pratique visée : `PRATIQUES.md` n°1 — un strap (une fonction qui réagit à un event nommé,
  dans le vocabulaire CodPlay) ne devrait émettre que des events de changement d'état
  (`start`/`pause`/`resume`/`stop`), pas une boucle qui réémet un event toutes les 250
  millisecondes. La valeur qui varie en continu (le décompte affiché, la jauge) devrait être
  portée par une **`TweenAction`** : un type d'action CodPlay où on fournit une fonction pure
  `fn(progress)` (`progress` allant de 0 à 1) plus une durée, et c'est le moteur d'affichage de
  CodPlay — pas le strap — qui appelle cette fonction en continu pour produire le rendu, sans
  jamais ré-exécuter le strap.

## Le problème technique à résoudre avant de pouvoir appliquer la pratique

Le strap qui gère le timer a besoin, au moment où il reçoit l'event `game:timer:pause`, de
savoir **combien de temps s'est réellement écoulé** depuis le dernier `start`/`resume`, pour
mémoriser le temps restant exact (utilisé au prochain `resume`).

Or, vérifié dans le code (`strap-types.ts:4-10` et `:76-81`) : quand un strap est appelé sur un
event ordinaire comme `game:timer:pause`, **il ne reçoit aucune information sur l'instant
présent dans la timeline de la scène**. Il reçoit seulement le nom de l'event, ses données, et
l'état de la scène — pas "à quel moment, en millisecondes depuis le début de la scène, sommes-nous
actuellement". C'est ce manque précis qui obligeait l'auteur original à utiliser une boucle
répétée (`context.live.loop`) : c'est aujourd'hui le seul mécanisme qui donne au code du strap
un temps écoulé, et seulement à l'intérieur de chaque répétition de la boucle.

Une `TweenAction` seule ne résout pas ce manque : sa fonction `fn` est volontairement "pure"
(elle ne lit ni n'écrit rien dans l'état de la scène, elle ne fait que calculer un style/contenu
visuel à partir de `progress`) — elle ne peut donc pas servir à mémoriser le temps restant dans
l'état de la scène.

## Décision : ajout retenu côté CodPlay (l'instant présent transmis au strap)

Plutôt que de garder une boucle répétée comme solution de contournement côté démo, on corrige le
manque à sa source : on donne au strap accès à l'instant présent de la timeline, en millisecondes,
au moment où il est appelé.

Concrètement :

- Le joueur interne de CodPlay (`player.ts`) connaît déjà cet instant présent pour chaque event
  qu'il traite (variable interne `scope.ms`, déjà calculée aux lignes 1045-1066 de `player.ts`,
  mais aujourd'hui utilisée seulement en interne, jamais transmise au strap).
- On ajoute un champ `ms` à l'objet `meta` que CodPlay transmet à chaque strap (défini aujourd'hui
  dans `strap-types.ts:4-10`, qui ne contient que `originEventName`/`origin`). `meta.ms` portera
  cet instant présent, en millisecondes depuis le début de la scène.
- C'est un ajout, pas un changement de comportement existant : tout le code qui n'utilise pas
  `meta.ms` continue de fonctionner identiquement.

Avec ça, le strap du timer peut calculer directement, sans aucune boucle :
`temps_restant = temps_restant_au_dernier_départ − (meta.ms − instant_du_dernier_départ)`.

## Conception du strap `game-timer.ts` avec cet ajout

Vocabulaire utilisé ci-dessous (défini une fois, pour éviter tout mot anglais non expliqué) :

- **minuteur d'expiration** : un seul event différé programmé pour se déclencher automatiquement
  après N millisecondes (ici, `game:timer:expired`), via `context.live.wait(...)` — l'outil
  CodPlay pour "déclenche cet event une seule fois, dans N ms". Il retourne un objet qui permet
  de l'annuler avant qu'il ne se déclenche (`.cancel()`), ce qui sert sur `pause`/`stop`.
- **segment** : la période entre un `start`/`resume` et le `pause`/`stop`/expiration suivant.

Déroulé :

1. **`game:timer:start`** (tout premier départ) :
   - `remaining = totalMs` (durée totale du jeu).
   - mémorise dans l'état de la scène : `segmentStartedAtMs = meta.ms`, `timerRemainingMs = remaining`.
   - programme le minuteur d'expiration : `context.live.wait(remaining, { event: { name: 'game:timer:expired' } })`, garde l'objet retourné pour pouvoir l'annuler plus tard.
   - émet un event par perso animé (`game-timer-fill`, `game-timer-label`) portant une `TweenAction` (`duration: remaining`, `fn` calcule la largeur de la jauge / le texte du décompte à partir de `progress`).

2. **`game:timer:resume`** : identique au point 1, mais `remaining = state.timerRemainingMs` (la valeur mémorisée au dernier `pause`).

3. **`game:timer:pause`** ou **`game:timer:stop`** :
   - calcule `elapsed = meta.ms - state.segmentStartedAtMs`.
   - calcule `remaining = max(0, state.timerRemainingMs - elapsed)` et le mémorise dans l'état.
   - annule le minuteur d'expiration en cours (`.cancel()` sur l'objet gardé à l'étape 1/2) — **avant** d'en programmer un nouveau, ce qui empêche structurellement le bug n°1 (il ne peut plus jamais y avoir deux minuteurs actifs en même temps, puisqu'il n'y a plus de boucle répétée du tout, seulement un seul minuteur ponctuel à la fois).
   - émet `{ name: 'tween:stop' }` pour figer l'affichage (jauge + texte) à sa valeur actuelle — `tween:stop` est le nom d'event réservé de CodPlay qui interrompt tout rendu animé en cours sur un perso (`v1-tween-action-spec.md` §11).

Plus aucune boucle répétée (`context.live.loop`) dans `game-timer.ts`.

### `stories/timer-story.ts` — personas

Aucun changement requis : `game-timer-label` (`actions: { "game:timer:label": {} }`) et
`game-timer-fill` (`actions: { "game:timer:fill": {} }`) sont déjà écrits sous une forme qui
laisse l'event porter directement le contenu de l'action — c'est exactement la forme attendue
par une `TweenAction` transmise via `event.data` (`v1-tween-action-spec.md`,
section "event.data comme porteur de TweenAction").

### `game-router.ts` / `game-trial-resolve.ts`

Aucun changement : ils émettent déjà `game:timer:start`/`pause`/`resume`/`stop` par leur nom,
sans connaître comment le strap qui les traite est construit à l'intérieur.

## Étapes

1. **Côté CodPlay (cœur, pas la démo)** : ajouter `ms: number` à `StrapMeta`
   (`packages/codplay/src/player/strap-types.ts:4-10`) ; le remplir avec `scope.ms` dans
   `executeStrap` (`packages/codplay/src/player/player.ts:1055-1065`). Vérifier qu'aucun test
   existant ne dépend de la forme exacte de `meta` (recherche des usages de `meta.origin`).
2. Écrire les deux fonctions qui calculent le contenu de chaque `TweenAction` (jauge, texte du
   décompte) à partir de `progress`, dans `game-timer.ts`.
3. Réécrire `createGameTimerStrap` selon le déroulé décrit ci-dessus (4 branches :
   `start`/`resume`/`pause`/`stop`, plus aucune boucle).
4. Vérifier manuellement (via `/run` ou un test ciblé) le scénario exact du bug n°1 : ouvrir la
   1ère épreuve, la refermer sans en ouvrir d'autre tout de suite, vérifier que le décompte
   affiché ne remonte jamais et ne saute jamais en arrière.
5. Écrire un test qui rejoue ce même scénario et vérifie qu'un seul minuteur d'expiration est
   actif à la fois, et que `timerRemainingMs` décroît de façon strictement monotone sur un cycle
   `start → pause → resume` sans aucune épreuve intermédiaire.
6. Mettre à jour `BUGS.md` n°1 (statut : corrigé, référence à ce plan) une fois validé.

## Hors scope

- Ne touche pas au bug n°2 (`BUGS.md`, retry mort) ni aux autres items de `PRATIQUES.md`.
- L'ajout `meta.ms` est volontairement minimal (un seul champ, lecture seule, rétrocompatible) —
  ne touche à aucun autre comportement du joueur CodPlay.
