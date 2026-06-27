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
boucle. Détail : `docs/formalisation/2026-06-26-quiz-hunt-timer-tween-fix-plan.md`.

**Régression trouvée et corrigée dans le correctif lui-même** : la 1ère version calculait le
temps écoulé seulement dans la branche `pause`/`stop`. Sur la toute première épreuve,
`game-router.ts` émet `start` (pas `pause`) à l'ouverture et `game-trial-resolve.ts` émet
`resume` (jamais `pause`) à la fermeture — donc rien ne recalculait `timerRemainingMs` entre les
deux, et `resume` repartait avec la durée totale intacte : le timer semblait "réinitialisé après
la réponse à la question" pour ce premier cycle précisément (signalé par l'auteur). Fix : le
calcul du temps écoulé du segment en cours s'applique maintenant à **chaque** event reçu, pas
seulement `pause`/`stop` — `resume` ferme correctement le segment précédent qu'il ait été ouvert
par `start` ou par un `resume` antérieur.

Vérifié par tests ciblés (scénario exact du bug original + scénario exact de cette régression :
`start` → `resume` direct sans `pause` → le temps restant doit refléter le temps réellement
écoulé, pas repartir de la durée totale) + suite complète 236/236, gates 21/21.

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

## 3. Message de résultat ("Gagné"/"Perdu") jamais visible après une épreuve — CORRIGÉ (2026-06-26)

**Statut** : corrigé. `quizQuestionStoryStraps` (infra partagée, non modifiée) émet
`quiz:question:answered` et `quiz:question:resolved:correct`/`:incorrect` dans le
même lot d'events, synchrone. Comme `game-trial-resolve.ts` réagissait à
`quiz:question:answered` en masquant le panneau de l'épreuve **dans le même tick**,
le texte de résultat posé sur `${prefix}-result` n'était jamais visible — le panneau
qui le contient disparaissait avant que le navigateur ne peigne quoi que ce soit.
Signalé par l'auteur ("je ne vois pas ce message !").

**Fix** : `game-trial-resolve.ts` retarde maintenant tout ce qui est visuel pour une
épreuve (retour grille, tuile succès/échec, reprise timer, panier) de 2000 ms via
`context.planned.delay` — le texte de résultat, posé immédiatement par l'infra
partagée, reste donc visible 2 secondes avant que le panneau ne se masque. Le timer
reste en pause pendant cette fenêtre (cohérent avec : le timer ne doit être suspendu
que pendant la lecture des contenus). Libellés changés en "Gagné !"/"Perdu"
(`quiz-hunt-demo.ts`). Hors scope : la question finale (pas de retour grille à
retarder). Ajout connexe : coche `✓`/croix `✗` sur le contenu des tuiles
succès/échec (`grid-story.ts`), restauré au numéro d'origine sur déblocage extra.

Vérifié par tests ciblés (delay exact de 2000ms, ordre des events, basket events
absents sur échec, route finale non affectée) + suite complète 236/236.

**Précision (2026-06-27)** : la catégorie "vert" (`COLOR_ACCENTS.vert`, `index.ts`) et l'état
`is-success` (`quiz-hunt.css`) utilisaient la même couleur `#16a34a` — une tuile verte non jouée
et une tuile résolue avec succès pouvaient donc partager le même fond. **Décision finale de
l'auteur : retirer la couleur de succès.** `is-success` ne fixe plus de `background-color` —
la tuile garde sa couleur de catégorie d'origine (via `--quiz-hunt-accent`), seule la coche `✓`
signale la réussite. Plus de couleur universelle de succès, donc plus aucune collision possible
avec une catégorie.

---

## 4. `game:timer:pause`/`game:timer:stop` jamais routés au strap du minuteur — CORRIGÉ (2026-06-27)

**Trouvé en cherchant le bug du panier ci-dessous** (voir note plus bas — sans rapport avec le
panier, mais réel). `index.ts` (`listen` de la scène) ne câblait que `game:timer:start` et
`game:timer:resume` vers le strap `game-timer` :
```
{ on: "game:timer:start", straps: ["game-timer"] },
{ on: "game:timer:resume", straps: ["game-timer"] },
```
Or `game-router.ts` émet `game:timer:pause` à chaque ouverture d'épreuve à partir de la 2e
(`timerStarted` déjà vrai), et `game-final-route.ts` émet `game:timer:stop`. Ces deux events
n'avaient **aucune règle `listen`** : ils étaient dispatchés sans qu'aucun strap ne les reçoive.
Conséquence réelle : à partir de la 2e épreuve, `game-timer.ts` ne recalculait jamais le temps
restant ni n'annulait le minuteur d'expiration en cours sur `pause` — le minuteur continuait de
tourner en tâche de fond pendant que la grille était affichée, et `tween:stop` n'était jamais
émis (jauge/texte figés visuellement, mais le minuteur sous-jacent dérivait).

**Fix** : ajout de `{ on: "game:timer:pause", straps: ["game-timer"] }` et
`{ on: "game:timer:stop", straps: ["game-timer"] }` au `listen` de la scène (`index.ts`). Le
strap `game-timer.ts` lui-même n'a pas changé — ses branches `pause`/`stop` existaient déjà et
étaient testées isolément hier, mais jamais atteintes en jeu réel faute de câblage.

Vérifié : suite complète 236/236 (pas de test ciblé supplémentaire — branches déjà couvertes
par les tests du strap lui-même, seul le câblage manquait).

---

## Investigation du 2026-06-27 : "la 3e réponse correcte ne s'écrit pas dans le panier"

Signalé : 3 épreuves de couleurs différentes, 1ère réussie (ajoutée au panier), 2e ratée, 3e
réussie mais absente du panier.

**Non reproduit.** Test d'intégration bout-en-bout (vrai `Player`+`BuilderFacade`, contenu et
seed réels de la démo, horloge simulée déterministe via `vi.useFakeTimers`) rejouant exactement
cette séquence (succès/échec/succès sur 3 couleurs différentes) : le panier contient
systématiquement les deux mots réussis, sur 5 exécutions consécutives. Une première version du
test avec une vraie horloge (`setTimeout` réel) montrait un résultat **non déterministe** (tantôt
la 1ère, tantôt la 3e manquait) — mais cette variation venait de la marge de minuterie du test
lui-même (attente de 2200 ms pile au-dessus du délai de 2000 ms de `game-trial-resolve.ts`), pas
du code de la démo : avec une horloge déterministe, le même scénario est stable.

**Hypothèse non écartée** : un écart de timing similaire pourrait exister dans un vrai navigateur
si le joueur valide une épreuve très peu de temps après que la grille soit redevenue cliquable
(juste après les 2 secondes de `game-trial-resolve.ts`) — mais en jeu réel, le délai de révélation
de la question (3 secondes, `game-router.ts`) s'ajoute toujours avant de pouvoir valider une
nouvelle épreuve, ce qui donne une marge bien plus confortable que dans le test instrumenté.

**À faire avant de conclure** : rejouer le scénario exact dans le navigateur (`/run`) en notant
précisément où l'écriture manque (case du panier ? tuile de la grille ? autre ?) et si possible
le délai réel entre la validation de la 2e et celle de la 3e épreuve.

---

## Pistes non encore explorées

Audit interrompu avant de couvrir : flux final/résultat (`game-final-route.ts`,
`game-result.ts`), déterminisme de la graine (`seed.ts`/`deriveGameDraw`), cas
limites du panier. À reprendre si besoin.
