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

### 1. `game-layout-story` — structure principale

**Rôle** : layout avec les trois zones.

- `data-part="game:zone:main"` — épreuve active ou grille
- `data-part="game:zone:basket"` — panier 4 couleurs
- `data-part="game:zone:timer"` — timer

Montée en rootStory. Les autres stories s'y injectent via `move: { parentId }`.

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

#### Types d'épreuves

| Type | Description |
|---|---|
| `vf-series` | Série de 3–4 questions vrai/faux en séquence → verdict gagné/perdu |
| `single` | Une question à réponse unique |
| `multiple` | Une question à réponses multiples |
| `reading+quiz` | Texte à lire, puis une question (single ou multiple) |
| `video+quiz` | Vidéo à regarder (timer pausé), puis une question |
| `minigame` | À définir ultérieurement |

Pas de réponse ouverte.

#### Épreuves quiz (`vf-series`, `single`, `multiple`)

Réutilise `quiz-question-scene` infrastructure — straps `quizQuestionStraps` embarqués dans la story.

**`vf-series`** : enchaîne 3–4 questions booléennes (pattern quiz-series réduit). Le verdict final (`game:trial:done { success }`) est calculé à l'issue des N questions. Le seuil de réussite est un paramètre de la trial (`threshold`, ex. toutes correctes ou majorité).

**`single` / `multiple`** : une seule question, résolution immédiate.

Dans tous les cas : émet `game:trial:done { trialId, success, wordId, color }`.

#### Épreuves média (`reading+quiz`, `video+quiz`)

À l'entrée dans la story (strap déclenché sur `game:trial:open`) :
```ts
events: [{ name: 'game:timer:pause' }]
```

Phase média (lecture ou vidéo) → bouton "Continuer" → phase question (single ou multiple).

À l'issue de la question :
```ts
events: [
  { name: 'game:trial:done', data: { trialId, success, wordId, color } },
  { name: 'game:timer:resume', data: { remainingMs: ... } }
]
```

La phase lecture est toujours gagnante si aucune question ne suit — mais dans ce jeu toutes les épreuves lecture/vidéo ont une question.

#### Extra dans une trial lecture

Si cette trial est désignée pour contenir un extra (déterminé par la graine à la création de la scène) :
- Le strap de la trial utilise `context.planned.delay(extraOffsetMs)` pour émettre
  `game:extra:show { label }` au bon moment.
- Après `extraDurationMs` : `game:extra:hide` (second `context.planned.delay` enchaîné).

`context.planned` est le bon outil ici — tout est résolu à l'init de la scène, sans dépendance à des événements futurs.

---

### 6. `game-extra-story` — jeton de rattrapage

**Rôle** : afficher un élément cliquable temporaire pendant une trial lecture.

- Caché initialement (`display: none`).
- `game:extra:show { label }` → visible avec animation.
- `game:extra:hide` → masqué.
- Clic → `game:extra:collect`.
- Un seul par session (le contrôleur ignore les collectes suivantes).

---

### 7. `game-final-{wordId}-story` — épreuve finale (×16)

**Rôle** : une question quiz pour un mot donné, hors timer.

16 stories pré-construites à la création de la scène (une par mot/question possible), toutes cachées initialement. Réutilise `quiz-question-scene` infrastructure.

**Sélection de la question** : la graine détermine à la création quelle couleur fournira la question finale (ex. `couleurFinale = colors[seededRandom() % 4]`). À l'init du jeu on ne sait pas encore quel mot occupera ce slot — c'est le joueur qui le détermine en jouant. Quand `game:final:start` est émis, le contrôleur lit `basket[couleurFinale].wordId` et affiche la story correspondante.

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

game-report         écoute game:result:show (side-effect strap)
                    → envoie les résultats de la partie (score, panier, temps, seed)
                    → V1 démo : console.log — sera remplacé par un fetch réel en production
```

---

## Paramétrage (GameConfig)

```ts
type GameConfig = {
  timerTotalMs: number         // durée totale phase épreuves
  extraDurationMs: number      // durée d'affichage du jeton extra
  seed: number                 // valeur de départ du tirage aléatoire
  showCorrection: boolean      // révéler la bonne réponse en cas de faute (défaut : false)
  colors: string[]             // ['rouge', 'bleu', 'vert', 'jaune']
  trials: TrialConfig[]        // 16 entrées externalisées
  labels: GameLabels           // textes localisables
}

