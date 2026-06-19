# Plan : jeu de quiz géographie — architecture scène et stories

## Statut
En attente de validation avant implémentation.

## Contraintes

- Extension de la démo `quiz-series` — réutilise ses types et straps sans modification.
- Aucune modification des specs CodPlay ni de sa structure interne.
- Démontre que les fonctionnalités existantes couvrent le besoin.
- Tout élément variable est paramétrable via `GameConfig` (voir §Paramétrage).
- Si un gap CodPlay est détecté, il est signalé avant toute implémentation.

---

## Vue d'ensemble

### Zones de l'écran

```
┌─────────────────────────────────────────────────┐
│  ZONE PRINCIPALE (épreuve ou grille)            │
│                                                 │
├──────────────────────┬──────────────────────────┤
│  PANIER (4 couleurs) │  TIMER                   │
└──────────────────────┴──────────────────────────┘
```

### Phases du jeu

```
init → grille → épreuve (×n) → finale → résultat
              ↑______________|  (retour grille après épreuve)
```

---

## Stories

### 1. `game-shell-story` — coquille principale

**Rôle** : layout avec les trois zones.

- `data-part="game:zone:main"` — épreuve active ou grille
- `data-part="game:zone:basket"` — panier 4 couleurs
- `data-part="game:zone:timer"` — timer

Montée en rootStory. Les autres stories s'injectent via `move: { parentId }`.

---

### 2. `game-grid-story` — grille des 16 tuiles

**Rôle** : afficher les tuiles et router les clics vers le contrôleur.

16 persos tuile, un par épreuve :
```ts
emit: { click: { event: { name: 'game:trial:open' }, data: { trialId } } }
```

Chaque tuile réagit aux événements :
- `game:trial:success:{ trialId }` → visuel succès (couleur pleine)
- `game:trial:fail:{ trialId }` → visuel échec (grisé, plus cliquable)
- `game:trial:unlocked:{ trialId }` → visuel restauré (via extra)

Montée dans `game:zone:main` au démarrage. Cachée/montrée via `style.display`.

---

### 3. `game-basket-story` — panier des 4 couleurs

**Rôle** : afficher les mots collectés, débloquer la finale quand les 4 couleurs sont remplies.

4 slots de couleur, chacun affichant le mot trouvé (vide initialement).

Réagit à :
- `game:word:collected { color, wordId, wordLabel }` → remplit le slot de la couleur

Affiche un bouton "Épreuve finale" caché initialement :
```ts
emit: { click: { event: { name: 'game:final:start' } } }
actions: { 'game:basket:complete': { style: { display: 'block' } } }
```

---

### 4. `game-timer-story` — timer avec tween

**Rôle** : décompte visuel, pause/reprise, émission d'expiration.

Pattern identique à `chrono-story`, **straps embarqués** dans la story.

Interface d'événements :
| Événement entrant | Effet |
|---|---|
| `game:timer:start { durationMs }` | Lance le tween (aiguille + affichage) |
| `game:timer:pause` | `tween:stop` — fige la position |
| `game:timer:resume { remainingMs }` | Relance depuis `remainingMs` |
| `game:timer:stop` | `tween:stop` + masque |

Le tween de fin émet `game:timer:expired` via un planned event à `durationMs`.

> **Note** : pause/resume repose sur le suivi de `timerRemainingMs` dans l'état scène
> (le contrôleur émet `game:timer:resume { remainingMs: state.timerRemainingMs }`).
> Aucune modification de CodPlay requise.

---

### 5. `game-trial-{id}-story` — 16 stories d'épreuves

**Rôle** : afficher et conduire une épreuve. Une story par épreuve, identifiant stable.

Montée dans `game:zone:main` à l'activation (via `move` ou `show/hide`).

#### Type quiz

Réutilise `quiz-question-scene` infrastructure :
- Straps `quizQuestionStraps` embarqués dans la story
- Émet `quiz:question:answered` → le contrôleur traduit en `game:trial:done`

