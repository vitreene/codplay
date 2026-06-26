# Journal de bugs — quiz-hunt

Statut : à traiter. Bugs de code de démo (pas de gap CodPlay) constatés en lisant
`stories/`, `straps/`, `index.ts`, `seed.ts` et en confrontant au plan
`docs/formalisation/2026-06-19-quiz-hunt-plan.md`.

---

## 1. Double boucle du timer après la première épreuve — CORRIGÉ (2026-06-26)

**Statut** : corrigé. `game-timer.ts` n'utilise plus `context.live.loop` ; un seul minuteur
d'expiration ponctuel (`context.live.wait`) à la fois, toujours annulé avant tout nouveau départ,
plus une `TweenAction` pour l'affichage continu (jauge + libellé). Nécessite un petit ajout côté
CodPlay (`StrapMeta.ms`, transmis par `player.ts`) pour calculer le temps restant exact sans
boucle. Détail : `docs/formalisation/2026-06-26-quiz-hunt-timer-tween-fix-plan.md`. Vérifié par
tests ciblés (scénario exact du bug : resume sans pause intermédiaire → un seul minuteur actif,
temps restant strictement décroissant) + suite complète 236/236, gates 21/21.

**Fichiers (état avant correction)** : `straps/game-router.ts:35-38`, `straps/game-trial-resolve.ts:45`, `straps/game-timer.ts:46-61`

- `game-router.ts` n'émet `game:timer:start` qu'au tout premier `game:trial:open`
  (`state.timerStarted === false`) ; tout accès suivant émet `game:timer:pause`.
- `game-trial-resolve.ts` émet **toujours** `game:timer:resume` à la fermeture
  d'une épreuve — y compris après la première, qui n'a jamais reçu de `pause`.
- `game-timer.ts` ne conserve aucun `HelperHandle` du `context.live.loop` lancé par
  `startTick` : `game:timer:resume` relance une nouvelle boucle sans annuler celle
  démarrée par `game:timer:start`.

**Effet** : entre la fermeture de la 1ère épreuve et l'ouverture de la 2ème (qui
seule émettra le `pause` arrêtant les deux boucles), **deux boucles de
décompte tournent en parallèle** et écrivent toutes les deux `timerRemainingMs`.
Le timer affiché peut visiblement remonter puis redescendre, et peut déclencher
`game:timer:expired` en double (donc `game:result:show` / `game-report` en double)
si le joueur reste sur la grille après la 1ère épreuve.

**Vérifié** : reproduit avec `PlayerScheduleFacade` (même moteur que
`context.live.loop`) en mimant exactement `startTick` : séquence de "remaining"
obtenue `[1000, 750, 750, 250, 500, 0, 250]` — non monotone, donc bien deux
boucles concurrentes.

**Piste** (non appliquée) : soit ne pas émettre `game:timer:resume` après la
toute première épreuve (miroir exact de la condition `start`/`pause` de
`game-router`), soit conserver le `HelperHandle` retourné par `context.live.loop`
dans l'état et le `cancel()` avant tout nouveau `startTick`.

> Voir `PRATIQUES.md` n°1 : la cause racine est le choix de `context.live.loop`
> pour porter une valeur continue. En remplaçant `startTick` par une
> `TweenAction` (pattern `chrono-story.ts`), ce bug disparaît de lui-même —
> `tween:stop` interrompt atomiquement tous les tweens actifs, sans handle à
> suivre manuellement.

---

## 2. Le retry via jeton de rattrapage ne réinitialise jamais l'épreuve — event mort

**Fichiers** : `stories/trials/build-reading-quiz.ts:26,87,107-108`,
`stories/answer-persos.ts:34,54,70,110,134`, `straps/game-router.ts:28-30`

- `build-reading-quiz.ts` définit `retryEventName = game:trial:{wordId}:retry` et
  le branche comme action de remise à zéro sur : le fieldset (`disabled:false`),
  chaque input réponse (`checked:false, disabled:false, visualState:'idle'`),
  les icônes de sélection/correction (`content:''`), le bouton valider
  (`disabled:true`) et le texte de résultat (`hidden:true`).
- **Rien n'émet jamais cet event.** Recherche exhaustive dans
  `packages/demos/src/scenes/quiz-hunt/` : aucun `emit` perso ni aucun strap ne
  produit `game:trial:{wordId}:retry`.
- Le seul endroit plausible, `game-router.ts` (`unlockEvents`, déclenché quand
  `status === 'fail' && extraToken`), n'émet que
  `game:grid:tile:{trialId}:unlocked` (le visuel de la tuile grille) — jamais
  l'event de reset de l'épreuve elle-même.

**Effet** : le déblocage de la tuile (visuel grille) fonctionne, mais en
rouvrant l'épreuve le panneau garde l'état de la tentative précédente :
fieldset désactivé, réponses cochées, icônes de correction affichées, message
"Mauvaise réponse" toujours visible. Le joueur ne peut pas effectivement
retenter l'épreuve malgré le jeton consommé.

**Cohérence avec le plan** : `2026-06-19-quiz-hunt-plan.md` §"Conséquence pour
le retry" décrit exactement ce mécanisme (event dédié par trial, reset par
actions persos pures, pas de strap) — le câblage côté persos a été fait, pas
l'émission de l'event déclencheur.

**Piste** (non appliquée) : ajouter `{ name: retryEventName }` (ou
`game:trial:${trialId}:retry`) à `unlockEvents` dans `game-router.ts`, à côté de
l'event de déblocage de la tuile grille.

---

## Pistes non encore explorées

Audit interrompu avant de couvrir : flux final/résultat (`game-final-route.ts`,
`game-result.ts`), déterminisme de la graine (`seed.ts`/`deriveGameDraw`), cas
limites du panier. À reprendre si besoin.