type TrialType = 'vf-series' | 'single' | 'multiple' | 'reading+quiz' | 'video+quiz' | 'minigame'

type TrialConfig = {
  id: string
  color: string                // couleur cible
  wordId: string
  wordLabel: string            // le mot à collecter
  type: TrialType
  showCorrection?: boolean     // surcharge du paramètre scène pour cette trial
  threshold?: number           // vf-series : nombre de bonnes réponses pour réussir
  content: VfSeriesContent | SingleQuizContent | MultipleQuizContent
           | ReadingQuizContent | VideoQuizContent
}
```

Une unique valeur `seed` par partie contrôle **tous** les aléatoires, dans cet ordre de consommation :
1. Distribution des 16 tuiles sur la grille (mélange par couleur)
2. Choix de la trial qui cache l'extra
3. Offset temporel d'apparition de l'extra
4. Couleur source de la question finale

La même `seed` produit exactement la même partie — indispensable pour les tests. Cette logique est une simple fonction dans le code de la démo, le générateur est réinitialisé depuis `seed` à chaque appel de `createGameScene()`. CodPlay n'en a pas connaissance.

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

## Structure du projet

```
packages/demos/src/scenes/geo-quiz/
│
├── index.ts                        — createGeoQuizScene(config) : SceneDoc
│                                     assemble stories + straps + seed
│
├── types.ts                        — GameConfig, TrialConfig, TrialType, GameLabels…
│
├── seed.ts                         — utilitaire PRNG (Mulberry32), pur JS
│
├── stories/
│   ├── layout-story.ts             — structure principale (3 zones)
│   ├── grid-story.ts               — grille 16 tuiles
│   ├── basket-story.ts             — panier 4 couleurs
│   ├── timer-story.ts              — timer (straps embarqués)
│   ├── extra-story.ts              — jeton de rattrapage
│   ├── result-story.ts             — écran de résultat
│   ├── final-story.ts              — builder : createFinalStory(question)
│   └── trials/
│       ├── build-vf-series.ts      — builder : createVfSeriesTrial(config)
│       ├── build-single.ts         — builder : createSingleTrial(config)
│       ├── build-multiple.ts       — builder : createMultipleTrial(config)
│       ├── build-reading-quiz.ts   — builder : createReadingQuizTrial(config)
│       └── build-video-quiz.ts     — builder : createVideoQuizTrial(config)
│
├── straps/
│   ├── game-router.ts              — game:trial:open
│   ├── game-trial-done.ts          — game:trial:done
│   ├── game-extra-collect.ts       — game:extra:collect
│   ├── game-timer-track.ts         — game:timer:pause (stocke remainingMs)
│   ├── game-final-route.ts         — game:final:start
│   ├── game-result.ts              — game:final:done + game:timer:expired
│   ├── game-report.ts              — side-effect : console.log (→ fetch en prod)
│   └── index.ts                    — export gameStraps : StrapCollection
│
└── assets/
    ├── texts/                      — contenus lecture (markdown ou HTML)
    ├── videos/                     — références vidéo
    └── questions/                  — contenu des questions par wordId
```

**Règle** : `index.ts` est le seul fichier qui importe à la fois `stories/` et `straps/`. Les builders de stories ne connaissent pas les straps scène, et vice-versa.

---

## Décisions arrêtées

1. **`context.planned.delay`** : confirmé comme outil pour l'extra temporisé. `context.live` écarté — tout doit être résolu à l'init de la scène.

2. **Question finale** : 16 stories pré-construites (une par mot). La couleur source est tirée par la graine à la création ; le mot effectif est lu dans le panier au déclenchement de la finale. Le contrôleur affiche la story du mot collecté pour cette couleur.

3. **Timer tracking** : le contrôleur stocke `timerRemainingMs` dans l'état scène et le passe en paramètre de `game:timer:resume`. Validé.

4. **Tirage aléatoire** : calculé dans le code de création de la scène à partir de `seed` (avant l'init CodPlay). Validé.