#### Type lecture/vidéo

À l'entrée dans la story (via un strap déclenché sur `game:trial:open`) :
```ts
events: [{ name: 'game:timer:pause' }]
```

À la fin (bouton "Continuer") :
```ts
events: [
  { name: 'game:trial:done', data: { trialId, success: true, wordId, color } },
  { name: 'game:timer:resume', data: { remainingMs: ... } }
]
```

#### Extra dans une trial lecture

Si cette trial est désignée pour contenir un extra (décidé par PRNG à l'init) :
- Strap de la trial utilise `context.planned.delay(extraOffsetMs)` pour émettre
  `game:extra:show { label }` à un moment précis de la lecture.
- Après `extraDurationMs` : `game:extra:hide` (via `context.planned.delay`).

> **Gap potentiel à vérifier** : `context.planned.delay` est spécifié dans
> `v1-strap-helpers-spec.md`. S'il n'est pas encore disponible dans le runner de
> straps des stories embarquées, signaler avant d'implémenter.

---

### 6. `game-extra-story` — jeton de rattrapage

**Rôle** : afficher un élément cliquable temporaire pendant une trial lecture.

- Caché initialement (`display: none`).
- `game:extra:show { label }` → visible avec animation.
- `game:extra:hide` → masqué.
- Clic → `game:extra:collect`.
- Un seul par session (le contrôleur ignore les collectes suivantes).

---

### 7. `game-final-story` — épreuve finale

**Rôle** : une question quiz tirée parmi les mots collectés, hors timer.

Réutilise `quiz-question-scene` infrastructure.

**Décision ouverte** : comment la question est-elle choisie ?
- Option A : 4 stories finales pré-construites (une par couleur), seule la bonne est montrée.
- Option B : une seule story finale, la question est injectée via state update au déclenchement.

> Option A est la plus sûre avec CodPlay actuel (state injecté au build, pas à runtime).
> Option B nécessite de vérifier si `state update` depuis un strap scène peut modifier
> `state.question` d'une story. **À trancher avant implémentation.**

Émet `game:final:done { isCorrect }`.

---

### 8. `game-result-story` — écran de résultat

**Rôle** : afficher le bilan final.

Réagit à `game:result:show { passed, basket, timerUsedMs }`.

---

## Événements — vocabulaire

| Événement | Émis par | Capté par |
|---|---|---|
| `game:trial:open { trialId }` | tuile (grille) | contrôleur scène |
| `game:trial:done { trialId, success, wordId, color }` | story épreuve | contrôleur scène |
| `game:word:collected { color, wordId, wordLabel }` | contrôleur | basket story |
| `game:basket:complete` | contrôleur | basket story (affiche bouton) |
| `game:trial:success { trialId }` | contrôleur | grille (tuile verte) |
| `game:trial:fail { trialId }` | contrôleur | grille (tuile grisée) |
| `game:trial:unlocked { trialId }` | contrôleur | grille (tuile restaurée) |
| `game:extra:show { label }` | trial lecture (planned) | extra story |
| `game:extra:hide` | trial lecture (planned) | extra story |
| `game:extra:collect` | extra story (clic) | contrôleur |
| `game:timer:start { durationMs }` | contrôleur | timer story |
| `game:timer:pause` | contrôleur | timer story |
| `game:timer:resume { remainingMs }` | contrôleur | timer story |
| `game:timer:stop` | contrôleur | timer story |
| `game:timer:expired` | timer story (planned) | contrôleur |
| `game:final:start` | panier (bouton) | contrôleur |
| `game:final:done { isCorrect }` | final story | contrôleur |
| `game:result:show { ... }` | contrôleur | result story |

---

## État scène (contrôleur)

```ts
{
  phase: 'idle' | 'grid' | 'trial' | 'final' | 'result',
  currentTrialId: string | null,
  trialStatus: Record<string, 'available' | 'success' | 'fail'>,
  basket: Record<string, { wordId: string; wordLabel: string } | null>,
  extraToken: boolean,         // joueur possède un jeton ?
  extraConsumedOn: string | null,  // trialId sur lequel il est utilisé
  timerRemainingMs: number,    // mis à jour à chaque pause
  timerStarted: boolean,
  seed: number
}
```

---

## Straps scène — contrôleur

```
game-router         écoute game:trial:open
                    → vérifie phase, statut tuile, jeton si nécessaire
                    → émet game:timer:start (1er accès) ou game:timer:pause (lecture)
                    → affiche story épreuve, cache grille

game-trial-done     écoute game:trial:done
                    → met à jour trialStatus, panier
                    → émet game:trial:success ou game:trial:fail
                    → si word collecté : game:word:collected
                    → si 4 couleurs remplies : game:basket:complete
                    → retour grille

game-extra-collect  écoute game:extra:collect
                    → stocke extraToken = true dans l'état

game-timer-track    écoute game:timer:pause
                    → calcule et stocke timerRemainingMs

game-final-route    écoute game:final:start
                    → vérifie que les 4 couleurs sont remplies
                    → émet game:timer:stop
                    → affiche final story (choix de la question : décision ouverte)

game-result         écoute game:final:done + game:timer:expired
                    → calcule résultat
                    → émet game:result:show
```

---

## Paramétrage (GameConfig)

```ts
type GameConfig = {
  timerTotalMs: number         // durée totale phase épreuves
  extraDurationMs: number      // durée d'affichage du jeton extra
  seed: number                 // graine PRNG reproductible
  colors: string[]             // ['rouge', 'bleu', 'vert', 'jaune']
  trials: TrialConfig[]        // 16 entrées externalisées
  labels: GameLabels           // textes localisables
}

type TrialConfig = {
  id: string
  color: string                // quelle couleur cible
  wordId: string
  wordLabel: string            // le mot à collecter
  type: 'quiz' | 'reading' | 'video'
  content: QuizTrialContent | ReadingTrialContent | VideoTrialContent
}
```

La distribution aléatoire des tuiles sur la grille est calculée au build via un PRNG seeded (Mulberry32 — pure JS, couche démo). Idem pour le choix de la trial qui cache l'extra et son offset temporel.

---

## Réutilisation de l'infrastructure existante

| Élément existant | Réutilisation |
|---|---|
| `ResolvedQuizQuestion`, `QuizAnswer`, `QuizQuestionStoryConfig` | Types pour les trials quiz et la finale |
| `quizQuestionStraps` | Embarqués dans chaque trial quiz-story |
| Pattern `container + slot` (quiz-series) | Montage/démontage des stories d'épreuves |
| Pattern `progress-story` (quiz-series) | Panier (à adapter aux 4 couleurs) |
| Pattern `chrono-story` | Timer story (tween + pause/stop) |
| Pattern story auto-suffisante (straps embarqués) | Timer story, trials |

---

## Points ouverts — à trancher avant implémentation

1. **`context.planned.delay` dans story straps** : disponible dans le runner actuel ?
   Requis pour l'extra temporisé dans les trials lecture. Vérifier avant d'implémenter.

2. **Question finale — choix à runtime** : Option A (4 stories pré-construites) ou Option B
   (state update vers une story existante) ? Option A est sûre, Option B est plus élégante
   mais nécessite validation.

3. **Timer tracking à la pause** : le contrôleur doit connaître `timerRemainingMs` au moment
   de la pause. Solution proposée : le contrôleur calcule `now - startTime` à la réception
   de `game:timer:pause`. Confirmer que le state scène peut stocker cette valeur fiablement.

4. **Distribution PRNG** : confirmer que la logique PRNG dans la couche authoring (JS pur,
   pas dans CodPlay) est le bon choix. La graine est un paramètre de `GameConfig`.
